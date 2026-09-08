import { sourceCatalog } from "./source-catalog";

export type RefreshResult = { runId: string; checked: number; healthy: number; degraded: number; sources: Array<{ id: string; status: "healthy" | "degraded"; httpStatus?: number; checkedAt: string }> };

export async function refreshSourceCatalog(): Promise<RefreshResult> {
  const runId = crypto.randomUUID();
  const results: RefreshResult["sources"] = [];
  for (const source of sourceCatalog) {
    let status: "healthy" | "degraded" = "degraded";
    let httpStatus: number | undefined;
    try {
      const response = await fetch(source.url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
      httpStatus = response.status;
      status = response.ok || response.status === 403 || response.status === 405 ? "healthy" : "degraded";
    } catch {
      status = "degraded";
    }
    results.push({ id: source.id, status, httpStatus, checkedAt: new Date().toISOString() });
  }
  return { runId, checked: results.length, healthy: results.filter((item) => item.status === "healthy").length, degraded: results.filter((item) => item.status === "degraded").length, sources: results };
}
