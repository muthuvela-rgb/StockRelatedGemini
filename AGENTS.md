# Project Knowledge & Guidelines

## Admin & Permissions
- **Superadmin Account**: `muthu.vela@gmail.com`.
- The **Access Audit** console tab and `/api/access-logs` endpoints are strictly reserved for this email address.

## Pending Feature: Prospero.ai Newsletter Ingestion
- Detailed architecture and implementation plans are documented in `PROSPERO_INTEGRATION_PLAN.md`.
- Focuses on ingesting subscriber newsletter issues from Prospero.ai (via Gmail OAuth or Inbound Email Webhook), parsing them with Gemini for macro bias and ticker-specific institutional flow, and factoring those signals into the options scoring model.
- When the user asks to resume or implement this feature, refer to `PROSPERO_INTEGRATION_PLAN.md`.
