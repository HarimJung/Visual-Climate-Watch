# Integration research

- Salesforce Data Cloud / Data 360 official docs: https://developer.salesforce.com/docs/data/data-cloud-query-guide/references/data-cloud-query-api-reference/c360a-direct-api-connected-app.html
  - Requires a Salesforce Connected App with OAuth enabled and appropriate scopes such as `cdp_query_api`, `cdp_profile_api`, `refresh_token`, and `api`.
  - The flow obtains a Salesforce access token, then a tenant-specific Data 360 token/endpoint. The Data 360 endpoint is organization-specific.
- Tableau REST authentication official docs: https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_auth.htm
  - REST requests require a credentials token. PAT authentication is recommended; sign-in uses base URL, API version, PAT name/secret, and site content URL.
  - Connected App JWT/OAuth 2.0 are also supported for supported REST methods.
- Tableau Connected Apps official docs: https://help.tableau.com/current/online/en-us/connected_apps.htm
  - Direct trust and OAuth 2.0 trust are supported; connected apps can authorize Tableau REST API and Metadata API access with scopes.
