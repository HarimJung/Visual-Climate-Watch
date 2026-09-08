// Derived values, and the discipline to refuse them.
//
// R4 — the engine computes an ambition gap only when it has the observations
// to support one. Everything else returns null with a reason the UI can print.
// The specification's calculateNdcGap() is deliberately NOT used: it
// extrapolates without checking the observation count and returns Infinity
// when emissions rise.
import type { CountryData } from '../contract/schema.ts';

type Point = { year: number; value_mtco2e: number; source_id?: string };
type Derived = CountryData['derived'];

const refuse = (reason: string): Derived => ({
  ambition_gap_factor: null, on_track: null, gap_state: 'unknown', $reason: reason,
});

/** Least-squares slope in MtCO2e per year. Negative means falling. */
function slope(points: Point[]): number {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.year, 0) / n;
  const my = points.reduce((s, p) => s + p.value_mtco2e, 0) / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.year - mx) * (p.value_mtco2e - my); den += (p.year - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}

export function derive(ndc: CountryData['ndc'], observed: Point[]): Derived {
  // R3: never trend across sources. Use the largest single-source series.
  const bySource = new Map<string, Point[]>();
  for (const p of observed) {
    const k = p.source_id ?? 'unattributed';
    bySource.set(k, (bySource.get(k) ?? []).concat(p));
  }
  const [sourceId, series] = [...bySource.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? ['', []];

  if (series.length < 2) {
    return refuse(`avg annual change requires ≥2 observed years from one source. The longest series here has ${series.length}. It is not computable.`);
  }
  const target = ndc.target_emissions_mtco2e;
  const targetYear = ndc.target_year;
  if (target == null || targetYear == null) {
    return refuse(`${series.length} observed years are loaded, but no NDC target emissions figure has been parsed, so there is nothing to measure the trend against.`);
  }

  const sorted = [...series].sort((a, b) => a.year - b.year);
  const latest = sorted[sorted.length - 1];
  const yearsLeft = targetYear - latest.year;
  if (yearsLeft <= 0) {
    return refuse(`the target year ${targetYear} is not after the latest observation (${latest.year}). A forward trajectory cannot be measured.`);
  }

  const observedAnnual = slope(sorted);
  const requiredAnnual = (target - latest.value_mtco2e) / yearsLeft;
  const note = `Trend: least-squares slope over ${sorted.length} observed years (${sorted[0].year}–${latest.year}) from ${sourceId}, compared against the ${ndc.source.id} target of ${target} MtCO₂e by ${targetYear}. The two are not necessarily on the same inventory scope — see series.$note.`;

  // Target sits above the observed level: nothing has to fall.
  if (requiredAnnual >= 0) {
    return {
      ambition_gap_factor: null, on_track: true, gap_state: 'observed',
      $reason: `the target (${target} MtCO₂e) is above the latest observed level (${latest.value_mtco2e} MtCO₂e), so no reduction rate is required to reach it.`,
      $note: note,
    };
  }
  // Emissions flat or rising while a cut is required: no multiple of this trend arrives.
  if (observedAnnual >= 0) {
    return {
      ambition_gap_factor: null, on_track: false, gap_state: 'observed',
      $reason: `observed emissions are rising by ${observedAnnual.toFixed(2)} MtCO₂e/yr while the target requires a fall of ${Math.abs(requiredAnnual).toFixed(2)} MtCO₂e/yr. No multiple of the current trend reaches it, so no finite gap factor is reported.`,
      $note: note,
    };
  }
  const factor = requiredAnnual / observedAnnual;   // both negative -> positive multiple
  return {
    ambition_gap_factor: Number(factor.toFixed(3)),
    on_track: factor <= 1,
    gap_state: 'observed',
    $note: note,
  };
}
