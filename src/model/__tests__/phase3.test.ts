import { describe, expect, it } from 'vitest';
import { defaultConstants, defaultInputs, initialState, run, snapshot, type ModelInputs, type Snapshot } from '../index';

const c = defaultConstants();
const base = defaultInputs();

/** Steady-state snapshot at the given inputs and starting volume. */
const at = (patch: Partial<ModelInputs> = {}, volumePercent = 0): Snapshot => {
  const inp = { ...base, ...patch };
  return snapshot(initialState(inp, c, volumePercent), inp, c);
};
/**
 * Run to sodium/volume steady state, then snapshot. Volume has a time constant of
 * days, so a 2-hour step is plenty here (time-step independence is tested separately).
 */
const settle = (patch: Partial<ModelInputs> = {}, days = 21, volumePercent = 0): Snapshot => {
  const inp = { ...base, ...patch };
  const { final } = run(initialState(inp, c, volumePercent), () => inp, 24 * days, 2, c, false);
  return snapshot(final, inp, c);
};
const rel = (a: number, b: number) => (a - b) / b;

const B = at();

describe('Phase 3 baseline is unchanged', () => {
  it('hormones at normal, drugs off, euvolaemic → no haemodynamic modifiers', () => {
    expect(B.effects.mods).toEqual({ afferent: 1, efferent: 1, kf: 1, tgfSignal: 1 });
    expect(B.effects.map).toBeCloseTo(base.map, 9);
    expect(B.trueGfr).toBeGreaterThan(100);
    expect(B.trueGfr).toBeLessThan(120);
  });
  it('tubule baseline: FENa <1%, sodium excretion matches intake, urine 1–2.5 L/day', () => {
    expect(B.tubule.fena).toBeLessThan(0.01);
    expect(B.tubule.naExcretionPerDay).toBeCloseTo(base.sodiumIntake, 0);
    expect(B.tubule.urineVolume).toBeGreaterThan(1);
    expect(B.tubule.urineVolume).toBeLessThan(2.5);
    expect(B.tubule.urineOsm).toBeCloseTo(c.urineOsm0, 6);
    expect(B.tubule.kExcretionPerDay).toBeCloseTo(c.potassiumExcretion0, 6);
  });
  it('euvolaemia is a true steady state: volume does not drift', () => {
    const { final } = run(initialState(base, c), () => base, 24 * 30, 2, c, false);
    expect(Math.abs(final.ecfVolume - c.ecfVolume0) / c.ecfVolume0).toBeLessThan(0.01);
  });
  it('sodium is conserved down the segments', () => {
    const t = at({ loopDiuretic: true, thiazide: true }).tubule;
    expect(t.excretedNa).toBeLessThanOrEqual(t.deliveredCollecting + 1e-12);
    expect(t.deliveredCollecting).toBeLessThanOrEqual(t.deliveredDistal + 1e-12);
    expect(t.deliveredDistal).toBeLessThanOrEqual(t.deliveredLoop + 1e-12);
    expect(t.deliveredLoop).toBeLessThanOrEqual(t.filteredNa + 1e-12);
  });
});

describe('Volume status', () => {
  it('depletion lowers MAP and raises angiotensin II, aldosterone and ADH; ANP falls', () => {
    const d = at({}, -20);
    expect(d.effects.map).toBeLessThan(B.effects.map);
    expect(d.effects.angIIEffective).toBeGreaterThan(2);
    expect(d.effects.aldoEffective).toBeGreaterThan(2);
    expect(d.effects.adhEffective).toBeGreaterThan(2);
    expect(d.effects.anpEffective).toBeLessThan(1);
  });
  it('depletion gives avid sodium retention, concentrated urine and a high urea:creatinine ratio', () => {
    const d = at({}, -20);
    expect(d.tubule.fena).toBeLessThan(0.005);
    expect(d.tubule.urineOsm).toBeGreaterThan(B.tubule.urineOsm);
    expect(d.tubule.urineVolume).toBeLessThan(B.tubule.urineVolume);
    expect(d.urea / d.creatinine).toBeGreaterThan((B.urea / B.creatinine) * 1.3);
  });
  it('expansion does the opposite (natriuresis, dilute urine)', () => {
    const e = at({}, 12);
    expect(e.effects.anpEffective).toBeGreaterThan(1);
    expect(e.tubule.fena).toBeGreaterThan(B.tubule.fena);
    expect(e.tubule.urineOsm).toBeLessThan(B.tubule.urineOsm);
  });
  it('GFR is defended across mild depletion but falls once MAP leaves the autoregulatory range', () => {
    expect(Math.abs(rel(at({}, -8).trueGfr, B.trueGfr))).toBeLessThan(0.05);
    expect(rel(at({}, -22).trueGfr, B.trueGfr)).toBeLessThan(-0.15);
  });
  it('volume returns to a steady state where sodium excretion equals intake', () => {
    for (const intake of [80, 150, 250]) {
      const s = settle({ sodiumIntake: intake }, 40);
      expect(Math.abs(s.tubule.naExcretionPerDay - intake) / intake).toBeLessThan(0.05);
    }
  });
  it('with volume linkage off the model is fully open-loop (volume has no effect)', () => {
    const off = at({ volumeLinked: false }, -20);
    expect(off.effects.map).toBe(base.map);
    expect(off.effects.angIIEffective).toBe(base.angiotensinII);
    expect(off.trueGfr).toBeCloseTo(B.trueGfr, 6);
  });
});

describe('Hormones', () => {
  it('angiotensin II constricts the efferent more than the afferent: FF up, RPF down', () => {
    const s = at({ angiotensinII: 4 });
    expect(s.effects.mods.efferent).toBeGreaterThan(s.effects.mods.afferent);
    expect(s.haemo.filtrationFraction).toBeGreaterThan(B.haemo.filtrationFraction);
    expect(s.haemo.pgc).toBeGreaterThan(B.haemo.pgc);
    expect(s.effects.mods.kf).toBeLessThan(1); // mesangial contraction
  });
  it('angiotensin II ×4 reproduces the renal plasma flow fall seen on infusion (−29%, ±8 points)', () => {
    // van der Bel / Hofman et al., JAHA 2016;5:e003185 — RPF 660 → 467 mL/min/1.73m².
    expect(rel(at({ angiotensinII: 4 }).haemo.rpf, B.haemo.rpf)).toBeLessThan(-0.21);
    expect(rel(at({ angiotensinII: 4 }).haemo.rpf, B.haemo.rpf)).toBeGreaterThan(-0.37);
  });
  it('aldosterone: sodium retained, potassium lost', () => {
    const s = at({ aldosterone: 3 });
    expect(s.tubule.fena).toBeLessThan(B.tubule.fena);
    expect(s.tubule.kExcretionPerDay).toBeGreaterThan(B.tubule.kExcretionPerDay);
  });
  it('ADH concentrates the urine and shrinks its volume; low ADH does the reverse', () => {
    const hi = at({ adh: 5 });
    const lo = at({ adh: 0.2 });
    expect(hi.tubule.urineOsm).toBeGreaterThan(B.tubule.urineOsm);
    expect(hi.tubule.urineVolume).toBeLessThan(B.tubule.urineVolume);
    expect(lo.tubule.urineOsm).toBeLessThan(300);
    expect(lo.tubule.urineVolume).toBeGreaterThan(B.tubule.urineVolume * 1.5);
    expect(hi.trueGfr).toBeCloseTo(B.trueGfr, 6); // ADH does not change GFR here
  });
  it('ADH raises urea reabsorption, so urea rises without creatinine changing', () => {
    const s = at({ adh: 5 });
    expect(s.clearances.ureaFR).toBeGreaterThan(B.clearances.ureaFR);
    expect(s.urea).toBeGreaterThan(B.urea);
    expect(s.creatinine).toBeCloseTo(B.creatinine, 6);
  });
  it('ANP dilates the afferent, constricts the efferent and causes natriuresis', () => {
    const s = at({ anp: 3 });
    expect(s.effects.mods.afferent).toBeLessThan(1);
    expect(s.effects.mods.efferent).toBeGreaterThan(1);
    expect(s.trueGfr).toBeGreaterThan(B.trueGfr);
    expect(s.tubule.fena).toBeGreaterThan(B.tubule.fena);
  });
});

describe('Drugs', () => {
  it('ACEi/ARB in health: plasma flow up, filtration fraction down, GFR nearly unchanged', () => {
    // Captopril/enalapril in healthy volunteers: ERPF rises, GFR unchanged, FF falls a few %.
    const s = at({ acei: true });
    expect(s.effects.mods.efferent).toBeLessThan(1);
    expect(s.haemo.rpf).toBeGreaterThan(B.haemo.rpf);
    expect(s.haemo.filtrationFraction).toBeLessThan(B.haemo.filtrationFraction);
    expect(Math.abs(rel(s.trueGfr, B.trueGfr))).toBeLessThan(0.1);
  });
  it('ACEi/ARB lowers potassium excretion (aldosterone falls), and more so with an MRA', () => {
    const a = at({ acei: true });
    expect(a.tubule.kExcretionPerDay).toBeLessThan(B.tubule.kExcretionPerDay);
    expect(at({ acei: true, mra: true }).tubule.kExcretionPerDay).toBeLessThan(a.tubule.kExcretionPerDay);
  });
  it('ACEi/ARB in bilateral renal artery stenosis drops GFR >15% and collapses filtration fraction', () => {
    const ras = { map: 60, angiotensinII: 4, volumeLinked: false } as const;
    const before = at(ras);
    const after = at({ ...ras, acei: true });
    expect(rel(after.trueGfr, before.trueGfr)).toBeLessThan(-0.15);
    expect(rel(after.haemo.filtrationFraction, before.haemo.filtrationFraction)).toBeLessThan(-0.4);
    expect(after.haemo.rpf).toBeGreaterThan(before.haemo.rpf); // flow rises while filtration falls
  });
  it('NSAIDs: no real effect in health, large GFR fall when volume-depleted', () => {
    // Ibuprofen/indomethacin do not change GFR in sodium-replete healthy volunteers.
    expect(Math.abs(rel(at({ nsaid: true }).trueGfr, B.trueGfr))).toBeLessThan(0.03);
    const dry = at({}, -15).trueGfr;
    expect(rel(at({ nsaid: true }, -15).trueGfr, dry)).toBeLessThan(-0.1);
  });
  it('NSAID effect scales with prostaglandin dependence', () => {
    expect(at({ nsaid: true }, -15).effects.pgDependence).toBeGreaterThan(at({ nsaid: true }).effects.pgDependence);
    expect(at({ nsaid: true, angiotensinII: 3 }).effects.pgDependence).toBeGreaterThan(at({ nsaid: true }).effects.pgDependence);
  });
  it('SGLT2 inhibitor: TGF-mediated dip in true GFR, lower glomerular pressure, glucosuria', () => {
    const s = at({ sglt2: true });
    const d = rel(s.trueGfr, B.trueGfr);
    expect(d).toBeLessThan(-0.02);
    expect(d).toBeGreaterThan(-0.12); // trials: early eGFR dip ~3–6 mL/min/1.73m²
    expect(s.haemo.pgc).toBeLessThan(B.haemo.pgc);
    expect(s.effects.mods.tgfSignal).toBeGreaterThan(1);
    expect(s.tubule.glucosuria).toBe(true);
    expect(s.tubule.fena).toBeGreaterThan(B.tubule.fena);
  });
  it('the SGLT2 dip is tubuloglomerular feedback: it disappears with autoregulation off', () => {
    const off = rel(at({ sglt2: true, autoregulation: false }).trueGfr, at({ autoregulation: false }).trueGfr);
    expect(Math.abs(off)).toBeLessThan(0.01);
  });
  it('eGFR follows the SGLT2 dip only after creatinine rises (days)', () => {
    const inp = { ...base, sglt2: true };
    const { trace } = run(initialState(base, c), () => inp, 24 * 10, 1, c);
    const early = trace[2]!;
    const late = trace.at(-1)!;
    expect(early.trueGfr).toBeLessThan(B.trueGfr); // true GFR drops at once
    expect(early.egfr).toBeGreaterThan(late.egfr); // eGFR takes days to follow
  });
  it('loop diuretic: big natriuresis and kaliuresis, washed-out medullary gradient, GFR roughly held', () => {
    const s = at({ loopDiuretic: true });
    expect(s.tubule.fena).toBeGreaterThan(3 * B.tubule.fena);
    expect(s.tubule.kExcretionPerDay).toBeGreaterThan(B.tubule.kExcretionPerDay);
    expect(s.tubule.maxUrineOsm).toBeLessThan(600);
    expect(s.effects.mdSensitivity).toBeLessThan(0.5);
    // Blunted sensing roughly offsets the extra delivery, so GFR is not acutely driven down.
    expect(Math.abs(rel(s.trueGfr, B.trueGfr))).toBeLessThan(0.05);
  });
  it('a loop diuretic causes real volume depletion over days, with RAAS activation', () => {
    const s = settle({ loopDiuretic: true });
    expect(s.volumePercent).toBeLessThan(-5);
    expect(s.effects.map).toBeLessThan(base.map);
    expect(s.effects.angIIEffective).toBeGreaterThan(1.5);
    // New steady state: excretion is back to matching intake
    expect(Math.abs(s.tubule.naExcretionPerDay - base.sodiumIntake) / base.sodiumIntake).toBeLessThan(0.05);
  });
  it('thiazide: natriuresis smaller than a loop diuretic, still kaliuretic', () => {
    const t = at({ thiazide: true });
    expect(t.tubule.fena).toBeGreaterThan(B.tubule.fena);
    expect(t.tubule.fena).toBeLessThan(at({ loopDiuretic: true }).tubule.fena);
    expect(t.tubule.kExcretionPerDay).toBeGreaterThan(B.tubule.kExcretionPerDay);
  });
  it('MRA: mild natriuresis with potassium retention', () => {
    const m = at({ mra: true });
    expect(m.tubule.fena).toBeGreaterThan(B.tubule.fena);
    expect(m.tubule.kExcretionPerDay).toBeLessThan(B.tubule.kExcretionPerDay);
  });
  it('each drug acts only at its own segment', () => {
    expect(at({ sglt2: true }).effects.fProximal).toBeLessThan(B.effects.fProximal);
    expect(at({ loopDiuretic: true }).effects.fLoop).toBeLessThan(B.effects.fLoop);
    expect(at({ thiazide: true }).effects.fDistal).toBeLessThan(B.effects.fDistal);
    expect(at({ mra: true }).effects.fCollecting).toBeLessThan(B.effects.fCollecting);
    expect(at({ thiazide: true }).effects.fLoop).toBeCloseTo(B.effects.fLoop, 9);
  });
  it('dose scales the effect, and a drug switched off does nothing', () => {
    expect(at({ loopDiuretic: true, loopDose: 1.5 }).tubule.fena).toBeGreaterThan(at({ loopDiuretic: true, loopDose: 0.5 }).tubule.fena);
    expect(at({ loopDiuretic: false, loopDose: 1.5 }).tubule.fena).toBeCloseTo(B.tubule.fena, 12);
  });
});

describe('Triple whammy (ACEi/ARB + diuretic + NSAID)', () => {
  // Seven days of loop diuretic, then the ACEi and NSAID are added.
  const schedule = (withDrugs: Partial<ModelInputs>) => (t: number) => ({ ...base, loopDiuretic: true, ...(t >= 24 * 7 ? withDrugs : {}) });
  const after = (withDrugs: Partial<ModelInputs>) => {
    const { final } = run(initialState(base, c), schedule(withDrugs), 24 * 14, 1, c, false);
    const inp = schedule(withDrugs)(24 * 14);
    return snapshot(final, inp, c);
  };
  const diureticOnly = after({});
  const plusAcei = after({ acei: true });
  const plusNsaid = after({ nsaid: true });
  const allThree = after({ acei: true, nsaid: true });

  it('the combination lowers GFR more than the diuretic alone or either drug added singly', () => {
    expect(allThree.trueGfr).toBeLessThan(diureticOnly.trueGfr);
    expect(allThree.trueGfr).toBeLessThan(plusAcei.trueGfr);
    expect(allThree.trueGfr).toBeLessThan(plusNsaid.trueGfr);
    expect(rel(allThree.trueGfr, diureticOnly.trueGfr)).toBeLessThan(-0.08);
  });
  it('creatinine rises and the combination deepens the volume depletion', () => {
    expect(allThree.creatinine).toBeGreaterThan(diureticOnly.creatinine * 1.1);
    expect(allThree.volumePercent).toBeLessThan(diureticOnly.volumePercent);
  });
  it('each limb contributes through its own mechanism', () => {
    // Diuretic → volume depletion → RAAS; ACEi → efferent dilation; NSAID → afferent constriction.
    expect(diureticOnly.volumePercent).toBeLessThan(-5);
    expect(plusAcei.effects.mods.efferent).toBeLessThan(1);
    expect(plusNsaid.effects.mods.afferent).toBeGreaterThan(1);
  });
});

describe('Intake controls (protein and fluid)', () => {
  it('protein intake sets urea without touching creatinine or GFR', () => {
    const hi = at({ proteinIntake: 150 });
    const lo = at({ proteinIntake: 40 });
    expect(hi.urea).toBeGreaterThan(B.urea * 1.5);
    expect(lo.urea).toBeLessThan(B.urea);
    expect(hi.creatinine).toBeCloseTo(B.creatinine, 9);
    expect(hi.trueGfr).toBeCloseTo(B.trueGfr, 9);
    // Urea generation is linear in protein intake.
    expect(hi.urea / lo.urea).toBeCloseTo(150 / 40, 1);
  });
  it('negative fluid balance dries the patient out and positive fluid resuscitates', () => {
    const dry = settle({ fluidBalance: -1 }, 10);
    expect(dry.volumePercent).toBeLessThan(-5);
    expect(dry.effects.angIIEffective).toBeGreaterThan(1.5);
    // Starting depleted, a positive balance restores volume.
    const filled = settle({ fluidBalance: 1.5 }, 10, -20);
    expect(filled.volumePercent).toBeGreaterThan(-20);
  });
  it('fluid resuscitation reverses a prerenal fall in GFR', () => {
    const depleted = at({}, -20);
    const resuscitated = settle({ fluidBalance: 2 }, 6, -20);
    expect(resuscitated.volumePercent).toBeGreaterThan(depleted.volumePercent + 5);
    expect(resuscitated.trueGfr).toBeGreaterThan(depleted.trueGfr);
    expect(resuscitated.effects.map).toBeGreaterThan(depleted.effects.map);
  });
  it('an ACE inhibitor no longer protects against an NSAID (triple-whammy interaction)', () => {
    // Prostaglandin dependence reflects the underlying hypovolaemic state, not the
    // angiotensin II level left after a blocker.
    expect(at({ nsaid: true, acei: true }, -15).effects.pgDependence).toBeCloseTo(at({ nsaid: true }, -15).effects.pgDependence, 6);
    // So the NSAID's OWN contribution to afferent tone is the same either way.
    // (Net afferent tone still differs, because an ACEi also removes angiotensin II's
    // smaller direct afferent effect.)
    const nsaidShare = (acei: boolean) => at({ nsaid: true, acei }, -15).effects.mods.afferent / at({ acei }, -15).effects.mods.afferent;
    expect(nsaidShare(true)).toBeCloseTo(nsaidShare(false), 6);
    expect(nsaidShare(false)).toBeGreaterThan(1.3);
  });
});
