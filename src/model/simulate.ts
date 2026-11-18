/**
 * Simulation driver: combines instantaneous (steady-state) haemodynamics with
 * time-stepped creatinine/urea kinetics. Pure TS, no UI imports.
 */
import { clearances, stepBiochem, steadyState, type BiochemState, type Clearances } from './biochem';
import { ckdEpi2021 } from './egfr';
import { solveHaemodynamics, type HaemodynamicResult } from './glomerulus';
import { defaultConstants, defaultInputs, type ModelConstants, type ModelInputs } from './parameters';
import { computeEffects, type Effects } from './pharmacology';
import { computeTubule, type TubuleResult } from './tubule';

export interface Snapshot {
  t: number; // hours
  haemo: HaemodynamicResult;
  clearances: Clearances;
  creatinine: number; // µmol/L
  urea: number; // mmol/L
  /** CKD-EPI 2021 from the CURRENT simulated creatinine, mL/min/1.73 m². */
  egfr: number;
  /** True GFR, mL/min (absolute, not BSA-indexed). */
  trueGfr: number;
  /** Values creatinine/urea are heading towards if inputs stay fixed. */
  steadyCreatinine: number;
  steadyUrea: number;
  /** Extracellular fluid volume, L, and its change from euvolaemia as a percentage. */
  ecfVolume: number;
  volumePercent: number;
  /** Volume status, hormone and drug effects (Phase 3). */
  effects: Effects;
  /** Illustrative tubular outputs (Phase 3). */
  tubule: TubuleResult;
}

const baselineGfrCache = new WeakMap<ModelConstants, number>();
/** Whole-kidney GFR at default inputs, euvolaemic — the reference for the urea low-flow term. */
export function baselineGfr(c: ModelConstants): number {
  let v = baselineGfrCache.get(c);
  if (v === undefined) {
    v = solveHaemodynamics(defaultInputs(), c).gfr;
    baselineGfrCache.set(c, v);
  }
  return v;
}

type Evaluation = {
  haemo: HaemodynamicResult;
  cl: Clearances;
  ss: { creatinine: number; urea: number };
  effects: Effects;
  /** Inputs after volume linkage (MAP and ADH may differ from the sliders). */
  effInputs: ModelInputs;
};

/** Single-entry memo: inputs are usually unchanged between time steps, and a solve costs a few ms. */
let memo: { key: string; c: ModelConstants; value: Evaluation } | undefined;

export function evaluate(inp: ModelInputs, c: ModelConstants, ecfVolume = c.ecfVolume0): Evaluation {
  // Volume moves by microlitres between animation frames; quantising the cache key to
  // 0.1 mL turns 60 solves a second into one per meaningful change.
  const key = JSON.stringify([inp, Math.round(ecfVolume * 1e4)]);
  if (memo && memo.key === key && memo.c === c) return memo.value;
  const effects = computeEffects(inp, c, ecfVolume);
  // Volume linkage changes the pressure reaching the kidney and the ADH level.
  const effInputs: ModelInputs = { ...inp, map: effects.map, adh: effects.adhEffective };
  const haemo = solveHaemodynamics(effInputs, c, effects.mods);
  const cl = clearances(haemo.gfr, baselineGfr(c), effInputs, c);
  const value = { haemo, cl, ss: steadyState(cl, effInputs), effects, effInputs };
  memo = { key, c, value };
  return value;
}

/**
 * Steady-state initial condition for given inputs, at a chosen volume
 * (euvolaemia unless a scenario starts the patient volume-depleted or overloaded).
 */
export function initialState(inp: ModelInputs, c: ModelConstants, volumePercent = 0): BiochemState {
  const ecfVolume = c.ecfVolume0 * (1 + volumePercent / 100);
  const { ss } = evaluate(inp, c, ecfVolume);
  return { t: 0, creatinine: ss.creatinine, urea: ss.urea, ecfVolume };
}

export function snapshot(state: BiochemState, inp: ModelInputs, c: ModelConstants): Snapshot {
  const { haemo, cl, ss, effects, effInputs } = evaluate(inp, c, state.ecfVolume);
  const ureaExcretionPerDay = (cl.urea / 1000) * state.urea * 1440;
  return {
    t: state.t,
    haemo,
    clearances: cl,
    creatinine: state.creatinine,
    urea: state.urea,
    egfr: ckdEpi2021(state.creatinine, inp.age, inp.sex),
    trueGfr: haemo.gfr,
    steadyCreatinine: ss.creatinine,
    steadyUrea: ss.urea,
    ecfVolume: state.ecfVolume,
    volumePercent: ((state.ecfVolume - c.ecfVolume0) / c.ecfVolume0) * 100,
    effects,
    tubule: computeTubule(haemo.gfr, ureaExcretionPerDay, baselineGfr(c), effects, effInputs, c),
  };
}

/**
 * Advance `duration` hours using step `dt`. Haemodynamics are re-solved each
 * step via `inputsAt(t)` so time-varying input schedules are supported.
 */
export function run(
  start: BiochemState,
  inputsAt: (t: number) => ModelInputs,
  duration: number,
  dt: number,
  c: ModelConstants = defaultConstants(),
  record = true,
): { final: BiochemState; trace: Snapshot[] } {
  let s = start;
  const trace: Snapshot[] = [];
  const n = Math.round(duration / dt);
  for (let i = 0; i < n; i++) {
    const inp = inputsAt(s.t);
    const { cl, effects, effInputs, haemo } = evaluate(inp, c, s.ecfVolume);
    if (record) trace.push(snapshot(s, inp, c));
    const na = computeTubule(haemo.gfr, (cl.urea / 1000) * s.urea * 1440, baselineGfr(c), effects, effInputs, c).excretedNa;
    s = stepBiochem(s, cl, inp, c, dt, na);
  }
  if (record) trace.push(snapshot(s, inputsAt(s.t), c));
  return { final: s, trace };
}
