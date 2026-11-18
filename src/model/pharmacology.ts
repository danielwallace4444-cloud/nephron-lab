/**
 * Volume status, hormones and drugs → haemodynamic modifiers and tubular fractions.
 * Pure TS. Directions follow standard physiology; the gains are illustrative and are
 * listed with their sources in parameters.ts. See MODEL.md §5 for the evidence used.
 */
import type { ExtraModifiers } from './glomerulus';
import type { ModelConstants, ModelInputs } from './parameters';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export interface Effects {
  mods: ExtraModifiers;
  /** Effective mean arterial pressure after any volume effect (mmHg). */
  map: number;
  /** Effective hormone levels (× normal) after volume linkage and drugs. */
  angIIEffective: number;
  aldoEffective: number;
  adhEffective: number;
  anpEffective: number;
  /** Volume relative to euvolaemia, as a fraction (−0.2 = 20% depleted). */
  volumeFraction: number;
  /** 0–1.2: how much afferent tone depends on prostaglandins (sets the NSAID effect). */
  pgDependence: number;
  /** Fractional Na reabsorption: proximal of filtered; the rest of what reaches that segment. */
  fProximal: number;
  fLoop: number;
  fDistal: number;
  fCollecting: number;
  /** Macula densa sensitivity (1 = normal; loop diuretics block the NKCC2 sensor). */
  mdSensitivity: number;
  /** Medullary gradient relative to normal (loop diuretics wash it out). */
  medullaryGradient: number;
  /** Doses actually in effect (0 when the drug is off). */
  doses: { nsaid: number; acei: number; sglt2: number; loop: number; thiazide: number; mra: number };
}

/**
 * @param ecfVolume current extracellular fluid volume (L); euvolaemia = c.ecfVolume0.
 */
export function computeEffects(inp: ModelInputs, c: ModelConstants, ecfVolume = c.ecfVolume0): Effects {
  const dose = (on: boolean, d: number) => (on ? d : 0);
  const doses = {
    nsaid: dose(inp.nsaid, inp.nsaidDose),
    acei: dose(inp.acei, inp.aceiDose),
    sglt2: dose(inp.sglt2, inp.sglt2Dose),
    loop: dose(inp.loopDiuretic, inp.loopDose),
    thiazide: dose(inp.thiazide, inp.thiazideDose),
    mra: dose(inp.mra, inp.mraDose),
  };

  // --- volume status drives pressure and the neurohormonal background ---
  const vol = inp.volumeLinked ? clamp((ecfVolume - c.ecfVolume0) / c.ecfVolume0, -0.4, 0.4) : 0;
  const map = clamp(inp.map + c.volMapGain * vol * 100, 20, 220);
  const angIIBase = inp.angiotensinII * Math.exp(-c.volAngIIGain * vol);
  const aldoBase = inp.aldosterone * Math.exp(-c.volAldoGain * vol);
  const adhEffective = clamp(inp.adh * Math.exp(-c.volAdhGain * vol), 0.05, 40);
  const anpEffective = clamp(inp.anp * Math.exp(c.volAnpGain * vol), 0.05, 20);
  const sympathetic = 1 + c.volSympatheticGain * Math.max(0, -vol);

  // --- drugs acting on the hormones ---
  const aceiFrac = clamp(c.aceiBlock * doses.acei, 0, 0.98);
  const angII = clamp(angIIBase * (1 - aceiFrac), 0.02, 30);
  const aldo = clamp(aldoBase * (1 - c.aceiAldoFraction * aceiFrac) * (1 - clamp(c.mraBlock * doses.mra, 0, 0.98)), 0.02, 30);

  // Prostaglandin support of the afferent arteriole: small in health, large when the
  // kidney is under-perfused and the renin-angiotensin system is switched on. This is
  // what NSAIDs remove.
  //
  // This uses the PRE-DRUG angiotensin II (angIIBase), not the level after an ACE
  // inhibitor. The underlying hypovolaemic, RAAS-activated state is what makes the
  // afferent arteriole prostaglandin-dependent; blocking angiotensin II does not undo
  // that. Using the post-blockade level would make an ACE inhibitor protect against an
  // NSAID, which is the opposite of the triple-whammy interaction.
  const pgDependence = clamp(c.pgBasal + c.pgAngIIGain * Math.max(0, angIIBase - 1) + c.pgMapGain * Math.max(0, 90 - map), 0, 1.2);

  const afferent =
    (1 + c.angIIAfferentGain * (angII - 1)) *
    Math.max(0.6, 1 - c.anpAfferentGain * (anpEffective - 1)) *
    (1 + c.nsaidMaxAfferent * doses.nsaid * pgDependence) *
    sympathetic;
  const efferent = Math.max(0.3, 1 + c.angIIEfferentGain * (angII - 1)) * (1 + c.anpEfferentGain * (anpEffective - 1));
  // Angiotensin II contracts mesangial cells, lowering Kf.
  const kf = Math.max(0.35, 1 - c.angIIKfGain * (angII - 1));

  const fProximal = clamp(c.fracProximal + c.angIIProximalGain * (angII - 1) - c.sglt2ProximalReduction * doses.sglt2, 0.4, 0.85);
  const fLoop = clamp(c.fracLoop * (1 - clamp(c.loopBlock * doses.loop, 0, 0.98)), 0, 0.95);
  const fDistal = clamp(c.fracDistal * (1 - clamp(c.thiazideBlock * doses.thiazide, 0, 0.98)), 0, 0.95);
  const fCollecting = clamp(c.fracCollecting + c.aldoCollectingGain * Math.log(aldo) - c.anpCollectingGain * Math.log(anpEffective), 0.15, 0.985);

  const mdSensitivity = 1 - clamp(c.loopTgfBlock * doses.loop, 0, 0.98);
  // NaCl arriving at the macula densa (end of the thick ascending limb), relative to normal.
  const mdDelivery = ((1 - fProximal) * (1 - fLoop)) / ((1 - c.fracProximal) * (1 - c.fracLoop));
  // The medullary gradient is built by NaCl transport in the thick ascending limb.
  const tal = ((1 - fProximal) * fLoop) / ((1 - c.fracProximal) * c.fracLoop);

  return {
    mods: { afferent, efferent, kf, tgfSignal: mdDelivery * mdSensitivity },
    map,
    angIIEffective: angII,
    aldoEffective: aldo,
    adhEffective,
    anpEffective,
    volumeFraction: vol,
    pgDependence,
    fProximal,
    fLoop,
    fDistal,
    fCollecting,
    mdSensitivity,
    medullaryGradient: clamp(tal, 0, 1.2),
    doses,
  };
}
