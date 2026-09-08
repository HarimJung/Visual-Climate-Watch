# Mock integration research

- Salesforce Data 360 Query API: https://developer.salesforce.com/docs/data/data-cloud-query-guide/references/data-cloud-query-api-reference
  - Query API supports Data 360 SQL and data stream, profile, engagement, unified data model, metadata, calculated insight, and data graph use cases.
- Salesforce Data 360 Webhook Data Action Targets: https://developer.salesforce.com/docs/data/data-cloud-int/references/webhook-data-action-targets/c360a-api-webhook-data-action-targets-in-customer-data-platform.html
  - Webhook targets are event-driven. Payloads use DataObjectDataChgEvent. Salesforce signs payloads with HMACSHA256 and requires a generated secret key for delivery and validation.
- Tableau REST API reference: https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_ref.htm
  - REST API covers authentication, data sources, workbooks, views, and jobs/tasks/schedules. The mock pipeline therefore models Tableau authentication, workbook/extract refresh, job completion, normalization, and snapshot publication without contacting Tableau.

The current test mode intentionally uses no real credentials and no external network writes. It preserves the same stages and output contracts that the production adapters will use after credentials are supplied.
