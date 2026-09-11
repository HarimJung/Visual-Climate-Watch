// DS-08, UNFCCC NDC Registry, via the openclimatedata mirror (Pattern C).
//
// WHY A MIRROR. unfccc.int/NDCREG sits behind a WAF that refuses this engine's
// requests, and ENGINE-BUILD.md §9 forbids working around one. The mirror is a
// separate publisher that already carries the registry as a flat file, so the
// request goes to raw.githubusercontent.com like DS-35's. Nothing is scraped.
//
// WHAT THIS SOURCE IS, AND IS NOT. It is the registry's *index*: which
// submission a Party filed, on what date, and where the document is. It
// carries no quantified target, so it moves `ndc.submission_date`,
// `ndc.version` and the document link, and leaves every number in `ndc` at
// null/'unknown'. Reading the percentage out of the PDF is Pattern D work and
// is not attempted here -- inferring one from a title would be R5.
//
// LICENCE. The mirror repository declares no licence. The facts it carries are
// the UNFCCC's own public filings and the URL this engine cites and shows is
// the unfccc.int document itself, never the mirror's copy; the mirror is
// recorded as the retrieval path with its licence stated as undeclared.
import { snapshot, etlLog, type EtlLog, type Snapshot, asModule, type EtlModule } from './_base.ts';

export const ID = 'DS-08';
export const URL = 'https://raw.githubusercontent.com/openclimatedata/ndcs/main/data/ndcs.json';
export const HOME = 'https://unfccc.int/NDCREG';
export const MIRROR = 'https://github.com/openclimatedata/ndcs';
export const LICENSE = 'not declared by the mirror; underlying documents are UNFCCC public filings';

export type NdcRegistryEntry = {
  party: string;
  /** The submission's own title, with the redundant party prefix removed. */
  version: string | null;
  title: string | null;
  submission_date: string | null;
  document_url: string | null;
  /** How many earlier submissions this Party has on the registry. */
  archived: number;
  /**
   * False when the registry holds submissions for this Party but none is
   * active. The United States is the case that matters: its three filings all
   * read Archived. That is the registry stating an absence, which is the only
   * kind of absence R1 allows to be recorded as one.
   */
  active: boolean;
};

type RawDoc = { title?: string; fileType?: string; encodedAbsUrl?: string };
type RawRow = { code?: string; party?: string; version?: string; status?: string; submissionDate?: string; ndcs?: RawDoc[] };

const isoDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function collect(refresh = false): Promise<{ data: Map<string, NdcRegistryEntry>; log: EtlLog; snap: Snapshot }> {
  const started = Date.now();
  const snap = await snapshot(URL, ID, 'ndcs.json', refresh);
  const rows = JSON.parse(snap.bytes.toString('utf8')) as RawRow[];
  if (!Array.isArray(rows)) throw new Error(`${ID}: ${URL} did not return an array of submissions`);

  const data = new Map<string, NdcRegistryEntry>();
  const archived = new Map<string, number>();
  let records = 0;

  const blank = (party: string): NdcRegistryEntry => ({
    party, version: null, title: null, submission_date: null, document_url: null, archived: 0, active: false,
  });

  for (const row of rows) {
    const iso3 = row.code?.toUpperCase();
    if (!iso3 || !/^[A-Z]{3}$/.test(iso3)) continue;
    // Every Party the registry mentions gets a record, so that "no active
    // submission" can be told apart from "this engine has never looked".
    if (!data.has(iso3)) data.set(iso3, blank(row.party?.trim() || iso3));
    if (row.status !== 'Active') {
      if (row.status === 'Archived') archived.set(iso3, (archived.get(iso3) ?? 0) + 1);
      continue;
    }
    // https only: the contract requires it of every source URL, and an http
    // link would be dropped by the gate after the record was already built.
    const doc = row.ndcs?.find((d) => d.fileType === 'NDC' && d.encodedAbsUrl?.startsWith('https://'));
    if (!doc?.encodedAbsUrl) continue;

    const date = isoDate(row.submissionDate);
    const held = data.get(iso3)!;
    // Several Active rows exist per Party when an addendum was filed. The most
    // recent dated one wins; an undated row never displaces a dated one.
    if (held.active && (date == null || (held.submission_date != null && held.submission_date >= date))) continue;

    const title = doc.title?.trim() || 'NDC submission';
    const party = row.party?.trim() || iso3;
    held.party = party;
    held.version = title.startsWith(`${party} `) ? title.slice(party.length + 1) : title;
    held.title = title;
    held.submission_date = date;
    held.document_url = doc.encodedAbsUrl;
    held.active = true;
    records++;
  }
  for (const [iso3, count] of archived) {
    const entry = data.get(iso3);
    if (entry) entry.archived = count;
  }

  return { data, log: etlLog(ID, snap, records, started), snap };
}

export const etlModule: EtlModule = asModule(ID, () => collect());
