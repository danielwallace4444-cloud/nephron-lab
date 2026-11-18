/**
 * Glomerular haemodynamics — pure TypeScript, no UI imports.
 *
 * Single-nephron Starling-force model in the style of Deen, Robertson & Brenner
 * (Am J Physiol 1972;223:1178-83), with oncotic pressure from the
 * Landis–Pappenheimer polynomial. See MODEL.md for every equation.
 *
 * Units (single nephron): flow nL/min, pressure mmHg, Kf nL/min/mmHg,
 * resistance mmHg·min/nL, protein g/dL.
 */
import { INPUT_DEFS, type ModelConstants, type ModelInputs } from './parameters';

/**
 * Landis–Pappenheimer: π = 2.1C + 0.16C² + 0.009C³ (mmHg, C in g/dL total protein).
 * Landis EM, Pappenheimer JR. Exchange of substances through the capillary walls.
 * Handbook of Physiology, Sect. 2 Circulation, Vol. II, Ch. 29. Am Physiol Soc, 1963.
 * (Chapter, volume and year confirmed from citing references. Page numbers are not
 * recorded here: the polynomial itself is what matters and it is confirmed.)
 */
export function oncoticPressure(c: number): number {
  return 2.1 * c + 0.16 * c * c + 0.009 * c * c * c;
}

export interface CapillaryResult {
  /** Single-nephron GFR, nL/min. */
  sngfr: number;
  /** Plasma flow leaving the capillary, nL/min. */
  qEfferent: number;
  piAfferent: number;
  piEfferent: number;
  /** Net ultrafiltration pressure at entry and exit, mmHg. */
  nfpAfferent: number;
  nfpEfferent: number;
  /** Mean NFP along the capillary, mmHg. */
  nfpMean: number;
  /** True if NFP has fallen to ~0 before the efferent end. */
  equilibrium: boolean;
  /** Fractional capillary length at which equilibrium is reached (1 if not reached). */
  equilibriumPosition: number;
  /** NFP profile at segment boundaries (length segments+1), for the UI. */
  nfpProfile: number[];
}

const EQUILIBRIUM_TOL_MMHG = 0.25;

/**
 * Integrate dQ/dx = −Kf · max(0, P_GC − P_BS − π(C(x))), x ∈ [0,1],
 * C(x) = C_A · Q_A / Q(x)  (protein conserved, membrane impermeable to protein).
 * P_GC is assumed constant along the capillary (classic simplification).
 * RK4 per segment.
 */
export function integrateCapillary(
  qAfferent: number,
  cAfferent: number,
  pgc: number,
  pbs: number,
  kf: number,
  segments: number,
): CapillaryResult {
  const piA = oncoticPressure(cAfferent);
  const qMin = qAfferent * 1e-6;
  const nfpAt = (q: number): number => {
    if (q <= qMin) return 0; // guard: Q never reaches 0
    return Math.max(0, pgc - pbs - oncoticPressure((cAfferent * qAfferent) / q));
  };
  const dqdx = (q: number) => -kf * nfpAt(q);

  const h = 1 / segments;
  let q = qAfferent;
  const profile: number[] = [nfpAt(q)];
  let eqPos = 1;
  let nfpIntegral = 0;
  for (let i = 0; i < segments; i++) {
    const k1 = dqdx(q);
    const k2 = dqdx(q + 0.5 * h * k1);
    const k3 = dqdx(q + 0.5 * h * k2);
    const k4 = dqdx(q + h * k3);
    const qNext = Math.max(qMin, q + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4));
    // Mean NFP = filtered volume / Kf, so accumulate via ΔQ.
    nfpIntegral += (q - qNext) / kf;
    q = qNext;
    const nfp = nfpAt(q);
    profile.push(nfp);
    if (eqPos === 1 && nfp < EQUILIBRIUM_TOL_MMHG) eqPos = (i + 1) * h;
  }
  const nfpA = profile[0] ?? 0;
  const nfpE = profile[profile.length - 1] ?? 0;
  return {
    sngfr: qAfferent - q,
    qEfferent: q,
    piAfferent: piA,
    piEfferent: oncoticPressure((cAfferent * qAfferent) / q),
    nfpAfferent: nfpA,
    nfpEfferent: nfpE,
    nfpMean: kf > 0 ? nfpIntegral : 0,
    equilibrium: nfpE < EQUILIBRIUM_TOL_MMHG && nfpA > 0,
    equilibriumPosition: nfpA > 0 ? eqPos : 0,
    nfpProfile: profile,
  };
}

/* ------------------------------------------------------------------------ */
/* Calibration (derived algebraically from targets in parameters.ts)          */
/* ------------------------------------------------------------------------ */

export interface Calibration {
  nephronsTotal: number;
  /** Baseline single-nephron blood flow, nL/min. */
  qBlood0: number;
  /** Baseline SNGFR at the calibration point, nL/min. */
  sngfr0: number;
  ra0: number;
  re0: number;
}

/**
 * MAP − P_GC  = Q_B · Ra                 (afferent carries the full blood flow)
 * P_GC − Pv   = (Q_B − SNGFR) · Re       (efferent carries blood minus filtrate)
 */
export function calibrate(c: ModelConstants): Calibration {
  const nephronsTotal = BASELINE_NEPHRONS_PER_KIDNEY * 1e6 * c.kidneys;
  const rbf0 = c.targetRpf / (1 - c.haematocrit); // mL/min, whole kidney
  const qBlood0 = (rbf0 * 1e6) / nephronsTotal; // nL/min per nephron
  const sngfr0 = baselineSngfrCached(c);
  const ra0 = (c.baselineMap - c.targetPgc) / qBlood0;
  const re0 = (c.targetPgc - c.baselineVenous) / (qBlood0 - sngfr0);
  return { nephronsTotal, qBlood0, sngfr0, ra0, re0 };
}

/* ------------------------------------------------------------------------ */
/* Full haemodynamic solve                                                   */
/* ------------------------------------------------------------------------ */

export interface HaemodynamicResult {
  /** Whole-kidney (both kidneys) values. */
  gfr: number; // mL/min
  rpf: number; // mL/min
  rbf: number; // mL/min
  filtrationFraction: number;
  /** Single-nephron values. */
  sngfr: number; // nL/min
  snPlasmaFlow: number; // nL/min
  pgc: number; // mmHg
  pbs: number; // mmHg
  capillary: CapillaryResult;
  /** Effective resistance multipliers vs calibrated baseline (all factors combined). */
  afferentEffective: number;
  efferentEffective: number;
  /** Drug and hormone multipliers alone (1 = none), separate from autoregulation. */
  modAfferent: number;
  modEfferent: number;
  /** Individual autoregulatory/adaptive factors on afferent resistance. */
  myogenicFactor: number;
  tgfFactor: number;
  compensationAfferentFactor: number;
  compensationKfFactor: number;
  kfEffective: number; // nL/min/mmHg per nephron
  nephronsTotal: number;
  /** True if MAP is outside the autoregulatory range (autoregulation saturated). */
  autoregSaturated: boolean;
}

/**
 * Hormone/drug modifiers (Phase 3, computed in pharmacology.ts). All 1 = no effect.
 * tgfSignal scales the macula densa signal: distal NaCl delivery × sensing, relative to normal.
 */
export interface ExtraModifiers {
  afferent: number;
  efferent: number;
  kf: number;
  tgfSignal: number;
}
export const NO_MODS: ExtraModifiers = { afferent: 1, efferent: 1, kf: 1, tgfSignal: 1 };

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

export function solveHaemodynamics(
  inp: ModelInputs,
  c: ModelConstants,
  mods: ExtraModifiers = NO_MODS,
): HaemodynamicResult {
  // Resistances and Kf are calibrated PER NEPHRON at the baseline nephron number.
  const cal = calibrate(c);
  const nephronsTotal = inp.nephronsPerKidney * 1e6 * c.kidneys;
  const baselineNephrons = cal.nephronsTotal;

  // Compensatory hyperfiltration (only for nephron loss).
  let A = 1;
  if (inp.compensation && nephronsTotal < baselineNephrons) {
    A = Math.pow(baselineNephrons / nephronsTotal, c.compensationExponent);
  }
  const compKf = A;
  const compRa = 1 / Math.sqrt(A);

  const kf = c.kfSN * inp.kfMult * compKf * mods.kf;
  const re = cal.re0 * inp.efferentMult * mods.efferent;
  const raBase = cal.ra0 * inp.afferentMult * compRa * mods.afferent;

  // Venous congestion: a rise in renal venous pressure above the calibration value is
  // partly transmitted to Bowman's space (via interstitial/tubular pressure). ILLUSTRATIVE gain.
  const pbs = inp.bowmanPressure + c.venousToBowmanGain * Math.max(0, inp.venousPressure - c.baselineVenous);

  // Myogenic: afferent resistance ratio that would hold P_GC (and so flow) at baseline,
  // (MAP − P_GC0)/(MAP0 − P_GC0), raised to an illustrative gain; MAP clamped to the range.
  let myo = 1;
  let saturated = false;
  if (inp.autoregulation) {
    const mapC = clamp(inp.map, c.autoregMapLow, c.autoregMapHigh);
    saturated = mapC !== inp.map;
    const rReq = (mapC - c.targetPgc) / (c.baselineMap - c.targetPgc);
    myo = Math.pow(Math.max(rReq, 0.05), c.myogenicGain);
  }

  // Coupled circuit + capillary: find Q_B with
  //   F(Q_B) = (MAP − Pv) − Q_B·Ra − (Q_B − SNGFR(P_GC, Q_A))·Re = 0,  P_GC = MAP − Q_B·Ra.
  // F is strictly decreasing in Q_B (F(0) > 0, F(dp/Ra) < 0), so bisection is safe.
  const solveAt = (raMult: number) => {
    const ra = raBase * myo * raMult;
    const dp = Math.max(0, inp.map - inp.venousPressure);
    const evalAt = (qBlood: number) => {
      const pgc = inp.map - qBlood * ra;
      const qPlasma = qBlood * (1 - c.haematocrit);
      const cap = integrateCapillary(qPlasma, inp.plasmaProtein, pgc, pbs, kf, c.capillarySegments);
      return { ra, qBlood, qPlasma, pgc, cap, f: dp - qBlood * ra - (qBlood - cap.sngfr) * re };
    };
    if (dp <= 0) return evalAt(0);
    let lo = 0;
    let hi = dp / ra;
    // 1e-7 relative is ~10 orders below anything displayed, and halves the iterations.
    for (let i = 0; i < 60 && hi - lo > 1e-7 * hi; i++) {
      const mid = 0.5 * (lo + hi);
      if (evalAt(mid).f > 0) lo = mid;
      else hi = mid;
    }
    return evalAt(0.5 * (lo + hi));
  };

  // TGF: afferent multiplier m = clamp((signal)^g), signal = SNGFR/setpoint × macula densa
  // delivery/sensing factor (Phase 3). Fixed point solved by bisection on
  // h(m) = m − tgf(SNGFR(m)), which is monotone increasing in m.
  let tgf = 1;
  if (inp.autoregulation) {
    const setpoint = cal.sngfr0 * A;
    const target = (m: number) => {
      const s = solveAt(m).cap.sngfr;
      return clamp(Math.pow((Math.max(s, 1e-9) / setpoint) * mods.tgfSignal, c.tgfGain), c.tgfMin, c.tgfMax);
    };
    let lo = c.tgfMin;
    let hi = c.tgfMax;
    if (lo - target(lo) >= 0) tgf = lo;
    else if (hi - target(hi) <= 0) tgf = hi;
    else {
      // Each probe runs a full circuit solve, so this loop dominates the cost.
      // 1e-5 on a multiplier displayed to 2 decimals is far tighter than needed.
      for (let i = 0; i < 40; i++) {
        const mid = 0.5 * (lo + hi);
        if (mid - target(mid) > 0) hi = mid;
        else lo = mid;
        if (hi - lo < 1e-5) break;
      }
      tgf = 0.5 * (lo + hi);
    }
  }

  const s = solveAt(tgf);
  const sngfr = s.cap.sngfr;
  const gfr = (sngfr * nephronsTotal) / 1e6;
  const rpf = (s.qPlasma * nephronsTotal) / 1e6;
  const rbf = (s.qBlood * nephronsTotal) / 1e6;
  return {
    gfr,
    rpf,
    rbf,
    filtrationFraction: s.qPlasma > 0 ? sngfr / s.qPlasma : 0,
    sngfr,
    snPlasmaFlow: s.qPlasma,
    pgc: s.pgc,
    pbs,
    capillary: s.cap,
    afferentEffective: s.ra / cal.ra0,
    efferentEffective: re / cal.re0,
    modAfferent: mods.afferent,
    modEfferent: mods.efferent,
    myogenicFactor: myo,
    tgfFactor: tgf,
    compensationAfferentFactor: compRa,
    compensationKfFactor: compKf,
    kfEffective: kf,
    nephronsTotal,
    autoregSaturated: inp.autoregulation && saturated,
  };
}

/* Baseline SNGFR at the calibration point — used for Re0 and as the TGF set-point. */
const baselineCache = new WeakMap<ModelConstants, number>();
export function baselineSngfrCached(c: ModelConstants): number {
  const hit = baselineCache.get(c);
  if (hit !== undefined) return hit;
  const nephronsTotal = BASELINE_NEPHRONS_PER_KIDNEY * 1e6 * c.kidneys;
  const qPlasma = (c.targetRpf * 1e6) / nephronsTotal;
  const pgc = c.targetPgc;
  // Baseline P_BS and protein come from the input defaults.
  const v = integrateCapillary(qPlasma, BASELINE_PROTEIN, pgc, BASELINE_PBS, c.kfSN, c.capillarySegments).sngfr;
  baselineCache.set(c, v);
  return v;
}

const BASELINE_PROTEIN = INPUT_DEFS.plasmaProtein.default;
const BASELINE_PBS = INPUT_DEFS.bowmanPressure.default;
const BASELINE_NEPHRONS_PER_KIDNEY = INPUT_DEFS.nephronsPerKidney.default;
