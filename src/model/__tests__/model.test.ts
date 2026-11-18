import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_RANGES,
  calibrate,
  ckdEpi2021,
  INPUT_DEFS,
  defaultConstants,
  defaultInputs,
  direction,
  formatValue,
  initialState,
  integrateCapillary,
  oncoticPressure,
  run,
  snapshot,
  solveHaemodynamics,
  type ModelInputs,
} from '../index';

const c = defaultConstants();
const base = defaultInputs();
const solve = (patch: Partial<ModelInputs> = {}) => solveHaemodynamics({ ...base, ...patch }, c);
const open = (patch: Partial<ModelInputs> = {}) => solve({ autoregulation: false, ...patch });
const inRange = (x: number, [lo, hi]: readonly [number, number]) => {
  expect(x).toBeGreaterThanOrEqual(lo);
  expect(x).toBeLessThanOrEqual(hi);
};

describe('baseline calibration (healthy adult)', () => {
  const h = solve();
  const s = snapshot(initialState(base, c), base, c);
  it('GFR 100–120 mL/min', () => inRange(h.gfr, CALIBRATION_RANGES.gfr));
  it('RPF 550–700 mL/min', () => inRange(h.rpf, CALIBRATION_RANGES.rpf));
  it('filtration fraction 0.17–0.22', () => inRange(h.filtrationFraction, CALIBRATION_RANGES.filtrationFraction));
  it('P_GC 45–55 mmHg', () => inRange(h.pgc, CALIBRATION_RANGES.pgc));
  it("Bowman's pressure 10–15 mmHg", () => inRange(h.pbs, CALIBRATION_RANGES.pbs));
  it('afferent oncotic pressure 25–28 mmHg', () => inRange(h.capillary.piAfferent, CALIBRATION_RANGES.piAfferent));
  it('plasma creatinine 60–90 µmol/L', () => inRange(s.creatinine, CALIBRATION_RANGES.creatinine));
  it('plasma urea 3–8 mmol/L', () => inRange(s.urea, CALIBRATION_RANGES.urea));
  it('~1 million nephrons per kidney (2 million total)', () => expect(h.nephronsTotal).toBe(2e6));
  it('autoregulation is neutral at baseline', () => {
    expect(h.myogenicFactor).toBeCloseTo(1, 6);
    expect(h.tgfFactor).toBeCloseTo(1, 4);
    expect(h.gfr).toBeCloseTo(open().gfr, 2);
  });
});

describe('Landis–Pappenheimer', () => {
  it('matches the polynomial', () => {
    expect(oncoticPressure(7)).toBeCloseTo(2.1 * 7 + 0.16 * 49 + 0.009 * 343, 10);
    expect(oncoticPressure(0)).toBe(0);
  });
});

describe('mass balance', () => {
  it('whole-kidney GFR = SNGFR × nephron number', () => {
    for (const n of [0.3, 0.7, 1, 1.4]) {
      const h = solve({ nephronsPerKidney: n });
      expect(h.gfr).toBeCloseTo((h.sngfr * h.nephronsTotal) / 1e6, 9);
    }
  });
  it('filtered volume = afferent − efferent plasma flow; protein conserved', () => {
    const h = solve();
    expect(h.sngfr).toBeCloseTo(h.snPlasmaFlow - h.capillary.qEfferent, 9);
    // Efferent oncotic pressure corresponds to C_A·Q_A/Q_E
    const cE = (base.plasmaProtein * h.snPlasmaFlow) / h.capillary.qEfferent;
    expect(h.capillary.piEfferent).toBeCloseTo(oncoticPressure(cE), 9);
  });
  it('mean NFP × Kf = SNGFR', () => {
    const h = solve();
    expect(h.capillary.nfpMean * h.kfEffective).toBeCloseTo(h.sngfr, 6);
  });
  it('capillary integration converges with segment count (<0.5% at 100 vs 1000)', () => {
    const coarse = integrateCapillary(300, 7, 54, 12, 4.9, 100).sngfr;
    const fine = integrateCapillary(300, 7, 54, 12, 4.9, 1000).sngfr;
    expect(Math.abs(coarse - fine) / fine).toBeLessThan(0.005);
  });
  it('never filters when P_GC − P_BS ≤ π_A, and Q stays positive', () => {
    const r = integrateCapillary(300, 7, 30, 12, 4.9, 100);
    expect(r.sngfr).toBe(0);
    const big = integrateCapillary(300, 7, 200, 0, 1e4, 100);
    expect(big.qEfferent).toBeGreaterThan(0);
  });
});

describe('filtration pressure equilibrium', () => {
  it('very high Kf reaches equilibrium and GFR becomes plasma-flow limited', () => {
    const k5 = open({ kfMult: 5 });
    const k10 = open({ kfMult: 10 });
    expect(k5.capillary.equilibrium).toBe(true);
    expect(k5.capillary.nfpEfferent).toBeLessThan(0.25);
    // Doubling Kf beyond equilibrium barely changes GFR (<2%)
    expect(Math.abs(k10.gfr - k5.gfr) / k5.gfr).toBeLessThan(0.02);
    // ...but at equilibrium GFR rises with plasma flow (afferent dilation at fixed P_GC is not
    // separable here, so compare plasma flow via haematocrit-independent check):
    const r1 = integrateCapillary(300, 7, 54, 12, 50, 200).sngfr;
    const r2 = integrateCapillary(600, 7, 54, 12, 50, 200).sngfr;
    expect(r2 / r1).toBeGreaterThan(1.9);
  });
  it('baseline is in filtration disequilibrium (NFP > 0 at efferent end)', () => {
    expect(solve().capillary.equilibrium).toBe(false);
  });
});

describe('directional responses (open loop, isolates the Starling mechanics)', () => {
  const b = open();
  it('afferent constriction lowers P_GC and GFR', () => {
    const h = open({ afferentMult: 1.3 });
    expect(h.pgc).toBeLessThan(b.pgc);
    expect(h.gfr).toBeLessThan(b.gfr);
  });
  it('efferent dilation lowers P_GC and GFR', () => {
    const h = open({ efferentMult: 0.7 });
    expect(h.pgc).toBeLessThan(b.pgc);
    expect(h.gfr).toBeLessThan(b.gfr);
  });
  it("raising Bowman's pressure lowers GFR", () => {
    expect(open({ bowmanPressure: 20 }).gfr).toBeLessThan(b.gfr);
    expect(solve({ bowmanPressure: 20 }).gfr).toBeLessThan(solve().gfr); // also with autoregulation
  });
  it('raising plasma protein lowers GFR', () => {
    expect(open({ plasmaProtein: 8 }).gfr).toBeLessThan(b.gfr);
  });
  it('lowering Kf lowers GFR', () => {
    expect(open({ kfMult: 0.5 }).gfr).toBeLessThan(b.gfr);
  });
});

describe('biphasic efferent response', () => {
  const sweep = [1, 1.25, 1.5, 2, 3, 4, 6, 8].map((m) => ({ m, h: open({ efferentMult: m }) }));
  const g0 = sweep[0]!.h.gfr;
  it('mild–moderate efferent constriction raises GFR', () => {
    expect(open({ efferentMult: 1.5 }).gfr).toBeGreaterThan(g0 * 1.1);
  });
  it('severe efferent constriction lowers GFR below baseline', () => {
    expect(open({ efferentMult: 6 }).gfr).toBeLessThan(g0 * 0.8);
  });
  it('GFR rises then falls (single interior peak)', () => {
    const gfrs = sweep.map((s) => s.h.gfr);
    const peak = gfrs.indexOf(Math.max(...gfrs));
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(gfrs.length - 1);
    for (let i = 1; i <= peak; i++) expect(gfrs[i]!).toBeGreaterThanOrEqual(gfrs[i - 1]!);
    for (let i = peak + 1; i < gfrs.length; i++) expect(gfrs[i]!).toBeLessThan(gfrs[i - 1]!);
  });
  it('mechanism: P_GC keeps rising while filtration fraction and efferent oncotic pressure rise and RPF falls', () => {
    for (let i = 1; i < sweep.length; i++) {
      const a = sweep[i - 1]!.h;
      const z = sweep[i]!.h;
      expect(z.pgc).toBeGreaterThan(a.pgc);
      expect(z.filtrationFraction).toBeGreaterThan(a.filtrationFraction);
      expect(z.capillary.piEfferent).toBeGreaterThan(a.capillary.piEfferent);
      expect(z.rpf).toBeLessThan(a.rpf);
    }
    expect(open({ efferentMult: 6 }).capillary.equilibrium).toBe(true);
  });
});

describe('autoregulation', () => {
  it('holds GFR and RPF within ±10% across MAP 80–180', () => {
    const b = solve();
    for (let map = 80; map <= 180; map += 10) {
      const h = solve({ map });
      expect(Math.abs(h.gfr - b.gfr) / b.gfr).toBeLessThan(0.1);
      expect(Math.abs(h.rpf - b.rpf) / b.rpf).toBeLessThan(0.1);
      expect(h.autoregSaturated).toBe(false);
    }
  });
  it('is much flatter than the open-loop response', () => {
    const arSpan = solve({ map: 160 }).gfr - solve({ map: 90 }).gfr;
    const olSpan = open({ map: 160 }).gfr - open({ map: 90 }).gfr;
    expect(arSpan).toBeLessThan(olSpan * 0.1);
  });
  it('saturates below the range: GFR falls steeply under MAP 80', () => {
    const h60 = solve({ map: 60 });
    expect(h60.autoregSaturated).toBe(true);
    expect(h60.gfr).toBeLessThan(solve({ map: 80 }).gfr * 0.6);
  });
  it('autoregulated GFR is monotone in MAP', () => {
    let prev = -1;
    for (let map = 40; map <= 200; map += 5) {
      const g = solve({ map }).gfr;
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
  });
});

describe('nephron loss', () => {
  it('fewer nephrons lowers whole-kidney GFR', () => {
    expect(solve({ nephronsPerKidney: 0.5 }).gfr).toBeLessThan(solve().gfr);
    expect(solve({ nephronsPerKidney: 0.5, compensation: false }).gfr).toBeLessThan(solve().gfr);
  });
  it('with compensation, single-nephron GFR rises', () => {
    const b = solve();
    const h = solve({ nephronsPerKidney: 0.5, compensation: true });
    expect(h.sngfr).toBeGreaterThan(b.sngfr * 1.2);
    expect(h.pgc).toBeGreaterThan(b.pgc); // glomerular hypertension
  });
  it('without compensation, single-nephron GFR is unchanged and GFR scales with N', () => {
    const b = solve();
    const h = solve({ nephronsPerKidney: 0.5, compensation: false });
    expect(h.sngfr).toBeCloseTo(b.sngfr, 6);
    expect(h.gfr).toBeCloseTo(b.gfr / 2, 6);
  });
});

describe('biochemistry kinetics', () => {
  // Volume linkage is switched off in these two: with it on, sodium balance keeps
  // moving extracellular volume (and so GFR) during the run, so there is no fixed
  // steady state to compare against. Volume dynamics are tested in phase3.test.ts.
  it('creatinine steady state = production / clearance', () => {
    const inp = { ...base, map: 70, volumeLinked: false };
    const { final } = run(initialState(base, c), () => inp, 24 * 30, 0.5, c, false);
    const s = snapshot(final, inp, c);
    const expected = (inp.creatinineProduction * 1000) / 24 / (s.trueGfr * 0.06);
    expect(Math.abs(final.creatinine - expected) / expected).toBeLessThan(0.005);
  });
  it('urea steady state = generation / (GFR·(1−FR))', () => {
    const inp = { ...base, map: 70, adh: 3, volumeLinked: false };
    const { final } = run(initialState(base, c), () => inp, 24 * 30, 0.5, c, false);
    const s = snapshot(final, inp, c);
    const expected = (inp.proteinIntake * 5.7) / 24 / (s.clearances.urea * 0.06);
    expect(Math.abs(final.urea - expected) / expected).toBeLessThan(0.005);
    expect(s.clearances.urea).toBeCloseTo(s.trueGfr * (1 - s.clearances.ureaFR), 9);
  });
  it('creatinine secretion raises clearance above GFR and lowers steady creatinine', () => {
    const a = snapshot(initialState(base, c), base, c);
    const withSec = { ...base, creatinineSecretion: true };
    const b = snapshot(initialState(withSec, c), withSec, c);
    expect(b.clearances.creatinine).toBeGreaterThan(b.trueGfr);
    expect(b.creatinine).toBeLessThan(a.creatinine);
  });
  it('prerenal state (low MAP, high ADH) raises the urea:creatinine ratio', () => {
    const b = snapshot(initialState(base, c), base, c);
    const pre = { ...base, map: 65, adh: 4 };
    const p = snapshot(initialState(pre, c), pre, c);
    expect(p.clearances.ureaFR).toBeGreaterThan(b.clearances.ureaFR);
    expect(p.urea / p.creatinine).toBeGreaterThan((b.urea / b.creatinine) * 1.3);
  });
  it('time-step independence: halving dt changes results by <1%', () => {
    // Non-steady scenario with an input schedule: hypotension for 24 h, then recovery.
    const sched = (t: number): ModelInputs => (t < 24 ? { ...base, map: 65, adh: 3 } : base);
    const a = run(initialState(base, c), sched, 72, 1.0, c, false).final;
    const b = run(initialState(base, c), sched, 72, 0.5, c, false).final;
    expect(Math.abs(a.creatinine - b.creatinine) / b.creatinine).toBeLessThan(0.01);
    expect(Math.abs(a.urea - b.urea) / b.urea).toBeLessThan(0.01);
  });
  it('eGFR lags true GFR after an acute fall (non-steady state)', () => {
    const inp = { ...base, map: 65 };
    const { trace } = run(initialState(base, c), () => inp, 12, 0.25, c);
    const at6h = trace.find((s) => s.t >= 6)!;
    // True GFR has already fallen; eGFR still overestimates it.
    expect(at6h.egfr).toBeGreaterThan(at6h.trueGfr * 1.2);
    // ...and only converges once creatinine approaches its new steady state (days).
    const later = run(initialState(base, c), () => inp, 24 * 10, 0.5, c).trace.at(-1)!;
    expect(Math.abs(later.creatinine - later.steadyCreatinine) / later.steadyCreatinine).toBeLessThan(0.01);
  });
});

describe('CKD-EPI 2021 (race-free)', () => {
  const MG = 88.4;
  it('40-year-old male, Scr 1.0 mg/dL ≈ 98', () => {
    expect(ckdEpi2021(1.0 * MG, 40, 'male')).toBeCloseTo(97.6, 1);
    expect(Math.round(ckdEpi2021(1.0 * MG, 40, 'male'))).toBe(98);
  });
  // Hand-computed from the published equation (142 × … × 0.9938^age × 1.012 [F]).
  it('reference cases', () => {
    // 40 F, 0.7 mg/dL: 142 × 1 × 1 × 0.9938^40 × 1.012
    expect(ckdEpi2021(0.7 * MG, 40, 'female')).toBeCloseTo(142 * Math.pow(0.9938, 40) * 1.012, 6);
    // 60 M, 2.0 mg/dL: 142 × (2/0.9)^-1.2 × 0.9938^60
    expect(ckdEpi2021(2.0 * MG, 60, 'male')).toBeCloseTo(142 * Math.pow(2 / 0.9, -1.2) * Math.pow(0.9938, 60), 6);
    // 30 F, 0.5 mg/dL (below κ, α branch): 142 × (0.5/0.7)^-0.241 × 0.9938^30 × 1.012
    expect(ckdEpi2021(0.5 * MG, 30, 'female')).toBeCloseTo(142 * Math.pow(0.5 / 0.7, -0.241) * Math.pow(0.9938, 30) * 1.012, 6);
  });
  it('rounded sanity values', () => {
    expect(Math.round(ckdEpi2021(2.0 * MG, 60, 'male'))).toBe(38); // 37.5
    expect(Math.round(ckdEpi2021(0.7 * MG, 40, 'female'))).toBe(112);
  });
});

describe('CKD-EPI 2021 vs National Kidney Foundation online calculator', () => {
  // Values read from https://www.kidney.org/professionals/gfr_calculator (CKD-EPI Creatinine 2021,
  // mg/dL input, no cystatin C) on 2026-11-18. The calculator reports whole numbers.
  const NKF: [number, number, 'male' | 'female', number][] = [
    [1.0, 40, 'male', 98],
    [0.7, 40, 'female', 112],
    [2.0, 60, 'male', 38],
    [0.5, 30, 'female', 129],
  ];
  it.each(NKF)('Scr %s mg/dL, age %s, %s → %s', (scr, age, sex, expected) => {
    expect(Math.round(ckdEpi2021(scr * 88.4, age, sex))).toBe(expected);
  });
});

describe('circuit consistency (efferent carries blood minus filtrate)', () => {
  it('satisfies both resistance equations at the solution', () => {
    for (const patch of [{}, { efferentMult: 3, autoregulation: false }, { map: 70 }, { afferentMult: 0.5 }]) {
      const inp = { ...base, ...patch };
      const h = solveHaemodynamics(inp, c);
      const cal = calibrate(c);
      const qB = h.rbf * 1e6 / h.nephronsTotal;
      const ra = h.afferentEffective * cal.ra0;
      const re = h.efferentEffective * cal.re0;
      expect(inp.map - h.pgc).toBeCloseTo(qB * ra, 4);
      expect(h.pgc - inp.venousPressure).toBeCloseTo((qB - h.sngfr) * re, 4);
    }
  });
});

describe('venous congestion', () => {
  it("raising venous pressure raises Bowman's pressure and lowers GFR and RPF", () => {
    const b = solve();
    const h = solve({ venousPressure: 20 });
    expect(h.pbs).toBeGreaterThan(b.pbs);
    expect(h.gfr).toBeLessThan(b.gfr);
    expect(h.rpf).toBeLessThan(b.rpf);
    expect(solve({ venousPressure: 30 }).gfr).toBeLessThan(h.gfr);
  });
  it('venous pressure below the calibration value does not lower Bowman pressure', () => {
    expect(solve({ venousPressure: 0 }).pbs).toBe(base.bowmanPressure);
  });
});

describe('ADH (Phase 1 scope)', () => {
  it('raises urea reabsorption and urea but leaves GFR and creatinine unchanged', () => {
    const b = snapshot(initialState(base, c), base, c);
    const hi = { ...base, adh: 5 };
    const s = snapshot(initialState(hi, c), hi, c);
    expect(s.trueGfr).toBeCloseTo(b.trueGfr, 9);
    expect(s.creatinine).toBeCloseTo(b.creatinine, 9);
    expect(s.clearances.ureaFR).toBeGreaterThan(b.clearances.ureaFR);
    expect(s.urea).toBeGreaterThan(b.urea);
    const lo = { ...base, adh: 0.2 };
    expect(snapshot(initialState(lo, c), lo, c).urea).toBeLessThan(b.urea);
  });
  it('urea fractional reabsorption stays within its bounds at extremes', () => {
    for (const adh of [0.1, 1, 10]) for (const map of [40, 93, 200]) {
      const inp = { ...base, adh, map };
      const fr = snapshot(initialState(base, c), inp, c).clearances.ureaFR;
      expect(fr).toBeGreaterThanOrEqual(c.ureaFrMin);
      expect(fr).toBeLessThanOrEqual(c.ureaFrMax);
    }
  });
});

describe('robustness at slider extremes', () => {
  const keys = ['map', 'afferentMult', 'efferentMult', 'plasmaProtein', 'bowmanPressure', 'kfMult', 'nephronsPerKidney', 'venousPressure'] as const;
  it('every single-slider extreme gives finite, non-negative, physically ordered outputs', () => {
    for (const k of keys) for (const v of [INPUT_DEFS[k].min, INPUT_DEFS[k].max]) for (const autoregulation of [true, false]) {
      const h = solve({ [k]: v, autoregulation });
      for (const x of [h.gfr, h.rpf, h.rbf, h.pgc, h.sngfr, h.filtrationFraction]) {
        expect(Number.isFinite(x)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
      }
      expect(h.filtrationFraction).toBeLessThan(1);
      const inp = { ...base, [k]: v, autoregulation };
      expect(h.pgc).toBeLessThanOrEqual(inp.map + 1e-9);
      expect(h.pgc).toBeGreaterThanOrEqual(inp.venousPressure - 1e-9);
    }
  });
  it('combined worst cases do not crash; zero GFR gives an unbounded (not NaN) steady state', () => {
    const shock = { ...base, map: 30, afferentMult: 4, bowmanPressure: 60, autoregulation: false };
    const s = snapshot(initialState(base, c), shock, c);
    expect(s.trueGfr).toBe(0);
    expect(s.steadyCreatinine).toBe(Infinity);
    const r = run(initialState(base, c), () => shock, 48, 0.5, c, false).final;
    expect(Number.isFinite(r.creatinine)).toBe(true);
    expect(r.creatinine).toBeGreaterThan(s.creatinine);
    const flood = { ...base, map: 200, afferentMult: 0.25, efferentMult: 8, kfMult: 3, plasmaProtein: 4, autoregulation: false };
    const f = solve(flood);
    expect(Number.isFinite(f.gfr)).toBe(true);
    expect(f.filtrationFraction).toBeLessThan(1);
  });
});

describe('formatting', () => {
  it('direction arrows with a dead-band', () => {
    expect(direction(110, 100)).toBe('up');
    expect(direction(90, 100)).toBe('down');
    expect(direction(101, 100)).toBe('same');
  });
  it('rounds to display step', () => {
    expect(formatValue(112.4, 5)).toBe('110');
    expect(formatValue(5.43, 0.5)).toBe('5.5');
    expect(formatValue(0.1834, 0.01)).toBe('0.18');
  });
});
