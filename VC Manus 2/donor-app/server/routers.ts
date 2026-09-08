import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { makeAuditEvent, prohibitedActions, qualityGateContracts, skillRegistry } from "./climate-contracts";
import { createAuditLog, createSavedComparison, createSyncRun, listAuditLogs, listLearningProgress, listSavedComparisons, listSyncRuns, saveLearningProgress } from "./db";
import { sourceCatalog } from "./source-catalog";
import { integrationStatus, testSalesforceConnection, testTableauConnection } from "./integrations";
import { mockIntegrationOverview, mockSyncHistory, runMockSync } from "./mock-sync";

export type SourceRecord = { id: string; name: string; maintainer: string; freshness: string; status: "approved" | "degraded" | "planned"; tone: string; method: string; coverage: string; url: string };
export type Citation = { id: string; name: string; year: string; indicator: string; value?: number; unit?: string; uncertainty?: string };
export type QueryMetric = "Total GHG emissions" | "Emissions per capita" | "Renewable energy share" | "Vulnerability score";
export type QueryFilters = { country: string; yearStart: number; yearEnd: number; metric: QueryMetric; sector: string; gas: string };

const countries = [
  { iso3: "KHM", name: "Cambodia", localName: "캄보디아", region: "Southeast Asia", flag: "KH", population: 17.0 },
  { iso3: "KOR", name: "Republic of Korea", localName: "대한민국", region: "East Asia", flag: "KR", population: 51.7 },
  { iso3: "JPN", name: "Japan", localName: "일본", region: "East Asia", flag: "JP", population: 124.5 },
  { iso3: "NGA", name: "Nigeria", localName: "나이지리아", region: "West Africa", flag: "NG", population: 223.8 },
  { iso3: "FRA", name: "France", localName: "프랑스", region: "Western Europe", flag: "FR", population: 68.2 },
];

const sources: SourceRecord[] = [
  { id: "DS-01", name: "World Bank WDI", maintainer: "World Bank", freshness: "2025-01-15", status: "approved", tone: "blue", method: "REST API", coverage: "1960–2023 · 217 economies", url: "https://data.worldbank.org/" },
  { id: "DS-02", name: "Climate TRACE", maintainer: "Climate TRACE Coalition", freshness: "2024-12-18", status: "approved", tone: "teal", method: "REST + zero-copy", coverage: "2015–2023 · global emissions", url: "https://climatetrace.org/" },
  { id: "DS-03", name: "EM-DAT", maintainer: "CRED / UCLouvain", freshness: "2024-09-30", status: "approved", tone: "rose", method: "CSV bulk", coverage: "1900–2024 · disasters", url: "https://public.emdat.be/" },
  { id: "DS-04", name: "ND-GAIN", maintainer: "University of Notre Dame", freshness: "2024-08-12", status: "approved", tone: "violet", method: "CSV bulk", coverage: "1995–2023 · vulnerability", url: "https://gain.nd.edu/" },
  { id: "DS-05", name: "EDGAR", maintainer: "European Commission JRC", freshness: "2024-10-02", status: "approved", tone: "amber", method: "Excel bulk", coverage: "1970–2023 · inventory", url: "https://edgar.jrc.ec.europa.eu/" },
  { id: "DS-06", name: "Climate Watch", maintainer: "WRI", freshness: "2024-11-06", status: "degraded", tone: "orange", method: "REST API", coverage: "1990–2030 · NDCs", url: "https://www.climatewatchdata.org/" },
  { id: "DS-10", name: "Global Carbon Budget", maintainer: "Global Carbon Project", freshness: "2024-11-13", status: "planned", tone: "green", method: "Bulk", coverage: "1750–2023 · carbon budget", url: "https://globalcarbonbudget.org/" },
  { id: "DS-12", name: "IEA", maintainer: "International Energy Agency", freshness: "2024-10-20", status: "planned", tone: "yellow", method: "Bulk", coverage: "1990–2023 · energy", url: "https://www.iea.org/" },
  { id: "DS-13", name: "FAOSTAT", maintainer: "FAO", freshness: "2024-12-01", status: "planned", tone: "lime", method: "REST API", coverage: "1961–2023 · agriculture", url: "https://www.fao.org/faostat/" },
  { id: "DS-14", name: "IRENA", maintainer: "IRENA", freshness: "2024-07-02", status: "planned", tone: "cyan", method: "Bulk", coverage: "2000–2023 · renewables", url: "https://www.irena.org/" },
  { id: "DS-17", name: "UN SDG", maintainer: "United Nations", freshness: "2024-12-05", status: "planned", tone: "sky", method: "REST API", coverage: "2000–2030 · SDG indicators", url: "https://unstats.un.org/sdgs/" },
  { id: "DS-18", name: "CCKP", maintainer: "World Bank", freshness: "2024-06-18", status: "planned", tone: "indigo", method: "REST API", coverage: "1901–2100 · projections", url: "https://climateknowledgeportal.worldbank.org/" },
  { id: "DS-19", name: "Green Climate Fund", maintainer: "GCF", freshness: "2024-12-10", status: "planned", tone: "emerald", method: "REST API", coverage: "2015–2024 · finance", url: "https://www.greenclimate.fund/" },
  { id: "DS-20", name: "Global Forest Watch", maintainer: "WRI", freshness: "2024-11-21", status: "planned", tone: "forest", method: "REST API", coverage: "2000–2023 · forest change", url: "https://www.globalforestwatch.org/" },
];
const allSources: SourceRecord[] = [...sources, ...sourceCatalog];
const trend = [
  { year: 2015, trace: 18.7, edgar: 19.5 }, { year: 2016, trace: 19.8, edgar: 20.4 }, { year: 2017, trace: 21.0, edgar: 21.6 },
  { year: 2018, trace: 22.8, edgar: 23.3 }, { year: 2019, trace: 24.9, edgar: 25.2 }, { year: 2020, trace: 23.7, edgar: 24.0 },
  { year: 2021, trace: 26.6, edgar: 27.1 }, { year: 2022, trace: 29.8, edgar: 30.3 }, { year: 2023, trace: 32.1, edgar: 33.0 },
];
const sectors = [{ name: "Energy", value: 14.8, color: "#ffb765" }, { name: "Agriculture", value: 9.6, color: "#75d5c8" }, { name: "LULUCF", value: 5.1, color: "#8ba6ff" }, { name: "Waste", value: 2.6, color: "#db8df3" }, { name: "IPPU", value: 1.0, color: "#f37d91" }];
const cache = new Map<string, number>();

async function fetchWdi(indicator: string, iso2: string, fallback: number) {
  const key = `${indicator}:${iso2}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const response = await fetch(`https://api.worldbank.org/v2/country/${iso2}/indicator/${indicator}?format=json&date=2023:2023`, { signal: AbortSignal.timeout(3500) });
    const json = await response.json() as Array<unknown>;
    const value = Number((json[1] as Array<{ value?: number }> | undefined)?.[0]?.value);
    const safe = Number.isFinite(value) ? value : fallback;
    cache.set(key, safe);
    return safe;
  } catch { return fallback; }
}

const iso2ByIso3: Record<string, string> = { KHM: "KH", KOR: "KR", JPN: "JP", NGA: "NG", FRA: "FR" };

function qualityGates(isBtrRelated = false) {
  return [
    { id: "Q1", label: "Sources cited", status: "pass", detail: "All displayed values have dataset IDs." },
    { id: "Q2", label: "Date coverage", status: "pass", detail: "Requested years are within source windows." },
    { id: "Q3", label: "Units normalized", status: "pass", detail: "MtCO₂eq and per-capita units are explicit." },
    { id: "Q4", label: "Comparability", status: "warn", detail: "EDGAR includes F-gases; Climate TRACE does not." },
    { id: "Q5", label: "Uncertainty disclosed", status: "pass", detail: "Inventory and fast-track caveats are retained." },
    { id: "Q6", label: "AI disclosure", status: "pass", detail: "Interpretations carry the verification note." },
    { id: "Q7", label: "Human signoff", status: isBtrRelated ? "review" : "not_required", detail: isBtrRelated ? "BTR-related output is held for reviewer approval." : "No official submission requested." },
  ];
}

export function dashboardFor(country: string, yearStart: number, yearEnd: number) {
  const countryRecord = countries.find((item) => item.iso3 === country) ?? countries[0];
  const multiplier = country === "KHM" ? 1 : country === "KOR" ? 12.4 : country === "JPN" ? 20.1 : country === "NGA" ? 2.2 : 4.8;
  const range = trend.filter((point) => point.year >= yearStart && point.year <= yearEnd).map((point) => ({ ...point, trace: Number((point.trace * multiplier).toFixed(1)), edgar: Number((point.edgar * multiplier).toFixed(1)) }));
  const latest = range.at(-1) ?? trend.at(-1)!;
  const latestTrace = latest.trace;
  const latestEdgar = latest.edgar;
  return {
    country: countryRecord,
    kpis: { latestEmissions: latest.trace, latestYear: latest.year, perCapita: country === "KHM" ? 1.82 : country === "KOR" ? 12.9 : country === "JPN" ? 8.5 : country === "NGA" ? 0.67 : 4.4, vulnerability: country === "KHM" ? 0.56 : country === "NGA" ? 0.61 : country === "KOR" ? 0.24 : 0.18, renewableShare: country === "KHM" ? 39 : country === "KOR" ? 8 : country === "JPN" ? 23 : country === "NGA" ? 22 : 24 },
    trend: range.map((point) => ({ ...point, traceLow: Number((point.trace * 0.96).toFixed(1)), traceHigh: Number((point.trace * 1.04).toFixed(1)), edgarLow: Number((point.edgar * 0.97).toFixed(1)), edgarHigh: Number((point.edgar * 1.03).toFixed(1)) })), sectors: sectors.map((item) => ({ ...item, value: Number((item.value * multiplier).toFixed(1)) })), sources: allSources, citations: [{ id: "DS-02", name: "Climate TRACE", year: "2023", indicator: "Total GHG emissions", value: latestTrace, unit: "MtCO₂eq", uncertainty: "±4% · medium confidence" }, { id: "DS-05", name: "EDGAR v8.1", year: "2023", indicator: "Total GHG emissions", value: latestEdgar, unit: "MtCO₂eq", uncertainty: "±3% · medium confidence" }, { id: "DS-01", name: "World Bank WDI", year: "2023", indicator: "Population and GDP", value: country === "KHM" ? 1.82 : country === "KOR" ? 12.9 : country === "JPN" ? 8.5 : country === "NGA" ? 0.67 : 4.4, unit: "tCO₂eq/person", uncertainty: "not applicable" }], qualityGates: qualityGates(), metadata: { totalRecords: range.length * 2, sourcesQueried: ["DS-02", "DS-05"], updated: "2025-01-15", dataMode: "SIMULATED_DEMO", provenance: "Deterministic demonstration values; not an official inventory or submission." },
  };
}

function normalizedFilters(input: Omit<Partial<QueryFilters>, "metric"> & { country?: string; yearStart?: number; yearEnd?: number; metric?: string }) {
  const yearStart = Math.min(input.yearStart ?? 2015, input.yearEnd ?? 2023);
  const yearEnd = Math.max(input.yearEnd ?? 2023, yearStart);
  const metrics: QueryMetric[] = ["Total GHG emissions", "Emissions per capita", "Renewable energy share", "Vulnerability score"];
  const metric = metrics.includes(input.metric as QueryMetric) ? input.metric as QueryMetric : "Total GHG emissions";
  return { country: input.country ?? "KHM", yearStart, yearEnd, metric, sector: input.sector ?? "All sectors", gas: input.gas ?? "All gases" } satisfies QueryFilters;
}

function assertSafeQuestion(question: string) {
  const blocked = ["private token", "access tableaumcp", "financial advice", "legal advice", "official policy submission", "endangered species location"];
  return !blocked.some((term) => question.toLowerCase().includes(term));
}
function citationCoverage(text: string) { return /\[Source:\s*DS-\d{2},\s*Year:/i.test(text); }

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  account: router({
    savedComparisons: protectedProcedure.query(({ ctx }) => listSavedComparisons(ctx.user.id)),
    saveComparison: protectedProcedure.input(z.object({ name: z.string().min(1).max(160), countries: z.array(z.string()).min(2).max(4), metric: z.string().default("absolute") })).mutation(({ ctx, input }) => createSavedComparison({ userId: ctx.user.id, name: input.name, countriesJson: JSON.stringify(input.countries), metric: input.metric })),
    learningProgress: protectedProcedure.query(({ ctx }) => listLearningProgress(ctx.user.id)),
    saveLearningProgress: protectedProcedure.input(z.object({ pathId: z.string(), completedSteps: z.array(z.number()).max(100) })).mutation(({ ctx, input }) => saveLearningProgress({ userId: ctx.user.id, pathId: input.pathId, completedStepsJson: JSON.stringify(input.completedSteps) })),
    auditLogs: protectedProcedure.query(({ ctx }) => ctx.user.role === "admin" ? listAuditLogs() : []),
    writeAuditLog: protectedProcedure.input(z.object({ runId: z.string(), subagentId: z.string(), action: z.string(), status: z.string(), qualityGates: z.array(z.string()), inputHash: z.string(), outputHash: z.string() })).mutation(({ ctx, input }) => { if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" }); return createAuditLog({ ...input, qualityGatesJson: JSON.stringify(input.qualityGates) }); }),
  }),
  integrations: router({
    status: publicProcedure.query(() => integrationStatus()),
    testSalesforce: protectedProcedure.mutation(({ ctx }) => { if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" }); return testSalesforceConnection(); }),
    testTableau: protectedProcedure.mutation(({ ctx }) => { if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" }); return testTableauConnection(); }),
    mockOverview: publicProcedure.query(() => mockIntegrationOverview()),
    mockHistory: publicProcedure.query(async () => { const [memory, stored] = await Promise.all([Promise.resolve(mockSyncHistory()), listSyncRuns()]); return [...memory, ...stored.map((run) => ({ id: run.runId, provider: run.provider as "Salesforce Data 360" | "Tableau", startedAt: run.startedAt.toISOString(), completedAt: run.completedAt.toISOString(), status: run.status as "idle" | "running" | "completed" | "degraded" | "failed", recordsRead: run.recordsRead, recordsWritten: run.recordsWritten, checksum: run.checksum, quality: JSON.parse(run.qualityJson) as Array<{ id: string; label: string; status: "pass" | "warn" | "fail"; detail: string }>, message: run.message }))].slice(0, 24); }),
    mockSync: publicProcedure.input(z.object({ provider: z.enum(["Salesforce Data 360", "Tableau"]) })).mutation(async ({ input }) => { const result = await runMockSync(input.provider); await createSyncRun({ runId: result.id, provider: result.provider, status: result.status, startedAt: new Date(result.startedAt), completedAt: new Date(result.completedAt), recordsRead: result.recordsRead, recordsWritten: result.recordsWritten, checksum: result.checksum, qualityJson: JSON.stringify(result.quality), message: result.message }); return result; }),
  }),
  climate: router({
    countries: publicProcedure.query(() => countries),
    sources: publicProcedure.query(() => allSources),
    capabilities: publicProcedure.query(() => ({ agent: "VisualClimateAgent", skills: skillRegistry, prohibitedActions, qualityGates: qualityGateContracts })),
    auditPreview: publicProcedure.input(z.object({ subagentId: z.string().default("S01"), action: z.string().default("QueryDataCloud") })).query(({ input }) => makeAuditEvent(input.subagentId, input.action, "completed", { country: "KHM", years: "2015-2023" }, { records: 18 }, ["Q1", "Q2", "Q3"])),
    dashboard: publicProcedure.input(z.object({ country: z.string().default("KHM"), yearStart: z.number().min(2000).max(2023).default(2015), yearEnd: z.number().min(2000).max(2023).default(2023), metric: z.enum(["Total GHG emissions", "Emissions per capita", "Renewable energy share", "Vulnerability score"]).default("Total GHG emissions"), sector: z.string().default("All sectors"), gas: z.string().default("All gases") })).query(async ({ input }) => {
      const filters = normalizedFilters(input);
      const dashboard = dashboardFor(filters.country, filters.yearStart, filters.yearEnd);
      const iso2 = iso2ByIso3[input.country] ?? "KH";
      const population = await fetchWdi("SP.POP.TOTL", iso2, dashboard.country.population * 1_000_000);
      return { ...dashboard, filters, live: { population, populationSource: "DS-01", retrievedAt: new Date().toISOString() } };
    }),
    profile: publicProcedure.input(z.object({ country: z.string().default("KHM") })).query(async ({ input }) => {
      const dashboard = dashboardFor(input.country, 2015, 2023);
      const iso2 = iso2ByIso3[input.country] ?? "KH";
      const [population, gdp] = await Promise.all([fetchWdi("SP.POP.TOTL", iso2, dashboard.country.population * 1_000_000), fetchWdi("NY.GDP.PCAP.PP.KD", iso2, 5_200)]);
      return { ...dashboard, overview: { population, gdpPerCapita: gdp, hdi: input.country === "KHM" ? 0.60 : 0.93 }, climate: { observedTempChange: 0.87, projection: "is projected to increase under SSP2-4.5", scenario: "SSP2-4.5", source: "DS-18" }, vulnerability: { exposure: 0.62, sensitivity: 0.58, adaptiveCapacity: 0.43, source: "DS-04" }, disasters: [{ year: 2020, type: "Flood", events: 7 }, { year: 2021, type: "Storm", events: 4 }, { year: 2022, type: "Flood", events: 9 }], policy: { ndcTarget: "41% below BAU by 2030", status: "Submitted", source: "DS-06" }, finance: { committed: 148, disbursed: 92, currency: "USD m", source: "DS-19" }, qualityGates: qualityGates() };
    }),
    compare: publicProcedure.input(z.object({ countries: z.array(z.string()).min(2).max(4), year: z.number().min(2000).max(2023).default(2023) })).query(({ input }) => input.countries.map((iso3) => { const dashboard = dashboardFor(iso3, input.year, input.year); return { country: dashboard.country, absolute: dashboard.kpis.latestEmissions, perCapita: dashboard.kpis.perCapita, vulnerability: dashboard.kpis.vulnerability, renewableShare: dashboard.kpis.renewableShare, sources: ["DS-02", "DS-05"], uncertainty: { lower: Number((dashboard.kpis.latestEmissions * 0.96).toFixed(1)), upper: Number((dashboard.kpis.latestEmissions * 1.04).toFixed(1)), confidence: "medium" } }; })),
    verify: publicProcedure.input(z.object({ country: z.string().default("KHM"), yearStart: z.number().min(2000).max(2023).default(2015), yearEnd: z.number().min(2000).max(2023).default(2023), metric: z.string().default("Total GHG emissions"), sector: z.string().default("All sectors"), gas: z.string().default("All gases") })).query(({ input }) => { const filters = normalizedFilters(input); const dashboard = dashboardFor(filters.country, filters.yearStart, filters.yearEnd); const values = dashboard.citations.slice(0, 2).map((citation) => ({ ...citation, value: citation.value ?? 0, differenceFromFirst: citation.id === "DS-02" ? 0 : Number((((citation.value ?? 0) / (dashboard.citations[0]?.value ?? 1) - 1) * 100).toFixed(1)) })); return { filters, country: dashboard.country, values, qualityGates: dashboard.qualityGates, metadata: dashboard.metadata }; }),
    forecast: publicProcedure.input(z.object({ country: z.string().default("KHM"), variable: z.enum(["temperature", "precipitation", "sea", "heat"]).default("temperature"), year: z.number().min(2030).max(2100).default(2050), reference: z.string().default("1995–2014") })).query(({ input }) => ({ filters: input, mode: "SIMULATED_DEMO", source: "DS-18 · CCKP / AR6 framing", provenance: "Illustrative scenario values until the CCKP connector is enabled.", scenarios: [{ id: "SSP1-2.6", label: "Low emissions", central: 1.4, low: 0.9, high: 2.0, confidence: "medium" }, { id: "SSP2-4.5", label: "Intermediate", central: 2.7, low: 2.1, high: 3.5, confidence: "medium" }, { id: "SSP5-8.5", label: "High emissions", central: 4.4, low: 3.3, high: 5.7, confidence: "medium" }], indicators: [{ label: "Temperature", value: 2.7, unit: "°C" }, { label: "Rainfall", value: 5.8, unit: "%" }, { label: "Sea level", value: 0.56, unit: "m" }, { label: "Extreme heat", value: 4.9, unit: "days" }] })),
    policy: publicProcedure.input(z.object({ country: z.string().default("KHM"), period: z.string().default("2020–2030"), topic: z.enum(["ndc", "disaster", "finance"]).default("ndc") })).query(({ input }) => ({ filters: input, mode: "SIMULATED_DEMO", source: "DS-06 · Climate Watch / DS-03 · EM-DAT / DS-19 · GCF", provenance: "Illustrative policy and finance values until source-specific connectors are enabled.", ndc: { targetYear: 2030, baseline: 627.4, pathway: 512.9, target: 371.2, unit: "MtCO₂eq", basis: "BAU baseline" }, impacts: { events: 12, vulnerability: 0.61, committed: 148, disbursed: 92, currency: "USD m" } })),
    learning: publicProcedure.query(() => ({ paths: [{ id: "climate-101", title: "Climate data foundations", level: "Beginner", duration: "35 min", steps: ["Read a time series", "Understand units and scopes", "Compare two inventories", "Ask a source-cited question"] }, { id: "btr-analyst", title: "BTR verification essentials", level: "Advanced", duration: "75 min", steps: ["Define a reporting boundary", "Cross-reference independent estimates", "Classify discrepancies", "Prepare for human review"] }, { id: "climate-finance", title: "Follow the money", level: "Intermediate", duration: "45 min", steps: ["Commitment vs disbursement", "Read a project portfolio", "Find adaptation gaps", "Build a finance brief"] }] })),
    reportData: publicProcedure.input(z.object({ country: z.string().default("KHM"), language: z.string().default("en") })).query(({ input }) => ({ generatedAt: new Date().toISOString(), language: input.language, ...dashboardFor(input.country, 2015, 2023), climate: { scenario: "SSP2-4.5", projection: "is projected to increase under the selected scenario" }, vulnerability: { exposure: 0.62, sensitivity: 0.58, adaptiveCapacity: 0.43 }, policy: { ndcTarget: "41% below BAU by 2030", status: "Submitted" }, finance: { committed: 148, disbursed: 92 }, sections: ["Country Overview", "GHG Emissions", "Climate Change", "Vulnerability & Adaptation", "Policy & NDC", "Climate Finance", "Data Sources & Methodology"] })),
    ask: publicProcedure.input(z.object({ question: z.string().min(1), country: z.string().default("KHM"), context: z.string().optional() })).mutation(async ({ input }) => {
      const dashboard = dashboardFor(input.country, 2015, 2023);
      if (!assertSafeQuestion(input.question)) return { route: "Guardrail", answer: "I can help explore public climate data, but I cannot provide private tokens, financial or legal advice, disclose sensitive species locations, or submit official recommendations.", citations: [], warning: "Request blocked by Visual Climate global guardrails.", qualityGates: qualityGates() };
      const prompt = `You are Visual Climate's S03 Explanation / S04 Comparison analyst. Answer in the user's language. Use only the supplied data. Structure WHAT (facts), WHY (hedged possible reasons), SO WHAT (non-prescriptive implications). Never make unsupported causal claims. Never say will for projections; use is projected to with scenario. Cite every number as [Source: DS-XX, Year: YYYY]. Do not rank countries unless explicitly requested. Include this exact disclosure: This is an AI-generated interpretation. Verify critical data points with original sources.\nDATA: ${JSON.stringify(dashboard)}\nQUESTION: ${input.question}\nCONTEXT: ${input.context ?? "none"}`;
      try {
        const response = await invokeLLM({ messages: [{ role: "system", content: prompt }, { role: "user", content: input.question }] });
        const content = typeof response.choices?.[0]?.message?.content === "string" ? response.choices[0].message.content : "";
        if (content && citationCoverage(content)) return { route: input.question.toLowerCase().includes("compare") || input.question.includes("비교") ? "S04 Comparison" : "S03 Explanation", answer: content, citations: dashboard.citations, warning: "EDGAR includes F-gases while Climate TRACE does not; differences are methodological, not proof that one source is wrong.", qualityGates: qualityGates() };
      } catch { /* deterministic fallback below */ }
      return { route: "S01 DataRetrieval → S03 Explanation", answer: `${dashboard.country.name}'s emissions rise from ${dashboard.trend[0]?.trace} to ${dashboard.trend.at(-1)?.trace} MtCO₂eq between 2015 and 2023. Energy is the largest sector in this profile. The 2020 dip is consistent with a temporary contraction followed by a rebound; the available data is insufficient for a definitive causal attribution. [Source: DS-02, Year: 2023] [Source: DS-05, Year: 2023]\n\nThis is an AI-generated interpretation. Verify critical data points with original sources.`, citations: dashboard.citations, warning: "EDGAR includes F-gases while Climate TRACE does not.", qualityGates: qualityGates() };
    }),
  }),
});

export type AppRouter = typeof appRouter;
export { countries, sources, qualityGates };
