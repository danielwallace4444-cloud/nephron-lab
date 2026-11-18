/** Calibration helper: find single-nephron Kf giving the target baseline GFR. Run: npx vite-node scripts/fit-kf.ts */
import { calibrate, integrateCapillary } from '../src/model/glomerulus';
import { defaultConstants, defaultInputs } from '../src/model/parameters';

const TARGET_GFR = 110; // mL/min, centre of the 100–120 calibration range
const c = defaultConstants();
const inp = defaultInputs();
const cal = calibrate(c);
const qp = cal.qBlood0 * (1 - c.haematocrit);
const gfrFor = (kf: number) => (integrateCapillary(qp, inp.plasmaProtein, c.targetPgc, inp.bowmanPressure, kf, 1000).sngfr * cal.nephronsTotal) / 1e6;
let lo = 0.1, hi = 50;
for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (gfrFor(m) < TARGET_GFR) lo = m; else hi = m; }
const kf = (lo + hi) / 2;
console.log({ qPlasmaSN: qp, ra0: cal.ra0, re0: cal.re0, kfSN: kf, wholeKidneyKf_mL_min_mmHg: (kf * cal.nephronsTotal) / 1e6, gfrAtRounded: gfrFor(Math.round(kf * 100) / 100) });
