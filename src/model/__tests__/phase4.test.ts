import { describe, expect, it } from 'vitest';
import { defaultConstants, defaultInputs, initialState, osmolalityProfile, snapshot, type ModelInputs, type Snapshot } from '../index';

const c = defaultConstants();
const base = defaultInputs();
const at = (patch: Partial<ModelInputs> = {}, volumePercent = 0): Snapshot => {
  const inp = { ...base, ...patch };
  return snapshot(initialState(inp, c, volumePercent), inp, c);
};
const B = at();
const seg = (s: Snapshot, id: string) => s.tubule.segments.find((x) => x.id === id)!;

describe('Phase 4: segment bookkeeping', () => {
  it('flow, sodium and potassium all fall monotonically down the nephron', () => {
    for (const patch of [{}, { loopDiuretic: true }, { thiazide: true }, { adh: 6 }, { mra: true }]) {
      const segs = at(patch).tubule.segments;
      for (let i = 1; i < segs.length; i++) {
        expect(segs[i]!.flow).toBeLessThanOrEqual(segs[i - 1]!.flow + 1e-9);
        expect(segs[i]!.na).toBeLessThanOrEqual(segs[i - 1]!.na + 1e-9);
      }
      // Potassium is secreted distally, so only the first three segments must fall.
      expect(segs[1]!.k).toBeLessThanOrEqual(segs[0]!.k);
      expect(segs[2]!.k).toBeLessThanOrEqual(segs[1]!.k);
    }
  });
  it('segment sodium matches the Phase 3 loads it was built from', () => {
    const t = B.tubule;
    expect(seg(B, 'glomerulus').na).toBeCloseTo(t.filteredNa, 12);
    expect(seg(B, 'proximal').na).toBeCloseTo(t.deliveredLoop, 12);
    expect(seg(B, 'loop').na).toBeCloseTo(t.deliveredDistal, 12);
    expect(seg(B, 'distal').na).toBeCloseTo(t.deliveredCollecting, 12);
    expect(seg(B, 'collecting').na).toBeCloseTo(t.excretedNa, 12);
  });
  it('the last segment agrees with the urine figures', () => {
    const u = seg(B, 'collecting');
    expect(u.osmolality).toBeCloseTo(B.tubule.urineOsm, 9);
    expect((u.flow * 1440) / 1000).toBeCloseTo(B.tubule.urineVolume, 9);
    expect(u.naRemaining).toBeCloseTo(B.tubule.fena, 12);
  });
  it('baseline water handling matches the textbook pattern', () => {
    // ~33% of filtrate leaves the proximal tubule, ~15–20% reaches the ascending limb, <2% is urine.
    expect(seg(B, 'proximal').waterRemaining).toBeCloseTo(0.33, 2);
    expect(seg(B, 'loop').waterRemaining).toBeGreaterThan(0.14);
    expect(seg(B, 'loop').waterRemaining).toBeLessThan(0.21);
    expect(seg(B, 'collecting').waterRemaining).toBeLessThan(0.02);
  });
  it('baseline sodium handling matches the textbook pattern', () => {
    // Proximal ~67%, loop ~25%, distal ~5%, collecting ~3% of FILTERED sodium reabsorbed.
    expect(1 - seg(B, 'proximal').naRemaining).toBeCloseTo(0.67, 2);
    expect(seg(B, 'proximal').naRemaining - seg(B, 'loop').naRemaining).toBeCloseTo(0.25, 2);
    expect(seg(B, 'loop').naRemaining - seg(B, 'distal').naRemaining).toBeCloseTo(0.05, 2);
    expect(B.tubule.fena).toBeLessThan(0.01);
  });
  it('potassium is largely reabsorbed early, and excretion is then set distally', () => {
    // ~67% reabsorbed proximally and ~20% in the loop, so ~13% reaches the distal nephron.
    expect(seg(B, 'loop').kRemaining).toBeCloseTo(1 - c.kFracProximal - c.kFracLoop, 9);
    // On a normal intake, excretion (FEK ~10–20%) roughly balances that delivery.
    expect(B.tubule.feK).toBeGreaterThan(0.05);
    expect(B.tubule.feK).toBeLessThan(0.3);
    expect(Math.abs(B.tubule.kDistalSecretion)).toBeLessThan(30);
  });
  it('distal potassium secretion turns clearly positive with aldosterone or high distal flow', () => {
    expect(at({ aldosterone: 3 }).tubule.kDistalSecretion).toBeGreaterThan(B.tubule.kDistalSecretion + 20);
    expect(at({ loopDiuretic: true }).tubule.kDistalSecretion).toBeGreaterThan(B.tubule.kDistalSecretion + 20);
    // An MRA does the opposite: potassium is retained.
    expect(at({ mra: true }).tubule.kDistalSecretion).toBeLessThan(B.tubule.kDistalSecretion);
  });
});

describe('Phase 4: osmolality profile', () => {
  const profile = (s: Snapshot) => osmolalityProfile(s.tubule);

  it('follows the classic shape: isosmotic, concentrated at the tip, dilute after the ascending limb', () => {
    const p = profile(B);
    expect(p[0]!.osm).toBeCloseTo(c.plasmaOsmolality, 9); // Bowman's space
    expect(p[1]!.osm).toBeCloseTo(c.plasmaOsmolality, 9); // isosmotic proximal reabsorption
    expect(p[2]!.osm).toBeGreaterThan(900); // loop tip
    expect(p[3]!.osm).toBeLessThan(150); // the diluting segment
    expect(p[4]!.osm).toBeLessThanOrEqual(p[3]!.osm);
    expect(p[5]!.osm).toBeCloseTo(B.tubule.urineOsm, 9);
  });
  it('positions run left to right along the nephron', () => {
    const p = profile(B);
    for (let i = 1; i < p.length; i++) expect(p[i]!.x).toBeGreaterThan(p[i - 1]!.x);
  });
  it('a loop diuretic washes out the gradient and stops the ascending limb diluting', () => {
    const l = at({ loopDiuretic: true });
    expect(l.tubule.hairpinOsm).toBeLessThan(B.tubule.hairpinOsm);
    expect(seg(l, 'loop').osmolality).toBeGreaterThan(seg(B, 'loop').osmolality * 2);
    // Urine ends up near isosmotic: it can be neither concentrated nor properly diluted.
    expect(Math.abs(l.tubule.urineOsm - c.plasmaOsmolality)).toBeLessThan(120);
  });
  it('ADH sets only the final step, not the profile upstream', () => {
    const hi = at({ adh: 6 });
    const lo = at({ adh: 0.2 });
    expect(hi.tubule.urineOsm).toBeGreaterThan(900);
    expect(lo.tubule.urineOsm).toBeLessThan(300);
    for (const id of ['proximal', 'loop', 'distal']) {
      expect(seg(hi, id).osmolality).toBeCloseTo(seg(lo, id).osmolality, 9);
    }
    expect(seg(hi, 'collecting').flow).toBeLessThan(seg(lo, 'collecting').flow);
  });
  it('a thiazide blocks the distal diluting step without touching the loop', () => {
    const t = at({ thiazide: true });
    expect(seg(t, 'loop').osmolality).toBeCloseTo(seg(B, 'loop').osmolality, 9);
    expect(seg(t, 'distal').osmolality).toBeGreaterThan(seg(B, 'distal').osmolality);
  });
});

describe('Phase 4: each diuretic marks its own segment', () => {
  const acting = (patch: Partial<ModelInputs>) =>
    at(patch)
      .tubule.segments.filter((x) => x.drugActing)
      .map((x) => x.id);

  it('marks the site of action and nothing else', () => {
    expect(acting({})).toEqual([]);
    expect(acting({ sglt2: true })).toEqual(['proximal']);
    expect(acting({ loopDiuretic: true })).toEqual(['loop']);
    expect(acting({ thiazide: true })).toEqual(['distal']);
    expect(acting({ mra: true })).toEqual(['collecting']);
    expect(acting({ loopDiuretic: true, mra: true })).toEqual(['loop', 'collecting']);
  });
  it('a blocked segment reabsorbs a smaller fraction of what reaches it', () => {
    expect(seg(at({ loopDiuretic: true }), 'loop').naFraction).toBeLessThan(seg(B, 'loop').naFraction);
    expect(seg(at({ thiazide: true }), 'distal').naFraction).toBeLessThan(seg(B, 'distal').naFraction);
    expect(seg(at({ mra: true }), 'collecting').naFraction).toBeLessThan(seg(B, 'collecting').naFraction);
    expect(seg(at({ sglt2: true }), 'proximal').naFraction).toBeLessThan(seg(B, 'proximal').naFraction);
  });
  it('blocking a segment increases delivery to every segment downstream', () => {
    const l = at({ loopDiuretic: true });
    expect(seg(l, 'distal').naRemaining).toBeGreaterThan(seg(B, 'distal').naRemaining);
    expect(seg(l, 'collecting').naRemaining).toBeGreaterThan(seg(B, 'collecting').naRemaining);
    expect(seg(l, 'proximal').naRemaining).toBeCloseTo(seg(B, 'proximal').naRemaining, 2);
  });
});

describe('Phase 4: physiological states', () => {
  it('volume depletion: avid sodium retention and a small, concentrated urine', () => {
    const d = at({}, -18);
    expect(d.tubule.fena).toBeLessThan(0.002);
    expect(seg(d, 'collecting').waterRemaining).toBeLessThan(seg(B, 'collecting').waterRemaining);
    expect(d.tubule.urineOsm).toBeGreaterThan(B.tubule.urineOsm);
  });
  it('a water load gives a large, dilute urine without changing sodium handling', () => {
    const w = at({ adh: 0.2 });
    expect(w.tubule.urineVolume).toBeGreaterThan(B.tubule.urineVolume * 1.5);
    expect(w.tubule.fena).toBeCloseTo(B.tubule.fena, 9);
  });
  it('aldosterone and an MRA move sodium and potassium in opposite directions', () => {
    const a = at({ aldosterone: 3 });
    const m = at({ mra: true });
    expect(a.tubule.fena).toBeLessThan(B.tubule.fena);
    expect(a.tubule.feK).toBeGreaterThan(B.tubule.feK);
    expect(m.tubule.fena).toBeGreaterThan(B.tubule.fena);
    expect(m.tubule.feK).toBeLessThan(B.tubule.feK);
  });
  it('nothing breaks when filtration stops', () => {
    const z = at({ map: 30, afferentMult: 4, bowmanPressure: 60, autoregulation: false, volumeLinked: false });
    expect(z.trueGfr).toBe(0);
    for (const g of z.tubule.segments) {
      expect(Number.isFinite(g.flow)).toBe(true);
      expect(Number.isFinite(g.osmolality)).toBe(true);
      expect(g.flow).toBeGreaterThanOrEqual(0);
    }
    expect(z.tubule.urineVolume).toBe(0);
  });
});
