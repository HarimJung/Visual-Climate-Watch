import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Download, Filter, Info, RotateCcw, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import EditorialShell from "@/components/EditorialShell";

const initial = { country: "KHM", metric: "Total GHG emissions" as const, yearStart: 2015, yearEnd: 2023, sector: "All sectors", gas: "All gases" };

type QueryState = typeof initial;

function downloadCsv(rows: Array<Record<string, string | number>>, filename: string) {
  const headers = Object.keys(rows[0] ?? {});
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export default function Query() {
  const [draft, setDraft] = useState<QueryState>(initial);
  const [applied, setApplied] = useState<QueryState>(initial);
  const input = useMemo(() => applied, [applied]);
  const { data, isLoading, isError, refetch } = trpc.climate.dashboard.useQuery(input);
  const countries = trpc.climate.countries.useQuery();
  const sources = trpc.climate.sources.useQuery();
  const update = <K extends keyof QueryState>(key: K, value: QueryState[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); setApplied({ ...draft, yearStart: Math.min(draft.yearStart, draft.yearEnd) }); };
  const reset = () => { setDraft(initial); setApplied(initial); };
  const exportRows = data?.citations.map((citation) => ({ source: citation.name, dataset: citation.id, year: citation.year, value: citation.value ?? "", unit: citation.unit ?? "", uncertainty: citation.uncertainty ?? "" })) ?? [];
  const verificationHref = `/verify?country=${applied.country}&yearStart=${applied.yearStart}&yearEnd=${applied.yearEnd}&metric=${encodeURIComponent(applied.metric)}&sector=${encodeURIComponent(applied.sector)}&gas=${encodeURIComponent(applied.gas)}`;
  return <EditorialShell eyebrow="02 · DATA QUERY / FRAME THE QUESTION">
    <div className="page-intro"><div><div className="section-kicker">DATA RETRIEVAL</div><h1>Ask for a number.<br /><em>Keep its conditions.</em></h1><p>Every selected condition is sent to the query contract and retained in the provenance record. Demo values are explicitly labelled until a source connector is active.</p></div><Link href="/" className="text-link">Back to orientation <ArrowRight size={14} /></Link></div>
    <form onSubmit={submit} className="query-form editorial-panel"><div className="panel-heading"><div><span className="section-number">01</span><h2>Query conditions</h2></div><span className="status-pill">{isLoading ? "retrieving" : "ready to retrieve"}</span></div><div className="field-grid">
      <label>Country<select value={draft.country} onChange={(e) => update("country", e.target.value)}>{countries.data?.map((item) => <option key={item.iso3} value={item.iso3}>{item.name} ({item.iso3})</option>)}</select></label>
      <label>Indicator<select value={draft.metric} onChange={(e) => update("metric", e.target.value as QueryState["metric"])}><option>Total GHG emissions</option><option>Emissions per capita</option><option>Renewable energy share</option><option>Vulnerability score</option></select></label>
      <label>Start year<select value={draft.yearStart} onChange={(e) => update("yearStart", Number(e.target.value))}><option value={2000}>2000</option><option value={2010}>2010</option><option value={2015}>2015</option><option value={2020}>2020</option></select></label>
      <label>End year<select value={draft.yearEnd} onChange={(e) => update("yearEnd", Number(e.target.value))}><option value={2021}>2021</option><option value={2022}>2022</option><option value={2023}>2023</option></select></label>
      <label>Sector<select value={draft.sector} onChange={(e) => update("sector", e.target.value)}><option>All sectors</option><option>Energy</option><option>Agriculture</option><option>Land use</option><option>Waste</option></select></label>
      <label>Gas scope<select value={draft.gas} onChange={(e) => update("gas", e.target.value)}><option>All gases</option><option>CO₂</option><option>CH₄</option><option>N₂O</option></select></label>
    </div><div className="form-actions"><button type="submit" className="button-primary"><Filter size={14} /> Run query</button><button type="button" onClick={reset} className="button-quiet"><RotateCcw size={14} /> Reset conditions</button></div></form>
    <section className="query-results"><div className="section-heading compact"><div><div className="section-kicker">02 · RETURNED EVIDENCE</div><h2>{applied.metric} · {data?.country.name ?? "selected country"}</h2></div><button type="button" onClick={() => downloadCsv(exportRows, `visual-climate-${applied.country}-${applied.yearEnd}.csv`)} disabled={!exportRows.length} className="button-secondary"><Download size={14} /> Export CSV</button></div>
      <div className="notice-bar"><Info size={16} /><span><strong>Provenance state: {data?.metadata.dataMode ?? "retrieving"}.</strong> {data?.metadata.provenance ?? "Waiting for the selected source contract."}</span><Link href={verificationHref}>Review checks <ArrowRight size={13} /></Link></div>
      {isError ? <div className="empty-state"><ShieldAlert size={18} /><span>Source retrieval failed. Check the connection and retry.</span><button type="button" className="button-secondary" onClick={() => refetch()}>Retry</button></div> : <div className="data-table"><div className="table-head"><span>Source</span><span>Value</span><span>Reference</span><span>Unit</span><span>Uncertainty</span><span>State</span></div>{(data?.citations ?? []).map((citation, index) => <div className="table-row" key={citation.id}><span><strong>{citation.name}</strong><small>{citation.id} · {sources.data?.find((source) => source.id === citation.id)?.maintainer ?? "source metadata"}</small></span><span className="table-value">{citation.value?.toFixed(index === 2 ? 2 : 1) ?? "—"}</span><span>{citation.year}</span><span>{citation.unit ?? "—"}</span><span>{citation.uncertainty ?? "not declared"}</span><span className="state-good"><CheckCircle2 size={13} /> cited</span></div>)}</div>}
      <div className="metadata-grid"><div><span>Conditions retained</span><strong>{applied.country} · {applied.yearStart}–{applied.yearEnd} · {applied.sector} · {applied.gas}</strong></div><div><span>Sources queried</span><strong>{data?.metadata.sourcesQueried.join(" · ") ?? "—"}</strong></div><div><span>Quality state</span><strong>{data?.qualityGates.filter((gate) => gate.status === "pass").length ?? 0}/{data?.qualityGates.length ?? 0} gates passed · review required</strong></div></div>
    </section>
  </EditorialShell>;
}
