import { useId, type JSX } from 'react';
import { ARROW, BAND_TONE, DISPLAY, band, direction, formatValue, type Snapshot } from '../model';
import type { TracePoint } from '../useSimulation';

export type MetricKey = 'gfr' | 'egfr' | 'creatinine' | 'urea' | 'urine';

/**
 * Sparklines cover the WHOLE run, not a rolling window: a drop that happened on day 2
 * must still be visible on day 20, otherwise every chart eventually looks flat and
 * stable. Long runs are downsampled to keep the path short.
 */
const MAX_POINTS = 140;

function sampleTrace(trace: TracePoint[]): TracePoint[] {
  if (trace.length <= MAX_POINTS) return trace;
  const step = trace.length / MAX_POINTS;
  const out: TracePoint[] = [];
  for (let i = 0; i < MAX_POINTS; i++) out.push(trace[Math.min(trace.length - 1, Math.round(i * step))]!);
  out[out.length - 1] = trace[trace.length - 1]!; // always end on the current value
  return out;
}

function Sparkline({ values, color, className = '' }: { values: number[]; color: string; className?: string }) {
  const gid = useId();
  const pts = values.filter((v) => isFinite(v));
  if (pts.length < 2) pts.unshift(pts[0] ?? 0);
  const W = 140;
  const H = 56;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const mid = (min + max) / 2;
  // Only a small floor, so a few percent of real change still reads as a slope.
  const span = Math.max(max - min, Math.abs(mid) * 0.03, 1e-6);
  const lo = mid - span * 0.65;
  const hi = mid + span * 0.65;
  const x = (i: number) => 4 + (i / (pts.length - 1)) * (W - 12);
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo)) * (H - 14);
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lx = x(pts.length - 1);
  const ly = y(pts[pts.length - 1]!);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${lx},${H} L${x(0)},${H} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={8} fill={color} opacity={0.18} className="nl-live" />
      <circle cx={lx} cy={ly} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

function ChangePill({ value, base, small = false }: { value: number; base: number; small?: boolean }) {
  const dir = direction(value, base);
  const p = isFinite(value) && base ? Math.round(((value - base) / base) * 100) : 0;
  const tone = dir === 'same' ? 'bg-slate-100 text-slate-600' : dir === 'up' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
  const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold tabular-nums ${tone} ${small ? 'px-1.5 py-0.5 text-[11px]' : 'px-2.5 py-1 text-sm'}`}>
      <span aria-hidden="true">{arrow}</span>
      {Math.abs(p)}%
      <span className="sr-only">{dir === 'same' ? ' change from healthy baseline' : dir === 'up' ? ' higher than healthy baseline' : ' lower than healthy baseline'}</span>
    </span>
  );
}

const ICONS: Record<MetricKey, JSX.Element> = {
  gfr: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-600" fill="currentColor" aria-hidden="true">
      <rect x="3" y="12" width="3.5" height="9" rx="1" />
      <rect x="8.5" y="7" width="3.5" height="14" rx="1" />
      <rect x="14" y="3" width="3.5" height="18" rx="1" />
      <rect x="19.5" y="9" width="2.5" height="12" rx="1" opacity=".6" />
    </svg>
  ),
  egfr: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-orange-500" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h2M14 12h2M8 16h2M14 16h2" strokeLinecap="round" />
    </svg>
  ),
  creatinine: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-blue-600" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c-.4 0-.8.2-1 .6C9 6.6 6 10.4 6 14a6 6 0 0 0 12 0c0-3.6-3-7.4-5-10.9-.2-.4-.6-.6-1-.6z" />
    </svg>
  ),
  urea: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3" strokeLinejoin="round" />
    </svg>
  ),
  urine: (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-600" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
      <path d="M6 4h12l-1.4 14.2A2 2 0 0 1 14.6 20H9.4a2 2 0 0 1-2-1.8L6 4z" strokeLinejoin="round" />
      <path d="M7 11h10" strokeLinecap="round" />
    </svg>
  ),
};

const META: Record<MetricKey, { title: string; short: string; unit: string; step: number; color: string; pick: (s: Snapshot) => number; trace: (p: TracePoint) => number; note?: string }> = {
  gfr: { title: 'Kidney Filtration (GFR)', short: 'GFR', unit: 'mL/min', step: DISPLAY.gfr.step, color: '#2563eb', pick: (s) => s.trueGfr, trace: (p) => p.gfr },
  egfr: {
    title: 'Estimated GFR (eGFR)',
    short: 'eGFR',
    unit: 'mL/min/1.73m²',
    step: DISPLAY.egfr.step,
    color: '#ea580c',
    pick: (s) => s.egfr,
    trace: (p) => p.egfr,
    note: 'Calculated from creatinine (CKD-EPI 2021), so it lags true GFR',
  },
  creatinine: { title: 'Creatinine', short: 'Creatinine', unit: 'µmol/L', step: DISPLAY.creatinine.step, color: '#2563eb', pick: (s) => s.creatinine, trace: (p) => p.creatinine },
  urea: { title: 'Urea', short: 'Urea', unit: 'mmol/L', step: DISPLAY.urea.step, color: '#2563eb', pick: (s) => s.urea, trace: (p) => p.urea },
  urine: {
    title: 'Urine Output',
    short: 'Urine',
    unit: 'L/day',
    step: 0.1,
    color: '#0891b2',
    pick: (s) => s.tubule.urineVolume,
    trace: (p) => p.urineVolume,
    note: 'Osmole load divided by urine concentration; ADH sets the concentration',
  },
};

/** Two series on one scale, so the gap between them is readable (used for GFR vs eGFR). */
function DualSparkline({ a, b, colorA, colorB, className = '' }: { a: number[]; b: number[]; colorA: string; colorB: string; className?: string }) {
  const gid = useId();
  const A = a.filter((v) => isFinite(v));
  const B = b.filter((v) => isFinite(v));
  if (A.length < 2) return <svg className={className} aria-hidden="true" />;
  const all = [...A, ...B];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const mid = (min + max) / 2;
  const span = Math.max(max - min, Math.abs(mid) * 0.03, 1e-6);
  const lo = mid - span * 0.6;
  const hi = mid + span * 0.6;
  const W = 150;
  const H = 60;
  const x = (i: number, n: number) => 4 + (i / (n - 1)) * (W - 12);
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo)) * (H - 14);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i, vals.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastA = A[A.length - 1]!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorA} stopOpacity="0.25" />
          <stop offset="100%" stopColor={colorA} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path(A)} L${x(A.length - 1, A.length)},${H} L${x(0, A.length)},${H} Z`} fill={`url(#${gid})`} />
      {B.length > 1 && <path d={path(B)} fill="none" stroke={colorB} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />}
      <path d={path(A)} fill="none" stroke={colorA} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(A.length - 1, A.length)} cy={y(lastA)} r={8} fill={colorA} opacity={0.18} className="nl-live" />
      <circle cx={x(A.length - 1, A.length)} cy={y(lastA)} r={4} fill={colorA} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

/** GFR and eGFR in one box: the point is the gap between them, so they share a chart. */
export function FiltrationCard({ snap, baseline, trace, onOpen, compact = false }: { snap: Snapshot; baseline: Snapshot; trace: TracePoint[]; onOpen: (k: MetricKey) => void; compact?: boolean }) {
  const gfr = snap.trueGfr;
  const egfr = snap.egfr;
  const lagging = isFinite(snap.steadyCreatinine) && Math.abs(snap.creatinine - snap.steadyCreatinine) / snap.steadyCreatinine > 0.03;
  return (
    <button
      type="button"
      onClick={() => onOpen('gfr')}
      className={`group relative w-full overflow-hidden rounded-2xl bg-white/85 text-left shadow-[0_2px_10px_-4px_rgb(30_64_175/0.16)] ring-1 ring-slate-200/70 backdrop-blur transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${compact ? 'p-3' : 'p-4'}`}
      aria-label={`Kidney filtration. True GFR ${formatValue(gfr, 5)} mL per minute, estimated GFR ${formatValue(egfr, 5)} mL per minute per 1.73 square metres. Open chart over time.`}
    >
      <div className="flex items-center gap-2">
        {ICONS.gfr}
        <span className={`font-semibold text-slate-800 ${compact ? 'text-xs' : 'text-[15px]'}`}>Kidney Filtration</span>
        <span className="ml-auto text-[10px] text-slate-400 opacity-0 transition group-hover:opacity-100 max-sm:hidden" aria-hidden="true">
          chart ↗
        </span>
      </div>
      <div className={`flex items-start gap-3 ${compact ? 'mt-1' : 'mt-2'}`}>
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium tracking-wide text-slate-500 uppercase">True GFR</span>
          <div className="flex items-baseline gap-1">
            <span className={`font-bold tracking-tight text-slate-900 tabular-nums ${compact ? 'text-2xl leading-none' : 'text-[34px] leading-none'}`}>{formatValue(gfr, 5)}</span>
            <span className="text-[10px] text-slate-600">mL/min</span>
          </div>
          <div className="mt-1">
            <ChangePill value={gfr} base={baseline.trueGfr} small />
          </div>
        </div>
        <div className="min-w-0 flex-1 border-l border-slate-200 pl-3">
          <span className="block text-[10px] font-medium tracking-wide text-slate-500 uppercase">eGFR</span>
          <div className="flex items-baseline gap-1">
            <span className={`font-bold tracking-tight tabular-nums ${compact ? 'text-2xl leading-none' : 'text-[34px] leading-none'}`} style={{ color: '#c2410c' }}>
              {formatValue(egfr, 5)}
            </span>
            <span className="text-[10px] text-slate-600">/1.73m²</span>
          </div>
          <div className="mt-1">
            <ChangePill value={egfr} base={baseline.egfr} small />
          </div>
        </div>
      </div>
      <DualSparkline
        a={sampleTrace(trace).map((p) => p.gfr)}
        b={sampleTrace(trace).map((p) => p.egfr)}
        colorA="#2563eb"
        colorB="#ea580c"
        className={`mt-2 w-full ${compact ? 'h-8' : 'h-14'}`}
      />
      {!compact && (
        <p className="mt-2 text-[11px] leading-tight text-slate-500">
          <span className="font-medium" style={{ color: '#c2410c' }}>
            Dashed
          </span>{' '}
          is eGFR, calculated from creatinine (CKD-EPI 2021).{' '}
          {lagging ? 'Creatinine is still moving, so eGFR does not yet reflect true GFR.' : 'Creatinine is settled, so the two agree.'}
        </p>
      )}
    </button>
  );
}

interface CardProps {
  k: MetricKey;
  snap: Snapshot;
  baseline: Snapshot;
  trace: TracePoint[];
  onOpen: (k: MetricKey) => void;
  size: 'lg' | 'sm';
}

export function StatCard({ k, snap, baseline, trace, onOpen, size }: CardProps) {
  const m = META[k];
  const v = m.pick(snap);
  const values = sampleTrace(trace).map(m.trace);
  const lg = size === 'lg';
  return (
    <button
      type="button"
      onClick={() => onOpen(k)}
      className={`group relative w-full overflow-hidden rounded-2xl bg-white/85 text-left shadow-[0_2px_10px_-4px_rgb(30_64_175/0.16)] ring-1 ring-slate-200/70 backdrop-blur transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
        lg ? 'p-4' : 'p-3'
      }`}
      aria-label={`${m.title}: ${formatValue(v, m.step)} ${m.unit}. Open chart over time.`}
    >
      <div className="flex items-center gap-2">
        {ICONS[k]}
        <span className={`font-semibold text-slate-800 ${lg ? 'text-[15px]' : 'text-xs'}`}>{lg ? m.title : m.short}</span>
        <span className="ml-auto text-[10px] text-slate-400 opacity-0 transition group-hover:opacity-100 max-sm:hidden" aria-hidden="true">
          chart ↗
        </span>
      </div>
      <div className={`flex items-end justify-between gap-2 ${lg ? 'mt-2' : 'mt-1'}`}>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className={`font-bold tracking-tight text-slate-900 tabular-nums ${lg ? 'text-[44px] leading-none' : 'text-2xl leading-none'}`}>{formatValue(v, m.step)}</span>
            <span className={`text-slate-600 ${lg ? (m.unit.length > 8 ? 'text-xs' : 'text-base') : 'text-[11px]'}`}>{m.unit}</span>
          </div>
          <div className={lg ? 'mt-3' : 'mt-1.5'}>
            <ChangePill value={v} base={m.pick(baseline)} small={!lg} />
          </div>
        </div>
        <Sparkline values={values} color={m.color} className={lg ? 'h-16 w-36 shrink-0' : 'h-10 w-16 shrink-0'} />
      </div>
      {m.note && lg && <p className="mt-2 text-[11px] leading-tight text-slate-500 max-sm:hidden">{m.note}</p>}
    </button>
  );
}

export function GlomerulusStrip({ snap, baseline }: { snap: Snapshot; baseline: Snapshot }) {
  const h = snap.haemo;
  const b = baseline.haemo;
  // Glomerular capillary pressure cannot be measured in a patient, so it is shown as a
  // band relative to healthy rather than a number that could be mistaken for a reading.
  const pgcBand = band(h.pgc, b.pgc);
  const items = [
    { k: 'Plasma filtered (FF)', v: `${formatValue(h.filtrationFraction * 100, 1)}`, u: '%', val: h.filtrationFraction, base: b.filtrationFraction },
    { k: 'Renal plasma flow', v: formatValue(h.rpf, DISPLAY.rpf.step), u: 'mL/min', val: h.rpf, base: b.rpf },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-white/60 p-2.5 ring-1 ring-white/80 backdrop-blur">
      <div className="min-w-0">
        <dt className="text-[11px] leading-tight text-slate-500">Glomerular pressure</dt>
        <dd>
          <span className={`text-[15px] font-semibold ${BAND_TONE[pgcBand]}`}>{pgcBand}</span>
          <span className="ml-1 text-[11px] text-slate-500" aria-hidden="true">
            {ARROW[direction(h.pgc, b.pgc)]}
          </span>
          <span className="block text-[10px] leading-tight text-slate-400">not measurable</span>
        </dd>
      </div>
      {items.map((i) => {
        const dir = direction(i.val, i.base);
        return (
          <div key={i.k} className="min-w-0">
            <dt className="text-[11px] leading-tight text-slate-500">{i.k}</dt>
            <dd className="tabular-nums">
              <span className="text-base font-semibold text-slate-900">{i.v}</span>
              <span className="ml-0.5 text-[11px] text-slate-500">{i.u}</span>
              <span className="ml-1 text-[11px] text-slate-500" aria-label={dir === 'same' ? 'unchanged' : dir === 'up' ? 'higher' : 'lower'}>
                {ARROW[dir]}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Urine and volume status (Phase 3, illustrative tubule model). */
export function UrinePanel({ snap, baseline }: { snap: Snapshot; baseline: Snapshot }) {
  const t = snap.tubule;
  const b = baseline.tubule;
  const vol = snap.volumePercent;
  const volLabel = vol < -12 ? 'markedly depleted' : vol < -4 ? 'depleted' : vol > 8 ? 'overloaded' : vol > 3 ? 'expanded' : 'euvolaemic';
  const volTone = Math.abs(vol) < 4 ? 'text-slate-600' : vol < 0 ? 'text-rose-700' : 'text-sky-700';
  const rows: { k: string; v: string; val: number; base: number }[] = [
    { k: 'Urine osmolality', v: `${Math.round(t.urineOsm / 10) * 10} mOsm/kg`, val: t.urineOsm, base: b.urineOsm },
    { k: 'Sodium excreted', v: `${Math.round(t.naExcretionPerDay)} mmol/day`, val: t.naExcretionPerDay, base: b.naExcretionPerDay },
    { k: 'Fractional Na excretion', v: `${(t.fena * 100).toFixed(2)} %`, val: t.fena, base: b.fena },
    { k: 'Potassium excreted', v: `${Math.round(t.kExcretionPerDay)} mmol/day`, val: t.kExcretionPerDay, base: b.kExcretionPerDay },
  ];
  return (
    <section aria-labelledby="urine-h" className="rounded-2xl bg-white/70 p-3 ring-1 ring-white/80 backdrop-blur">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="urine-h" className="text-[13px] font-semibold text-slate-800">
          Urine &amp; volume
        </h2>
        <span className={`text-[11px] font-medium tabular-nums ${volTone}`}>
          {vol > 0 ? '+' : ''}
          {vol.toFixed(0)}% · {volLabel}
        </span>
      </div>
      <dl className="mt-1.5 space-y-0.5">
        {rows.map((r) => {
          const dir = direction(r.val, r.base);
          return (
            <div key={r.k} className="flex items-baseline justify-between gap-2 text-[11px]">
              <dt className="text-slate-600">{r.k}</dt>
              <dd className="tabular-nums text-slate-900">
                <span className="font-semibold">{r.v}</span>
                <span className="ml-1 text-slate-500" aria-label={dir === 'same' ? 'unchanged' : dir === 'up' ? 'higher' : 'lower'}>
                  {ARROW[dir]}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      {t.glucosuria && <p className="mt-1.5 text-[11px] text-amber-800">Glucose is present in the urine (SGLT2 inhibitor). Its osmotic effect on urine volume is not modelled.</p>}
      <p className="mt-1.5 text-[10px] leading-tight text-slate-400">Illustrative segmental tubule model; plasma sodium and potassium are held constant.</p>
    </section>
  );
}
