/**
 * Plain-language, rule-based account of what the model is doing right now, written for a
 * medical student: each line names the mechanism and, where there is one, the bedside
 * clue that goes with it. Shown in the "What's happening?" card.
 */
import { DRUG_DEFS, type DrugKey, type ModelInputs, type Snapshot } from './model';

const rel = (a: number, b: number) => (b ? (a - b) / b : 0);
const pc = (x: number) => `${Math.abs(Math.round(x * 100))}%`;

export function explain(s: Snapshot, b: Snapshot, inp: ModelInputs): string[] {
  const h = s.haemo;
  const hb = b.haemo;
  const e = s.effects;
  const t = s.tubule;
  const out: string[] = [];
  const fenaPct = t.fena * 100;
  const urCr = (1000 * s.urea) / s.creatinine;

  // ---- volume status: the commonest driver, and the one with the clearest bedside signs
  if (s.volumePercent < -4) {
    out.push(
      `Volume depletion (${Math.abs(Math.round(s.volumePercent))}% down) drops perfusion pressure to ${Math.round(e.map)} mmHg. Renin–angiotensin, aldosterone and ADH all switch on${
        inp.acei ? ', though the ACE inhibitor is blocking angiotensin II' : ''
      }.`,
    );
    if (fenaPct < 1) out.push(`Classic prerenal picture: FENa ${fenaPct.toFixed(2)}% (under 1%) with urine at ${Math.round(t.urineOsm)} mOsm/kg — tubules intact and reabsorbing hard, so this is hypoperfusion, not tubular injury.`);
  } else if (s.volumePercent > 4) {
    out.push(`Volume expansion (${Math.round(s.volumePercent)}% up) suppresses renin–angiotensin and releases ANP, so the kidney dumps sodium: FENa ${fenaPct.toFixed(2)}%.`);
  }

  // ---- the urea:creatinine clue
  if (urCr > 100 && s.volumePercent < -4) out.push(`Urea is rising out of proportion to creatinine (ratio ${Math.round(urCr)}): slow tubular flow and high ADH drive urea reabsorption. Another pointer to a prerenal cause.`);

  // ---- drugs, each by its mechanism and its clinical consequence
  if (inp.acei) {
    out.push(
      inp.angiotensinII > 1.5 || s.volumePercent < -6
        ? `This kidney was leaning on angiotensin II to constrict the efferent arteriole and hold filtration pressure up. The ACE inhibitor has taken that away: filtration fraction is down to ${pc(h.filtrationFraction)} and GFR falls — the mechanism behind the creatinine rise after starting an ACEi in renal artery stenosis or hypovolaemia.`
        : `The ACE inhibitor relaxes the efferent arteriole: renal plasma flow rises, filtration fraction falls, GFR barely moves. That is the expected picture in a well-perfused kidney — and the reason a small creatinine rise on starting is acceptable.`,
    );
    if (inp.mra || t.kExcretionPerDay < 0.6 * b.tubule.kExcretionPerDay) out.push(`Aldosterone is suppressed, so potassium excretion has fallen to ${Math.round(t.kExcretionPerDay)} mmol/day${inp.mra ? ' — with an MRA on board too, this is the combination that causes hyperkalaemia' : ' — watch the potassium'}.`);
  }
  if (inp.nsaid) {
    out.push(
      e.pgDependence > 0.4
        ? `Prostaglandins were holding this afferent arteriole open against a high angiotensin II / low perfusion state. The NSAID blocks them, the afferent constricts, and GFR drops. This is why NSAIDs are dangerous in the dehydrated, not in the well.`
        : `The NSAID is doing almost nothing: a well-perfused kidney barely depends on prostaglandins for afferent tone. Reach for the volume slider to see why the same tablet is hazardous in a dry patient.`,
    );
  }
  if (inp.sglt2) out.push(`The SGLT2 inhibitor leaves sodium in the proximal tubule, so the macula densa senses more salt and tubuloglomerular feedback constricts the afferent arteriole. The result is an expected early dip in eGFR — a haemodynamic effect to be ridden out, not a reason to stop the drug.`);
  if (inp.loopDiuretic) out.push(`Blocking NKCC2 in the thick ascending limb produces a brisk natriuresis, wastes potassium, and abolishes the medullary gradient, so urine cannot be concentrated (max ${Math.round(t.maxUrineOsm)} mOsm/kg).`);
  if (inp.thiazide && !inp.loopDiuretic) out.push(`The thiazide blocks the distal Na-Cl cotransporter. Only about 5% of filtered sodium reaches that segment, so the natriuresis is modest — but the extra distal delivery still costs potassium.`);
  if (inp.mra && !inp.acei) out.push(`Blocking aldosterone in the collecting duct gives a mild natriuresis and retains potassium — useful in heart failure and cirrhosis, risky with an ACEi or in CKD.`);
  if ((Object.keys(DRUG_DEFS) as DrugKey[]).filter((k) => inp[k]).length >= 3 && s.volumePercent < -4)
    out.push(`Three nephrotoxic hits at once in a volume-depleted patient — the "triple whammy" (ACEi/ARB + diuretic + NSAID), one of the commonest avoidable causes of community-acquired AKI.`);

  // ---- direct haemodynamic settings
  if (inp.map < 80 && inp.autoregulation && s.volumePercent > -4) out.push(`Below about 80 mmHg autoregulation is exhausted: the afferent arteriole is already maximally dilated, so GFR now falls directly with blood pressure.`);
  else if (!inp.autoregulation && Math.abs(e.map - 93) > 3) out.push(`Autoregulation is switched off, so glomerular pressure tracks blood pressure directly — useful for seeing the raw Starling mechanics, not physiological.`);
  if (inp.afferentMult > 1.05) out.push(`Afferent constriction cuts both renal plasma flow and glomerular pressure, so GFR and filtration fraction fall together.`);
  if (inp.efferentMult > 1.05)
    out.push(
      rel(h.gfr, hb.gfr) > 0.02
        ? `Efferent constriction raises glomerular pressure and filtration fraction (${pc(h.filtrationFraction)}) while lowering plasma flow — GFR is maintained at the cost of a hyperfiltering glomerulus.`
        : `Efferent constriction is now severe: so little plasma passes that oncotic pressure rises fast enough to stop filtration early, and GFR falls despite high glomerular pressure. This is the far side of the biphasic efferent curve.`,
    );
  if (inp.efferentMult < 0.95) out.push(`Efferent dilation lets pressure escape the glomerulus: filtration fraction falls and GFR drops even though plasma flow rises.`);
  if (h.pbs > hb.pbs + 1) out.push(`Raised pressure in Bowman's space opposes filtration directly — the post-renal mechanism. Blood flow is preserved, so the problem is back-pressure, not perfusion.`);
  if (inp.plasmaProtein > 7.2) out.push(`A higher plasma protein raises oncotic pressure, which opposes filtration throughout the capillary.`);
  if (inp.nephronsPerKidney < 0.95)
    out.push(
      inp.compensation
        ? `With fewer nephrons the survivors hyperfiltrate (${Math.round(h.sngfr)} vs ${Math.round(hb.sngfr)} nL/min each), so total GFR falls less than nephron count does — which is why creatinine is a late and insensitive marker of CKD, and why that same hyperfiltration drives further scarring.`
        : `Nephron loss without compensation: GFR falls in direct proportion to the number of nephrons.`,
    );
  if (e.adhEffective > 1.5 && s.volumePercent > -4) out.push(`High ADH concentrates the urine (${Math.round(t.urineOsm)} mOsm/kg) and increases urea reabsorption, lifting urea more than creatinine.`);

  // ---- the non-steady-state trap
  const crGap = isFinite(s.steadyCreatinine) ? rel(s.creatinine, s.steadyCreatinine) : -1;
  if (Math.abs(crGap) > 0.03)
    out.push(
      crGap < 0
        ? `Creatinine has not caught up yet, so eGFR (${Math.round(s.egfr)}) still overestimates the true GFR (${Math.round(s.trueGfr)}). eGFR equations assume a steady state — in acute kidney injury they lag by a day or more.`
        : `Creatinine is still falling, so eGFR currently understates the recovery in true GFR.`,
    );

  if (out.length === 0) {
    if (Math.abs(rel(h.gfr, hb.gfr)) < 0.03)
      out.push(`Healthy nephron at steady state: about ${Math.round(hb.filtrationFraction * 100)}% of arriving plasma is filtered, and FENa is under 1%. Change something, or pick a scenario.`);
    else out.push(`GFR is ${rel(h.gfr, hb.gfr) > 0 ? 'up' : 'down'} ${pc(rel(h.gfr, hb.gfr))} from healthy.`);
  }
  return out.slice(0, 4);
}
