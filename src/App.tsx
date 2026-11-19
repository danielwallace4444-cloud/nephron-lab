import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Controls } from './components/Controls';
import { NephronDiagram } from './components/NephronDiagram';
import { FiltrationCard, GlomerulusStrip, StatCard, UrinePanel, type MetricKey } from './components/StatCards';
import type { ChartSeries } from './components/TimeChart';

/** Charts (and uPlot with them) load only when a chart is first opened. */
const TimeChart = lazy(() => import('./components/TimeChart').then((m) => ({ default: m.TimeChart })));
import { explain } from './explain';
import type { ModelInputs, Snapshot } from './model';
import { SCENARIOS, type Scenario } from './scenarios';
import { HOURS_PER_SECOND, SPEEDS, useSimulation, type TracePoint } from './useSimulation';

const SERIES_1 = '#2a78d6';
const SERIES_2 = '#eb6834';

function formatTime(h: number) {
  const day = Math.floor(h / 24);
  const hr = Math.floor(h % 24);
  return `Day ${day} · ${String(hr).padStart(2, '0')}:00`;
}

function Logo() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" aria-hidden="true">
      <defs>
        <linearGradient id="lg-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#lg-logo)" />
      <path d="M15 10c-5 0-7 5-7 10s2 10 7 10c3 0 4-2.4 3.4-4.6-.5-1.8-2.4-2.6-2.4-5.4s1.9-3.6 2.4-5.4C19 12.4 18 10 15 10z" fill="#fff" />
      <path d="M25 10c5 0 7 5 7 10s-2 10-7 10c-3 0-4-2.4-3.4-4.6.5-1.8 2.4-2.6 2.4-5.4s-1.9-3.6-2.4-5.4C21 12.4 22 10 25 10z" fill="#fff" opacity=".85" />
    </svg>
  );
}

function ScenarioChips({ active, onPick, className = '' }: { active: string | null; onPick: (s: Scenario) => void; className?: string }) {
  return (
    <div role="group" aria-label="Clinical scenarios" className={`flex gap-1.5 ${className}`}>
      {SCENARIOS.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={active === s.id}
          onClick={() => onPick(s)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
            active === s.id ? 'bg-sky-600 text-white shadow-sm' : 'bg-white/70 text-slate-700 ring-1 ring-white hover:bg-white'
          }`}
        >
          {s.short}
          <span className="sr-only">: {s.title}</span>
        </button>
      ))}
    </div>
  );
}

function Bulb() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-sky-500" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V17h5v-1.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WhatsHappening({ scenario, step, onNext, snap, baseline, inputs }: { scenario: Scenario | null; step: number; onNext: () => void; snap: Snapshot; baseline: Snapshot; inputs: ModelInputs }) {
  const now = explain(snap, baseline, inputs);
  const onStep = scenario && step === 1 && scenario.next;
  return (
    <section aria-labelledby="wh-h" className="rounded-2xl bg-gradient-to-br from-white/85 to-sky-50/80 p-4 shadow-sm ring-1 ring-white/80 backdrop-blur">
      <div className="flex items-center gap-2">
        <Bulb />
        <h2 id="wh-h" className="text-base font-semibold text-slate-900">
          What's happening?
        </h2>
      </div>
      {scenario && (
        <div className="mt-2">
          <p className="text-sm font-semibold text-sky-900">
            {scenario.title}
            {onStep && <span className="font-normal text-slate-600"> · {scenario.next!.label}</span>}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-slate-700">{onStep ? scenario.next!.note : scenario.note}</p>
          {!onStep && <p className="mt-1.5 text-[13px] leading-snug font-medium text-slate-800">Watch: {scenario.watch}</p>}
          {scenario.next && step === 0 && (
            <button
              type="button"
              onClick={onNext}
              className="mt-2 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              {scenario.next.action} →
            </button>
          )}
        </div>
      )}
      <ul aria-live="polite" className={`${scenario ? 'mt-2 border-t border-slate-200/70 pt-2' : 'mt-2'} space-y-1 text-[13px] leading-snug text-slate-700`}>
        {now.map((t) => (
          <li key={t} className="flex gap-1.5">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
            {t}
          </li>
        ))}
      </ul>
      {scenario?.modelNote && <p className="mt-2 text-[11px] leading-snug text-slate-500">Model note: {scenario.modelNote}</p>}
    </section>
  );
}

function Playback({
  running,
  setRunning,
  speed,
  setSpeed,
  t,
  onReset,
  onResetClock,
}: {
  running: boolean;
  setRunning: (v: boolean) => void;
  speed: number;
  setSpeed: (v: number) => void;
  t: number;
  onReset: () => void;
  onResetClock: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/90 p-1.5 pr-2 shadow-lg ring-1 ring-white backdrop-blur sm:gap-3 sm:pr-3">
      <button
        type="button"
        onClick={() => setRunning(!running)}
        aria-label={running ? 'Pause simulation' : 'Play simulation'}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-600 text-white shadow hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      >
        {running ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1">
          <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-800">{formatTime(t)}</span>
          <button
            type="button"
            onClick={onResetClock}
            aria-label="Restart the clock at day 0, keeping the current state"
            title="Restart the clock at day 0 (keeps the current state)"
            className="grid h-5 w-5 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-sky-600"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="text-[11px] text-slate-500">{running ? 'Simulation running' : 'Paused'}</div>
      </div>
      <div role="radiogroup" aria-label={`Speed (1× = ${HOURS_PER_SECOND} simulated hours per second)`} className="flex gap-0.5 sm:gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={speed === s}
            onClick={() => setSpeed(s)}
            className={`rounded-full px-2 py-1 text-xs font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-sky-600 sm:px-2.5 ${speed === s ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {s}×
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onReset}
        aria-label="Reset to healthy baseline"
        title="Reset to healthy baseline"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-600"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

const CHART_META: Record<MetricKey, { title: string; unit: string }> = {
  gfr: { title: 'True GFR vs eGFR', unit: 'mL/min' },
  egfr: { title: 'True GFR vs eGFR', unit: 'mL/min' },
  creatinine: { title: 'Plasma creatinine', unit: 'µmol/L' },
  urea: { title: 'Plasma urea', unit: 'mmol/L' },
  urine: { title: 'Urine output', unit: 'L/day' },
};

function ChartDialog({ metric, onClose, trace }: { metric: MetricKey | null; onClose: () => void; trace: TracePoint[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<MetricKey>('gfr');
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (metric) {
      setTab(metric === 'egfr' ? 'gfr' : metric);
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [metric]);
  const t = useMemo(() => trace.map((p) => p.t), [trace]);
  const series = useMemo((): ChartSeries[] => {
    if (tab === 'gfr' || tab === 'egfr')
      return [
        { label: 'True GFR (mL/min)', color: SERIES_1, values: trace.map((p) => p.gfr), decimals: 0 },
        { label: 'eGFR (mL/min/1.73m²)', color: SERIES_2, dash: [6, 4], values: trace.map((p) => p.egfr), decimals: 0 },
      ];
    if (tab === 'creatinine') return [{ label: 'Creatinine', color: SERIES_1, values: trace.map((p) => p.creatinine), decimals: 0 }];
    if (tab === 'urine') return [{ label: 'Urine output', color: '#0891b2', values: trace.map((p) => p.urineVolume), decimals: 1 }];
    return [{ label: 'Urea', color: SERIES_1, values: trace.map((p) => p.urea), decimals: 1 }];
  }, [trace, tab]);
  const daily = trace.filter((p) => Math.abs(p.t / 24 - Math.round(p.t / 24)) < 1e-6);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className="m-auto w-[min(760px,94vw)] rounded-3xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/30 backdrop:backdrop-blur-sm">
      {metric && (
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Over time</h2>
            <div className="flex items-center gap-2">
              <div role="tablist" aria-label="Measure" className="inline-flex rounded-full bg-slate-100 p-0.5">
                {(
                  [
                    ['gfr', 'GFR / eGFR'],
                    ['urine', 'Urine'],
                    ['creatinine', 'Creatinine'],
                    ['urea', 'Urea'],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={`rounded-full px-3 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-sky-600 ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <button type="button" onClick={onClose} aria-label="Close chart" className="grid h-8 w-8 place-items-center rounded-full text-xl text-slate-500 hover:bg-slate-100">
                ×
              </button>
            </div>
          </div>
          <div className="mt-3">
            <Suspense fallback={<div className="h-[232px] animate-pulse rounded-xl bg-slate-100" aria-label="Loading chart" />}>
              <TimeChart title={CHART_META[tab].title} unit={CHART_META[tab].unit} t={t} series={series} />
            </Suspense>
          </div>
          {tab === 'gfr' && <p className="mt-1 text-xs text-slate-500">eGFR comes from the current creatinine, so after a sudden change it trails true GFR until creatinine settles (days).</p>}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-slate-600">Data table (daily)</summary>
            <div className="mt-2 max-h-48 overflow-auto">
              <table className="w-full text-right text-xs tabular-nums">
                <thead className="sticky top-0 bg-white text-slate-500">
                  <tr>
                    <th className="text-left font-medium">Day</th>
                    <th className="font-medium">GFR</th>
                    <th className="font-medium">eGFR</th>
                    <th className="font-medium">Urine</th>
                    <th className="font-medium">Creatinine</th>
                    <th className="font-medium">Urea</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((p) => (
                    <tr key={p.t} className="border-t border-slate-100">
                      <td className="text-left">{Math.round(p.t / 24)}</td>
                      <td>{p.gfr.toFixed(0)}</td>
                      <td>{p.egfr.toFixed(0)}</td>
                      <td>{p.urineVolume.toFixed(1)}</td>
                      <td>{p.creatinine.toFixed(0)}</td>
                      <td>{p.urea.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </dialog>
  );
}

export function App() {
  const sim = useSimulation();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [step, setStep] = useState(0);
  const [chart, setChart] = useState<MetricKey | null>(null);

  const pick = (s: Scenario | null) => {
    setScenario(s);
    setStep(0);
    sim.restart(s?.inputs ?? {}, s?.volumePercent ?? 0);
    sim.setRunning(true);
  };
  const next = () => {
    if (scenario?.next) {
      setStep(1);
      sim.setInputs(scenario.next.inputs);
    }
  };
  const card = (k: MetricKey, size: 'lg' | 'sm') => <StatCard k={k} size={size} snap={sim.current} baseline={sim.baseline} trace={sim.trace} onOpen={setChart} />;
  const note = <WhatsHappening scenario={scenario} step={step} onNext={next} snap={sim.current} baseline={sim.baseline} inputs={sim.inputs} />;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-3 lg:px-6 lg:pt-4">
        <Logo />
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Nephron Lab</h1>
          <p className="truncate text-[11px] text-slate-500 sm:text-xs">Illustrative teaching model · not for clinical decisions</p>
        </div>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <span className="text-xs font-medium text-slate-500">Clinical scenarios</span>
          <ScenarioChips active={scenario?.id ?? null} onPick={pick} />
        </div>
      </header>

      {/* Phone: sticky headline numbers */}
      <div className="sticky top-0 z-30 px-4 pt-2 pb-2 lg:hidden" style={{ background: 'linear-gradient(#eef3fb 85%, transparent)' }}>
        <FiltrationCard snap={sim.current} baseline={sim.baseline} trace={sim.trace} onOpen={setChart} compact />
      </div>

      {/* Phone: scenarios */}
      <div className="lg:hidden">
        <ScenarioChips active={scenario?.id ?? null} onPick={pick} className="overflow-x-auto px-4 pb-1" />
      </div>

      <main className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-24 lg:grid lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)_330px] lg:gap-5 lg:px-6 lg:pt-3 lg:pb-4">
        {/* Left: hero + controls */}
        <div className="order-4 flex min-h-0 flex-col gap-3 lg:order-none">
          <div className="hidden lg:block">
            <h2 className="text-[28px] leading-[1.1] font-bold tracking-tight text-slate-900">
              Discover how
              <br />a nephron filters
            </h2>
            <p className="mt-2 text-sm text-slate-600">Change the physiology and watch filtration, creatinine and eGFR respond over simulated days.</p>
          </div>
          <section aria-labelledby="ctrl-h" className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white/75 p-3 shadow-sm ring-1 ring-white/80 backdrop-blur">
            <h2 id="ctrl-h" className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-900">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-600" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" strokeLinecap="round" />
              </svg>
              Adjust physiology
            </h2>
            <Controls inputs={sim.inputs} setInputs={sim.setInputs} volumePercent={sim.current.volumePercent} setVolumePercent={sim.setVolumePercent} />
          </section>
        </div>

        {/* Centre: the nephron */}
        <section aria-label="Nephron" className="relative order-1 flex min-h-0 flex-col lg:order-none">
          <div className="nl-stage flex min-h-0 flex-1 items-center justify-center">
            <div className="nl-fit">
              <NephronDiagram snap={sim.current} baseline={sim.baseline} inputs={sim.inputs} animate={sim.running} />
            </div>
          </div>
          <p className="mt-1 text-center text-[11px] text-slate-500 lg:mb-14">
            Tap a label to learn more. Vessel width follows arteriolar tone (exaggerated so changes are visible), flow speed follows blood and
            filtrate flow, and the capsule swells with back-pressure.
          </p>
          <div className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-2 lg:absolute lg:bottom-0">
            <Playback
              running={sim.running}
              setRunning={sim.setRunning}
              speed={sim.speed}
              setSpeed={sim.setSpeed}
              t={sim.current.t}
              onReset={() => pick(null)}
              onResetClock={sim.restartClock}
            />
          </div>
        </section>

        {/* Phone: explanation + more numbers */}
        <div className="order-2 lg:hidden">{note}</div>
        <div className="order-3 flex flex-col gap-2 lg:hidden">
          {card('urine', 'lg')}
          <div className="grid grid-cols-2 gap-2">
            {card('creatinine', 'sm')}
            {card('urea', 'sm')}
          </div>
          <GlomerulusStrip snap={sim.current} baseline={sim.baseline} />
          <UrinePanel snap={sim.current} baseline={sim.baseline} />
        </div>

        {/* Right: numbers + explanation (desktop) */}
        <aside className="nl-scroll hidden min-h-0 flex-col gap-3 overflow-y-auto pr-1 pb-1 lg:flex [&>*]:shrink-0">
          <FiltrationCard snap={sim.current} baseline={sim.baseline} trace={sim.trace} onOpen={setChart} />
          {card('urine', 'lg')}
          <div className="grid grid-cols-2 gap-3">
            {card('creatinine', 'sm')}
            {card('urea', 'sm')}
          </div>
          <GlomerulusStrip snap={sim.current} baseline={sim.baseline} />
          <UrinePanel snap={sim.current} baseline={sim.baseline} />
          {note}
        </aside>
      </main>

      <footer className="order-last px-4 pb-24 text-[11px] text-slate-500 lg:hidden">Educational and conceptual only. Not patient-specific. No data is collected or stored.</footer>

      <ChartDialog metric={chart} onClose={() => setChart(null)} trace={sim.trace} />
    </div>
  );
}
