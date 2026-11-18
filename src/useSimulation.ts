import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  computeTubule,
  defaultConstants,
  defaultInputs,
  evaluate,
  initialState,
  snapshot,
  stepBiochem,
  type BiochemState,
  type ModelInputs,
  type Snapshot,
} from './model';

export interface TracePoint {
  t: number; // hours
  gfr: number;
  egfr: number;
  creatinine: number;
  urea: number;
  urineVolume: number;
  volumePercent: number;
}

/** Simulated hours per real second at 1×. Creatinine takes days to settle, so a day
 *  passes in about two seconds at 1× and the whole response fits in a sitting. */
export const HOURS_PER_SECOND = 12;
export const SPEEDS = [0.5, 1, 2, 4] as const;
const DT = 0.25; // hours per integration step
const SAMPLE_EVERY = 1; // hours between chart samples
/**
 * Keep the entire run, so a change made on day 7 is still visible on day 30. One sample
 * an hour is ~720 points a month, which uPlot draws without trouble; the cap is only a
 * guard against someone leaving it running for simulated years.
 */
const MAX_TRACE_POINTS = 24 * 400;
const MAX_STEPS_PER_FRAME = 400;
/**
 * React re-renders are throttled to this interval. The physics still integrates every
 * frame; only the repaint is limited, which keeps the diagram and panels cheap. Flow and
 * sparkle animation is pure CSS, so it stays smooth at the display's own frame rate.
 */
const UI_INTERVAL_MS = 70;

const C = defaultConstants();
const BASE_INPUTS = defaultInputs();
const BASE_STATE = initialState(BASE_INPUTS, C);
export const BASELINE: Snapshot = snapshot(BASE_STATE, BASE_INPUTS, C);

function point(s: Snapshot): TracePoint {
  return {
    t: s.t,
    gfr: s.trueGfr,
    egfr: s.egfr,
    creatinine: s.creatinine,
    urea: s.urea,
    urineVolume: s.tubule.urineVolume,
    volumePercent: s.volumePercent,
  };
}

export function useSimulation() {
  const [inputs, setInputsState] = useState<ModelInputs>(BASE_INPUTS);
  const [bio, setBio] = useState<BiochemState>(BASE_STATE);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [trace, setTrace] = useState<TracePoint[]>(() => [point(BASELINE)]);

  const inputsRef = useRef(inputs);
  const bioRef = useRef(bio);
  const traceRef = useRef(trace);
  const nextSample = useRef(SAMPLE_EVERY);
  inputsRef.current = inputs;

  const current = useMemo(() => snapshot(bio, inputs, C), [bio, inputs]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    let carry = 0;
    const tick = (now: number) => {
      const realDt = Math.min(0.1, (now - last) / 1000); // clamp after tab switches
      last = now;
      carry += realDt * HOURS_PER_SECOND * speed;
      let steps = Math.min(MAX_STEPS_PER_FRAME, Math.floor(carry / DT));
      carry -= steps * DT;
      if (steps > 0) {
        const inp = inputsRef.current;
        let s = bioRef.current;
        let tr = traceRef.current;
        let appended = false;
        // Haemodynamics are re-solved once per frame; within the frame only the
        // slow pools (creatinine, urea, volume) are integrated.
        const { cl, effects, effInputs, haemo } = evaluate(inp, C, s.ecfVolume);
        const naExcretion = computeTubule(haemo.gfr, (cl.urea / 1000) * s.urea * 1440, haemo.gfr, effects, effInputs, C).excretedNa;
        while (steps-- > 0) {
          s = stepBiochem(s, cl, inp, C, DT, naExcretion);
          if (s.t >= nextSample.current - 1e-9) {
            nextSample.current += SAMPLE_EVERY;
            if (!appended) {
              tr = tr.slice();
              appended = true;
            }
            tr.push(point(snapshot(s, inp, C)));
          }
        }
        if (appended) {
          if (tr.length > MAX_TRACE_POINTS) tr = tr.slice(tr.length - MAX_TRACE_POINTS);
          traceRef.current = tr;
        }
        bioRef.current = s;
        if (now - lastUi >= UI_INTERVAL_MS) {
          lastUi = now;
          if (appended) setTrace(traceRef.current);
          setBio(s);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  const setInputs = useCallback((patch: Partial<ModelInputs>) => {
    setInputsState((prev) => ({ ...prev, ...patch }));
  }, []);

  /** Set extracellular volume directly (the volume-status control). */
  const setVolumePercent = useCallback((pct: number) => {
    setBio((prev) => {
      const next = { ...prev, ecfVolume: C.ecfVolume0 * (1 + pct / 100) };
      bioRef.current = next;
      return next;
    });
  }, []);

  /**
   * Zero the day counter and clear the chart, keeping the current physiology exactly as
   * it is. Useful once a run has gone on for weeks and the interesting part has scrolled
   * past: it does not reset the patient, only the clock.
   */
  const restartClock = useCallback(() => {
    setBio((prev) => {
      const next = { ...prev, t: 0 };
      bioRef.current = next;
      nextSample.current = SAMPLE_EVERY;
      traceRef.current = [point(snapshot(next, inputsRef.current, C))];
      setTrace(traceRef.current);
      return next;
    });
  }, []);

  /**
   * Full reset: day 0, healthy blood chemistry, then the scenario's physiology applied on
   * top. Creatinine and urea deliberately start at their HEALTHY values rather than at the
   * steady state of the new inputs — otherwise a scenario opens with creatinine already
   * elevated and a flat line, hiding the very deterioration it is meant to teach. Volume is
   * the exception: it starts where the scenario says, because that is the acute insult.
   */
  const restart = useCallback((patch: Partial<ModelInputs> = {}, volumePercent = 0) => {
    const next = { ...BASE_INPUTS, ...patch };
    const state: BiochemState = {
      t: 0,
      creatinine: BASE_STATE.creatinine,
      urea: BASE_STATE.urea,
      ecfVolume: C.ecfVolume0 * (1 + volumePercent / 100),
    };
    bioRef.current = state;
    traceRef.current = [point(snapshot(state, next, C))];
    nextSample.current = SAMPLE_EVERY;
    setBio(state);
    setTrace(traceRef.current);
    setInputsState(next);
  }, []);

  return { inputs, setInputs, setVolumePercent, restart, restartClock, current, trace, running, setRunning, speed, setSpeed, baseline: BASELINE };
}
