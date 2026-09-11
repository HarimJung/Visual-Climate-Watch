// Derived values, and the discipline to refuse them.
//
// R4, the engine computes an ambition gap only when it has the observations
// to support one. Everything else returns null with a reason the UI can print.
// The specification's calculateNdcGap() is deliberately NOT used: it
// extrapolates without checking the observation count and returns Infinity
// when emissions rise.
import type { CountryData } from '../contract/schema.ts';

type Point = { year: number; value_mtco2e: number; source_id?: string };
type Derived = CountryData['derived'];

const refuse = (reason: string, trend: number | null = null): Derived => ({
  ambition_gap_factor: null, on_track: null, gap_state: 'unknown',
  trend_annual_mtco2e: trend, $reason: reason,
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
  // The trend stands on its own: it is measurable whenever two observations
  // from one source exist, whether or not a target was ever parsed to judge it
  // against. Refusals below still carry it.
  const sorted = [...series].sort((a, b) => a.year - b.year);
  const observedAnnual = slope(sorted);
  const trend = Number(observedAnnual.toFixed(3));

  const targetYear = ndc.target_year;
  let target = ndc.target_emissions_mtco2e;
  let conversion = '';

  // A percentage against a base year becomes a tonnage only with a base-year
  // level, and the document does not always publish one. The observed series
  // has one, on its own inventory scope, so the conversion is done here --
  // where it is a derived value with its basis stated -- and never written
  // into ndc.target_emissions_mtco2e as if the document had said it (R5).
  if (target == null && ndc.reduction_pct != null && targetYear != null) {
    if (ndc.base_year == null) {
      // A BAU-basis pledge becomes a tonnage only against the document's own
      // BAU projection. When the filing states one for the target year, the
      // conversion is done here and says so; when it does not, the refusal
      // below stands, and it is the document that is silent, not the engine.
      if (ndc.bau_state === 'pledged' && ndc.bau_2030_mtco2e != null && targetYear === 2030) {
        target = Number((ndc.bau_2030_mtco2e * (1 - ndc.reduction_pct / 100)).toFixed(3));
        conversion = ` The target tonnage is derived here, not quoted: ${ndc.reduction_pct}% below the document's own business-as-usual projection of ${ndc.bau_2030_mtco2e} MtCO₂e for 2030. The document states the percentage and the projection; the engine did the arithmetic.`;
      } else {
        return refuse(`the pledge is ${ndc.reduction_pct}% below a business-as-usual projection for ${targetYear}. That projection is not in any source loaded here, so the percentage cannot be turned into a tonnage and the trend cannot be judged against it.`, trend);
      }
    }
    const basePoint = ndc.base_year == null ? undefined : sorted.find((p) => p.year === ndc.base_year);
    if (ndc.base_year != null && !basePoint) {
      return refuse(`the pledge is ${ndc.reduction_pct}% below ${ndc.base_year} levels, and ${sourceId} carries no observation for ${ndc.base_year}, so there is no base-year level to apply it to.`, trend);
    }
    if (basePoint) {
      target = Number((basePoint.value_mtco2e * (1 - ndc.reduction_pct / 100)).toFixed(3));
      conversion = ` The target tonnage is derived here, not quoted: ${ndc.reduction_pct}% below ${sourceId}'s ${ndc.base_year} value of ${basePoint.value_mtco2e} MtCO₂e. The document states the percentage; the level it is applied to comes from ${sourceId}, on ${sourceId}'s inventory scope, which is not necessarily the document's.`;
    }
  }

  if (target == null || targetYear == null) {
    return refuse(`${series.length} observed years are loaded, but no NDC target emissions figure has been parsed, so there is nothing to measure the trend against.`, trend);
  }

  const latest = sorted[sorted.length - 1];
  const yearsLeft = targetYear - latest.year;
  if (yearsLeft <= 0) {
    return refuse(`the target year ${targetYear} is not after the latest observation (${latest.year}). A forward trajectory cannot be measured.`, trend);
  }

  const requiredAnnual = (target - latest.value_mtco2e) / yearsLeft;
  const note = `Trend: least-squares slope over ${sorted.length} observed years (${sorted[0].year}-${latest.year}) from ${sourceId}, compared against the ${ndc.source.id} target of ${target} MtCO₂e by ${targetYear}. The two are not necessarily on the same inventory scope, see series.$note.${conversion}`;

  // Target sits above the observed level: nothing has to fall *today*. That is
  // not the same as arriving under it. A rising trend can still cross the target
  // before the target year, so the trend is projected rather than waved through.
  const projected = latest.value_mtco2e + observedAnnual * yearsLeft;
  if (requiredAnnual >= 0) {
    const under = projected <= target;
    return {
      ambition_gap_factor: null, on_track: under, gap_state: 'observed', trend_annual_mtco2e: trend,
      $reason: `the target (${target} MtCO₂e) is above the latest observed level (${latest.value_mtco2e} MtCO₂e), so no cut is required today. Carried forward at the observed ${observedAnnual >= 0 ? '+' : ''}${observedAnnual.toFixed(2)} MtCO₂e/yr, ${targetYear} projects ${projected.toFixed(1)} MtCO₂e, ${under ? 'still under it' : 'above it'}.`,
      $note: note,
    };
  }
  // Emissions flat or rising while a cut is required: no multiple of this trend arrives.
  if (observedAnnual >= 0) {
    return {
      ambition_gap_factor: null, on_track: false, gap_state: 'observed', trend_annual_mtco2e: trend,
      $reason: `observed emissions are rising by ${observedAnnual.toFixed(2)} MtCO₂e/yr while the target requires a fall of ${Math.abs(requiredAnnual).toFixed(2)} MtCO₂e/yr. No multiple of the current trend reaches it, so no finite gap factor is reported.`,
      $note: note,
    };
  }
  const factor = requiredAnnual / observedAnnual;   // both negative -> positive multiple
  return {
    ambition_gap_factor: Number(factor.toFixed(3)),
    on_track: factor <= 1,
    gap_state: 'observed',
    trend_annual_mtco2e: trend,
    $note: note,
  };
}
