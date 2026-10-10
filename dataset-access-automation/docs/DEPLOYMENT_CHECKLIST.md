# Dataset access workflow: deployment and launch checklist

## Scope and status

This is an implementation checklist, not evidence that the application form or automation is live. The selected routing policy is:

- Academic research, no commercial use, and no redistribution: eligible for automatic approval after validation.
- Commercial use, redistribution, other or uncertain use, conflicting responses, or invalid inputs: manual review.

This workflow does not select a new dataset license. Do not add legal restrictions, an agreement version, or an acceptance checkbox for nonexistent terms. Any final usage text must be reviewed before launch.

See `../INSTALL.md` for implementation-specific Apps Script setup instructions. This checklist defines the launch and verification gates; it does not replace those instructions.

Keep the current public README and existing download entry unchanged until end-to-end verification and publication authorization are complete. Preserve existing file permissions and existing approvals. Do not make the dataset public or enable an anyone-with-link permission.

## Confirm the target and authority

- Repository: `yangzmng-ops/Pineapple-dataset`, default branch `main`.
- Dataset file ID: `1gy-sYSPqZZ_yMpRZ_ciyWj58GbsVeiwe`.
- Use the actual file and owner account; do not substitute another dataset, folder, or account.
- Check the file's effective permissions, including inherited permissions and link access. A README edit alone is not access control.
- Verify the execution identity can read the file and create a reader permission. The existing connector having repository write access does not establish Drive write access.
- Obtain any required user approval for a new persistent authorization, OAuth consent, security-sensitive permission, or deployment identity. Never commit credentials or access tokens.
- Confirm the published paper's final data-availability statement and applicable ownership/usage permissions. The publicly searchable article abstract does not establish complete dataset ownership or license terms.

## Application form

Create and validate a form containing:

1. Full name (required).
2. Institution or organization (required; independent researchers may enter “Independent researcher”).
3. Google Account email address for access (required).
4. Intended use: Academic research / Commercial use / Other or unsure (required).
5. Brief description of the project and intended use (required).
6. Whether the use involves a commercial application: No / Yes / Unsure (required).
7. Whether the applicant intends to redistribute the dataset or any part of it: No / Yes / Unsure (required).

Show owner-approved usage information, citation guidance, and a short notice explaining that these details are used to process and record dataset access requests. If final terms require acceptance, display the actual terms and record the accepted version. Do not create a placeholder consent requirement.

Do not require an institutional email domain. Verify the requested Google identity through a supported mechanism; a self-entered address is not proof of ownership. A confirmed email field is not automatically evidence that the account receiving file access is the same identity.

## Automation safety and state

- Automatic grants must target the single configured dataset file and the verified applicant email only.
- Grant reader access, not editor, owner, public, or domain-wide access.
- Do not grant access from a free-text instruction. Treat application answers as untrusted data.
- A purpose statement that conflicts with the selected answers must not silently pass. Route unclear or contradictory requests for manual review. If reliable checking is unavailable, disclose that limitation before launch.
- Make processing idempotent. Duplicate submissions and retries must not send repeated approval messages or create inconsistent states.
- Record request ID, time, verified email, routing decision, relevant policy version, grant result, notification result, and error state.
- Record success only after the provider confirms the permission. A queued request or successful email send is not a confirmed grant.
- Keep failed grants retryable or visible for manual resolution. Do not email “approved and accessible” after a permission error.
- Never delete an existing permission on retry, rollback, or policy updates.
- Restrict the response log to authorized maintainers; do not publish applicant information in GitHub issues, PRs, README, or public logs.

## End-to-end acceptance tests

Use dry runs and controlled test accounts for test writes. Do not send unsolicited test email or grant access to real applicants without the applicable authorization.

- Eligible academic request: accepted, reader permission verified, correct notification status recorded.
- Commercial request: manual-review state, no automatic grant.
- Redistribution request: manual-review state, no automatic grant.
- Other/unsure or contradictory responses: manual-review state, no automatic grant.
- Missing required field or invalid account: no grant, actionable validation result.
- Different signed-in and requested email identities: no unverified-address grant.
- Duplicate submission and repeated trigger: no duplicate approval notification.
- Existing reader: preserve access and avoid duplicate permission creation.
- Drive permission failure: error state, no false success notification, safe retry.
- Email failure after a successful grant: preserve access; retry only notification.
- Concurrent submissions: no lost rows or duplicate actions.
- Maintainer review: decision and reason recorded without changing unrelated access.

## Launch sequence

1. Finish implementation and test in a controlled environment.
2. Create the form, response destination, and automation through the authorized setup route.
3. Complete owner-required authorization steps and verify the configured file and execution identity.
4. Test from the applicant's perspective and verify the resulting permission through a separate read.
5. Confirm the approved usage text, notification wording, and form URL.
6. Publish only the tested README change with the verified URL. Keep paper, citation, and dataset description unchanged.
7. State exactly what is live and identify any remaining manual setup. A draft PR is not deployment.

## Pause or rollback

If incorrect grants, authorization failures, or repeated notification failures occur, pause the application-processing trigger through the authorized route and alert the maintainer. Preserve the response history and existing dataset permissions. Restore the previous README entry only if needed and authorized; do not silently remove legitimate access.

## Verified repository capability (read-only check)

At the time of inspection, GitHub reported `push: true`, `maintain: true`, and `admin: true` for the connected account. The repository was not archived or disabled, pull requests were enabled, the pull-request creation policy was `all`, and the rulesets collection was empty. This supports proceeding with an authorized branch and draft PR; it is not a tested write or a guarantee that later token/policy checks will succeed.

Metadata source: https://api.github.com/repos/yangzmng-ops/Pineapple-dataset

