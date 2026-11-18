/**
 * Nephron Lab — parameter registry.
 *
 * EVERY number the model uses lives here, with unit, default, plausible range,
 * a plain-language description and a `source`. Where a citation has not been
 * personally confirmed, the source says "TODO verify" rather than inventing one.
 *
 * Illustrative, educational model. Not patient-specific. Not for clinical decisions.
 */

export type ParamGroup =
  | 'Haemodynamics'
  | 'Biochemistry'
  | 'Hormones'
  | 'Drugs'
  | 'Patient'
  | 'Model';

export interface ParamDef {
  key: string;
  name: string;
  unit: string;
  default: number;
  /** Plausible / allowed range for the slider. */
  min: number;
  max: number;
  step: number;
  description: string;
  source: string;
  group: ParamGroup;
}

const p = (d: ParamDef): ParamDef => d;

/* ------------------------------------------------------------------------ */
/* User-adjustable inputs                                                    */
/* ------------------------------------------------------------------------ */

export const INPUT_DEFS = {
  map: p({
    key: 'map', name: 'Mean arterial pressure', unit: 'mmHg',
    default: 93, min: 30, max: 200, step: 1, group: 'Haemodynamics',
    description: 'Average pressure driving blood into the kidney (renal artery pressure assumed equal to MAP).',
    source: 'VERIFIED 2026-11-18. Arithmetic: mean arterial pressure = diastolic + one third of the pulse pressure, so 120/80 gives 80 + 13 = 93 mmHg.',
  }),
  afferentMult: p({
    key: 'afferentMult', name: 'Afferent arteriolar resistance', unit: '× baseline',
    default: 1, min: 0.25, max: 4, step: 0.05, group: 'Haemodynamics',
    description: 'Tone of the arteriole leading INTO the glomerulus. Constriction lowers glomerular pressure and flow.',
    source: 'Dimensionless multiplier of the calibrated baseline resistance (see MODEL.md). Range illustrative.',
  }),
  efferentMult: p({
    key: 'efferentMult', name: 'Efferent arteriolar resistance', unit: '× baseline',
    default: 1, min: 0.25, max: 8, step: 0.05, group: 'Haemodynamics',
    description: 'Tone of the arteriole LEAVING the glomerulus. Mild constriction raises glomerular pressure; severe constriction starves the glomerulus of flow.',
    source: 'Dimensionless multiplier of the calibrated baseline resistance (see MODEL.md). Range illustrative.',
  }),
  plasmaProtein: p({
    key: 'plasmaProtein', name: 'Plasma protein (afferent)', unit: 'g/dL',
    default: 7.0, min: 4.0, max: 10.0, step: 0.1, group: 'Biochemistry',
    description: 'Total plasma protein entering the glomerulus. Sets the oncotic pressure that opposes filtration.',
    source: 'VERIFIED 2026-11-18. Total protein reference interval 6.0-8.3 g/dL in adults (UCSF Health; MedlinePlus), so the 7.0 g/dL default and 4-10 slider range bracket normal. Laboratory intervals vary slightly.',
  }),
  bowmanPressure: p({
    key: 'bowmanPressure', name: "Bowman's space pressure", unit: 'mmHg',
    default: 12, min: 5, max: 60, step: 1, group: 'Haemodynamics',
    description: "Hydrostatic pressure in Bowman's space. Rises with downstream (e.g. ureteric) obstruction and opposes filtration.",
    source: 'Brief calibration target 10-15 mmHg. Bowman\'s space pressure cannot be measured directly in humans; published figures are inferred from micropuncture in other species. STILL TODO verify against a human source.',
  }),
  kfMult: p({
    key: 'kfMult', name: 'Filtration coefficient (Kf)', unit: '× baseline',
    default: 1, min: 0.1, max: 3, step: 0.05, group: 'Haemodynamics',
    description: 'Multiplier on the single-nephron filtration coefficient. INTERNAL: no longer a user control. Kept because the engine and the tests use it, and because disease states that change filtration surface area will act through it.',
    source: 'Dimensionless multiplier of the calibrated Kf. Not user-facing; see kfSN.',
  }),
  nephronsPerKidney: p({
    key: 'nephronsPerKidney', name: 'Nephron number (per kidney)', unit: 'million',
    default: 1.0, min: 0.1, max: 1.5, step: 0.05, group: 'Haemodynamics',
    description: 'Functioning nephrons in each of two kidneys. Reduced by ageing, CKD or nephrectomy.',
    source: 'Bertram JF, Douglas-Denton RN, Diouf B, Hughson MD, Hoy WE. Human nephron number: implications for health and disease. Pediatr Nephrol 2011;26(9):1529-33 — averages cluster near ~1 million per kidney; individual kidneys range ~200,000 to >2.5 million (confirmed from abstract). Slider range 0.1–1.5 million is a teaching choice (lower end represents CKD/nephrectomy).',
  }),
  venousPressure: p({
    key: 'venousPressure', name: 'Renal venous pressure', unit: 'mmHg',
    default: 5, min: 0, max: 30, step: 1, group: 'Haemodynamics',
    description: 'Pressure the kidney drains against. Set qualitatively in the interface (None / Mild / Moderate / Severe congestion) because this is not measured at the bedside and the teaching point is the direction and its effect on filtration, not a number.',
    source: 'Conventional low single-digit mmHg at rest; the congestion levels (12 / 20 / 28) are MODEL CHOICES spacing the effect across a useful range. Deliberately not shown as a number in the interface.',
  }),
  adh: p({
    key: 'adh', name: 'ADH (vasopressin) level', unit: '× normal',
    default: 1, min: 0.1, max: 10, step: 0.1, group: 'Hormones',
    description: 'Water hormone. Raises water reabsorption in the collecting duct (higher urine osmolality, less urine) and urea reabsorption (urea rises more than creatinine).',
    source: 'Dimensionless relative level; effects are illustrative (see MODEL.md §4).',
  }),
  angiotensinII: p({
    key: 'angiotensinII', name: 'Angiotensin II', unit: '× normal',
    default: 1, min: 0.1, max: 5, step: 0.1, group: 'Hormones',
    description: 'Constricts the efferent arteriole more than the afferent, propping up glomerular pressure when perfusion falls. Also increases proximal sodium reabsorption and drives aldosterone release.',
    source: 'MODEL CHOICE, not a measurable quantity: a dimensionless multiple of normal. Preferential efferent constriction by angiotensin II is standard physiology; the GAIN is fitted (see angIIEfferentGain), and the slider range is a teaching range, not a measured plasma level.',
  }),
  aldosterone: p({
    key: 'aldosterone', name: 'Aldosterone', unit: '× normal',
    default: 1, min: 0.1, max: 5, step: 0.1, group: 'Hormones',
    description: 'Acts on the collecting duct: more sodium reabsorbed (sodium retention) and more potassium secreted into urine.',
    source: 'MODEL CHOICE, not a measurable quantity: a dimensionless multiple of normal. The direction (sodium retention, potassium secretion) is standard physiology; the gains are illustrative and the range is a teaching range, not a measured plasma level.',
  }),
  anp: p({
    key: 'anp', name: 'ANP (atrial natriuretic peptide)', unit: '× normal',
    default: 1, min: 0.5, max: 5, step: 0.1, group: 'Hormones',
    description: 'Released when the atria are stretched. Dilates the afferent and constricts the efferent arteriole (raising GFR) and reduces collecting-duct sodium reabsorption (natriuresis).',
    source: 'MODEL CHOICE, not a measurable quantity: a dimensionless multiple of normal. The directions (afferent dilation, efferent constriction, natriuresis) are standard physiology; the gains are illustrative and the range is a teaching range, not a measured plasma level.',
  }),
  sodiumIntake: p({
    key: 'sodiumIntake', name: 'Sodium intake', unit: 'mmol/day',
    default: 150, min: 20, max: 400, step: 10, group: 'Biochemistry',
    description: 'Dietary sodium. Extracellular volume rises or falls until sodium excretion matches intake, so a diuretic causes real volume depletion here.',
    source: 'VERIFIED 2026-11-18. 150 mmol/day (3.5 g sodium) is close to measured typical intake: global average ~3.95 g/day and US ~3.6 g/day. Note this is ABOVE the WHO recommended ceiling of <2 g/day (87 mmol), which is a target rather than a description of what people eat.',
  }),
  nsaidDose: p({
    key: 'nsaidDose', name: 'NSAID strength', unit: '× standard', default: 1, min: 0.25, max: 1.5, step: 0.05, group: 'Drugs',
    description: 'Relative dose when the NSAID is on.', source: 'Illustrative scale.',
  }),
  aceiDose: p({
    key: 'aceiDose', name: 'ACEi/ARB strength', unit: '× standard', default: 1, min: 0.25, max: 1.5, step: 0.05, group: 'Drugs',
    description: 'Relative dose when the ACE inhibitor / ARB is on.', source: 'Illustrative scale.',
  }),
  sglt2Dose: p({
    key: 'sglt2Dose', name: 'SGLT2 inhibitor strength', unit: '× standard', default: 1, min: 0.25, max: 1.5, step: 0.05, group: 'Drugs',
    description: 'Relative dose when the SGLT2 inhibitor is on.', source: 'Illustrative scale.',
  }),
  loopDose: p({
    key: 'loopDose', name: 'Loop diuretic strength', unit: '× standard', default: 1, min: 0.25, max: 1.5, step: 0.05, group: 'Drugs',
    description: 'Relative dose when the loop diuretic is on.', source: 'Illustrative scale.',
  }),
  thiazideDose: p({
    key: 'thiazideDose', name: 'Thiazide strength', unit: '× standard', default: 1, min: 0.25, max: 1.5, step: 0.05, group: 'Drugs',
    description: 'Relative dose when the thiazide is on.', source: 'Illustrative scale.',
  }),
  mraDose: p({
    key: 'mraDose', name: 'MRA strength', unit: '× standard', default: 1, min: 0.25, max: 1.5, step: 0.05, group: 'Drugs',
    description: 'Relative dose when the mineralocorticoid receptor antagonist is on.', source: 'Illustrative scale.',
  }),
  creatinineProduction: p({
    key: 'creatinineProduction', name: 'Creatinine production', unit: 'mmol/day',
    default: 12, min: 4, max: 25, step: 0.5, group: 'Biochemistry',
    description: 'Daily creatinine generation from muscle. Assumed constant (not linked to age or sex in this model).',
    source: 'VERIFIED 2026-11-18. Men produce ~150-200 umol/kg/day of creatinine and women ~100-150; for 70 kg that is 10.5-14 mmol/day in men, so the 12 mmol/day default sits mid-range. Production tracks muscle mass, which this model does not vary.',
  }),
  proteinIntake: p({
    key: 'proteinIntake', name: 'Protein intake', unit: 'g/day',
    default: 75, min: 20, max: 200, step: 5, group: 'Biochemistry',
    description: 'Dietary protein. Its nitrogen is excreted as urea, so a high intake (or a gastrointestinal bleed, or catabolism) raises urea without changing creatinine.',
    source: 'VERIFIED 2026-11-18. Urea generation = protein x 5.7 mmol/g (see ureaPerGramProtein). The RDA is 0.8 g/kg/day (56 g at 70 kg) while measured US intake averages ~1.2 g/kg (~84 g), so the 75 g/day default lies between the minimum requirement and typical intake. It also reproduces the baseline urea of ~5.4 mmol/L.',
  }),
  fluidBalance: p({
    key: 'fluidBalance', name: 'Net fluid balance', unit: 'L/day',
    default: 0, min: -3, max: 3, step: 0.1, group: 'Biochemistry',
    description: 'Isotonic fluid gained or lost each day outside the kidney: intravenous fluids and drinking on the positive side, vomiting, diarrhoea, bleeding or sweating on the negative side. Use it to resuscitate a dehydrated patient, or to dry one out.',
    source: 'Treated as ISOTONIC because plasma sodium is held constant: pure water would change the sodium concentration, which this model cannot represent. See MODEL.md.',
  }),
  age: p({
    key: 'age', name: 'Age (for eGFR only)', unit: 'years',
    default: 40, min: 18, max: 90, step: 1, group: 'Patient',
    description: 'Used ONLY inside the CKD-EPI 2021 equation. Does not change true GFR in this model.',
    source: 'CKD-EPI 2021 validated in adults ≥18 y (Inker et al., NEJM 2021;385:1737-49).',
  }),
} as const satisfies Record<string, ParamDef>;

export type InputKey = keyof typeof INPUT_DEFS;

export type Sex = 'male' | 'female';

/** Full set of model inputs (numeric sliders + discrete toggles). */
export interface ModelInputs {
  map: number;
  afferentMult: number;
  efferentMult: number;
  plasmaProtein: number;
  bowmanPressure: number;
  kfMult: number;
  nephronsPerKidney: number;
  venousPressure: number;
  adh: number;
  creatinineProduction: number;
  proteinIntake: number;
  fluidBalance: number;
  age: number;
  sex: Sex;
  /** Myogenic + tubuloglomerular-feedback autoregulation of afferent tone. */
  autoregulation: boolean;
  /** Adaptive hyperfiltration of surviving nephrons when nephron number falls. */
  compensation: boolean;
  /** Adds a small fixed tubular creatinine secretion clearance. */
  creatinineSecretion: boolean;
  angiotensinII: number;
  aldosterone: number;
  anp: number;
  sodiumIntake: number;
  /** Hormones and MAP respond to extracellular volume (otherwise fully open-loop). */
  volumeLinked: boolean;
  nsaid: boolean;
  nsaidDose: number;
  acei: boolean;
  aceiDose: number;
  sglt2: boolean;
  sglt2Dose: number;
  loopDiuretic: boolean;
  loopDose: number;
  thiazide: boolean;
  thiazideDose: number;
  mra: boolean;
  mraDose: number;
}

export type DrugKey = 'nsaid' | 'acei' | 'sglt2' | 'loopDiuretic' | 'thiazide' | 'mra';

/** Drug info cards (2–3 plain sentences each) and the dose input each one uses. */
export const DRUG_DEFS: Record<DrugKey, { name: string; dose: InputKey; site: string; mechanism: string; source: string }> = {
  nsaid: {
    name: 'NSAIDs',
    dose: 'nsaidDose',
    site: 'Afferent arteriole',
    mechanism:
      'Block prostaglandin synthesis. Prostaglandins keep the afferent arteriole open when the kidney is under stress, so NSAIDs constrict it, and the effect is much bigger when angiotensin II is high or perfusion is low than in a healthy person.',
    source: 'VERIFIED 2026-11-18 (direction/mechanism). Ibuprofen and indomethacin do not change renal blood flow or GFR in sodium-replete healthy volunteers, while risk concentrates in hypovolaemia and with diuretics - which is exactly the pattern this model reproduces. MODEL CHOICE: the prostaglandin-dependence index and its gain. No quantitative GFR fall under true volume depletion was found in the literature searched.',
  },
  acei: {
    name: 'ACE inhibitor / ARB',
    dose: 'aceiDose',
    site: 'Efferent arteriole',
    mechanism:
      'Reduce angiotensin II production (ACEi) or block its receptor (ARB). The efferent arteriole relaxes, so glomerular pressure and filtration fraction fall. When GFR depends on angiotensin II (e.g. bilateral renal artery stenosis) GFR can drop sharply; aldosterone also falls, so potassium excretion falls.',
    source: 'VERIFIED 2026-11-18 (direction/mechanism). In healthy volunteers captopril and enalapril raise effective renal plasma flow, leave GFR essentially unchanged and lower filtration fraction by a few percent (e.g. 24.1% to 22.5%) - matching this model. MODEL CHOICE: the block fraction and aldosterone share.',
  },
  sglt2: {
    name: 'SGLT2 inhibitor',
    dose: 'sglt2Dose',
    site: 'Proximal tubule',
    mechanism:
      'Block sodium-glucose reabsorption in the proximal tubule, so more sodium reaches the macula densa. Tubuloglomerular feedback constricts the afferent arteriole, lowering glomerular pressure and causing an early, expected eGFR dip. Also causes glucosuria and mild natriuresis.',
    source: 'VERIFIED 2026-11-18 (direction/mechanism). The SGLT2 outcome trials (CREDENCE, DAPA-CKD, EMPA-REG) show an early eGFR dip of ~3-6 mL/min/1.73m2 that partly recovers by week 12; this model gives ~6%. MODEL CHOICE: the size of the proximal block. Glucose itself is not modelled, so the osmotic diuresis from glucosuria is missing.',
  },
  loopDiuretic: {
    name: 'Loop diuretic',
    dose: 'loopDose',
    site: 'Thick ascending limb',
    mechanism:
      'Block the Na-K-2Cl transporter in the thick ascending limb, so large amounts of sodium and water stay in the tubule. Because the macula densa senses salt through the same transporter, feedback is blunted; the medullary gradient washes out, so urine cannot be concentrated, and potassium is lost.',
    source: 'VERIFIED 2026-11-18 (direction/mechanism). NKCC2 inhibition in the thick ascending limb, with the macula densa sensing salt through the same transporter, is standard pharmacology. MODEL CHOICE: the block fractions (see loopBlock and loopTgfBlock).',
  },
  thiazide: {
    name: 'Thiazide',
    dose: 'thiazideDose',
    site: 'Distal convoluted tubule',
    mechanism:
      'Block the Na-Cl cotransporter in the distal convoluted tubule. Natriuresis is smaller than with a loop diuretic because less sodium reaches this segment; extra sodium delivery downstream increases potassium loss.',
    source: 'VERIFIED 2026-11-18 (direction/mechanism). Na-Cl cotransporter inhibition in a segment that receives only ~5% of the filtered sodium load is standard pharmacology, which is why the natriuresis is smaller than a loop diuretic\'s. MODEL CHOICE: the block fraction.',
  },
  mra: {
    name: 'MRA (e.g. spironolactone)',
    dose: 'mraDose',
    site: 'Collecting duct',
    mechanism:
      'Block the aldosterone receptor in the collecting duct. Sodium reabsorption and potassium secretion fall, giving mild natriuresis and potassium retention (risk of hyperkalaemia, especially with an ACEi/ARB).',
    source: 'VERIFIED 2026-11-18 (direction/mechanism). Aldosterone receptor blockade in the collecting duct reducing sodium reabsorption and potassium secretion is standard pharmacology. MODEL CHOICE: the block fraction.',
  },
};

export const TOGGLE_DEFS = {
  sex: {
    name: 'Sex (for eGFR only)', default: 'male' as Sex,
    description: 'Used ONLY inside the CKD-EPI 2021 equation. Creatinine production is not adjusted for sex here, so eGFR and true GFR differ at baseline for females — an intentional teaching point about eGFR assumptions.',
    source: 'Inker et al., NEJM 2021;385:1737-49 (coefficients cross-checked against kidney.org and NIDDK pages).',
  },
  autoregulation: {
    name: 'Autoregulation', default: true,
    description: 'Myogenic response + tubuloglomerular feedback adjust afferent tone to hold flow and GFR near-constant across MAP ~80–180 mmHg. Gains are ILLUSTRATIVE, not measured.',
    source: 'VERIFIED 2026-11-18 (direction/mechanism). Autoregulation holds renal blood flow and GFR relatively constant across a renal arterial pressure of 80-180 mmHg via the myogenic response and tubuloglomerular feedback. MODEL CHOICE: the gains (myogenicGain, tgfGain and the TGF bounds), hand-tuned for a flat GFR across that range.',
  },
  compensation: {
    name: 'Compensatory hyperfiltration', default: true,
    description: 'When nephrons are lost, surviving nephrons enlarge (higher Kf), dilate their afferent arterioles and reset TGF, so single-nephron GFR rises. Strength is illustrative.',
    source: 'Direction is standard physiology (the Brenner hyperfiltration concept: surviving nephrons enlarge and raise single-nephron GFR). MODEL CHOICE: the exponent, which sets how strongly they compensate. No quantitative human reference was found.',
  },
  volumeLinked: {
    name: 'Volume-linked hormones', default: true,
    description:
      'With this on, extracellular volume drives mean arterial pressure, angiotensin II, aldosterone, ADH, ANP and sympathetic afferent tone, and the hormone sliders act as multipliers on top. Turn it off for a fully open-loop model where you set every hormone by hand.',
    source: 'Directions are standard physiology (volume depletion raises the renin-angiotensin system and ADH and lowers ANP; expansion does the reverse). MODEL CHOICE: every gain, and the exponential form linking volume to hormone level.',
  },
  creatinineSecretion: {
    name: 'Tubular creatinine secretion', default: false,
    description: 'Adds a small fixed secretion clearance, so creatinine clearance slightly exceeds true GFR.',
    source: 'Tubular secretion of creatinine is well established, but its size varies between individuals and whether it grows as GFR falls is actively disputed; the commonly quoted 10-20% share could NOT be confirmed in the literature searched. MODEL CHOICE: a fixed clearance, where real secretion is saturable and drug-inhibitable.',
  },
} as const;

/* ------------------------------------------------------------------------ */
/* Fixed model constants (not exposed as sliders in Phase 1)                  */
/* ------------------------------------------------------------------------ */

export const MODEL_CONSTANTS = {
  kidneys: p({
    key: 'kidneys', name: 'Number of kidneys', unit: '', default: 2, min: 1, max: 2, step: 1, group: 'Model',
    description: 'Both kidneys assumed identical.', source: 'Anatomy.',
  }),
  haematocrit: p({
    key: 'haematocrit', name: 'Haematocrit', unit: 'fraction', default: 0.45, min: 0.2, max: 0.6, step: 0.01, group: 'Model',
    description: 'Converts renal blood flow to plasma flow. Rise in haematocrit along the capillary and viscosity effects are ignored.',
    source: 'VERIFIED 2026-11-18. Adult haematocrit is conventionally 0.40-0.50; standard renal-physiology tables pair RBF ~1000-1100 mL/min with Hct 0.40-0.45 to give RPF ~600 mL/min. The 0.45 default sits in that range. Haematocrit does not change with volume status here.',
  }),
  baselineMap: p({
    key: 'baselineMap', name: 'Calibration MAP', unit: 'mmHg', default: 93, min: 93, max: 93, step: 1, group: 'Model',
    description: 'MAP at which baseline resistances are calibrated.', source: 'Model calibration choice.',
  }),
  baselineVenous: p({
    key: 'baselineVenous', name: 'Calibration venous pressure', unit: 'mmHg', default: 5, min: 5, max: 5, step: 1, group: 'Model',
    description: 'Venous pressure at which baseline resistances are calibrated.', source: 'Model calibration point, matching the venousPressure default.',
  }),
  targetPgc: p({
    key: 'targetPgc', name: 'Calibration glomerular capillary pressure', unit: 'mmHg', default: 54, min: 45, max: 55, step: 1, group: 'Model',
    description: 'Baseline glomerular capillary pressure used to split total resistance into afferent and efferent parts. INTERNAL: the resulting pressure is reported in the interface as a band (low / normal / raised / high), never as a number, because it cannot be measured in a patient.',
    source: 'Brief calibration range 45-55 mmHg; 54 chosen (see MODEL.md section 6b). Glomerular capillary pressure cannot be measured in humans - published values are inferred from animal micropuncture or from models such as the Gomez equations, which rest on canine data. No human figure exists to verify it against, which is exactly why the interface shows a band instead.',
  }),
  targetRpf: p({
    key: 'targetRpf', name: 'Calibration renal plasma flow', unit: 'mL/min', default: 600, min: 550, max: 700, step: 10, group: 'Model',
    description: 'Baseline whole-kidney (both kidneys) plasma flow used to set total resistance.',
    source: 'VERIFIED 2026-11-18. 600 mL/min is the classic EFFECTIVE renal plasma flow measured by PAH clearance. Because renal PAH extraction is ~0.92, true RPF is nearer 650-700 mL/min, so this model\'s filtration fraction (0.18) is at the upper end of what the true figure would give (~0.16). Both sit inside the brief\'s 550-700 and 0.17-0.22 targets.',
  }),
  kfSN: p({
    key: 'kfSN', name: 'Single-nephron Kf (baseline)', unit: 'nL/min/mmHg', default: 4.9, min: 0.5, max: 20, step: 0.1, group: 'Model',
    description: 'Permeability x surface area of the glomerular capillary wall, per nephron. INTERNAL: not exposed in the interface, because no clinician measures it and a number would imply otherwise. The model still needs it, and the engine can vary it for future disease states (diabetic hyperfiltration, glomerulosclerosis).',
    source: 'FITTED in this model (scripts/fit-kf.ts) to give a whole-kidney GFR of 110 mL/min; not a measurement, and deliberately not shown in the interface. Human whole-kidney Kf is itself back-calculated from an assumed transcapillary pressure, so no published figure could validate it.',
  }),
  capillarySegments: p({
    key: 'capillarySegments', name: 'Capillary integration segments', unit: '', default: 100, min: 20, max: 1000, step: 10, group: 'Model',
    description: 'Number of RK4 steps along the glomerular capillary length.', source: 'Numerical choice (brief: ~100).',
  }),
  creatinineVd: p({
    key: 'creatinineVd', name: 'Creatinine distribution volume', unit: 'L', default: 42, min: 20, max: 70, step: 1, group: 'Model',
    description: 'Creatinine distributes in total body water (~0.6 L/kg × 70 kg).', source: 'VERIFIED 2026-11-18. Total body water is ~60% of body weight, i.e. ~42 L in a 70 kg adult (28 L intracellular, 14 L extracellular). Creatinine distributes through total body water.',
  }),
  ureaVd: p({
    key: 'ureaVd', name: 'Urea distribution volume', unit: 'L', default: 42, min: 20, max: 70, step: 1, group: 'Model',
    description: 'Urea distributes in total body water.', source: 'VERIFIED 2026-11-18. Total body water, ~42 L in a 70 kg adult (60% of body weight). Urea distributes through total body water.',
  }),
  creatinineSecretionClearance: p({
    key: 'creatinineSecretionClearance', name: 'Creatinine secretion clearance', unit: 'mL/min', default: 10, min: 0, max: 30, step: 1, group: 'Model',
    description: 'Fixed extra clearance when tubular secretion is enabled.', source: 'MODEL CHOICE, not a measurable quantity: an illustrative fixed clearance. Tubular secretion of creatinine is well established but its size varies between individuals and is disputed; the commonly quoted 10-20% could not be confirmed. Real secretion is saturable and drug-inhibitable, unlike this fixed term.',
  }),
  // Urea fractional reabsorption: FR = frMin + (frMax-frMin)·σ(z),
  // z = z0 + kAdh·ln(ADH) − kFlow·ln(GFR/GFR0)
  ureaFrBaseline: p({
    key: 'ureaFrBaseline', name: 'Baseline urea fractional reabsorption', unit: 'fraction', default: 0.5, min: 0.3, max: 0.6, step: 0.01, group: 'Model',
    description: 'About half of filtered urea is reabsorbed at normal flow and ADH.', source: 'VERIFIED 2026-11-18. The proximal tubule passively reabsorbs roughly 40-50% of filtered urea by solvent drag, so a baseline fractional reabsorption of 0.5 is at the top of that range. Fractional urea EXCRETION can exceed 50% in some studies, attributed to medullary secretion, which this model does not include.',
  }),
  ureaFrMin: p({
    key: 'ureaFrMin', name: 'Minimum urea fractional reabsorption', unit: 'fraction', default: 0.2, min: 0, max: 0.4, step: 0.01, group: 'Model',
    description: 'Floor at very high flow / low ADH.', source: 'Illustrative.',
  }),
  ureaFrMax: p({
    key: 'ureaFrMax', name: 'Maximum urea fractional reabsorption', unit: 'fraction', default: 0.85, min: 0.6, max: 0.95, step: 0.01, group: 'Model',
    description: 'Ceiling at very low flow / high ADH.', source: 'Illustrative.',
  }),
  ureaFrAdhGain: p({
    key: 'ureaFrAdhGain', name: 'ADH gain on urea reabsorption', unit: '', default: 1.0, min: 0, max: 3, step: 0.1, group: 'Model',
    description: 'Logistic gain per ln(ADH).', source: 'ILLUSTRATIVE gain, chosen for qualitative behaviour.',
  }),
  ureaFrFlowGain: p({
    key: 'ureaFrFlowGain', name: 'Low-flow gain on urea reabsorption', unit: '', default: 1.0, min: 0, max: 3, step: 0.1, group: 'Model',
    description: 'Logistic gain per −ln(GFR/GFR0); GFR is the proxy for tubular flow in Phase 1.', source: 'ILLUSTRATIVE gain, chosen for qualitative behaviour.',
  }),
  autoregMapLow: p({
    key: 'autoregMapLow', name: 'Autoregulation lower limit', unit: 'mmHg', default: 80, min: 60, max: 90, step: 1, group: 'Model',
    description: 'Below this MAP the myogenic response is maximally dilated.', source: 'VERIFIED 2026-11-18. Autoregulation holds renal blood flow and GFR relatively constant over a renal arterial pressure of 80-180 mmHg, by the myogenic response and tubuloglomerular feedback. Outside that window autoregulation fails. The figure is a textbook convention rather than a sharp threshold.',
  }),
  autoregMapHigh: p({
    key: 'autoregMapHigh', name: 'Autoregulation upper limit', unit: 'mmHg', default: 180, min: 150, max: 200, step: 1, group: 'Model',
    description: 'Above this MAP the myogenic response is maximally constricted.', source: 'VERIFIED 2026-11-18. Upper end of the 80-180 mmHg autoregulatory range (see autoregMapLow).',
  }),
  myogenicGain: p({
    key: 'myogenicGain', name: 'Myogenic gain', unit: '', default: 0.85, min: 0, max: 1, step: 0.05, group: 'Model',
    description: 'Fraction (as an exponent) of the afferent resistance change needed for perfect flow constancy that the myogenic response supplies.',
    source: 'ILLUSTRATIVE gain.',
  }),
  tgfGain: p({
    key: 'tgfGain', name: 'TGF gain', unit: '', default: 3.0, min: 0, max: 5, step: 0.1, group: 'Model',
    description: 'Afferent resistance multiplier = (SNGFR / set-point)^gain, bounded. SNGFR is the Phase 1 proxy for macula densa NaCl delivery.',
    source: 'ILLUSTRATIVE gain.',
  }),
  tgfMin: p({
    key: 'tgfMin', name: 'TGF minimum multiplier', unit: '×', default: 0.7, min: 0.3, max: 1, step: 0.05, group: 'Model',
    description: 'Maximum TGF-mediated afferent dilation.', source: 'ILLUSTRATIVE bound.',
  }),
  tgfMax: p({
    key: 'tgfMax', name: 'TGF maximum multiplier', unit: '×', default: 1.6, min: 1, max: 3, step: 0.05, group: 'Model',
    description: 'Maximum TGF-mediated afferent constriction.', source: 'ILLUSTRATIVE bound.',
  }),
  venousToBowmanGain: p({
    key: 'venousToBowmanGain', name: "Venous → Bowman's pressure transmission", unit: 'mmHg/mmHg', default: 1.0, min: 0, max: 1, step: 0.05, group: 'Model',
    description: "Fraction of any rise in renal venous pressure (above the calibration value) added to Bowman's space pressure. Represents venous congestion raising renal interstitial and tubular pressure.",
    source: 'MODEL CHOICE, not a measurable quantity: an illustrative transmission factor. The direction is supported by classic isolated-kidney work on venous pressure (Winton FR, J Physiol 1931;72:49-61 - record confirmed, findings not read) and by cardiorenal physiology, but no quantitative human figure was found.',
  }),
  // --- Phase 3: extracellular volume and its neurohormonal consequences ---
  ecfVolume0: p({ key: 'ecfVolume0', name: 'Extracellular fluid volume (euvolaemic)', unit: 'L', default: 14, min: 8, max: 20, step: 0.5, group: 'Model',
    description: 'About 20% of body weight in a 70 kg adult. Sodium balance moves this volume.', source: 'VERIFIED 2026-11-18. Extracellular fluid is ~20% of body weight, i.e. ~14 L in a 70 kg adult, from the 60-40-20 rule (total body water 42 L = 28 L intracellular + 14 L extracellular).' }),
  volMapGain: p({ key: 'volMapGain', name: 'MAP change per % volume change', unit: 'mmHg/%', default: 1.0, min: 0, max: 3, step: 0.1, group: 'Model',
    description: 'Effective MAP = slider + gain × volume change (%). A 10% fall in volume lowers MAP ~10 mmHg after baroreflex compensation.', source: 'MODEL CHOICE, not a measurable quantity: an illustrative gain. Real baroreflex compensation is non-linear and depends on reflex capacity, age and medication.' }),
  volAngIIGain: p({ key: 'volAngIIGain', name: 'Angiotensin II per unit volume loss', unit: '', default: 8, min: 0, max: 16, step: 0.5, group: 'Model',
    description: 'Ang II × exp(gain × fractional volume loss): −20% volume → ×5.', source: 'MODEL CHOICE, not a measurable quantity: an illustrative gain. The direction (volume depletion activates the renin-angiotensin system) is standard physiology; the exponential form and its steepness are model choices.' }),
  volAldoGain: p({ key: 'volAldoGain', name: 'Aldosterone per unit volume loss', unit: '', default: 7, min: 0, max: 16, step: 0.5, group: 'Model',
    description: 'Aldosterone × exp(gain × fractional volume loss).', source: 'ILLUSTRATIVE.' }),
  volAdhGain: p({ key: 'volAdhGain', name: 'ADH per unit volume loss', unit: '', default: 6, min: 0, max: 16, step: 0.5, group: 'Model',
    description: 'ADH × exp(gain × fractional volume loss). Baroreceptor-mediated ADH release is steep once volume falls ~10%.', source: 'ILLUSTRATIVE.' }),
  volAnpGain: p({ key: 'volAnpGain', name: 'ANP per unit volume gain', unit: '', default: 5, min: 0, max: 16, step: 0.5, group: 'Model',
    description: 'ANP × exp(gain × fractional volume gain): atrial stretch releases ANP.', source: 'ILLUSTRATIVE.' }),
  volSympatheticGain: p({ key: 'volSympatheticGain', name: 'Sympathetic afferent constriction per unit volume loss', unit: '', default: 0.8, min: 0, max: 3, step: 0.1, group: 'Model',
    description: 'Afferent resistance × (1 + gain × fractional volume loss): −20% volume → afferent ×1.16.', source: 'ILLUSTRATIVE.' }),
  // --- Phase 3: hormone & drug effects (all ILLUSTRATIVE gains) ---
  angIIKfGain: p({ key: 'angIIKfGain', name: 'Angiotensin II → Kf reduction', unit: 'per × normal', default: 0.08, min: 0, max: 0.4, step: 0.01, group: 'Model',
    description: 'Kf × max(0.35, 1 − gain·(AII − 1)). Angiotensin II contracts mesangial cells, reducing filtration surface area. This term is why angiotensin II lowers GFR even though it raises glomerular pressure.',
    source: 'MODEL CHOICE, not a measurable quantity: a compromise. Angiotensin II contracting mesangial cells to lower Kf is standard physiology, but the SIZE here is constrained by two conflicting anchors - a larger value would match the small GFR fall on infusion yet reverse the required behaviour of ACEi in renal artery stenosis. See MODEL.md section 6.' }),
  angIIEfferentGain: p({
    key: 'angIIEfferentGain', name: 'Angiotensin II → efferent gain', unit: '/× normal', default: 0.3, min: 0, max: 0.5, step: 0.01, group: 'Model',
    description: 'Efferent resistance × (1 + gain·(AII − 1)). AII ×4 → efferent ×1.9.',
    source: 'FITTED to the renal plasma flow fall in the human infusion study of van der Bel / Hofman et al., J Am Heart Assoc 2016;5:e003185 (8 healthy volunteers at 3.0 ng/kg/min: RPF 660→467 mL/min/1.73m², GFR 121→110). The model matches the RPF fall (−30%) but NOT the small GFR fall — see MODEL.md §6, known mismatch.',
  }),
  angIIAfferentGain: p({
    key: 'angIIAfferentGain', name: 'Angiotensin II → afferent gain', unit: '/× normal', default: 0.03, min: 0, max: 0.3, step: 0.01, group: 'Model',
    description: 'Afferent resistance × (1 + gain·(AII − 1)); smaller than the efferent gain (preferential efferent action).', source: 'ILLUSTRATIVE.',
  }),
  angIIProximalGain: p({
    key: 'angIIProximalGain', name: 'Angiotensin II → proximal reabsorption', unit: 'fraction per × normal', default: 0.01, min: 0, max: 0.05, step: 0.005, group: 'Model',
    description: 'Proximal fractional Na reabsorption + gain·(AII − 1).', source: 'ILLUSTRATIVE.',
  }),
  aceiBlock: p({
    key: 'aceiBlock', name: 'ACEi/ARB maximal block', unit: 'fraction', default: 0.85, min: 0, max: 1, step: 0.05, group: 'Model',
    description: 'Effective angiotensin II = AII × (1 − block·dose).', source: 'ILLUSTRATIVE.',
  }),
  aceiAldoFraction: p({
    key: 'aceiAldoFraction', name: 'Angiotensin-dependent share of aldosterone', unit: 'fraction', default: 0.5, min: 0, max: 1, step: 0.05, group: 'Model',
    description: 'Aldosterone falls by this share of the ACEi/ARB block.', source: 'ILLUSTRATIVE; aldosterone also responds to potassium and ACTH.',
  }),
  anpAfferentGain: p({
    key: 'anpAfferentGain', name: 'ANP → afferent dilation', unit: '/× normal', default: 0.06, min: 0, max: 0.2, step: 0.01, group: 'Model',
    description: 'Afferent resistance × max(0.6, 1 − gain·(ANP − 1)).', source: 'ILLUSTRATIVE.',
  }),
  anpEfferentGain: p({
    key: 'anpEfferentGain', name: 'ANP → efferent constriction', unit: '/× normal', default: 0.04, min: 0, max: 0.2, step: 0.01, group: 'Model',
    description: 'Efferent resistance × (1 + gain·(ANP − 1)).', source: 'ILLUSTRATIVE.',
  }),
  nsaidMaxAfferent: p({
    key: 'nsaidMaxAfferent', name: 'NSAID maximal afferent constriction', unit: 'fraction', default: 0.5, min: 0, max: 1, step: 0.05, group: 'Model',
    description: 'Afferent × (1 + max·dose·PG-dependence). PG-dependence = clamp(basal + kAII·(AII_eff − 1) + kMAP·max(0, 90 − MAP), 0, 1.2).', source: 'ILLUSTRATIVE.',
  }),
  pgBasal: p({ key: 'pgBasal', name: 'Basal prostaglandin dependence', unit: '', default: 0.1, min: 0, max: 0.5, step: 0.05, group: 'Model', description: 'Healthy kidneys depend little on prostaglandins.', source: 'ILLUSTRATIVE.' }),
  pgAngIIGain: p({ key: 'pgAngIIGain', name: 'PG dependence per Ang II', unit: '/× normal', default: 0.3, min: 0, max: 1, step: 0.05, group: 'Model', description: 'Prostaglandin dependence rises with angiotensin II.', source: 'ILLUSTRATIVE.' }),
  pgMapGain: p({ key: 'pgMapGain', name: 'PG dependence per mmHg below 90', unit: '/mmHg', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Model', description: 'Prostaglandin dependence rises with low perfusion pressure.', source: 'ILLUSTRATIVE.' }),
  sglt2ProximalReduction: p({
    key: 'sglt2ProximalReduction', name: 'SGLT2i fall in proximal reabsorption', unit: 'fraction of filtered', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Model',
    description: 'Proximal fractional Na reabsorption − value·dose. 0.03 raises distal delivery ~9%.', source: 'MODEL CHOICE, not a measurable quantity: an illustrative size, chosen so the resulting true-GFR dip (~6%) lands inside the 3-6 mL/min/1.73m2 early eGFR dip seen in the SGLT2 outcome trials. Glucose itself is not modelled.',
  }),
  loopBlock: p({ key: 'loopBlock', name: 'Loop diuretic maximal TAL block', unit: 'fraction', default: 0.8, min: 0, max: 1, step: 0.05, group: 'Model', description: 'TAL fractional reabsorption × (1 − block·dose).', source: 'ILLUSTRATIVE.' }),
  loopTgfBlock: p({ key: 'loopTgfBlock', name: 'Loop diuretic block of macula densa sensing', unit: 'fraction', default: 0.72, min: 0, max: 1, step: 0.05, group: 'Model', description: 'Macula densa signal × (1 − block·dose) (NKCC2 is the sensor).', source: 'MODEL CHOICE, not a measurable quantity: chosen (0.72) so the blunted macula densa sensing roughly cancels the increased NaCl delivery, reproducing the clinical observation that a loop diuretic does not acutely swing GFR. NKCC2 being the macula densa sensor is standard physiology; the number is a model choice.' }),
  thiazideBlock: p({ key: 'thiazideBlock', name: 'Thiazide maximal DCT block', unit: 'fraction', default: 0.8, min: 0, max: 1, step: 0.05, group: 'Model', description: 'DCT fractional reabsorption × (1 − block·dose).', source: 'ILLUSTRATIVE.' }),
  mraBlock: p({ key: 'mraBlock', name: 'MRA maximal block', unit: 'fraction', default: 0.85, min: 0, max: 1, step: 0.05, group: 'Model', description: 'Effective aldosterone × (1 − block·dose).', source: 'ILLUSTRATIVE.' }),
  // --- Phase 3: illustrative tubule (fractions of the load DELIVERED to each segment) ---
  fracProximal: p({ key: 'fracProximal', name: 'Proximal Na reabsorption', unit: 'fraction of filtered', default: 0.67, min: 0.5, max: 0.8, step: 0.01, group: 'Model', description: 'About two-thirds of filtered sodium.', source: 'VERIFIED 2026-11-18. The proximal tubule reabsorbs about two-thirds of filtered sodium. Standard split: proximal 67%, loop 25%, distal 5%, collecting duct ~3%, leaving <1% excreted.' }),
  fracLoop: p({ key: 'fracLoop', name: 'Thick ascending limb Na reabsorption', unit: 'fraction of delivered', default: 0.76, min: 0.5, max: 0.9, step: 0.01, group: 'Model', description: '≈25% of filtered sodium.', source: 'VERIFIED 2026-11-18. 0.76 of what reaches the loop equals ~25% of the FILTERED load, the standard thick-ascending-limb figure.' }),
  fracDistal: p({ key: 'fracDistal', name: 'DCT Na reabsorption', unit: 'fraction of delivered', default: 0.62, min: 0.3, max: 0.9, step: 0.01, group: 'Model', description: '≈5% of filtered sodium.', source: 'VERIFIED 2026-11-18. 0.62 of what reaches the distal tubule equals ~5% of the FILTERED load, the standard early-distal figure (mainly the Na-Cl cotransporter).' }),
  fracCollecting: p({ key: 'fracCollecting', name: 'Collecting duct Na reabsorption', unit: 'fraction of delivered', default: 0.775, min: 0.2, max: 0.95, step: 0.005, group: 'Model', description: 'FITTED (scripts/fit3.ts) so baseline sodium excretion matches a 150 mmol/day intake, giving FENa ≈ 0.7%; euvolaemia is then a true steady state.', source: 'FITTED (scripts/fit3.ts) so baseline sodium excretion matches a 150 mmol/day intake, giving FENa ~0.7%; euvolaemia is then a true steady state. Equals ~3% of the filtered load, the standard collecting-duct figure.' }),
  aldoCollectingGain: p({ key: 'aldoCollectingGain', name: 'Aldosterone → collecting duct reabsorption', unit: 'per ln(×)', default: 0.12, min: 0, max: 0.3, step: 0.01, group: 'Model', description: 'CD fraction + gain·ln(aldo_eff).', source: 'ILLUSTRATIVE.' }),
  anpCollectingGain: p({ key: 'anpCollectingGain', name: 'ANP → collecting duct reabsorption', unit: 'per ln(×)', default: 0.12, min: 0, max: 0.3, step: 0.01, group: 'Model', description: 'CD fraction − gain·ln(ANP).', source: 'ILLUSTRATIVE.' }),
  ureaPerGramProtein: p({ key: 'ureaPerGramProtein', name: 'Urea generated per gram of protein', unit: 'mmol/g', default: 5.7, min: 3, max: 8, step: 0.1, group: 'Model',
    description: 'Protein is ~16% nitrogen and urea carries 28 g of nitrogen per mol, so 1 g of protein yields ~5.7 mmol of urea.',
    source: 'VERIFIED 2026-11-18. Arithmetic: protein is ~16% nitrogen, so 1 g yields 0.16 g N; urea carries 28 g N per mol (two nitrogens), giving 0.16/28 = 5.7 mmol urea per gram of protein. Assumes all protein nitrogen leaves as urea, ignoring faecal and non-urea nitrogen.' }),
  plasmaSodium: p({ key: 'plasmaSodium', name: 'Plasma sodium (fixed)', unit: 'mmol/L', default: 140, min: 130, max: 150, step: 1, group: 'Model', description: 'Held constant: body sodium and volume are not tracked.', source: 'Conventional normal value.' }),
  potassiumExcretion0: p({ key: 'potassiumExcretion0', name: 'Baseline K excretion', unit: 'mmol/day', default: 70, min: 30, max: 150, step: 5, group: 'Model', description: 'Matches a typical dietary intake.', source: 'VERIFIED 2026-11-18. Final potassium excretion is 10-20% of the filtered load and is set by distal secretion, not filtration. At baseline this model gives a fractional excretion of ~11%, inside that range, and 70 mmol/day matches a typical dietary intake at steady state.' }),
  potassiumAldoExp: p({ key: 'potassiumAldoExp', name: 'K secretion exponent on aldosterone', unit: '', default: 0.5, min: 0, max: 1, step: 0.05, group: 'Model', description: 'K excretion ∝ aldo_eff^exp.', source: 'ILLUSTRATIVE.' }),
  potassiumFlowExp: p({ key: 'potassiumFlowExp', name: 'K secretion exponent on distal Na delivery', unit: '', default: 0.5, min: 0, max: 1, step: 0.05, group: 'Model', description: 'K excretion ∝ (distal delivery)^exp.', source: 'ILLUSTRATIVE.' }),
  // --- Phase 4: water, potassium and the osmolality profile (qualitative) ---
  plasmaPotassium: p({ key: 'plasmaPotassium', name: 'Plasma potassium (fixed)', unit: 'mmol/L', default: 4.0, min: 2.5, max: 6.5, step: 0.1, group: 'Model',
    description: 'Held constant: body potassium is not tracked, so the model shows what is excreted, never a blood level.', source: 'Conventional normal value.' }),
  plasmaOsmolality: p({ key: 'plasmaOsmolality', name: 'Plasma osmolality (fixed)', unit: 'mOsm/kg', default: 290, min: 270, max: 310, step: 1, group: 'Model',
    description: 'Filtrate leaves the glomerulus isosmotic with plasma.', source: 'Conventional normal value.' }),
  fracWaterDescending: p({ key: 'fracWaterDescending', name: 'Descending limb water reabsorption', unit: 'fraction of delivered', default: 0.45, min: 0, max: 0.8, step: 0.05, group: 'Model',
    description: 'Water leaves the water-permeable descending limb, so about 18% of the filtered volume reaches the hairpin.', source: 'CALIBRATION CHOICE: set so that ~18% of filtered volume reaches the thick ascending limb, matching the textbook figure of 15-20%. The underlying countercurrent exchange is not modelled.' }),
  talEndOsmolality: p({ key: 'talEndOsmolality', name: 'Osmolality leaving the thick ascending limb', unit: 'mOsm/kg', default: 100, min: 60, max: 290, step: 5, group: 'Model',
    description: 'The thick ascending limb removes NaCl but is water-impermeable, so fluid leaves it dilute ("the diluting segment"). Rises towards isosmotic when a loop diuretic blocks that transport.', source: 'VERIFIED 2026-11-18. The thick ascending limb removes NaCl while being water-impermeable, so fluid leaves it hypotonic at ~100 mOsm/kg - the \'diluting segment\'. Consistent with the ~50-100 mOsm/kg floor reachable when ADH is absent.' }),
  kFracProximal: p({ key: 'kFracProximal', name: 'Proximal potassium reabsorption', unit: 'fraction of filtered', default: 0.67, min: 0.4, max: 0.85, step: 0.01, group: 'Model',
    description: 'Potassium is reabsorbed with sodium and water in the proximal tubule.', source: 'VERIFIED 2026-11-18. About two-thirds of filtered potassium is reabsorbed passively in the proximal tubule, largely by solvent drag with sodium and water.' }),
  kFracLoop: p({ key: 'kFracLoop', name: 'Loop potassium reabsorption', unit: 'fraction of filtered', default: 0.2, min: 0, max: 0.4, step: 0.01, group: 'Model',
    description: 'A further fifth of filtered potassium is reabsorbed in the thick ascending limb (via NKCC2).', source: 'VERIFIED 2026-11-18. The thick ascending limb reabsorbs a further ~20% of filtered potassium via NKCC2, the transporter loop diuretics block. Sources give 20-30%; the lower end is used here.' }),
  urineOsm0: p({ key: 'urineOsm0', name: 'Baseline urine osmolality', unit: 'mOsm/kg', default: 600, min: 300, max: 900, step: 10, group: 'Model', description: 'At normal ADH.', source: 'VERIFIED 2026-11-18. With normal fluid intake and diet, urine osmolality is typically ~500-850 mOsm/kg, so 600 is representative.' }),
  urineOsmMin: p({ key: 'urineOsmMin', name: 'Minimum urine osmolality', unit: 'mOsm/kg', default: 50, min: 30, max: 100, step: 5, group: 'Model', description: 'Maximally dilute urine.', source: 'VERIFIED 2026-11-18. Maximally dilute urine is ~50-100 mOsm/kg when ADH is absent.' }),
  urineOsmMax: p({ key: 'urineOsmMax', name: 'Maximum urine osmolality', unit: 'mOsm/kg', default: 1200, min: 800, max: 1400, step: 10, group: 'Model', description: 'Maximally concentrated urine with an intact medullary gradient.', source: 'VERIFIED 2026-11-18. Maximally concentrated urine is ~1200 mOsm/kg (some sources say up to 1400) with maximal ADH and an intact medullary gradient. The upper limit falls with age.' }),
  compensationExponent: p({
    key: 'compensationExponent', name: 'Hyperfiltration exponent', unit: '', default: 0.5, min: 0, max: 1, step: 0.05, group: 'Model',
    description: 'Adaptation factor A = (N0/N)^exponent applied to Kf, afferent dilation (A^-0.5) and TGF set-point, only when N < N0.',
    source: 'ILLUSTRATIVE choice.',
  }),
} as const satisfies Record<string, ParamDef>;

export type ConstantKey = keyof typeof MODEL_CONSTANTS;
export type ModelConstants = { [K in ConstantKey]: number };

export function defaultConstants(): ModelConstants {
  const out = {} as ModelConstants;
  for (const k of Object.keys(MODEL_CONSTANTS) as ConstantKey[]) out[k] = MODEL_CONSTANTS[k].default;
  return out;
}

export function defaultInputs(): ModelInputs {
  const num = {} as Record<InputKey, number>;
  for (const k of Object.keys(INPUT_DEFS) as InputKey[]) num[k] = INPUT_DEFS[k].default;
  return {
    ...num,
    sex: TOGGLE_DEFS.sex.default,
    autoregulation: TOGGLE_DEFS.autoregulation.default,
    compensation: TOGGLE_DEFS.compensation.default,
    creatinineSecretion: TOGGLE_DEFS.creatinineSecretion.default,
    volumeLinked: true,
    nsaid: false,
    acei: false,
    sglt2: false,
    loopDiuretic: false,
    thiazide: false,
    mra: false,
  };
}

/** Baseline calibration targets asserted in tests (healthy adult). From the project brief. */
export const CALIBRATION_RANGES = {
  gfr: [100, 120], // mL/min
  rpf: [550, 700], // mL/min
  filtrationFraction: [0.17, 0.22],
  pgc: [45, 55], // mmHg
  pbs: [10, 15], // mmHg
  piAfferent: [25, 28], // mmHg
  creatinine: [60, 90], // µmol/L
  urea: [3, 8], // mmol/L
} as const;
