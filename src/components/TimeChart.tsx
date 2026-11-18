import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

export interface ChartSeries {
  label: string;
  color: string;
  dash?: number[];
  values: number[];
  decimals: number;
}

interface Props {
  title: string;
  unit: string;
  /** Simulated time in hours. */
  t: number[];
  series: ChartSeries[];
}

/** Single-axis time series (x in days). uPlot provides the crosshair and live legend. */
export function TimeChart({ title, unit, t, series }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const key = series.map((s) => s.label).join('|');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const opts: uPlot.Options = {
      width: el.clientWidth || 320,
      height: 200,
      cursor: { drag: { x: false, y: false }, points: { size: 8 } },
      legend: { show: true, live: true },
      scales: {
        x: { time: false },
        y: {
          // Scale to the data rather than from zero, so a change of a few percent is
          // visible. A floor on the span stops a steady line filling the chart with noise.
          range: (_u, min, max) => {
            const mid = (min + max) / 2;
            const span = Math.max(max - min, Math.abs(mid) * 0.06, 1);
            return [Math.max(0, mid - span * 0.7), mid + span * 0.7];
          },
        },
      },
      axes: [
        {
          label: 'Simulated time (days)',
          labelSize: 18,
          size: 40,
          stroke: '#64748b',
          grid: { stroke: '#e2e8f0', width: 1 },
          ticks: { stroke: '#e2e8f0' },
          values: (_u, vals) => vals.map((v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))),
          font: '11px system-ui, sans-serif',
          labelFont: '11px system-ui, sans-serif',
        },
        {
          label: unit,
          labelSize: 18,
          size: 46,
          stroke: '#64748b',
          grid: { stroke: '#e2e8f0', width: 1 },
          ticks: { stroke: '#e2e8f0' },
          font: '11px system-ui, sans-serif',
          labelFont: '11px system-ui, sans-serif',
        },
      ],
      series: [
        { label: 'Day', value: (_u, v) => (v == null ? '—' : v.toFixed(2)) },
        ...series.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: 2,
          dash: s.dash,
          points: { show: false },
          value: (_u: uPlot, v: number | null) => (v == null ? '—' : `${v.toFixed(s.decimals)} ${unit}`),
        })),
      ],
    };
    const p = new uPlot(opts, [[], ...series.map(() => [])], el);
    plot.current = p;
    const ro = new ResizeObserver(() => p.setSize({ width: el.clientWidth, height: 200 }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      p.destroy();
      plot.current = null;
    };
    // Recreate only when the set of series changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, unit]);

  useEffect(() => {
    plot.current?.setData([t.map((h) => h / 24), ...series.map((s) => s.values)]);
  }, [t, series]);

  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-sm font-semibold text-slate-800">{title}</figcaption>
      <div ref={host} className="nl-chart w-full" />
    </figure>
  );
}
