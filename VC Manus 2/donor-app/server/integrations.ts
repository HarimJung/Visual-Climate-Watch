type IntegrationState = { provider: "Salesforce Data 360" | "Tableau"; configured: boolean; authMode: string; requiredSecrets: string[]; docs: string; lastChecked: string };

export function integrationStatus(): IntegrationState[] {
  return [
    { provider: "Salesforce Data 360", configured: Boolean(process.env.SALESFORCE_DATA_CLOUD_ACCESS_TOKEN || (process.env.SALESFORCE_DATA_CLOUD_URL && process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET)), authMode: "Connected App OAuth / bearer token", requiredSecrets: ["SALESFORCE_DATA_CLOUD_URL", "SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"], docs: "https://developer.salesforce.com/docs/data/data-cloud-query-guide/references/data-cloud-query-api-reference/c360a-direct-api-connected-app.html", lastChecked: new Date().toISOString() },
    { provider: "Tableau", configured: Boolean(process.env.TABLEAU_BASE_URL && process.env.TABLEAU_SITE_CONTENT_URL && process.env.TABLEAU_PAT_NAME && process.env.TABLEAU_PAT_SECRET), authMode: "Personal Access Token or Connected App JWT", requiredSecrets: ["TABLEAU_BASE_URL", "TABLEAU_SITE_CONTENT_URL", "TABLEAU_PAT_NAME", "TABLEAU_PAT_SECRET"], docs: "https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_auth.htm", lastChecked: new Date().toISOString() },
  ];
}

export async function testTableauConnection(): Promise<{ ok: boolean; message: string }> {
  const base = process.env.TABLEAU_BASE_URL;
  const site = process.env.TABLEAU_SITE_CONTENT_URL;
  const name = process.env.TABLEAU_PAT_NAME;
  const secret = process.env.TABLEAU_PAT_SECRET;
  if (!base || !site || !name || !secret) return { ok: false, message: "Tableau credentials are not configured." };
  const response = await fetch(`${base.replace(/\/$/, "")}/api/3.27/auth/signin`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ credentials: { personalAccessTokenName: name, personalAccessTokenSecret: secret, site: { contentUrl: site } } }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) return { ok: false, message: `Tableau sign-in failed with HTTP ${response.status}.` };
  return { ok: true, message: "Tableau REST authentication succeeded." };
}

export async function testSalesforceConnection(): Promise<{ ok: boolean; message: string }> {
  const token = process.env.SALESFORCE_DATA_CLOUD_ACCESS_TOKEN;
  const url = process.env.SALESFORCE_DATA_CLOUD_URL;
  if (!token || !url) return { ok: false, message: "Salesforce Data 360 URL and access token are not configured." };
  const response = await fetch(`${url.replace(/\/$/, "")}/services/data/v64.0/`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) return { ok: false, message: `Salesforce Data 360 health check failed with HTTP ${response.status}.` };
  return { ok: true, message: "Salesforce Data 360 authentication succeeded." };
}
