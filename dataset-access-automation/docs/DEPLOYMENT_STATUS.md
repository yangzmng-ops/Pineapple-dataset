# Production Deployment Status

## Activation

The dataset access workflow was enabled at **2026-10-11T01:15:02.122Z** with owner authorization.

- [Public application form](https://docs.google.com/forms/d/e/1FAIpQLSdcSYltEs0-DajkiHbEo19G0WnVwfd0eJtrOV8qvcR5Blo6Dg/viewform)
- [Access Terms](ACCESS_TERMS.md), version `2026-10-11-v1`
- [Privacy Notice](PRIVACY_NOTICE.md), version `2026-10-11-v1`

## Verified at activation

- Production mode: LIVE; policy configuration and applicant notifications enabled.
- Form published and accepting responses; the respondent page was opened and verified as fillable.
- Google Account email collection: VERIFIED. Response summaries and response editing disabled.
- Form-submit processing and hourly pending-request retry triggers installed.
- Dataset remains restricted; existing owner and reader permissions are unchanged.
- Application log remains private to its owner.
- Independent local tests: 41/41 passed. Real Google configuration validation passed.
- At verification there were no responses, application records, or approval notifications. No fictitious application was submitted.

## Outstanding first-applicant verification

There was no separate test account. The owner explicitly chose to verify new-user reader permission, the access notification email, and actual download with the first real application. **These new-user end-to-end outcomes have not yet been verified.** Record their observed results when that application occurs; existing owner access is not evidence that a new applicant can download.

The production workflow being enabled does not establish successful processing of any future application. Inspect failed or uncertain permission/notification states and handle them according to the installation guide.

## Publication boundary

Only the public application entry and approved usage/privacy documents are provided here. Form editing, script administration, and private response-log links are intentionally excluded.
