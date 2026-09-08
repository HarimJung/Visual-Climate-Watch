export const skillRegistry = [
  ["S01", "DataRetrieval", "Fetches source-faithful climate records"],
  ["S02", "Visualization", "Selects accessible visual templates"],
  ["S03", "Explanation", "Explains trends with citations and uncertainty"],
  ["S04", "Comparison", "Checks comparability before normalization"],
  ["S05", "Validation", "Cross-references values and anomalies"],
  ["S06", "ReportGeneration", "Compiles seven-section country reports"],
  ["S07", "LearningPath", "Guides climate data literacy"],
  ["S08", "PeerBenchmark", "Compares explicit peer sets without surprise rankings"],
  ["S09", "AnomalyDetection", "Flags unexplained changes for review"],
  ["S10", "NDCAnalyzer", "Summarizes national contribution targets"],
  ["S11", "ClimateProjection", "Labels scenario-based projections"],
  ["S12", "DisasterAnalysis", "Summarizes reported disaster events"],
  ["S13", "FinanceTracker", "Separates commitment and disbursement"],
  ["S14", "DataImputation", "Human-gated missing-data proposals only"],
  ["S15", "EmbedWidget", "Produces safe read-only embed configuration"],
  ["S16", "Translation", "Translates outputs with climate terminology"],
] as const;

export const prohibitedActions = [
  "GenerateCountryRanking", "ProvideFinancialAdvice", "ProvideLegalAdvice", "DiscloseEndangeredSpeciesLocations",
  "SubmitPolicyRecommendationsAsOfficial", "AccessTableauMCPLogin", "AccessPrivateTokens", "CircumventSourceTerms", "ImputeWithoutApproval",
] as const;

export const qualityGateContracts = [
  ["Q1", "Source traceability", "Every numerical claim has a dataset ID and year"],
  ["Q2", "Date coverage", "Requested range falls inside source coverage"],
  ["Q3", "Unit normalization", "Units are explicit and comparable"],
  ["Q4", "Comparability", "Gas, sector, GWP, boundary and timeframe differences are shown"],
  ["Q5", "Uncertainty", "Ranges, fast-track caveats and missingness are disclosed"],
  ["Q6", "AI disclosure", "Analytical responses carry the verification note"],
  ["Q7", "Human signoff", "BTR-related output is held for reviewer approval"],
] as const;

export type AuditEvent = {
  runId: string;
  subagentId: string;
  action: string;
  status: "completed" | "blocked" | "review";
  qualityGates: string[];
  inputHash: string;
  outputHash: string;
  timestamp: string;
};

export function makeAuditEvent(subagentId: string, action: string, status: AuditEvent["status"], input: unknown, output: unknown, qualityGates: string[] = []): AuditEvent {
  const stable = (value: unknown) => JSON.stringify(value, Object.keys((value && typeof value === "object") ? value as object : {}).sort());
  const hash = (value: string) => Array.from(value).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0).toString(16);
  return { runId: crypto.randomUUID(), subagentId, action, status, qualityGates, inputHash: hash(stable(input)), outputHash: hash(stable(output)), timestamp: new Date().toISOString() };
}
