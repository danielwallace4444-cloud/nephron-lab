# Nephron Lab: model description

> **Illustrative model, not for clinical decisions.** Nephron Lab is a conceptual teaching
> simulator. It is not patient-specific and does not predict what will happen to real patients.
> Its numeric gains are chosen to show qualitative behaviour. They are not fitted to patient data.

Every parameter, with its unit, default, range, description and source, is in
[`src/model/parameters.ts`](src/model/parameters.ts). Any source marked **TODO verify** has not been
confirmed against a primary reference.

Status: **Phase 4 (tubule segments), 2026-11-18.** Phases 1–3 are described below and unchanged except where noted.

---

## 1. Confirmed references

| Item | Reference | How it was confirmed |
|---|---|---|
| Single-nephron Starling-force model | Deen WM, Robertson CR, Brenner BM. A model of glomerular ultrafiltration in the rat. *Am J Physiol* 1972;223(5):1178–83. | Bibliographic record and abstract found. Full text not read. |
| Oncotic pressure polynomial | Landis EM, Pappenheimer JR. Exchange of substances through the capillary walls. *Handbook of Physiology*, Sect. 2 Circulation, Vol. II, Ch. 29. American Physiological Society, 1963. Polynomial π = 2.1C + 0.16C² + 0.009C³ (C = total protein, g/dL). | The polynomial is confirmed through a secondary source (*Lymphology* journal reproduction). The chapter, volume and year are confirmed from citing references. **Page numbers (and editor) are TODO verify.** |
| eGFR | Inker LA et al. New creatinine- and cystatin C-based equations to estimate GFR without race. *N Engl J Med* 2021;385:1737–49. | Coefficients were cross-checked against the NKF and NIDDK equation pages. Four cases were also run through the **NKF online eGFR calculator** (2026-11-18), and all match (see §3). |
| SGLT2 inhibitor early eGFR dip | Outcome-trial reviews (CREDENCE, DAPA-CKD, EMPA-REG): an early fall of roughly 3–6 mL/min/1.73 m² versus placebo, partly recovering by week 12. | Read from review material summarising the trials, not from the trial papers themselves. Used as a range, not a point value. |
| ACE inhibitor in healthy people | Captopril/enalapril in healthy volunteers: effective renal plasma flow rises, GFR is unchanged, filtration fraction falls by a few percent (e.g. 24.1% → 22.5%). | Abstract-level values from several small studies. Used only as directions and rough magnitudes. |
| NSAIDs in healthy people | Ibuprofen and indomethacin do not change renal blood flow or GFR in sodium-replete healthy volunteers; risk concentrates in hypovolaemia and with diuretics. | Abstract-level. No quantitative GFR fall under true volume depletion was found — the size of that fall here is a model choice. |
| Angiotensin II infusion | van der Bel / Hofman et al., *J Am Heart Assoc* 2016;5:e003185 — 8 healthy volunteers, 3.0 ng/kg/min: RPF 660 → 467 mL/min/1.73 m², GFR 121 → 110. | Values from the abstract. Percentage changes (RPF −29%, GFR −9%) are my own arithmetic. See §6 for a known mismatch. |
| Nephron number | Bertram JF, Douglas-Denton RN, Diouf B, Hughson MD, Hoy WE. Human nephron number: implications for health and disease. *Pediatr Nephrol* 2011;26(9):1529–33. | Abstract confirmed: averages are about 1 million per kidney, with a range of about 200,000 to more than 2.5 million. |
| Venous pressure and kidney (qualitative) | Winton FR. The influence of venous pressure on the isolated mammalian kidney. *J Physiol* 1931;72:49–61. | The record's existence is confirmed. **Its findings were not read.** It is cited only as the classic qualitative basis, and the gain is illustrative. |

---

## 1b. Source verification (checked 2026-11-18)

Every parameter in `parameters.ts` now says which of three things it is. Nothing is cited
that was not actually found.

**Verified against a source** — defaults confirmed to sit in the published range:

| Value | Model | Published |
|---|---|---|
| Mean arterial pressure | 93 mmHg | diastolic + ⅓ pulse pressure for 120/80 |
| Total plasma protein | 7.0 g/dL | reference interval 6.0–8.3 g/dL |
| Creatinine production | 12 mmol/day | 150–200 µmol/kg/day in men → 10.5–14 at 70 kg |
| Protein intake | 75 g/day | RDA 56 g at 70 kg; measured US mean ~84 g |
| Sodium intake | 150 mmol/day | measured typical intake 3.6–4.0 g/day (WHO advises <2 g) |
| Urea per g protein | 5.7 mmol/g | arithmetic: 16% N ÷ 28 g N per mol urea |
| Total body water | 42 L | 60% of 70 kg |
| Extracellular volume | 14 L | 20% of body weight (60-40-20 rule) |
| Renal plasma flow | 600 mL/min | effective RPF by PAH clearance (true RPF ~650–700) |
| Haematocrit | 0.45 | conventional adult 0.40–0.50 |
| Autoregulatory range | 80–180 mmHg | renal blood flow and GFR held constant over 80–180 mmHg |
| Na reabsorption | 67 / 25 / 5 / ~3 % | the standard proximal / loop / distal / collecting split |
| K reabsorption | 67% proximal, 20% loop | ~⅔ proximal; 20–30% in the thick ascending limb |
| Fractional K excretion | ~11% | final excretion is 10–20% of the filtered load |
| Urea fractional reabsorption | 0.5 | 40–50% reabsorbed passively in the proximal tubule |
| Urine osmolality | 50 / 600 / 1200 | 50–100 maximally dilute, ~500–850 typical, ~1200 maximal |
| Ascending limb outflow | 100 mOsm/kg | the hypotonic "diluting segment" |

**Model choices that cannot be verified** — relabelled, with the "TODO verify" removed because
no amount of searching can confirm a number that was invented for this model. These are all the
gains: volume→hormone couplings, autoregulation gains, the hyperfiltration exponent, every drug
block fraction, the prostaglandin-dependence index, the venous→Bowman transmission, and the
fixed creatinine-secretion clearance. The *directions* are standard physiology and several are
anchored to measured behaviour (see §6); the *magnitudes* are mine.

**Not shown as numbers, because they cannot be measured.** Three quantities were resolved by
changing the interface rather than by hunting for a citation that does not exist:
- **Glomerular capillary pressure** is reported as a band — low / slightly low / normal / raised /
  high, against the healthy baseline — never in mmHg. The same applies to the net filtration
  pressure derived from it. Oncotic pressure is still given as a number, because it is calculated
  from the plasma protein the user sets.
- **Single-nephron Kf** is no longer a control. The engine still uses it, and disease states that
  change filtration surface area will act through it, but a slider implied a measurable quantity.
- **Renal venous pressure** is set as *venous congestion* (None / Mild / Moderate / Severe). The
  teaching point is the direction and its effect on filtration, not a pressure reading.

**Still genuinely unverified (2).** Bowman's space pressure and its calibration range: not directly
measurable in humans, and published figures come from animal micropuncture. It stays a numeric
control because it is an *input* — the user is asking "what if outflow were obstructed?" — rather
than a reported measurement.

The Landis–Pappenheimer page numbers are no longer tracked as a gap: the chapter, volume and year
are confirmed, and the polynomial itself — the thing actually used — is confirmed.

Two findings corrected the model rather than just its documentation: renal plasma flow of
600 mL/min is the *effective* value (PAH clearance under-reads true flow by ~8%), and the WHO
sodium ceiling is less than half the intake this model calls typical. Both are now stated at the
parameter rather than left implicit.

## 1c. Planned: disease states acting on glomerular pressure

Glomerular capillary pressure is the quantity this model is best placed to teach and the one a
student can never measure, which makes it the natural subject for a disease layer. The hook already
exists: `ExtraModifiers` in `glomerulus.ts` carries `afferent`, `efferent`, `kf` and `tgfSignal`
multipliers, and `computeEffects()` in `pharmacology.ts` is the single place they are assembled.
A disease module would add its own multipliers there, exactly as drugs and hormones do now, with
no change to the solver.

Candidates, and the lever each would pull:

| Disease | Mechanism | Lever |
|---|---|---|
| Diabetic hyperfiltration | afferent dilation plus a raised filtration surface | `afferent` ↓, `kf` ↑ |
| Established diabetic nephropathy | glomerulosclerosis reducing surface area | `kf` ↓, nephron number ↓ |
| Congestive cardiac failure | low output, venous congestion, neurohormonal activation | venous congestion, volume, angiotensin II |
| Hypertensive nephrosclerosis | afferent wall thickening, impaired autoregulation | `afferent` ↑, autoregulation gains ↓ |
| Glomerulonephritis | inflammatory fall in filtration surface | `kf` ↓ |

Two conditions should be met before any of these ships: each lever needs an evidence anchor in the
way the angiotensin II and SGLT2 effects do (§6), and the interface must keep showing glomerular
pressure as a band, since adding disease states does not make it measurable.

## 2. Glomerular haemodynamics (steady state, single nephron)

Units: flow nL/min, pressure mmHg, resistance mmHg·min/nL, Kf nL/min/mmHg, protein g/dL.

### 2.1 Series resistances (efferent carries blood minus filtrate)
```
MAP − P_GC = Q_B · Ra                    afferent arteriole carries the full blood flow
P_GC − Pv  = (Q_B − SNGFR) · Re          efferent arteriole carries blood minus filtrate
Q_A        = Q_B · (1 − Hct)             afferent plasma flow
```
Because SNGFR depends on P_GC and Q_A, these equations are coupled to the capillary integration (§2.3).
They are solved by bisection on Q_B. `F(Q_B) = (MAP − Pv) − Q_B·Ra − (Q_B − SNGFR)·Re` is strictly decreasing,
with F(0) > 0 and F((MAP−Pv)/Ra) < 0, so the root is unique.

The brief's simpler form, `Q = (MAP − Pv)/(Ra + Re)`, treats efferent flow as equal to afferent flow. This revision
replaced it because it slightly understated the rise in P_GC with efferent constriction.

`Ra = Ra0 · afferentMult · myogenic · TGF · compensation` and `Re = Re0 · efferentMult`.
Phase 3 hormone and drug multipliers will plug into `ExtraModifiers`.

**Venous congestion.** A rise in renal venous pressure above the calibration value is partly transmitted to Bowman's
space, standing in for a raised interstitial and tubular pressure:
```
P_BS,eff = P_BS + g_v · max(0, Pv − Pv0)          g_v = 1.0 (ILLUSTRATIVE)
```
Effect with autoregulation on: Pv 10 → GFR 106, Pv 20 → 96, Pv 25 → 75 mL/min. The drop steepens once TGF dilation saturates.

### 2.2 Calibration (derived, see `calibrate()`)
| Target | Value | Notes |
|---|---|---|
| MAP0, Pv0 | 93, 5 mmHg | calibration point |
| RPF (both kidneys) | 600 mL/min | gives RBF = 600/(1−0.45) ≈ 1091 mL/min |
| Nephrons | 1 × 10⁶ per kidney × 2 | |
| P_GC0 | 54 mmHg | inside the brief's 45–55 range; see §6 for why 54 was chosen over 50 |
| Ra0 = (MAP0 − P_GC0)/Q_B0 | ≈ 0.0715 mmHg·min/nL | algebraic |
| Re0 = (P_GC0 − Pv0)/(Q_B0 − SNGFR0) | ≈ 0.0999 mmHg·min/nL | algebraic, with SNGFR0 = 55 nL/min at the calibration point. Re lumps the efferent arteriole and all post-glomerular resistance |
| Kf (single nephron) | **4.9 nL/min/mmHg** (fitted) | `scripts/fit-kf.ts` bisects to a whole-kidney GFR of 110 mL/min. Whole-kidney equivalent ≈ 10 mL/min/mmHg. **Fitted, not measured.** |

Emergent baseline values (not fitted): FF 0.183, π_A 25.6 mmHg, π_E ≈ 35 mmHg, NFP at the afferent end
16.4 mmHg and at the efferent end 6.6 mmHg (the baseline is in filtration **dis**equilibrium).

### 2.3 Filtration along the capillary
Capillary length is normalised to x ∈ [0, 1] and integrated with RK4 over 100 segments:
```
dQ/dx = −Kf · max(0, P_GC − P_BS − π(C(x)))
C(x)  = C_A · Q_A / Q(x)                       protein is conserved (membrane is protein-impermeable)
π(C)  = 2.1C + 0.16C² + 0.009C³                Landis–Pappenheimer
SNGFR = Q_A − Q(1)            FF = SNGFR / Q_A
GFR   = SNGFR × N_total
```
Guards: Q ≥ 10⁻⁶·Q_A, and NFP ≥ 0 (no reabsorption back into the glomerular capillary).
Equilibrium is flagged when the efferent-end NFP is below 0.25 mmHg.
The segment count has been checked: 100 vs 1000 segments differ by less than 0.5%.

### 2.4 Autoregulation (toggle; gains are ILLUSTRATIVE)
**Myogenic response.** The response is driven by MAP, clamped to the range [80, 180]:
```
r_req    = (MAP_c − P_GC0) / (MAP0 − P_GC0)     Ra ratio that would hold P_GC (and therefore flow) at baseline
myogenic = r_req ^ 0.85
```
**Tubuloglomerular feedback (TGF).** Phase 1 uses SNGFR as a proxy for macula densa NaCl delivery:
```
TGF = clamp( (SNGFR / SNGFR_set)^3, 0.7, 1.6 )
```
This is an implicit loop, solved by bisection on `m − TGF(SNGFR(m))`, which is monotone. SNGFR_set is
the open-loop baseline SNGFR multiplied by the compensation factor A.

Result: across MAP 80–180, GFR stays at 108–116 mL/min (tested within ±10%). Below MAP 80,
the myogenic response is maximally dilated, and GFR falls to about 47 mL/min at MAP 60.

### 2.5 Compensatory hyperfiltration (toggle; ILLUSTRATIVE)
When N < N0, `A = (N0/N)^0.5`. Then Kf is multiplied by A, Ra by A^−0.5, and the TGF set-point by A.
Example: halving nephron number gives SNGFR 55 → 78 nL/min, P_GC 54 → 57 mmHg and GFR 110 → 78 mL/min.

---

## 3. Biochemistry (single-pool kinetics, time in hours)
Haemodynamics are recomputed at each step (they are treated as instantaneous). Concentrations are integrated with RK4,
holding clearances constant within a step.
```
dCr/dt = (G_cr − CL_cr·Cr) / V_cr        CL_cr = GFR (+10 mL/min if secretion is on)
dU/dt  = (G_u  − CL_u·U)  / V_u          CL_u  = GFR · (1 − FR_u)
FR_u   = 0.2 + 0.65·σ(z),   z = z0 + 1.0·ln(ADH) − 1.0·ln(GFR/GFR0)     (FR_u = 0.5 at baseline)
```
| | Default | Steady state |
|---|---|---|
| G_cr | 12 mmol/day | Cr ≈ 76 µmol/L |
| G_u | 430 mmol/day | U ≈ 5.4 mmol/L |
| V_cr = V_u | 42 L (total body water) | τ_Cr = V/GFR ≈ 6.4 h at baseline |

Unit conversion: GFR in mL/min × 0.06 = L/h.

**eGFR (CKD-EPI 2021, race-free)**, with Scr in mg/dL = µmol/L ÷ 88.4:
```
eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^age × 1.012[F]
κ = 0.7 F / 0.9 M,   α = −0.241 F / −0.302 M
```
**Checked against the NKF online calculator** (kidney.org/professionals/gfr_calculator, 2026-11-18, CKD-EPI Creatinine 2021):

| Scr (mg/dL) | Age | Sex | NKF calculator | This model |
|---|---|---|---|---|
| 1.0 | 40 | M | 98 | 97.6 → 98 |
| 0.7 | 40 | F | 112 | 112 |
| 2.0 | 60 | M | 38 | 37.5 → 38 |
| 0.5 | 30 | F | 129 | 129 |

The eGFR is computed from the *current* simulated creatinine, so it lags true GFR in non-steady states.

---

## 3b. Phase 3: volume status, hormones and drugs

All of this layer is **illustrative in magnitude**. Directions follow standard physiology;
the gains are model choices unless a source says otherwise. Code: `pharmacology.ts` (effects)
and `tubule.ts` (segmental sodium handling). Every gain is in `parameters.ts`.

### 3b.1 Extracellular volume is a state, not a slider value
```
dECF/dt = (Na_intake − Na_excretion) / plasma_Na + fluid_balance     ECF in L
volume% = 100 × (ECF − ECF₀) / ECF₀                                  ECF₀ = 14 L
```
`fluid_balance` (L/day) is fluid gained or lost outside the kidney — a drip, drinking,
vomiting, diarrhoea, bleeding, sweating. It is treated as **isotonic**, because plasma
sodium is held fixed: pure water would change the sodium concentration, which this model
cannot represent. Read it as "give or remove saline", not "drink water".

**Urea generation comes from protein intake**: `urea = protein (g/day) × 5.7 mmol/g`
(protein is ~16% nitrogen; urea carries 28 g of nitrogen per mol). 75 g/day reproduces the
baseline urea of ~5.4 mmol/L. This is why a high protein load or a gastrointestinal bleed
raises urea without touching creatinine.
Because excretion feeds back on volume, **euvolaemia is a true steady state** (the collecting-duct
sodium fraction is fitted so that baseline excretion equals a 150 mmol/day intake, giving FENa ≈ 0.7%),
and a diuretic produces **real volume depletion over simulated days** rather than a hand-set number.

With *volume-linked hormones* on (the default), volume drives:
```
MAP_eff  = MAP_slider + 1.0 mmHg per % volume change
Ang II   = slider × exp(−8 × Δvol)        aldosterone = slider × exp(−7 × Δvol)
ADH      = slider × exp(−6 × Δvol)        ANP        = slider × exp(+5 × Δvol)
afferent × (1 + 0.8 × fractional volume deficit)          [sympathetic tone]
```
Turning the toggle off makes the model fully open-loop: the hormone sliders are then the exact levels.

### 3b.2 Hormone actions
| Hormone | Action in the model |
|---|---|
| Angiotensin II | efferent ×(1 + 0.30·(A−1)), afferent ×(1 + 0.03·(A−1)), Kf ×max(0.35, 1 − 0.08·(A−1)) (mesangial contraction), proximal Na reabsorption +0.01·(A−1) |
| Aldosterone | collecting-duct Na fraction + 0.12·ln(aldo); potassium excretion ∝ aldo^0.5 |
| ADH | urine osmolality towards the maximum the medullary gradient allows; raises urea reabsorption (Phase 1 term) |
| ANP | afferent ×max(0.6, 1 − 0.06·(ANP−1)), efferent ×(1 + 0.04·(ANP−1)), collecting-duct Na fraction − 0.12·ln(ANP) |

### 3b.3 Drug actions
| Drug | Site | Model |
|---|---|---|
| ACEi / ARB | efferent arteriole | effective Ang II × (1 − 0.85·dose); aldosterone also falls by half of that block |
| NSAID | afferent arteriole | afferent × (1 + 0.5·dose·PG), PG = clamp(0.1 + 0.3·(AngII−1) + 0.03·max(0, 90−MAP), 0, 1.2) |
| SGLT2 inhibitor | proximal tubule | proximal Na fraction − 0.03·dose → more NaCl at the macula densa → TGF constricts the afferent; flags glucosuria |
| Loop diuretic | thick ascending limb | TAL fraction × (1 − 0.8·dose); macula densa sensing × (1 − 0.72·dose); medullary gradient washes out |
| Thiazide | distal convoluted tubule | DCT fraction × (1 − 0.8·dose) |
| MRA | collecting duct | effective aldosterone × (1 − 0.85·dose) |

The macula densa signal driving tubuloglomerular feedback is now
`(SNGFR / set-point) × (NaCl delivery / normal) × sensing`, so SGLT2 inhibitors act through
feedback (their dip disappears with autoregulation off) and loop diuretics blunt it.

### 3b.4 Illustrative segmental tubule
Sodium is reabsorbed as a fraction of what reaches each segment
(proximal 0.67 of filtered, TAL 0.76, DCT 0.62, collecting duct 0.775 — the last fitted).
Potassium excretion = 70 mmol/day × aldo^0.5 × (distal Na delivery relative to normal)^0.5.
Urine osmolality interpolates between 50 and the maximum the medullary gradient allows;
urine volume = daily osmole load ÷ urine osmolality.

**Plasma sodium and potassium are held constant.** The model shows what the kidney *excretes*,
not what happens to the blood levels, so it cannot show hyponatraemia or a potassium number.

## 3c. Phase 4: segment-by-segment tubular handling

Phase 3 already tracked sodium down the nephron. Phase 4 adds **water** and **potassium**
per segment and a **tubular fluid osmolality profile**, and surfaces all of it in the UI
(each segment's label on the diagram, plus the "Along the tubule" panel).

### 3c.1 Water
```
proximal  : water follows sodium isosmotically → volume × (1 − f_proximal), osmolality unchanged
descending: water-permeable → volume × (1 − 0.45), so ~18% of filtered volume reaches the hairpin
ascending : water-impermeable → volume unchanged
distal    : water-impermeable → volume unchanged
collecting: volume = the urine volume already computed from osmole excretion ÷ urine osmolality
```
The descending-limb fraction is **chosen** so that the textbook figure (15–20% of filtrate
entering the thick ascending limb) comes out right. Baseline result: 33% of filtrate leaves the
proximal tubule, 18% reaches the ascending limb, and 0.9% becomes urine.

### 3c.2 Potassium
```
filtered K = GFR × 4.0 mmol/L          (plasma potassium fixed)
proximal reabsorbs 0.67 of filtered;  thick ascending limb a further 0.20
→ ~13% of filtered potassium reaches the distal nephron
excretion = the Phase 3 value (aldosterone and distal flow); distal secretion = excretion − delivery
```
At baseline, excretion (FEK ≈ 11%) roughly balances distal delivery (13%), so net distal handling is
near zero; aldosterone, a loop diuretic or a thiazide all push it into clear net secretion, and an MRA
reverses it. This matches the teaching that **urinary potassium is set distally**, not by filtration.

### 3c.3 Osmolality profile — QUALITATIVE
The curve has six anchor points: Bowman's space and the end of the proximal tubule at plasma
osmolality (290), the loop tip at the medullary peak, the end of the ascending limb at ~100, a
slightly lower value after the distal tubule, and the computed urine osmolality.

Two of these are computed by the model (the medullary peak, which washes out with a loop diuretic,
and the final urine osmolality, set by ADH). The intermediate dilution is **scaled by how much NaCl
each segment actually reabsorbs relative to normal**, so blocking the ascending limb leaves fluid near
isosmotic and a thiazide removes the last diluting step.

**This is not a solved countercurrent multiplier.** A real profile requires countercurrent exchange,
NaCl entry into the descending limb and urea recycling, none of which are modelled. Intermediate
osmolalities are teaching anchors that respond correctly in direction, not computed osmole balances.
Anything read off the middle of this curve should be treated as illustrative.

**Removed from the interface (Phase 4 display):** the "Along the tubule" panel, which showed the
osmolality curve and the per-segment table. The segment model still runs and is still tested; its
numbers remain available on each tubular segment's label in the diagram. The standalone panel was
more detail than this teaching level needs.

## 4. Assumptions and simplifications
1. **P_GC is constant along the capillary.** Axial pressure drop is ignored.
2. **Efferent flow is the blood flow minus SNGFR.** Plasma protein concentration rises in efferent blood, but the resulting
   viscosity change is ignored.
3. **Haematocrit is fixed.** Its rise along the capillary and viscosity effects are ignored.
4. **Re lumps the efferent arteriole, peritubular capillaries and veins.** This is why Re0 > Ra0.
5. **Haemodynamics are quasi-steady.** They respond instantly to inputs, and only creatinine and urea have dynamics.
6. **Both kidneys are identical.** All nephrons are identical (no cortical/juxtamedullary heterogeneity).
7. **Creatinine production is constant.** It is not linked to age, sex, muscle mass or diet. As a result, eGFR ≠ true GFR at baseline
   for females (88 vs 110). This is **kept on purpose** as a teaching point: eGFR equations assume an average creatinine
   generation for age and sex. The UI must label it.
8. **True GFR is absolute (mL/min), while eGFR is BSA-indexed (mL/min/1.73 m²).** The comparison assumes BSA = 1.73 m².
9. **ADH (Phase 1) only affects urea reabsorption.** GFR stands in for tubular flow in the urea term.
10. **TGF senses SNGFR.** Phase 3 (SGLT2i) will need distal NaCl delivery instead.
11. **Creatinine secretion is a fixed clearance.** In reality it is saturable and drug-inhibitable.
12. **Single-pool kinetics.** There is no intra- or extracellular lag, no extrarenal clearance and no dialysis.
13. **Venous → Bowman's pressure transmission is a single linear gain.** It acts only above the calibration venous pressure.
    Real intrarenal tissue pressure buffers moderate venous hypertension in a non-linear way.
14. **Volume affects the kidney only through pressure and hormones.** Haematocrit, plasma protein and cardiac output do not change with volume.
15. **Drug doses are relative, not pharmacokinetic.** There is no absorption, half-life, accumulation in renal failure, or time to onset: a drug's full effect appears the moment it is switched on.
16. **Potassium is an excretion rate only.** Plasma potassium is not tracked, so "hyperkalaemia risk" is inferred from falling excretion, never shown as a number.
17. **Glucose is not modelled.** SGLT2 inhibitors flag glucosuria but the osmotic diuresis from urinary glucose is omitted, so their urine volume is understated.
18. **Vessel width in the diagram is deliberately exaggerated.** Radius truly scales with resistance^(−1/4), which makes real changes
    almost invisible (a 60% rise in resistance narrows a vessel by only 11%). The drawing uses an exponent of 1.35 instead, and the arterioles rest deliberately narrow, so the same
    change is unmistakable: afferent tone from x0.4 to x3 moves the drawn vessel from 42 px to 7.5 px, over a 1.5 s transition
    so the learner watches it move rather than finding it already moved. This affects the picture only: every number in the labels and panels is the true model value, and the
    diagram caption says the widths are exaggerated.
19. **Flow animation speed is exaggerated too**, like vessel width: the particle rate uses flow^1.6 so a modest change in blood or filtrate
    flow is obvious. Numbers in the labels and panels remain the true values.
20. **Charts scale to their data, not from zero.** A change of a few percent is meant to be visible, so read the axis before judging a slope.
21. **Tubular fluid osmolality between the endpoints is a qualitative anchor** (see §3c.3), not a computed osmole balance.
22. **Fluid balance is isotonic only** (see §3b.1), so the model cannot show hyponatraemia, water intoxication or pure dehydration.
23. **Plasma potassium is fixed at 4.0 mmol/L**, so the model shows potassium *excretion* and never a blood level.
24. **Segment water handling ignores the descending limb's solute entry and urea recycling**, so the volume at the hairpin is approximate.
25. **Hormones do not feed back on each other or on volume except as written.** There is no renin, no potassium-driven aldosterone, no thirst and no fluid intake control.

## 5. Known limitations and behaviour to be aware of
- **Open-loop sensitivity is high.** The margin P_GC − P_BS − π_A is only about 16 mmHg. With autoregulation OFF,
  a 2× afferent resistance cuts GFR to about 19 mL/min, and an open-loop MAP of 140 gives GFR ≈ 290 mL/min.
  This is inherent to the Starling framework with human-like pressures. The UI should show open-loop mode as a "mechanism" view.
- **Bowman pressure 30 mmHg (with autoregulation) gives GFR ≈ 52 mL/min.** This is plausible qualitatively, but obstruction physiology
  (initial afferent dilation, later fall in flow) is not modelled.
- **Nothing is capped.** At very low GFR, creatinine rises without bound. When GFR is 0, the steady state is reported
  as Infinity (tested not to be NaN), and the UI should show "—".
- **Performance.** One haemodynamic solve takes about 7 ms, because of the nested TGF and circuit bisections. `evaluate()` memoises
  the last input set, so time-stepping with unchanged inputs costs nothing extra. Slider drags re-solve once per change.

## 6. Phase 3 calibration, and a known mismatch

**Anchored to evidence**
- Collecting-duct sodium fraction **fitted** so baseline excretion = 150 mmol/day intake (FENa ≈ 0.7%, normal <1%).
- Angiotensin II efferent gain **fitted** so Ang II ×4 reproduces the renal plasma flow fall on infusion (model −30% vs −29% measured).
- ACE inhibitor in a healthy kidney: plasma flow up, filtration fraction down, GFR within 10% — matching healthy-volunteer studies.
- NSAID in a healthy kidney: GFR change <3% — matching the sodium-replete volunteer studies.
- SGLT2 inhibitor: true GFR dip of about 6% (≈6 mL/min), inside the 3–6 mL/min/1.73 m² trial range.
- Loop diuretic: GFR roughly held acutely; the macula densa block (0.72) is **chosen** so the blunted sensing
  roughly offsets the increased sodium delivery, which is why GFR does not swing.

**Prostaglandin dependence uses the pre-drug angiotensin II.** An NSAID's effect scales with how
much the afferent arteriole relies on prostaglandins, which is driven by the underlying
hypovolaemic, RAAS-activated state. Using the angiotensin II level *after* an ACE inhibitor had
blocked it made the ACE inhibitor appear to protect against an NSAID — the opposite of the
triple-whammy interaction. The term now uses the volume-driven level before any drug.

**Known mismatch — filtration fraction in renal artery stenosis.** Classically, filtration
fraction is *raised* in bilateral renal artery stenosis: efferent constriction holds GFR up while
renal plasma flow falls. This model keeps it near its normal 0.18, because the same angiotensin II
that constricts the efferent arteriole also lowers Kf here, and the two effects cancel. What the
model *does* reproduce correctly is the collapse in filtration fraction (0.18 → 0.08) and the fall
in GFR when an ACE inhibitor removes that efferent support — which is the teaching point of the
scenario. The scenario text and its model note say so rather than claiming a raised starting value.

**Known overshoot — sodium and potassium handling in deep volume depletion.** At −18% volume the
model drives fractional sodium excretion to about 0.04%, below the <1% normally quoted for prerenal
states, and potassium excretion *rises* with aldosterone. A genuinely oliguric patient excretes less
potassium, because so little fluid reaches the distal nephron. The directions are right; the
magnitudes are more extreme than a real patient's. Flagged in the scenario's model note.

**Known mismatch — angiotensin II and GFR.** On infusion in healthy volunteers, GFR *falls* about 9%.
In this model Ang II ×4 *raises* GFR by roughly 10%. The Kf (mesangial) term pulls GFR down, and a larger
value would match the infusion data — but it would then also reverse the required teaching behaviour of
**ACEi in bilateral renal artery stenosis**, where GFR must fall when angiotensin II support is removed.
A single-nephron model at fixed mean arterial pressure cannot do both, so the renal-artery-stenosis case
(explicitly required by the brief) was preferred and this discrepancy is documented rather than hidden.
Treat the angiotensin II slider as a teaching device for *efferent tone and filtration fraction*, not as a
quantitative prediction of GFR during an infusion.

## 6b. Phase 1 calibration choices
- **P_GC0 = 54 rather than 50.** At 50 mmHg the driving margin was only 12 mmHg, so a 1.5× afferent resistance cut GFR by 70%
  and a 0.5× efferent resistance gave GFR = 0. Using 54 (still inside the brief's range) keeps the biphasic efferent
  response while making the model less brittle. After the efferent-flow revision, GFR peaks at about 140 at 2×, is 107 at 4×,
  81 at 6× and 65 at 8× (open loop).
- **P_BS0 = 12 mmHg** and **total protein 7.0 g/dL** (π_A 25.6 mmHg).
- **Autoregulation gains** (myogenic 0.85, TGF 3, TGF bounds 0.7–1.6) were tuned by hand for flat GFR across 80–180.
- **Venous → Bowman gain 1.0** was chosen over 0.5, which produced almost no congestion effect (GFR 107 at Pv 20).
- **Kf was unchanged by the revision.** P_GC0 and Q_A0 are unchanged at the calibration point, and the refit gives 4.90 again.

## 7. Tests (`npm test`, 108 cases: 56 Phase 1–2, 33 Phase 3, 19 Phase 4)
These cover:
- baseline calibration ranges, mass balance and segment convergence
- filtration equilibrium and directional responses
- the biphasic efferent response and its mechanism
- autoregulation flatness and saturation
- nephron loss with and without compensation
- creatinine and urea steady states, and the prerenal urea:creatinine rise
- time-step independence (<1%) and eGFR lag
- CKD-EPI hand-computed cases and the NKF calculator cases
- display rounding

Added in the revision:
- the circuit-consistency check (both resistance equations hold at the solution)
- venous congestion
- ADH acting alone (urea changes, GFR and creatinine don't)
- urea reabsorption bounds
- every single-slider extreme, with and without autoregulation (finite, non-negative, FF < 1, Pv ≤ P_GC ≤ MAP)
- combined worst cases (zero GFR does not produce NaN)

Phase 3 (`phase3.test.ts`):
- baseline unchanged by the new layer; euvolaemia does not drift; sodium conserved down the segments
- volume status: hormone directions, sodium avidity, urine concentration, GFR defended until MAP leaves the autoregulatory range
- volume returns to a steady state where excretion matches intake, at three different intakes
- each hormone's direction, and the angiotensin II renal-plasma-flow anchor
- each drug: ACEi in health and in renal artery stenosis, NSAID in health vs volume depletion, the SGLT2 dip and its dependence on tubuloglomerular feedback, loop vs thiazide vs MRA, segment specificity, dose scaling
- the triple whammy, including that each limb contributes through its own mechanism

Phase 4 (`phase4.test.ts`):
- flow, sodium and potassium fall monotonically down the nephron; segment loads match the Phase 3 figures; the last segment agrees with the urine numbers
- baseline water and sodium handling match the textbook pattern (67% / 25% / 5% / 3%)
- potassium is reabsorbed early and set distally; secretion rises with aldosterone and distal flow, and falls with an MRA
- the osmolality profile has the classic shape; a loop diuretic flattens it, ADH moves only the final point, a thiazide only the distal step
- each diuretic marks its own segment and increases delivery downstream
- volume depletion, a water load, aldosterone vs MRA, and zero filtration
