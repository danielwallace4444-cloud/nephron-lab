/**
 * Illustrative tubular handling (Phases 3–4). Steady-state and open-loop: plasma
 * sodium, potassium and osmolality are fixed, so diuretics change what the kidney
 * excretes but do not move blood levels. See MODEL.md §3b and §3c.
 *
 * Phase 4 adds segment-by-segment sodium, water and potassium handling and a
 * QUALITATIVE osmolality profile along the nephron — the shape responds to the model
 * (medullary gradient, loop/thiazide block, ADH) but it is not a solved countercurrent
 * multiplier, and its intermediate values are teaching anchors, not computed osmoles.
 */
import type { Effects } from './pharmacology';
import type { ModelConstants, ModelInputs } from './parameters';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export type SegmentId = 'glomerulus' | 'proximal' | 'loop' | 'distal' | 'collecting' | 'urine';

export interface Segment {
  id: SegmentId;
  name: string;
  /** Anatomical site of action, for drug labelling. */
  short: string;
  /** Fluid leaving this segment, mL/min. */
  flow: number;
  /** Fraction of the filtered volume still in the tubule here. */
  waterRemaining: number;
  /** Sodium leaving this segment, mmol/min, and as a fraction of filtered. */
  na: number;
  naRemaining: number;
  /** Potassium leaving this segment, mmol/min, and as a fraction of filtered. */
  k: number;
  kRemaining: number;
  /** Tubular fluid osmolality leaving this segment, mOsm/kg (qualitative). */
  osmolality: number;
  /** Sodium reabsorbed within this segment, as a fraction of what it received. */
  naFraction: number;
  /** True if a drug the user has switched on acts here. */
  drugActing: boolean;
}

export interface TubuleResult {
  /** Na load (mmol/min) at each boundary (kept from Phase 3). */
  filteredNa: number;
  deliveredLoop: number;
  deliveredDistal: number;
  deliveredCollecting: number;
  excretedNa: number;
  /** Fractional excretion of sodium (0–1). */
  fena: number;
  naExcretionPerDay: number; // mmol/day
  kExcretionPerDay: number; // mmol/day
  /** Fractional excretion of potassium (can exceed 1: potassium is secreted). */
  feK: number;
  urineOsm: number; // mOsm/kg
  urineVolume: number; // L/day
  /** Maximum achievable concentration given the medullary gradient. */
  maxUrineOsm: number;
  /** Osmolality at the loop tip (the medullary peak), mOsm/kg. */
  hairpinOsm: number;
  glucosuria: boolean;
  /** Phase 4: segment-by-segment handling, in order down the nephron. */
  segments: Segment[];
  /** Net potassium added distally (mmol/day); negative means net reabsorption. */
  kDistalSecretion: number;
}

/** Baseline distal delivery (fraction of filtered reaching the collecting duct). */
const distalFraction = (c: ModelConstants) => (1 - c.fracProximal) * (1 - c.fracLoop) * (1 - c.fracDistal);

export function computeTubule(
  gfr: number,
  ureaExcretionPerDay: number,
  gfrBaseline: number,
  e: Effects,
  inp: ModelInputs,
  c: ModelConstants,
): TubuleResult {
  // ---- sodium down the nephron (Phase 3) ----
  const filteredNa = (gfr / 1000) * c.plasmaSodium; // mmol/min
  const deliveredLoop = filteredNa * (1 - e.fProximal);
  const deliveredDistal = deliveredLoop * (1 - e.fLoop);
  const deliveredCollecting = deliveredDistal * (1 - e.fDistal);
  const excretedNa = deliveredCollecting * (1 - e.fCollecting);
  const fena = filteredNa > 0 ? excretedNa / filteredNa : 0;

  // ---- potassium: excretion is set distally by aldosterone and flow ----
  const distalRel = gfrBaseline > 0 ? deliveredCollecting / ((gfrBaseline / 1000) * c.plasmaSodium * distalFraction(c)) : 0;
  const kExcretionPerDay = c.potassiumExcretion0 * Math.pow(e.aldoEffective, c.potassiumAldoExp) * Math.pow(Math.max(distalRel, 0), c.potassiumFlowExp);
  const filteredK = (gfr / 1000) * c.plasmaPotassium; // mmol/min
  const kAfterProximal = filteredK * (1 - c.kFracProximal);
  const kAfterLoop = Math.max(0, filteredK * (1 - c.kFracProximal - c.kFracLoop));
  const kExcreted = kExcretionPerDay / 1440; // mmol/min
  const feK = filteredK > 0 ? kExcreted / filteredK : 0;

  // ---- concentrating ability and urine ----
  const maxUrineOsm = 300 + (c.urineOsmMax - 300) * Math.min(1, e.medullaryGradient);
  const frac0 = (c.urineOsm0 - c.urineOsmMin) / (c.urineOsmMax - c.urineOsmMin);
  const k = (1 - frac0) / frac0;
  const sat = inp.adh / (inp.adh + k);
  const urineOsm = c.urineOsmMin + (maxUrineOsm - c.urineOsmMin) * sat;

  const naExcretionPerDay = excretedNa * 1440;
  const osmoles = 2 * (naExcretionPerDay + kExcretionPerDay) + ureaExcretionPerDay; // mOsm/day
  const urineVolume = gfr > 0 ? osmoles / urineOsm : 0;

  // ---- Phase 4: water and the osmolality profile ----
  const filteredFlow = gfr; // mL/min
  // Proximal reabsorption is isosmotic: water follows sodium, so the fluid stays at plasma osmolality.
  const flowProximal = filteredFlow * (1 - e.fProximal);
  // The descending limb is water-permeable: water leaves towards the medullary interstitium.
  const flowHairpin = flowProximal * (1 - c.fracWaterDescending);
  // Thick ascending limb and distal tubule are relatively water-impermeable.
  const flowLoop = flowHairpin;
  const flowDistal = flowHairpin;
  const flowUrine = (urineVolume * 1000) / 1440; // L/day → mL/min

  // Osmolality (qualitative anchors that respond to the model state):
  //  • hairpin rises to the medullary peak, which washes out with a loop diuretic
  //  • the thick ascending limb dilutes towards ~100 mOsm/kg in proportion to the
  //    NaCl it actually removes, so blocking it leaves fluid near isosmotic
  //  • the distal tubule dilutes a little further, unless a thiazide blocks it
  const talActivity = clamp(e.fLoop / c.fracLoop, 0, 1);
  const osmPlasma = c.plasmaOsmolality;
  const osmHairpin = maxUrineOsm;
  const osmTal = osmPlasma - (osmPlasma - c.talEndOsmolality) * talActivity;
  const dctActivity = clamp(e.fDistal / c.fracDistal, 0, 1);
  const osmDistal = Math.max(c.urineOsmMin, osmTal - 0.2 * (osmTal - c.urineOsmMin) * dctActivity);

  const segments: Segment[] = [
    {
      id: 'glomerulus',
      name: 'Filtrate',
      short: "Bowman's space",
      flow: filteredFlow,
      waterRemaining: 1,
      na: filteredNa,
      naRemaining: 1,
      k: filteredK,
      kRemaining: 1,
      osmolality: osmPlasma,
      naFraction: 0,
      drugActing: false,
    },
    {
      id: 'proximal',
      name: 'Proximal tubule',
      short: 'Proximal tubule',
      flow: flowProximal,
      waterRemaining: filteredFlow > 0 ? flowProximal / filteredFlow : 0,
      na: deliveredLoop,
      naRemaining: filteredNa > 0 ? deliveredLoop / filteredNa : 0,
      k: kAfterProximal,
      kRemaining: 1 - c.kFracProximal,
      osmolality: osmPlasma, // isosmotic reabsorption
      naFraction: e.fProximal,
      drugActing: inp.sglt2,
    },
    {
      id: 'loop',
      name: 'Loop of Henle',
      short: 'Thick ascending limb',
      flow: flowLoop,
      waterRemaining: filteredFlow > 0 ? flowLoop / filteredFlow : 0,
      na: deliveredDistal,
      naRemaining: filteredNa > 0 ? deliveredDistal / filteredNa : 0,
      k: kAfterLoop,
      kRemaining: Math.max(0, 1 - c.kFracProximal - c.kFracLoop),
      osmolality: osmTal,
      naFraction: e.fLoop,
      drugActing: inp.loopDiuretic,
    },
    {
      id: 'distal',
      name: 'Distal tubule',
      short: 'Distal convoluted tubule',
      flow: flowDistal,
      waterRemaining: filteredFlow > 0 ? flowDistal / filteredFlow : 0,
      na: deliveredCollecting,
      naRemaining: filteredNa > 0 ? deliveredCollecting / filteredNa : 0,
      k: kAfterLoop,
      kRemaining: Math.max(0, 1 - c.kFracProximal - c.kFracLoop),
      osmolality: osmDistal,
      naFraction: e.fDistal,
      drugActing: inp.thiazide,
    },
    {
      id: 'collecting',
      name: 'Collecting duct',
      short: 'Collecting duct',
      flow: flowUrine,
      waterRemaining: filteredFlow > 0 ? flowUrine / filteredFlow : 0,
      na: excretedNa,
      naRemaining: fena,
      k: kExcreted,
      kRemaining: feK,
      osmolality: urineOsm,
      naFraction: e.fCollecting,
      drugActing: inp.mra,
    },
  ];

  return {
    filteredNa,
    deliveredLoop,
    deliveredDistal,
    deliveredCollecting,
    excretedNa,
    fena,
    naExcretionPerDay,
    kExcretionPerDay,
    feK,
    urineOsm,
    urineVolume,
    maxUrineOsm,
    glucosuria: inp.sglt2,
    hairpinOsm: osmHairpin,
    segments,
    kDistalSecretion: (kExcreted - kAfterLoop) * 1440,
  };
}

/** The qualitative osmolality curve, as plotted: position along the nephron vs mOsm/kg. */
export function osmolalityProfile(t: TubuleResult): { x: number; osm: number; label: string }[] {
  const seg = (id: SegmentId) => t.segments.find((s) => s.id === id)!;
  return [
    { x: 0, osm: seg('glomerulus').osmolality, label: "Bowman's space" },
    { x: 0.2, osm: seg('proximal').osmolality, label: 'End of proximal tubule' },
    { x: 0.42, osm: t.hairpinOsm, label: 'Loop tip (medulla)' },
    { x: 0.62, osm: seg('loop').osmolality, label: 'End of ascending limb' },
    { x: 0.78, osm: seg('distal').osmolality, label: 'End of distal tubule' },
    { x: 1, osm: seg('collecting').osmolality, label: 'Final urine' },
  ];
}
