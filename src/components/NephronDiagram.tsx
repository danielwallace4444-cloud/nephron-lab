import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { DRUG_DEFS, band, type DrugKey, type ModelInputs, type Snapshot } from '../model';

const VB_W = 600;
const VB_H = 560;
const G = { x: 300, y: 142 };
const TUFT_R = 56;
const CORTEX_Y = 360;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
type RGB = [number, number, number];
const mixRGB = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i]! - v) * clamp(t, 0, 1))) as RGB;
const css = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/**
 * True physical exponent is 0.25. The drawing uses 1.35, and the arterioles start
 * deliberately narrow, so there is room to both constrict and dilate visibly: ×3
 * afferent tone takes the vessel to about a quarter of its resting calibre, and ×0.5
 * roughly doubles it.
 */
const DISPLAY_EXPONENT = 1.35;
const vesselWidth = (base: number, r: number) => clamp(base * Math.pow(r, -DISPLAY_EXPONENT), 4, 64);
/**
 * Seconds per particle cycle; null = no flow. The ratio is raised to a power above 1 so
 * a modest change in flow produces an obvious change in speed (exaggerated, like width).
 */
/**
 * Seconds per particle cycle; null = no flow. Quantised to quarter-second steps on
 * purpose: animation-duration is re-applied whenever the string changes, which restarts
 * the dash cycle. A continuously varying duration therefore made the fluid stutter on
 * every tick. Discrete steps keep the animation running smoothly between real changes.
 */
const flowDur = (ratio: number) => {
  if (ratio < 0.02) return null;
  const raw = clamp(1.6 / Math.pow(ratio, 1.6), 0.35, 16);
  return Math.round(raw * 4) / 4;
};
const f0 = (x: number) => (isFinite(x) ? Math.round(x).toString() : '—');
const f2 = (x: number) => (isFinite(x) ? x.toFixed(2) : '—');
const pct = (x: number) => (isFinite(x) ? `${Math.round(x * 100)}%` : '—');
const polar = (deg: number, r: number): [number, number] => [G.x + Math.cos((deg * Math.PI) / 180) * r, G.y + Math.sin((deg * Math.PI) / 180) * r];

const AFFERENT = 'M -10 84 C 50 52 140 40 200 60 C 236 72 256 96 266 118';
const EFFERENT = 'M 334 118 C 350 78 400 52 458 52 C 526 52 566 88 570 146';
const CAPILLARY = 'M 570 146 C 574 214 556 292 564 372 C 570 440 582 500 588 580';
const TUBULE =
  'M 238 196 C 206 214 152 198 134 230 C 116 264 172 278 176 302 C 182 328 130 334 138 362 C 146 390 230 378 230 414 ' +
  'L 230 488 C 230 538 294 538 294 488 L 294 334 C 294 292 344 302 362 270 C 378 242 370 204 380 184 ' +
  'C 392 160 420 152 434 174 C 446 194 454 214 470 198 C 486 180 504 180 512 204 C 520 230 516 268 516 310';
const DUCT = 'M 516 300 L 516 600';
const MD: [number, number] = [380, 184];
/** Medullary interstitium between the loop limbs (osmotic gradient). */
const LOOP_GLOW = 'M 236 330 C 236 470 240 520 262 520 C 284 520 288 470 288 330 Z';

/**
 * The tuft as lobular capillary loops that converge on the vascular pole, which is where
 * the arterioles actually meet it — closer to glomerular histology than a ball of yarn.
 * Each lobule leaves the pole, loops out to its tip and returns.
 */
/**
 * The tuft as a tangled, continuous capillary rather than a fan of lobules: closer to how
 * a glomerulus is drawn in an atlas. Two closed meandering loops (three- and four-lobed,
 * offset) read as one convoluted vessel folded back on itself inside Bowman's capsule.
 */
/** Spacing between the moving dots inside a vessel, in user units. */
const DASH_PERIOD = 18;

const POLE: [number, number] = [G.x, G.y - TUFT_R * 0.72];

function lobedLoop(lobes: number, radius: number, amp: number, rotDeg: number, cx: number, cy: number): string {
  const pts: string[] = [];
  const rot = (rotDeg * Math.PI) / 180;
  const N = 84;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = radius * (1 + amp * Math.cos(lobes * th));
    const x = cx + Math.cos(th + rot) * r;
    const y = cy + Math.sin(th + rot) * r * 0.92;
    pts.push(`${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ') + ' Z';
}

const TUFT_LOOPS = [
  { d: lobedLoop(3, TUFT_R * 0.74, 0.34, -18, G.x, G.y + 3), w: 18 },
  { d: lobedLoop(4, TUFT_R * 0.56, 0.4, 36, G.x + 3, G.y - 4), w: 14 },
];

interface TubeStyle {
  edge: RGB;
  body: RGB;
  core: RGB;
  glow: RGB;
  spark: string;
}

// Muted, slightly desaturated palette: still clearly colour-coded, less poster-paint.
const STYLE = {
  afferent: { edge: [146, 32, 52], body: [199, 68, 83], core: [243, 199, 203], glow: [205, 100, 115], spark: '#f6dba6' },
  efferent: { edge: [74, 48, 125], body: [116, 97, 180], core: [214, 209, 238], glow: [126, 115, 190], spark: '#dcdcf5' },
  capillary: { edge: [66, 62, 134], body: [108, 108, 176], core: [202, 206, 234], glow: [120, 124, 186], spark: '#dcdcf5' },
  tubule: { edge: [170, 128, 36], body: [226, 191, 108], core: [248, 240, 216], glow: [213, 173, 92], spark: '#fffaf0' },
  duct: { edge: [170, 128, 36], body: [229, 199, 128], core: [250, 243, 224], glow: [213, 173, 92], spark: '#fffaf0' },
} satisfies Record<string, TubeStyle>;

/** A glossy translucent tube: glow, shaded body, bright core, highlight, and one sparkle layer. */
function Tube({ d, w, s, dur, sparkle = true, animateWidth = false }: { d: string; w: number; s: TubeStyle; dur: number | null; sparkle?: boolean; animateWidth?: boolean }) {
  // Speed in user units per second. The flow loop reads this attribute every frame, so a
  // change in flow eases in continuously instead of restarting the animation.
  const speed = dur === null ? 0 : DASH_PERIOD / dur;
  return (
    <g className={animateWidth ? 'nl-tube nl-tube-anim' : 'nl-tube'}>
      <path d={d} fill="none" stroke={css(s.edge, 0.9)} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={css(s.body)} strokeWidth={w * 0.78} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={css(s.core, 0.6)} strokeWidth={w * 0.3} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={Math.max(1, w * 0.07)} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${-w * 0.15} ${-w * 0.19})`} />
      {sparkle && (
        <path
          d={d}
          fill="none"
          stroke={s.spark}
          strokeWidth={Math.max(2, w * 0.15)}
          strokeLinecap="round"
          strokeDasharray={`0 ${DASH_PERIOD}`}
          data-flow={speed}
          style={{ display: dur === null ? 'none' : undefined }}
        />
      )}
    </g>
  );
}

/**
 * Where each drug acts, and what it does there. The glyph follows the usual conventions:
 * arrows pointing inwards for constriction, outwards for dilation, and a bar-headed line
 * (the standard "inhibits" notation) for blocking transport or a receptor.
 */
type DrugAction = 'constrict' | 'dilate' | 'block';
const DRUG_SITES: Record<DrugKey, { at: [number, number]; action: DrugAction; what: string }> = {
  nsaid: { at: [196, 58], action: 'constrict', what: 'constricts the afferent arteriole' },
  acei: { at: [404, 56], action: 'dilate', what: 'dilates the efferent arteriole' },
  sglt2: { at: [150, 246], action: 'block', what: 'blocks proximal sodium-glucose reabsorption' },
  loopDiuretic: { at: [268, 455], action: 'block', what: 'blocks the Na-K-2Cl transporter' },
  thiazide: { at: [452, 206], action: 'block', what: 'blocks the Na-Cl cotransporter' },
  mra: { at: [516, 360], action: 'block', what: 'blocks the aldosterone receptor' },
};
const ACTION_COLOUR: Record<DrugAction, string> = { constrict: '#be123c', dilate: '#0f766e', block: '#b45309' };

interface LabelDef {
  id: string;
  name: string;
  at: [number, number];
  pos: [number, number];
  mobile: boolean;
  info: () => ReactNode;
  /** Drug marks render as an action glyph instead of a text pill, with no leader line. */
  glyph?: DrugAction;
}

/** The glyph shown at a drug's site of action. */
function ActionGlyph({ action, play }: { action: DrugAction; play: string }) {
  const col = ACTION_COLOUR[action];
  return (
    <svg viewBox="-22 -22 44 44" className="h-7 w-7 sm:h-9 sm:w-9" aria-hidden="true">
      <circle r={19} fill="#fff" opacity={0.85} />
      <circle r={19} fill="none" stroke={col} strokeWidth={2} opacity={0.4} />
      <circle r={19} fill="none" stroke={col} strokeWidth={2} className="nl-site" style={{ animationPlayState: play }} />
      {action === 'constrict' && (
        <>
          <polygon points="-7,0 -17,-5 -17,5" fill={col} />
          <polygon points="7,0 17,-5 17,5" fill={col} />
          <polygon points="0,-7 -5,-17 5,-17" fill={col} />
          <polygon points="0,7 -5,17 5,17" fill={col} />
        </>
      )}
      {action === 'dilate' && (
        <>
          <polygon points="-17,0 -7,-5 -7,5" fill={col} />
          <polygon points="17,0 7,-5 7,5" fill={col} />
          <polygon points="0,-17 -5,-7 5,-7" fill={col} />
          <polygon points="0,17 -5,7 5,7" fill={col} />
        </>
      )}
      {action === 'block' && (
        <>
          <path d="M -14 0 L 2 0" stroke={col} strokeWidth={3.5} strokeLinecap="round" />
          <path d="M 2 -9 L 2 9" stroke={col} strokeWidth={3.5} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function Row({ k, v, base }: { k: string; v: string; base?: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt className="text-slate-600">{k}</dt>
      <dd className="text-right font-semibold tabular-nums text-slate-900">
        {v}
        {base && <span className="ml-1 font-normal text-slate-500">(healthy {base})</span>}
      </dd>
    </div>
  );
}

interface Props {
  snap: Snapshot;
  baseline: Snapshot;
  inputs: ModelInputs;
  animate: boolean;
}

function NephronDiagramInner({ snap, baseline, inputs, animate }: Props) {
  const h = snap.haemo;
  const b = baseline.haemo;
  const segOf = (id: string) => snap.tubule.segments.find((x) => x.id === id);
  /** Rows shared by every tubular segment's explainer. */
  const segRows = (id: string) => {
    const g = segOf(id);
    if (!g) return null;
    return (
      <dl className="mt-2">
        <Row k="Fluid leaving here" v={`${g.flow.toFixed(1)} mL/min`} base={`${(g.waterRemaining * 100).toFixed(g.waterRemaining < 0.1 ? 1 : 0)}% of filtered`} />
        <Row k="Sodium still in the tubule" v={`${(g.naRemaining * 100).toFixed(g.naRemaining < 0.1 ? 1 : 0)}% of filtered`} />
        <Row k="Potassium still in the tubule" v={`${(g.kRemaining * 100).toFixed(0)}% of filtered`} />
        <Row k="Fluid osmolality" v={`${Math.round(g.osmolality)} mOsm/kg`} />
        <Row k="Sodium reabsorbed here" v={`${Math.round(g.naFraction * 100)}% of what arrives`} />
      </dl>
    );
  };
  const [open, setOpen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  // Hovering previews an explainer; clicking pins it so it survives the pointer leaving.
  const shown = open ?? hover;
  const root = useRef<HTMLDivElement>(null);

  /**
   * Flow is driven here rather than by CSS keyframes. A CSS animation restarts at the end
   * of every cycle — and the old keyframe travelled 48 units against an 18-unit dash
   * pattern, so it jumped two thirds of a dash on each loop — and changing its duration
   * mid-flight moves the animation to a different phase. Advancing an accumulator each
   * frame instead gives genuinely continuous motion, and lets speed change smoothly.
   */
  const svgRef = useRef<SVGSVGElement>(null);
  const playRef = useRef(animate);
  playRef.current = animate;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const phase = new WeakMap<Element, number>();
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playRef.current) {
        svg.querySelectorAll<SVGPathElement>('[data-flow]').forEach((el) => {
          const v = Number(el.dataset.flow) || 0;
          const next = (phase.get(el) ?? 0) + v * dt;
          phase.set(el, next % 1e6);
          el.style.strokeDashoffset = String(-next);
        });
        svg.querySelectorAll<SVGCircleElement>('[data-particle]').forEach((el) => {
          const rate = Number(el.dataset.rate) || 0;
          let p = (phase.get(el) ?? Number(el.dataset.phase ?? 0)) + rate * dt;
          p -= Math.floor(p);
          phase.set(el, p);
          const dx = Number(el.dataset.dx) || 0;
          const dy = Number(el.dataset.dy) || 0;
          el.setAttribute('transform', `translate(${(dx * p).toFixed(2)} ${(dy * p).toFixed(2)})`);
          el.style.opacity = String(p < 0.18 ? p / 0.18 : p > 0.82 ? (1 - p) / 0.18 : 1);
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  // ----- live styling -----
  const wA = vesselWidth(22, h.afferentEffective);
  const wE = vesselWidth(19, h.efferentEffective);
  /**
   * Autoregulation often moves a vessel further than a drug does, so the net width can
   * look dilated even where a drug is constricting. These ghosts show the width the
   * vessel would have at the same autoregulatory state WITHOUT the drugs and hormones,
   * so the drug's own contribution is visible as the gap.
   */
  const ghostA = Math.abs(h.modAfferent - 1) > 0.02 ? vesselWidth(22, h.afferentEffective / h.modAfferent) : null;
  const ghostE = Math.abs(h.modEfferent - 1) > 0.02 ? vesselWidth(19, h.efferentEffective / h.modEfferent) : null;
  const bloodDur = flowDur(h.rbf / b.rbf);
  const tubuleDur = flowDur(h.gfr / b.gfr);
  const filt = clamp(h.sngfr / b.sngfr, 0, 2.2);
  const pgcRel = clamp((h.pgc - 35) / 50, 0, 1);
  const tuftDark = mixRGB([170, 98, 92], [138, 32, 46], pgcRel);
  const tuftMid = mixRGB([223, 150, 139], [206, 74, 84], pgcRel);
  const tuftLight = mixRGB([244, 212, 203], [242, 170, 165], pgcRel);
  const pbsRel = clamp((h.pbs - 10) / 35, 0, 1);
  const rCapsule = clamp(86 + 1.5 * (h.pbs - 12), 80, 124);
  const capsuleW = 26 + pbsRel * 6;
  const spaceFill = mixRGB([255, 246, 214], [252, 190, 80], pbsRel);
  const capsuleStyle: TubeStyle = {
    edge: mixRGB([234, 179, 8], [217, 119, 6], pbsRel),
    body: mixRGB([253, 224, 140], [251, 176, 64], pbsRel),
    core: [255, 251, 235],
    glow: mixRGB([251, 191, 36], [249, 115, 22], pbsRel),
    spark: '#ffffff',
  };
  const CAPSULE = (() => {
    const [x0, y0] = polar(236, rCapsule);
    const [x1, y1] = polar(304, rCapsule);
    return `M ${x0} ${y0} A ${rCapsule} ${rCapsule} 0 1 0 ${x1} ${y1}`;
  })();

  // Filtrate particles crossing Bowman's space; count and speed follow SNGFR.
  const particleCount = Math.round(clamp(filt, 0, 2) * 7);
  // Quantised for the same reason as flowDur: a changing duration restarts the animation.
  const particleDur = Math.round(clamp(1.8 / Math.max(filt, 0.05), 0.8, 6) * 4) / 4;
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const a = ((i / Math.max(particleCount, 1)) * 300 + 120 + i * 11) * (Math.PI / 180);
    const r0 = TUFT_R - 4;
    const r1 = rCapsule - capsuleW / 2 - 3;
    return { x: G.x + Math.cos(a) * r0, y: G.y + Math.sin(a) * r0, dx: Math.cos(a) * (r1 - r0), dy: Math.sin(a) * (r1 - r0), phase: i / Math.max(particleCount, 1) };
  });

  const labels: LabelDef[] = [
    {
      id: 'aff',
      name: 'Afferent arteriole',
      at: [150, 42],
      pos: [150, 12],
      mobile: true,
      info: () => (
        <>
          <p>Brings blood into the glomerulus. Narrowing it lowers the pressure that reaches the capillaries.</p>
          <dl className="mt-2">
            <Row k="Net resistance" v={`×${f2(h.afferentEffective)}`} base="×1.00" />
            <Row k="from drugs & hormones" v={`×${f2(h.modAfferent)}`} />
            {inputs.autoregulation && <Row k="from myogenic response" v={`×${f2(h.myogenicFactor)}`} />}
            {inputs.autoregulation && <Row k="from tubuloglomerular feedback" v={`×${f2(h.tgfFactor)}`} />}
            <Row k="Renal blood flow" v={`${f0(h.rbf)} mL/min`} base={f0(b.rbf)} />
          </dl>
          {h.modAfferent > 1.05 && h.afferentEffective < 1 && (
            <p className="mt-2 text-amber-800">
              The vessel still looks dilated because autoregulation is opening it against a low perfusion pressure. Drugs and hormones are
              constricting it ×{f2(h.modAfferent)} on top of that — the dashed halo shows how wide it would otherwise be.
            </p>
          )}
          {h.autoregSaturated && <p className="mt-2 text-amber-800">Autoregulation is at its limit at this pressure.</p>}
        </>
      ),
    },
    {
      id: 'eff',
      name: 'Efferent arteriole',
      at: [470, 46],
      pos: [470, 14],
      mobile: true,
      info: () => (
        <>
          <p>
            Carries blood out of the glomerulus, then breaks up into the peritubular capillaries around the tubules. Mild constriction
            raises glomerular pressure; severe constriction starves the glomerulus of flow, so GFR falls again.
          </p>
          <dl className="mt-2">
            <Row k="Net resistance" v={`×${f2(h.efferentEffective)}`} base="×1.00" />
            <Row k="from drugs & hormones" v={`×${f2(h.modEfferent)}`} />
            <Row k="Renal plasma flow" v={`${f0(h.rpf)} mL/min`} base={f0(b.rpf)} />
          </dl>
        </>
      ),
    },
    {
      id: 'glom',
      name: 'Glomerulus',
      at: [G.x + 30, G.y + 4],
      pos: [468, 104],
      mobile: true,
      info: () => (
        <>
          <p>A knot of capillaries. Blood pressure inside pushes plasma out; plasma proteins pull it back (oncotic pressure).</p>
          <dl className="mt-2">
            <Row k="Capillary pressure" v={band(h.pgc, b.pgc)} />
            <Row k="Net push to filter" v={band(h.capillary.nfpMean, b.capillary.nfpMean)} />
            <Row k="Oncotic pressure in → out" v={`${f0(h.capillary.piAfferent)} → ${f0(h.capillary.piEfferent)} mmHg`} />
            <Row k="Plasma filtered (FF)" v={pct(h.filtrationFraction)} base={pct(b.filtrationFraction)} />
            <Row k="Filtrate per nephron" v={`${f0(h.sngfr)} nL/min`} base={f0(b.sngfr)} />
          </dl>
          <p className="mt-2 text-[11px] text-slate-500">
            Glomerular capillary pressure and the net filtration pressure are shown as bands, not numbers: neither can be measured in a
            patient. Oncotic pressure is calculated from the plasma protein you set, so it is given as a value.
          </p>
          {h.capillary.equilibrium && (
            <p className="mt-2 text-sky-900">
              Filtration equilibrium: the net push reaches zero {pct(h.capillary.equilibriumPosition)} of the way along the capillary, so extra
              filtration now depends on plasma flow.
            </p>
          )}
        </>
      ),
    },
    {
      id: 'bowman',
      name: "Bowman's capsule",
      at: polar(196, rCapsule),
      pos: [88, 150],
      mobile: true,
      info: () => (
        <>
          <p>
            Catches the filtrate. Pressure in Bowman's space pushes back against filtration; it rises when urine outflow is blocked or venous
            pressure is high, and the capsule swells in the diagram.
          </p>
          <dl className="mt-2">
            <Row k="Bowman's pressure (P_BS)" v={`${f0(h.pbs)} mmHg`} base={f0(b.pbs)} />
          </dl>
        </>
      ),
    },
    {
      id: 'pct',
      name: 'Proximal tubule',
      at: [134, 232],
      pos: [62, 262],
      mobile: true,
      info: () => (
        <>
          <p>Reabsorbs about two-thirds of filtered sodium, with water following isosmotically — so the fluid leaves as concentrated as plasma, just smaller in volume.</p>
          {segRows('proximal')}
          {inputs.sglt2 && <p className="mt-2 text-teal-800">The SGLT2 inhibitor acts here, leaving more sodium in the tubule.</p>}
        </>
      ),
    },
    {
      id: 'loop',
      name: 'Loop of Henle',
      at: [231, 470],
      pos: [128, 470],
      mobile: true,
      info: () => (
        <>
          <p>
            The descending limb is water-permeable, so fluid concentrates towards the medullary peak ({Math.round(snap.tubule.hairpinOsm)} mOsm/kg). The thick ascending
            limb then pumps NaCl out but holds water in, so fluid leaves dilute — the "diluting segment".
          </p>
          {segRows('loop')}
          {inputs.loopDiuretic && <p className="mt-2 text-teal-800">The loop diuretic acts here: the gradient washes out and the fluid leaves near isosmotic.</p>}
        </>
      ),
    },
    {
      id: 'md',
      name: 'Macula densa',
      at: MD,
      pos: [424, 248],
      mobile: false,
      info: () => (
        <>
          <p>
            Where the tubule returns to its own glomerulus. It senses distal salt delivery and adjusts the afferent arteriole (tubuloglomerular
            feedback). Here, single-nephron GFR stands in for salt delivery.
          </p>
          <dl className="mt-2">
            <Row k="Feedback on afferent" v={inputs.autoregulation ? `×${f2(h.tgfFactor)}` : 'off'} />
          </dl>
        </>
      ),
    },
    {
      id: 'dct',
      name: 'Distal tubule',
      at: [470, 198],
      pos: [424, 304],
      mobile: true,
      info: () => (
        <>
          <p>Fine-tunes sodium, potassium and calcium. It is relatively water-impermeable, so it dilutes the fluid a little further.</p>
          {segRows('distal')}
          {inputs.thiazide && <p className="mt-2 text-teal-800">The thiazide acts here.</p>}
        </>
      ),
    },
    {
      id: 'cd',
      name: 'Collecting duct',
      at: [516, 430],
      pos: [430, 430],
      mobile: true,
      info: () => (
        <>
          <p>
            Each collecting duct drains many nephrons. ADH inserts water channels, so this is where the final urine volume and concentration are set; aldosterone
            drives the last of the sodium reabsorption and potassium secretion.
          </p>
          {segRows('collecting')}
          <dl className="mt-1">
            <Row k="Urine" v={`${snap.tubule.urineVolume.toFixed(1)} L/day at ${Math.round(snap.tubule.urineOsm)} mOsm/kg`} />
          </dl>
          {inputs.mra && <p className="mt-2 text-teal-800">The MRA acts here, blocking aldosterone.</p>}
        </>
      ),
    },
  ];

  for (const k of Object.keys(DRUG_SITES) as DrugKey[]) {
    if (!inputs[k]) continue;
    const d = DRUG_SITES[k];
    const def = DRUG_DEFS[k];
    labels.push({
      id: `drug-${k}`,
      name: `${def.name}: ${d.what}`,
      at: d.at,
      pos: d.at,
      mobile: true,
      glyph: d.action,
      info: () => (
        <>
          <p className="font-medium text-slate-900">{d.what.charAt(0).toUpperCase() + d.what.slice(1)}.</p>
          <p className="mt-1">{def.mechanism}</p>
          <dl className="mt-2">
            <Row k="Site" v={def.site} />
            {k === 'nsaid' && <Row k="Afferent tone from drugs" v={`×${f2(h.modAfferent)}`} />}
            {k === 'acei' && <Row k="Efferent tone from drugs" v={`×${f2(h.modEfferent)}`} />}
            {k === 'acei' && <Row k="Angiotensin II now" v={`×${f2(snap.effects.angIIEffective)}`} />}
            {k === 'sglt2' && <Row k="Salt reaching the macula densa" v={`×${f2(h.capillary ? snap.effects.mods.tgfSignal : 1)}`} />}
            {(k === 'loopDiuretic' || k === 'thiazide' || k === 'mra') && <Row k="Fractional sodium excretion" v={pct(snap.tubule.fena)} base={pct(baseline.tubule.fena)} />}
          </dl>
        </>
      ),
    });
  }

  const summary = `Nephron diagram. Afferent resistance ${f2(h.afferentEffective)} times healthy, efferent ${f2(h.efferentEffective)} times. Glomerular capillary pressure ${band(
    h.pgc,
    b.pgc,
  )}, Bowman's space pressure ${f0(h.pbs)} mmHg, filtrate per nephron ${f0(h.sngfr)} nL/min. Use the labels for details.`;

  return (
    <div ref={root} className="relative w-full" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
      <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label={summary} className="absolute inset-0 h-full w-full select-none">
        <defs>
          <radialGradient id="nl-tuft" cx="42%" cy="38%" r="65%">
            <stop offset="0%" stopColor={css(tuftMid)} />
            <stop offset="70%" stopColor={css(tuftDark)} />
            <stop offset="100%" stopColor={css(tuftDark)} />
          </radialGradient>
          <radialGradient id="nl-space" cx="50%" cy="50%" r="50%">
            <stop offset="50%" stopColor={css(spaceFill, 0.35)} />
            <stop offset="100%" stopColor={css(spaceFill, 0.85)} />
          </radialGradient>
          {/* Soft fade at the drawing's edges so vessels dissolve rather than end */}
          <linearGradient id="nl-fade-x" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VB_W} y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.08" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.94" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="nl-fade-y" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={VB_H}>
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.03" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.86" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="nl-edge-x" maskUnits="userSpaceOnUse" x={-60} y={-60} width={VB_W + 120} height={VB_H + 120}>
            <rect x={-60} y={-60} width={VB_W + 120} height={VB_H + 120} fill="url(#nl-fade-x)" />
          </mask>
          <mask id="nl-edge-y" maskUnits="userSpaceOnUse" x={-60} y={-60} width={VB_W + 120} height={VB_H + 120}>
            <rect x={-60} y={-60} width={VB_W + 120} height={VB_H + 120} fill="url(#nl-fade-y)" />
          </mask>
          <linearGradient id="nl-loopglow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.2" />
            <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        <text x={8} y={CORTEX_Y - 6} className="fill-slate-400/80 text-[10px] font-semibold tracking-[0.25em]">
          CORTEX
        </text>
        <text x={8} y={CORTEX_Y + 14} className="fill-slate-400/80 text-[10px] font-semibold tracking-[0.25em]">
          MEDULLA
        </text>

        <g mask="url(#nl-edge-x)">
        <g mask="url(#nl-edge-y)">
        <ellipse aria-hidden="true" cx={300} cy={CORTEX_Y + 150} rx={250} ry={140} fill="#bfdbfe" opacity={0.22} />
        {/* Medullary gradient between the loop limbs */}
        <path d={LOOP_GLOW} fill="url(#nl-loopglow)" opacity={0.85} />

        {/* Peritubular capillaries continue from the efferent arteriole */}
        <Tube d={CAPILLARY} w={14} s={STYLE.capillary} dur={bloodDur && bloodDur * 1.4} />

        {/* Tubule and collecting duct */}
        <Tube d={DUCT} w={38} s={STYLE.duct} dur={tubuleDur && tubuleDur * 1.4} />
        <Tube d={TUBULE} w={28} s={STYLE.tubule} dur={tubuleDur} />
        <circle cx={MD[0]} cy={MD[1]} r={6.5} fill="#38bdf8" stroke="#fff" strokeWidth={2} />

        {/* Bowman's space + capsule (cup open at the vascular pole) */}
        <circle cx={G.x} cy={G.y} r={rCapsule + 26} fill={css(capsuleStyle.glow, 0.12)} />
        <circle cx={G.x} cy={G.y} r={rCapsule - 2} fill="url(#nl-space)" />
        <Tube d={CAPSULE} w={capsuleW} s={capsuleStyle} dur={null} sparkle={false} />

        {/* Filtrate particles crossing Bowman's space, driven by the same flow loop */}
        {particles.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="#38bdf8"
            opacity={0}
            data-particle=""
            data-dx={p.dx.toFixed(1)}
            data-dy={p.dy.toFixed(1)}
            data-phase={p.phase.toFixed(3)}
            data-rate={(1 / particleDur).toFixed(3)}
          />
        ))}

        {/* Arterioles. Where a drug narrows a vessel, a dashed halo behind it shows the
            calibre the vessel would have had without that drug. */}
        {ghostE !== null && ghostE > wE + 1.5 && (
          <path d={EFFERENT} fill="none" stroke="#64748b" strokeOpacity={0.4} strokeWidth={ghostE} strokeLinecap="round" strokeDasharray="7 7" className="nl-ghost">
            <title>Calibre without the drug</title>
          </path>
        )}
        <Tube d={EFFERENT} w={wE} s={STYLE.efferent} dur={bloodDur} animateWidth />
        {ghostA !== null && ghostA > wA + 1.5 && (
          <path d={AFFERENT} fill="none" stroke="#64748b" strokeOpacity={0.4} strokeWidth={ghostA} strokeLinecap="round" strokeDasharray="7 7" className="nl-ghost">
            <title>Calibre without the drug</title>
          </path>
        )}
        <Tube d={AFFERENT} w={wA} s={STYLE.afferent} dur={bloodDur} animateWidth />

        {/* Glomerular tuft: one convoluted capillary folded back on itself. Static
            geometry — it does not pulse; only its colour tracks pressure. */}
        <g>
          {TUFT_LOOPS.map((l, i) => (
            <g key={i}>
              {/* vessel wall, then lumen, then a soft highlight along the top of the tube */}
              <path d={l.d} fill="none" stroke={css(tuftDark, 0.95)} strokeWidth={l.w} strokeLinejoin="round" strokeLinecap="round" />
              <path d={l.d} fill="none" stroke={css(tuftMid)} strokeWidth={l.w - 4.5} strokeLinejoin="round" strokeLinecap="round" />
              <path d={l.d} fill="none" stroke={css(tuftLight, 0.55)} strokeWidth={Math.max(1.2, l.w * 0.22)} strokeLinejoin="round" strokeLinecap="round" transform="translate(-0.8 -1.1)" />
            </g>
          ))}
          {/* mesangium at the vascular pole, where the arterioles meet the tuft */}
          <circle cx={POLE[0]} cy={POLE[1]} r={7} fill={css(tuftDark, 0.85)} />
        </g>
        </g>
        </g>
        {filt < 0.02 && (
          <text x={G.x} y={G.y + rCapsule + 26} textAnchor="middle" className="fill-slate-800 text-[13px] font-semibold">
            filtration has stopped
          </text>
        )}

        {/* Leader lines */}
        {labels.filter((l) => !l.glyph).map((l) => (
          <g key={l.id} className={l.mobile ? '' : 'max-sm:hidden'} aria-hidden="true">
            <line x1={l.at[0]} y1={l.at[1]} x2={l.pos[0]} y2={l.pos[1]} stroke="#ffffff" strokeOpacity={0.95} strokeWidth={1.6} />
            <circle cx={l.at[0]} cy={l.at[1]} r={4} fill="#fff" stroke="#94a3b8" strokeWidth={1} />
          </g>
        ))}
      </svg>

      {/* Label cards */}
      {labels.map((l) => {
        const isOpen = shown === l.id;
        const left = (l.pos[0] / VB_W) * 100;
        const top = (l.pos[1] / VB_H) * 100;
        return (
          <div
            key={l.id}
            className={`absolute ${l.mobile ? '' : 'max-sm:hidden'}`}
            style={{
              left: left < 50 ? `max(2px, calc(${left}% - 52px))` : undefined,
              right: left >= 50 ? `max(2px, calc(${100 - left}% - 52px))` : undefined,
              top: `${top}%`,
              transform: 'translateY(-50%)',
              zIndex: isOpen ? 30 : 10,
            }}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`nl-info-${l.id}`}
              onClick={() => setOpen(open === l.id ? null : l.id)}
              onMouseEnter={() => setHover(l.id)}
              onMouseLeave={() => setHover((v) => (v === l.id ? null : v))}
              onFocus={() => setHover(l.id)}
              onBlur={() => setHover((v) => (v === l.id ? null : v))}
              className={
                l.glyph
                  ? 'block rounded-full transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600'
                  : `whitespace-nowrap rounded-xl px-2 py-1 text-[10px] font-medium shadow-[0_4px_14px_-4px_rgb(15_23_42/0.25)] backdrop-blur-md transition sm:px-3 sm:py-1.5 sm:text-[13px] ${
                      isOpen ? 'bg-slate-900 text-white' : 'bg-white/85 text-slate-800 hover:bg-white'
                    } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600`
              }
            >
              {l.glyph ? <ActionGlyph action={l.glyph} play={animate ? 'running' : 'paused'} /> : l.name}
              {l.glyph && <span className="sr-only">{l.name}</span>}
            </button>
          </div>
        );
      })}

      {shown &&
        (() => {
          const l = labels.find((x) => x.id === shown)!;
          const upper = l.pos[1] < VB_H / 2;
          return (
            <div
              id={`nl-info-${l.id}`}
              role="dialog"
              aria-label={l.name}
              className={`absolute z-40 w-[min(300px,92%)] rounded-2xl bg-white/95 p-3 text-[13px] leading-snug text-slate-700 shadow-xl ring-1 ring-slate-200 backdrop-blur ${
                upper ? 'bottom-[4%] left-0' : 'top-[4%] right-0'
              }`}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{l.name}</h3>
                <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="-mr-1 -mt-1 rounded-full px-1.5 text-lg leading-none text-slate-400 hover:text-slate-700">
                  ×
                </button>
              </div>
              {l.info()}
            </div>
          );
        })()}
    </div>
  );
}

/**
 * The simulation ticks faster than the drawing can meaningfully change, so the diagram
 * re-renders only when something it actually draws has moved. Values are quantised well
 * below what is visible (resistances to 0.5%, pressures to 0.5 mmHg), which removes most
 * renders during a steady run without the picture ever lagging perceptibly behind.
 */
function visualSignature(p: Props): (number | boolean)[] {
  const h = p.snap.haemo;
  const t = p.snap.tubule;
  return [
    Math.round(h.afferentEffective * 200),
    Math.round(h.efferentEffective * 200),
    Math.round(h.modAfferent * 200),
    Math.round(h.modEfferent * 200),
    Math.round(h.pgc * 2),
    Math.round(h.pbs * 2),
    Math.round(h.sngfr * 2),
    Math.round(h.gfr * 2),
    Math.round(h.rbf / 4),
    Math.round(h.rpf / 4),
    Math.round(h.capillary.piEfferent * 2),
    Math.round(h.capillary.nfpMean * 4),
    Math.round(h.tgfFactor * 200),
    Math.round(h.myogenicFactor * 200),
    h.capillary.equilibrium,
    Math.round(t.urineVolume * 20),
    Math.round(t.fena * 2000),
    Math.round(t.urineOsm / 5),
    Math.round(p.snap.effects.angIIEffective * 50),
    p.animate,
  ];
}

export const NephronDiagram = memo(NephronDiagramInner, (prev, next) => {
  // Inputs change only on a user action, so a reference check is enough.
  if (prev.inputs !== next.inputs || prev.baseline !== next.baseline) return false;
  const a = visualSignature(prev);
  const b = visualSignature(next);
  return a.every((v, i) => v === b[i]);
});
