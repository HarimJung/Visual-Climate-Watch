// DS-15, Green Climate Fund, project and disbursement data (Pattern A).
//
// This is the axis the vulnerability picture has been missing: ND-GAIN says
// how exposed a country is, and until now nothing said what reached it.
//
// ACCESS. api.gcfund.org is the endpoint the Fund's own open-data dashboard
// reads; it serves no robots.txt and greenclimate.fund allows crawling outside
// /admin, /search and /user. One request returns every project.
//
// WHAT IS AND IS NOT ATTRIBUTABLE. The Fund states approved financing per
// country, so `approved_usd` is its own figure, not a share this engine
// invented. Disbursements are recorded per project, with no country split. For
// a single-country project the project's disbursements are that country's; for
// a regional project they are not divided, they are counted and declared. A
// pro-rata split would be a number nobody published (R5).
//
// SCOPE. GCF is one channel. `finance_flows` says GCF and only GCF, and
// `finance_need.received_usd` -- which means all climate finance received --
// is deliberately left unknown, because no source loaded here reports it.
import { snapshot, etlLog, type EtlLog, type Snapshot, asModule, type EtlModule } from './_base.ts';

export const ID = 'DS-15';
export const URL = 'https://api.gcfund.org/v1/projects';
export const HOME = 'https://www.greenclimate.fund/projects/dashboard';
export const LICENSE = 'GCF open data, attribution requested';
export const SCOPE = 'Green Climate Fund only. Not total climate finance received.';

export type Flow = {
  year: number;
  flow_type: 'approval' | 'disbursement';
  channel: 'GCF';
  instrument: string | null;
  provider: string | null;
  amount_usd: number;
  project_ref: string;
  project_name: string;
  state: 'observed';
};

export type GcfCountry = {
  approved_usd: number | null;
  co_financing_usd: number | null;
  disbursed_usd: number | null;
  projects: number;
  /** Projects covering more than one country: their disbursements are not split. */
  regional_projects: number;
  regional_disbursed_usd: number;
  instruments: string[];
  latest_disbursement: string | null;
  flows: Flow[];
};

type RawFinancing = { Currency?: string; GCF?: number; CoFinancing?: number; Total?: number };
type RawCountry = { ISO3?: string; CountryName?: string; Financing?: RawFinancing[] };
type RawDisb = { AmountDisbursedUSDeq?: number; AmountDisbursed?: number; DateEffective?: string; Entity?: string };
type RawFund = { Source?: string; Instrument?: string; BudgetUSDeq?: number };
type RawProject = {
  ApprovedRef?: string; ProjectName?: string; ApprovalDate?: string;
  Countries?: RawCountry[]; Disbursements?: RawDisb[]; Funding?: RawFund[];
};

const year = (v: string | undefined): number | null => {
  const y = v?.slice(0, 4);
  return y && /^(19|20)\d{2}$/.test(y) ? Number(y) : null;
};

const usd = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v !== 0 ? v : null);

export async function collect(refresh = false): Promise<{ data: Map<string, GcfCountry>; log: EtlLog; snap: Snapshot }> {
  const started = Date.now();
  const snap = await snapshot(URL, ID, 'projects.json', refresh);
  const rows = JSON.parse(snap.bytes.toString('utf8')) as RawProject[];
  if (!Array.isArray(rows) || !rows.some((r) => r.Countries)) {
    throw new Error(`${ID}: ${URL} did not return projects with country financing`);
  }

  const data = new Map<string, GcfCountry>();
  const blank = (): GcfCountry => ({
    approved_usd: null, co_financing_usd: null, disbursed_usd: null,
    projects: 0, regional_projects: 0, regional_disbursed_usd: 0,
    instruments: [], latest_disbursement: null, flows: [],
  });

  let records = 0;
  for (const p of rows) {
    const countries = (p.Countries ?? []).filter((c) => c.ISO3 && /^[A-Z]{3}$/.test(c.ISO3));
    if (!countries.length) continue;
    const ref = p.ApprovedRef ?? '';
    const name = p.ProjectName ?? ref;
    const instruments = [...new Set((p.Funding ?? []).filter((f) => f.Source === 'GCF' && f.Instrument).map((f) => f.Instrument!))];
    const single = countries.length === 1;
    const disbursements = p.Disbursements ?? [];
    const disbursedTotal = disbursements.reduce((s, d) => s + (usd(d.AmountDisbursedUSDeq ?? d.AmountDisbursed) ?? 0), 0);

    for (const c of countries) {
      const iso3 = c.ISO3!;
      const e = data.get(iso3) ?? blank();
      const fin = (c.Financing ?? [])[0];
      const gcf = usd(fin?.GCF);
      const co = usd(fin?.CoFinancing);
      e.projects++;
      if (gcf != null) e.approved_usd = (e.approved_usd ?? 0) + gcf;
      if (co != null) e.co_financing_usd = (e.co_financing_usd ?? 0) + co;
      for (const i of instruments) if (!e.instruments.includes(i)) e.instruments.push(i);

      const approvalYear = year(p.ApprovalDate);
      if (gcf != null && approvalYear != null) {
        e.flows.push({
          year: approvalYear, flow_type: 'approval', channel: 'GCF',
          instrument: instruments.join(' + ') || null, provider: 'Green Climate Fund',
          amount_usd: gcf, project_ref: ref, project_name: name, state: 'observed',
        });
      }

      if (single) {
        for (const d of disbursements) {
          const amount = usd(d.AmountDisbursedUSDeq ?? d.AmountDisbursed);
          const y = year(d.DateEffective);
          if (amount == null || y == null) continue;
          e.disbursed_usd = (e.disbursed_usd ?? 0) + amount;
          e.flows.push({
            year: y, flow_type: 'disbursement', channel: 'GCF',
            instrument: instruments.join(' + ') || null, provider: d.Entity ?? null,
            amount_usd: amount, project_ref: ref, project_name: name, state: 'observed',
          });
          const day = d.DateEffective!.slice(0, 10);
          if (e.latest_disbursement == null || day > e.latest_disbursement) e.latest_disbursement = day;
        }
      } else if (disbursedTotal > 0) {
        // Counted, never divided.
        e.regional_projects++;
        e.regional_disbursed_usd += disbursedTotal;
      }
      data.set(iso3, e);
      records++;
    }
  }

  for (const e of data.values()) {
    e.flows.sort((a, b) => a.year - b.year || a.project_ref.localeCompare(b.project_ref) || a.flow_type.localeCompare(b.flow_type));
    e.instruments.sort();
    e.approved_usd = e.approved_usd == null ? null : Math.round(e.approved_usd);
    e.co_financing_usd = e.co_financing_usd == null ? null : Math.round(e.co_financing_usd);
    e.disbursed_usd = e.disbursed_usd == null ? null : Math.round(e.disbursed_usd);
    e.regional_disbursed_usd = Math.round(e.regional_disbursed_usd);
  }

  return { data, log: etlLog(ID, snap, records, started), snap };
}

export const etlModule: EtlModule = asModule(ID, () => collect());
