/** Fit: (1) collecting-duct Na fraction so baseline excretion = intake; (2) Ang II gains to the infusion data. */
import { computeTubule, computeEffects, defaultConstants, defaultInputs, initialState, snapshot, solveHaemodynamics, type ModelConstants } from '../src/model';

const b = defaultInputs();
// 1. fracCollecting so baseline UNa = sodiumIntake (euvolaemia is then a true steady state)
let lo = 0.3, hi = 0.985;
for (let i = 0; i < 70; i++) {
  const m = (lo + hi) / 2;
  const c = { ...defaultConstants(), fracCollecting: m };
  const s = snapshot(initialState(b, c), b, c);
  if (s.tubule.naExcretionPerDay > b.sodiumIntake) lo = m; else hi = m;
}
const fCD = Math.round(((lo + hi) / 2) * 1000) / 1000;
console.log('fracCollecting =', fCD);

// 2. Ang II: target RPF -29%, GFR -9% at a strongly pressor infusion (taken as x4 normal)
const base = (c: ModelConstants) => solveHaemodynamics(b, c, computeEffects(b, c).mods);
const atAII = (c: ModelConstants, x: number) => {
  const i = { ...b, angiotensinII: x };
  return solveHaemodynamics(i, c, computeEffects(i, c).mods);
};
console.log('eff.gain  kf.gain |  RPF%   GFR%    FF%');
for (const eg of [0.25, 0.3, 0.35, 0.4]) {
  for (const kg of [0.08, 0.12, 0.16, 0.2]) {
    const c = { ...defaultConstants(), fracCollecting: fCD, angIIEfferentGain: eg, angIIKfGain: kg };
    const B = base(c), A = atAII(c, 4);
    const pc = (a: number, z: number) => (((a - z) / z) * 100).toFixed(0).padStart(4);
    console.log(`${eg.toFixed(2)}      ${kg.toFixed(2)}    | ${pc(A.rpf, B.rpf)}  ${pc(A.gfr, B.gfr)}  ${pc(A.filtrationFraction, B.filtrationFraction)}   (target -29, -9, +29)`);
  }
}
const c2 = { ...defaultConstants(), fracCollecting: fCD };
const t = computeTubule(110, 430, 110, computeEffects(b, c2), b, c2);
console.log('baseline UNa', t.naExcretionPerDay.toFixed(0), 'FENa%', (t.fena * 100).toFixed(2));
