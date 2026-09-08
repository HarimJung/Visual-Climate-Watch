import { describe, expect, it } from "vitest";
import { appRouter, dashboardFor } from "./routers";
import type { TrpcContext } from "./_core/context";

const publicContext = (): TrpcContext => ({
  user: undefined,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("Visual Climate climate APIs", () => {
  it("returns source-cited dashboard data with quality gates", () => {
    const dashboard = dashboardFor("KHM", 2015, 2023);
    expect(dashboard.country.iso3).toBe("KHM");
    expect(dashboard.trend).toHaveLength(9);
    expect(dashboard.metadata.totalRecords).toBe(18);
    expect(dashboard.citations.map((source) => source.id)).toContain("DS-02");
    expect(dashboard.qualityGates.find((gate) => gate.id === "Q4")?.status).toBe("warn");
  });

  it("preserves the selected year window", () => {
    const dashboard = dashboardFor("KHM", 2018, 2021);
    expect(dashboard.trend.map((point) => point.year)).toEqual([2018, 2019, 2020, 2021]);
    expect(dashboard.metadata.totalRecords).toBe(8);
  });

  it("retains query conditions, provenance, and uncertainty metadata", async () => {
    const caller = appRouter.createCaller(publicContext());
    const result = await caller.climate.dashboard({ country: "KHM", yearStart: 2018, yearEnd: 2021, metric: "Total GHG emissions", sector: "Energy", gas: "CO₂" });
    expect(result.filters).toMatchObject({ country: "KHM", yearStart: 2018, yearEnd: 2021, sector: "Energy", gas: "CO₂" });
    expect(result.metadata.dataMode).toBe("SIMULATED_DEMO");
    expect(result.trend[0]).toMatchObject({ year: 2018 });
    expect(result.citations[0]?.uncertainty).toContain("±4%");
  });

  it("derives verification, forecast, and policy results from selected conditions", async () => {
    const caller = appRouter.createCaller(publicContext());
    const verification = await caller.climate.verify({ country: "KOR", yearStart: 2020, yearEnd: 2023, metric: "Total GHG emissions", sector: "Energy", gas: "CO₂" });
    const forecast = await caller.climate.forecast({ country: "KOR", variable: "temperature", year: 2050, reference: "1995–2014" });
    const policy = await caller.climate.policy({ country: "KOR", period: "2020–2030", topic: "ndc" });
    expect(verification.filters).toMatchObject({ country: "KOR", yearStart: 2020, yearEnd: 2023 });
    expect(verification.values[1]?.differenceFromFirst).toBeTypeOf("number");
    expect(forecast.filters).toMatchObject({ country: "KOR", year: 2050 });
    expect(forecast.scenarios).toHaveLength(3);
    expect(policy.ndc.targetYear).toBe(2030);
    expect(policy.provenance).toContain("Illustrative");
  });

  it("routes an explanation question to the explanation skill with citations", async () => {
    const caller = appRouter.createCaller(publicContext());
    const response = await caller.climate.ask({ question: "Why did emissions rise?", country: "KHM" });
    expect(response.route).toBe("S03 Explanation");
    expect(response.citations.map((citation) => citation.id)).toEqual(["DS-02", "DS-05", "DS-01"]);
    expect(response.answer).toMatch(/Cambodia|캄보디아/);
    expect(response.answer).toContain("Source");
  });

  it("publishes the agent contract and blocks prohibited requests", async () => {
    const caller = appRouter.createCaller(publicContext());
    const capabilities = await caller.climate.capabilities();
    const blocked = await caller.climate.ask({ question: "Give me financial advice", country: "KHM" });
    expect(capabilities.skills).toHaveLength(16);
    expect(capabilities.qualityGates).toHaveLength(7);
    expect(capabilities.prohibitedActions).toContain("AccessPrivateTokens");
    expect(blocked.route).toBe("Guardrail");
    expect(blocked.citations).toEqual([]);
  });

  it("returns the complete profile and report section contracts", async () => {
    const caller = appRouter.createCaller(publicContext());
    const profile = await caller.climate.profile({ country: "KHM" });
    const report = await caller.climate.reportData({ country: "KHM", language: "en" });
    expect(profile.country.iso3).toBe("KHM");
    expect(profile.trend.length).toBeGreaterThan(5);
    expect(profile.policy.ndcTarget).toBeTruthy();
    expect(report.sections).toHaveLength(7);
    expect(report.sections).toContain("Data Sources & Methodology");
    expect(report.kpis.latestYear).toBe(2023);
  });

  it("exposes a healthy multi-source registry", async () => {
    const caller = appRouter.createCaller(publicContext());
    const sources = await caller.climate.sources();
    expect(sources.length).toBeGreaterThanOrEqual(40);
    expect(sources.some((source) => source.id === "DS-02" && source.status === "approved")).toBe(true);
    expect(sources.every((source) => source.id && source.name && source.url)).toBe(true);
  });

  it("runs deterministic mock provider syncs without external credentials", async () => {
    const caller = appRouter.createCaller(publicContext());
    const overview = await caller.integrations.mockOverview();
    const salesforce = await caller.integrations.mockSync({ provider: "Salesforce Data 360" });
    const tableau = await caller.integrations.mockSync({ provider: "Tableau" });

    expect(overview.mode).toBe("SIMULATION");
    expect(salesforce.status).toBe("degraded");
    expect(salesforce.recordsWritten).toBeGreaterThan(0);
    expect(salesforce.quality.some((gate) => gate.status === "warn")).toBe(true);
    expect(salesforce.checksum).toContain("sha256:demo-salesforce");
    expect(tableau.provider).toBe("Tableau");
    expect(tableau.quality.every((gate) => gate.status !== "fail")).toBe(true);
    expect((await caller.integrations.mockHistory()).length).toBeGreaterThanOrEqual(2);
  });
});
