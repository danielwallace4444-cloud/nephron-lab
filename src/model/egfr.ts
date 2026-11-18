/**
 * CKD-EPI 2021 creatinine equation (race-free).
 * Inker LA et al. N Engl J Med 2021;385:1737-49. Coefficients cross-checked
 * against the National Kidney Foundation and NIDDK published equation pages.
 *
 * eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^age × 1.012 [female]
 * κ = 0.7 (F) / 0.9 (M); α = −0.241 (F) / −0.302 (M); Scr in mg/dL.
 * Output is mL/min/1.73 m² (indexed to body surface area).
 */
import type { Sex } from './parameters';

export const CREATININE_UMOL_PER_MGDL = 88.4;

export function ckdEpi2021(scrUmolL: number, age: number, sex: Sex): number {
  const scr = scrUmolL / CREATININE_UMOL_PER_MGDL;
  const female = sex === 'female';
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const r = scr / kappa;
  return (
    142 *
    Math.pow(Math.min(r, 1), alpha) *
    Math.pow(Math.max(r, 1), -1.2) *
    Math.pow(0.9938, age) *
    (female ? 1.012 : 1)
  );
}
