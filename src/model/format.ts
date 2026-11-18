/** Display helpers: sensible rounding (no false precision) and direction vs baseline. */

export type Direction = 'up' | 'down' | 'same';

/** Relative change below which a value is shown as unchanged. */
export const DIRECTION_THRESHOLD = 0.03;

export function direction(value: number, baseline: number, threshold = DIRECTION_THRESHOLD): Direction {
  if (!isFinite(value) || !isFinite(baseline) || baseline === 0) return 'same';
  const rel = (value - baseline) / Math.abs(baseline);
  if (rel > threshold) return 'up';
  if (rel < -threshold) return 'down';
  return 'same';
}

export const ARROW: Record<Direction, string> = { up: '▲', down: '▼', same: '–' };

/**
 * Some model outputs are real physiology but cannot be measured in a patient —
 * glomerular capillary pressure above all. Showing them as a number invites students to
 * treat them as a reading. These are reported as a band relative to healthy instead.
 */
export type Band = 'low' | 'slightly low' | 'normal' | 'raised' | 'high';

export function band(value: number, baseline: number): Band {
  if (!isFinite(value) || !isFinite(baseline) || baseline === 0) return 'normal';
  const r = value / baseline;
  if (r < 0.9) return 'low';
  if (r < 0.97) return 'slightly low';
  if (r <= 1.03) return 'normal';
  if (r <= 1.15) return 'raised';
  return 'high';
}

export const BAND_TONE: Record<Band, string> = {
  low: 'text-violet-800',
  'slightly low': 'text-violet-700',
  normal: 'text-slate-700',
  raised: 'text-rose-700',
  high: 'text-rose-800',
};

/** Round to a step appropriate to the quantity's precision in this model. */
export function roundTo(x: number, step: number): number {
  return Math.round(x / step) * step;
}

export const DISPLAY = {
  gfr: { unit: 'mL/min', step: 5 },
  egfr: { unit: 'mL/min/1.73 m²', step: 5 },
  rpf: { unit: 'mL/min', step: 10 },
  creatinine: { unit: 'µmol/L', step: 5 },
  urea: { unit: 'mmol/L', step: 0.5 },
  pgc: { unit: 'mmHg', step: 1 },
  filtrationFraction: { unit: '', step: 0.01 },
  sngfr: { unit: 'nL/min', step: 1 },
} as const;

export function formatValue(x: number, step: number): string {
  if (!isFinite(x)) return '—';
  const r = roundTo(x, step);
  const decimals = step >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(step)));
  return r.toFixed(decimals);
}
