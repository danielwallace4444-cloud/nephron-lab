/**
 * Scenario presets. Each sets inputs (and a starting extracellular volume) on top of
 * the healthy baseline, with a short teaching note. From Phase 3 these use the real
 * hormone and drug controls rather than standing in for them.
 */
import type { ModelInputs } from './model';

export interface ScenarioStep {
  label: string;
  /** Button text that moves to this step. */
  action: string;
  inputs: Partial<ModelInputs>;
  note: string;
}

export interface Scenario {
  id: string;
  title: string;
  short: string;
  inputs: Partial<ModelInputs>;
  /** Starting extracellular volume, % from euvolaemia. */
  volumePercent?: number;
  note: string;
  /** What to watch, phrased as a prompt. */
  watch: string;
  next?: ScenarioStep;
  /** Disclosure shown when the preset simplifies or stands in for something. */
  modelNote?: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'prerenal',
    title: 'Volume depletion (prerenal)',
    short: 'Prerenal',
    inputs: { fluidBalance: -0.3, sodiumIntake: 40 },
    volumePercent: -18,
    note:
      'Gastroenteritis: modest ongoing losses and almost nothing taken by mouth. Extracellular volume is down about 18%, so perfusion pressure falls and the renin–angiotensin system, aldosterone and ADH all rise. The kidney holds on to sodium and water avidly, and angiotensin II constricts the efferent arteriole to prop up filtration pressure.',
    watch: 'Fractional sodium excretion falls below 0.5%, urine is concentrated and scanty, and urea rises more than creatinine.',
    modelNote:
      'The ongoing losses matter: with normal eating and drinking the kidney would simply retain sodium and refill the patient within a couple of days. Set fluid balance back to zero to watch exactly that. Two numbers run hotter than real life: fractional sodium excretion falls further than the <1% usually quoted, and potassium excretion rises with aldosterone where a truly oliguric patient would excrete less because so little fluid reaches the distal nephron.',
  },
  {
    id: 'nsaid-prerenal',
    title: 'NSAID in volume depletion',
    short: 'NSAID + dry',
    inputs: { nsaid: true, fluidBalance: -0.3, sodiumIntake: 40 },
    volumePercent: -18,
    note:
      'The same dehydrated patient takes an NSAID. With angiotensin II high and pressure low, the afferent arteriole is being held open by prostaglandins; blocking them lets it constrict, and GFR falls much further than the volume depletion alone would cause.',
    watch: 'Compare with the prerenal preset. Same volume, but a narrower afferent arteriole and a markedly lower GFR.',
    modelNote:
      'How much prostaglandins matter is modelled as rising with angiotensin II and with low perfusion pressure; the size of that dependence is illustrative. Ongoing losses keep the patient dry, as in the prerenal preset.',
  },
  {
    id: 'ras-acei',
    title: 'ACEi/ARB in bilateral renal artery stenosis',
    short: 'RAS + ACEi',
    inputs: { map: 60, angiotensinII: 4, volumeLinked: false },
    note:
      'Stenoses drop the pressure reaching both kidneys to about 60 mmHg. The afferent arteriole is already maximally dilated by autoregulation, so the only thing still holding filtration up is angiotensin II constricting the efferent arteriole. Renal plasma flow is low and filtration has become efferent-dependent.',
    watch: 'Note how low the plasma flow is, and that GFR is being held up by efferent tone alone. Then start the ACE inhibitor and watch the filtration fraction collapse.',
    next: {
      label: 'ACE inhibitor started',
      action: 'Start ACE inhibitor',
      inputs: { acei: true },
      note:
        'Blocking angiotensin II relaxes the efferent arteriole. Glomerular pressure falls, the filtration fraction collapses and GFR drops sharply, even though renal plasma flow rises. Creatinine climbs over the following days.',
    },
    modelNote:
      'The MAP slider stands for the perfusion pressure beyond the stenoses. Two honest caveats: classically the filtration fraction is RAISED in renal artery stenosis, but this model holds it near normal because angiotensin II also lowers Kf (MODEL.md §6) — the collapse in filtration fraction when the ACE inhibitor is given is reproduced correctly, the raised starting value is not. Volume linkage is also off here, so the volume readout drifts upward as sodium is retained but has no effect on anything.',
  },
  {
    id: 'triple-whammy',
    title: 'Triple whammy: ACEi/ARB + diuretic + NSAID',
    short: 'Triple whammy',
    inputs: { acei: true, loopDiuretic: true },
    volumePercent: -8,
    note:
      'A common real-world combination. The diuretic has caused volume depletion, so the kidney leans on angiotensin II (efferent constriction) and prostaglandins (afferent dilation) to hold GFR up. The ACE inhibitor has already removed the first of those.',
    watch: 'GFR is holding for now. Then add the NSAID and remove the other support.',
    next: {
      label: 'NSAID added',
      action: 'Add NSAID',
      inputs: { nsaid: true },
      note:
        'With the efferent arteriole relaxed by the ACE inhibitor and the afferent arteriole constricted by the NSAID, both ends of the glomerulus now work against filtration in a volume-depleted patient. GFR falls and creatinine rises over the next few days.',
    },
    modelNote: 'Volume keeps responding to sodium balance here, so the diuretic deepens the depletion over simulated days.',
  },
  {
    id: 'sglt2',
    title: 'Starting an SGLT2 inhibitor',
    short: 'SGLT2i',
    inputs: { sglt2: true },
    note:
      'Blocking proximal sodium-glucose reabsorption sends more sodium to the macula densa. Tubuloglomerular feedback reads that as too much filtration and constricts the afferent arteriole, so glomerular pressure and GFR fall a little. This early dip is expected, not injury.',
    watch: 'True GFR dips at once, but eGFR only follows over several days as creatinine rises. Switch autoregulation off and the dip disappears.',
    modelNote: 'Glucose is not modelled: glucosuria is flagged but the osmotic effect of urinary glucose on urine volume is not included.',
  },
  {
    id: 'nephron-loss',
    title: 'Nephron loss with compensatory hyperfiltration',
    short: 'Nephron loss',
    inputs: { nephronsPerKidney: 0.5, compensation: true },
    note:
      'Half the nephrons are gone, as after a nephrectomy. The survivors enlarge and dilate their afferent arterioles, so each filters more: single-nephron GFR and glomerular pressure rise, and whole-kidney GFR falls by less than half.',
    watch: 'Turn "Compensatory hyperfiltration" off to see GFR drop to exactly half.',
  },
  {
    id: 'obstruction',
    title: 'Ureteric obstruction',
    short: 'Obstruction',
    inputs: { bowmanPressure: 30 },
    note:
      "Back-pressure from an obstructed outflow raises the pressure in Bowman's space, which directly opposes filtration. Net filtration pressure and GFR fall even though blood flow through the glomerulus is preserved.",
    watch:
      "Watch Bowman's capsule swell and darken, and fewer filtrate particles cross it. Renal plasma flow stays up — even rises a little as feedback dilates the afferent arteriole — so this is back-pressure, not hypoperfusion. Fractional sodium excretion rises, unlike the prerenal picture.",
    modelNote:
      'Both kidneys are identical here, so this behaves like bilateral obstruction (or obstruction of a single functioning kidney). The later fall in renal blood flow is not modelled.',
  },
  {
    id: 'haemorrhage',
    title: 'Haemorrhage with hypotension',
    short: 'Haemorrhage',
    inputs: { sodiumIntake: 40 },
    volumePercent: -28,
    note:
      'A large, sudden loss of extracellular volume. Perfusion pressure falls below the autoregulatory range, so the afferent arteriole is already wide open and can protect filtration no further; sympathetic tone works against that dilation. A strongly activated renin–angiotensin system clamps the efferent arteriole, which is all that keeps any filtration going. GFR falls steeply and the kidney virtually stops excreting sodium.',
    watch: 'Creatinine takes days to catch up with the fall in GFR, so eGFR badly overestimates true GFR on day one. Watch it climb while GFR slowly recovers as the kidney refills the patient.',
    modelNote:
      'Red cells and haematocrit are not modelled, so this is the volume loss of haemorrhage rather than the anaemia. Intake is low (the patient is not eating), so volume refills slowly and GFR recovers over days — in reality this patient would be resuscitated; do that with positive fluid balance under Intake. Angiotensin II reaches about nine times normal here, at the top of any physiological range.',
  },
];
