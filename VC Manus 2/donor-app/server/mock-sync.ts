export type MockProvider = "Salesforce Data 360" | "Tableau";
export type MockSyncStatus = "idle" | "running" | "completed" | "degraded" | "failed";
export type MockQuality = { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string };
export type MockSyncRun = { id: string; provider: MockProvider; startedAt: string; completedAt: string; status: MockSyncStatus; recordsRead: number; recordsWritten: number; checksum: string; quality: MockQuality[]; message: string };

const history: MockSyncRun[] = [];
const demoCredentials = {
  salesforce: { instanceUrl: "https://demo.data360.invalid", clientId: "demo-connected-app", clientSecret: "••••••••••••••••", accessToken: "mock_sf_access_token" },
  tableau: { baseUrl: "https://demo.tableau.invalid", siteContentUrl: "visual-climate-demo", patName: "demo-pat", patSecret: "••••••••••••••••" },
};

function quality(provider: MockProvider): MockQuality[] { return provider === "Salesforce Data 360" ? [
  { id: "Q1", label: "Credential contract", status: "pass", detail: "Mock Connected App OAuth accepted." },
  { id: "Q2", label: "Schema contract", status: "pass", detail: "Country, year, indicator, value, unit mapped." },
  { id: "Q3", label: "Freshness", status: "pass", detail: "Demo stream is within the configured 15-minute window." },
  { id: "Q4", label: "Source completeness", status: "warn", detail: "Demo payload omits one optional sector field." },
] : [
  { id: "Q1", label: "Credential contract", status: "pass", detail: "Mock Tableau PAT accepted." },
  { id: "Q2", label: "Workbook contract", status: "pass", detail: "Climate Indicators workbook and view resolved." },
  { id: "Q3", label: "Extract freshness", status: "pass", detail: "Demo extract refresh completed." },
  { id: "Q4", label: "View metadata", status: "warn", detail: "One calculated field uses a demo lineage note." },
]; }

async function pause() { await new Promise((resolve) => setTimeout(resolve, 120)); }

export function mockIntegrationOverview() {
  return {
    mode: "SIMULATION",
    environment: "demo",
    credentials: demoCredentials,
    providers: [
      { provider: "Salesforce Data 360" as const, connected: true, auth: "Mock Connected App OAuth", endpoint: demoCredentials.salesforce.instanceUrl, lastSync: history.find((run) => run.provider === "Salesforce Data 360")?.completedAt ?? null, status: history.find((run) => run.provider === "Salesforce Data 360")?.status ?? "idle" },
      { provider: "Tableau" as const, connected: true, auth: "Mock Personal Access Token", endpoint: demoCredentials.tableau.baseUrl, lastSync: history.find((run) => run.provider === "Tableau")?.completedAt ?? null, status: history.find((run) => run.provider === "Tableau")?.status ?? "idle" },
    ],
    pipeline: ["authenticate", "discover", "retrieve", "normalize", "quality-check", "snapshot", "publish"],
  };
}

export async function runMockSync(provider: MockProvider): Promise<MockSyncRun> {
  const started = new Date(); const run: MockSyncRun = { id: `mock_${provider === "Tableau" ? "tb" : "sf"}_${started.getTime()}`, provider, startedAt: started.toISOString(), completedAt: started.toISOString(), status: "running", recordsRead: 0, recordsWritten: 0, checksum: "pending", quality: [], message: "Authenticating demo credentials…" };
  history.unshift(run);
  await pause(); run.message = "Retrieving demo source records…"; run.recordsRead = provider === "Tableau" ? 42 : 68;
  await pause(); run.message = "Normalizing country, year, unit, and indicator fields…"; run.recordsWritten = provider === "Tableau" ? 39 : 64;
  await pause(); run.quality = quality(provider); run.checksum = provider === "Tableau" ? "sha256:demo-tableau-7f2c" : "sha256:demo-salesforce-9a41"; run.status = "degraded"; run.completedAt = new Date().toISOString(); run.message = "Completed with one non-blocking metadata warning.";
  return run;
}

export function mockSyncHistory() { return history.slice(0, 12); }
export function resetMockSyncHistory() { history.length = 0; }
