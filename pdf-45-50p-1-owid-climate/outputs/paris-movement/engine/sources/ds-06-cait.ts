// DS-06 — Climate Watch / CAIT (I)NDC content assessment (Pattern C).
// Licence: CC BY 4.0, stated in the mirror's README beside the WRI citation.
//
// WHY A MIRROR, AGAIN. climatewatchdata.org/robots.txt carries
// `Disallow: /api/`, and their data explorer's download button is under that
// path, so this engine does not crawl it. openclimatedata republishes the same
// CAIT workbook as CSV on GitHub under the licence WRI granted, so the request
// goes to raw.githubusercontent.com and nothing is worked around.
//
// ★ VINTAGE. This is the FIRST round: CAIT's Paris Contributions assessment of
// the 2015-16 (I)NDCs. Cambodia here pledges 27% against BAU; the same country
// filed NDC 3.0 on 2025-08-08. Presenting this as "the target" would be a
// ten-year-old pledge shown as current, so it is kept in its own contract key,
// never merged into `ndc`, and never fed to derive(). The dial's headline
// number still comes only from a document this engine has actually read.
//
// WHAT IS NOT TAKEN. The quantitative cells are free text and only 3 of 197
// rows carry a target in a form that parses without judgement:
//   KHM "<p>11,600 Gg CO2eq by 2030</p>"   KOR "782.5 ... by 2020; 809.7 ...
//   by 2025; 850.6 ... by 2030"            BRA "1.3 GtCO2e ... in 2025"
// Mixed units, several values per cell, HTML, and intensity targets sitting in
// the same column as absolute ones. Extracting a headline MtCO2e out of that
// is guesswork printed as a measurement, so no emissions figure is read here
// at all. Only fields the source itself enumerates are taken.
import { snapshot, etlLog, parseCsv, type EtlLog, type Snapshot, asModule, type EtlModule } from './_base.ts';

export const ID = 'DS-06';
export const URL = 'https://raw.githubusercontent.com/openclimatedata/ndc-assessments/main/data/ndc-content-cait.csv';
export const HOME = 'https://www.climatewatchdata.org/ndcs-content';
export const MIRROR = 'https://github.com/openclimatedata/ndc-assessments';
export const LICENSE = 'CC BY 4.0';
export const VINTAGE = 'First (I)NDC round, as assessed by WRI CAIT (2016). Not the latest submission.';

export type ConditionalityClass = 'unconditional' | 'conditional' | 'both' | 'partial' | 'none' | 'unknown';

/** CAIT's own wording. Kept verbatim as well, so the mapping is auditable. */
const CONDITIONALITY: Record<string, ConditionalityClass> = {
  'Unconditional (I)NDC only': 'unconditional',
  'Conditional (I)NDC only': 'conditional',
  'Conditional (I)NDC and unconditional (I)NDC': 'both',
  'Partially conditional (I)NDC (unspecified mix of domestic/international resources)': 'partial',
  'No Document Submitted': 'none',
};

export type CaitAssessment = {
  country: string;
  summary: string | null;
  ghg_target: string | null;
  target_type: string | null;
  base_year: number | null;
  target_year: number | null;
  conditionality: string | null;
  conditionality_class: ConditionalityClass;
  gases: string | null;
  sectors: string | null;
};

/** CAIT stores rendered HTML in its text cells. */
const plain = (v: string | undefined): string | null => {
  if (!v) return null;
  const text = v
    .replace(/<[^>]*>/g, ' ')
    .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text && text !== 'Not Specified' && text !== 'Not Applicable' ? text : null;
};

/**
 * A year only when the cell is a bare year. CAIT also writes sentences into
 * these columns -- Tuvalu's target year reads "2025<br>Period for defining
 * actions: Start year: 2020; End year: 2025". Reading the first number out of
 * that is a guess, so anything but a bare year is unknown.
 */
const exactYear = (v: string | undefined): number | null =>
  v && /^(19|20)\d{2}$/.test(v.trim()) ? Number(v.trim()) : null;

export async function collect(refresh = false): Promise<{ data: Map<string, CaitAssessment>; log: EtlLog; snap: Snapshot }> {
  const started = Date.now();
  const snap = await snapshot(URL, ID, 'ndc-content-cait.csv', refresh);
  const rows = parseCsv(snap.bytes.toString('utf8'));
  if (!rows.length || !('ISO' in rows[0]) || !('conditionality' in rows[0])) {
    throw new Error(`${ID}: ${URL} does not have the CAIT columns this adapter reads`);
  }

  const data = new Map<string, CaitAssessment>();
  let records = 0;
  for (const r of rows) {
    const iso = r.ISO?.trim().toUpperCase();
    if (!iso || !/^[A-Z]{3}$/.test(iso)) continue;
    const conditionality = r.conditionality?.trim() || null;
    data.set(iso, {
      country: r.Country?.trim() || iso,
      summary: plain(r.indc_summary),
      ghg_target: plain(r.ghg_target),
      target_type: plain(r.mitigation_contribution_type),
      base_year: exactYear(r.reference_base_year),
      target_year: exactYear(r.time_target_year),
      conditionality,
      conditionality_class: conditionality ? (CONDITIONALITY[conditionality] ?? 'unknown') : 'unknown',
      gases: plain(r.coverage_gas),
      sectors: plain(r.coverage_sectors_short),
    });
    records++;
  }
  return { data, log: etlLog(ID, snap, records, started), snap };
}

export const etlModule: EtlModule = asModule(ID, () => collect());
