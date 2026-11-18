/**
 * Time-stepped creatinine and urea kinetics (single-pool, pure TS).
 *
 * dCr/dt = (G_cr − CL_cr·Cr) / V_cr      CL_cr = GFR (+ secretion clearance)
 * dU/dt  = (G_u  − CL_u·U)  / V_u       CL_u  = GFR · (1 − FR_urea)
 *
 * Units: concentrations µmol/L (creatinine) and mmol/L (urea), time in hours,
 * GFR mL/min, generation mmol/day, volumes L.
 */
import type { ModelConstants, ModelInputs } from './parameters';

export interface BiochemState {
  /** Simulated time, hours. */
  t: number;
  creatinine: number; // µmol/L
  urea: number; // mmol/L
  /** Extracellular fluid volume, L (euvolaemia = constants.ecfVolume0). */
  ecfVolume: number;
}

/** mL/min → L/h */
const ML_MIN_TO_L_H = 0.06;
/** Urea produced per gram of dietary protein (constants.ureaPerGramProtein). */
const UREA_PER_G_PROTEIN = 5.7;

export function ureaFractionalReabsorption(gfr: number, gfrBaseline: number, adh: number, c: ModelConstants): number {
  const span = c.ureaFrMax - c.ureaFrMin;
  const frac0 = (c.ureaFrBaseline - c.ureaFrMin) / span;
  const z0 = Math.log(frac0 / (1 - frac0));
  const flowRel = Math.max(gfr, 1e-6) / gfrBaseline;
  const z = z0 + c.ureaFrAdhGain * Math.log(Math.max(adh, 1e-6)) - c.ureaFrFlowGain * Math.log(flowRel);
  return c.ureaFrMin + span / (1 + Math.exp(-z));
}

export interface Clearances {
  creatinine: number; // mL/min
  urea: number; // mL/min
  ureaFR: number;
}

export function clearances(gfr: number, gfrBaseline: number, inp: ModelInputs, c: ModelConstants): Clearances {
  const fr = ureaFractionalReabsorption(gfr, gfrBaseline, inp.adh, c);
  return {
    creatinine: gfr + (inp.creatinineSecretion ? c.creatinineSecretionClearance : 0),
    urea: gfr * (1 - fr),
    ureaFR: fr,
  };
}

/** Generation rates in concentration-mass units per hour. */
function generation(inp: ModelInputs) {
  return {
    cr: (inp.creatinineProduction * 1000) / 24, // µmol/h
    u: (inp.proteinIntake * UREA_PER_G_PROTEIN) / 24, // mmol/h
  };
}

export function steadyState(cl: Clearances, inp: ModelInputs): { creatinine: number; urea: number } {
  const g = generation(inp);
  return {
    creatinine: cl.creatinine > 0 ? g.cr / (cl.creatinine * ML_MIN_TO_L_H) : Infinity,
    urea: cl.urea > 0 ? g.u / (cl.urea * ML_MIN_TO_L_H) : Infinity,
  };
}

/**
 * One RK4 step of dt hours with clearances held constant over the step.
 * `naExcretion` (mmol/min) moves extracellular volume: sodium is the osmole that
 * holds water in the extracellular space, so volume follows sodium balance at a
 * fixed plasma sodium.
 */
export function stepBiochem(s: BiochemState, cl: Clearances, inp: ModelInputs, c: ModelConstants, dt: number, naExcretion = inp.sodiumIntake / 1440): BiochemState {
  const g = generation(inp);
  const kCr = cl.creatinine * ML_MIN_TO_L_H;
  const kU = cl.urea * ML_MIN_TO_L_H;
  const fCr = (x: number) => (g.cr - kCr * x) / c.creatinineVd;
  const fU = (x: number) => (g.u - kU * x) / c.ureaVd;
  const rk4 = (f: (x: number) => number, x: number) => {
    const k1 = f(x);
    const k2 = f(x + 0.5 * dt * k1);
    const k3 = f(x + 0.5 * dt * k2);
    const k4 = f(x + dt * k3);
    return x + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  };
  const naBalance = inp.sodiumIntake / 1440 - naExcretion; // mmol/min
  // Volume follows sodium balance, plus any isotonic fluid given or lost elsewhere.
  const dVolume = ((naBalance * 60) / c.plasmaSodium) * dt + (inp.fluidBalance / 24) * dt;
  const ecfVolume = Math.max(0.5 * c.ecfVolume0, s.ecfVolume + dVolume);
  return { t: s.t + dt, creatinine: Math.max(0, rk4(fCr, s.creatinine)), urea: Math.max(0, rk4(fU, s.urea)), ecfVolume };
}
