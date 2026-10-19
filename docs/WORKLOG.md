# GharDekho Renters QA Work Log

Date: 2026-10-19
Repository: https://github.com/oddwivedi11-max/GharDekhoRENTERS.COM
Working branch: `fix/full-qa`
Backup branch: `backup-20261019`

## Phase 0 — Safety and setup

- Created `backup-20261019` from `main`. This is a Git branch backup, not a Git tag.
- Created `fix/full-qa` from `main`.
- No production code, database rows, auth settings, DNS settings, or deployment settings have been changed.
- A Git tag is still missing: the available GitHub write actions can create branches/files/commits but do not expose a tag-creation action. Do not substitute a branch for a tag.
- A recoverable external export of schema, RLS policies, functions, triggers, storage policies and Auth settings is not yet saved. The Supabase connector can inspect the database but does not expose an export/download operation or Auth-settings read endpoint. No production rows were queried for user content, changed or exported.
- Browser automation and baseline screenshots have not yet been created. The available connected tools do not expose a real interactive browser session or screenshot-at-viewport runner. Container networking cannot resolve GitHub, and Playwright setup timed out; no browser tests are claimed.
- The full index.html was successfully retrieved through the GitHub REST contents endpoint (1,063,328 characters), so source access is no longer the blocker. However, Phase 2 code changes must wait until Gate 0 is satisfied as required by the Master Brief.

## Phase 1 — Initial read-only inspection

### Confirmed from repository configuration

- `wrangler.jsonc` deploys static assets from the repository root.
- `.github/workflows/deploy-cloudflare.yml` deploys on pushes to `main`.
- `.github/workflows/deploy-pages.yml` also deploys on pushes to `main` and modifies `index.html` during the Pages workflow. The canonical production domain/active Pages configuration still needs verification before deciding how to handle the second workflow.
- `_redirects` sends `/admin` to `/admin/` and routes `/admin/control` to `/index.html`.
- The connected Supabase project is active and healthy. RLS is enabled on the inspected public tables.
- The live database migration history includes later migrations not reflected by the appendix's description of only five repository migration files. Repository migrations and live migration history need reconciliation before any SQL is proposed/applied.

### Confirmed database findings (read-only)

- `get_public_properties()` currently returns properties with `verification_status` pending or verified, includes `owner_id`, and does not filter for a verified owner.
- `get_nearby_properties(...)` currently returns pending/verified verification states and includes `owner_id`; radius is clamped to a minimum of 0.5 km, so a requested 1 km radius can still be expanded only if caller values differ, and this implementation should be tested against the user's reported radius issue.
- Supabase security advisors currently flag anonymous execution of SECURITY DEFINER functions including `get_public_properties`, `get_nearby_properties`, and `verify_my_login_phone`. These findings require function-by-function review; do not revoke permissions blindly because public browsing/nearby features may depend on them.
- Current `properties_owner_update` policy checks owner ownership in USING and WITH CHECK, but permits a broad set of status values. The existing verification-protection triggers must be reviewed alongside this policy before selecting a minimal edit fix.
- Current `properties` public-select policies filter the table to verified/occupied/soon-available status, but the SECURITY DEFINER RPC definitions above bypass that table policy filtering unless their own WHERE clauses are corrected.

### Current gate status

- Gate 0: PARTIAL — branches exist; tag, external schema/settings backup, browser runner and baseline screenshots remain unverified.
- Gate 1: IN PROGRESS — initial database and deployment configuration inspected. Full reproduction and the required user decisions are still pending.
- No production migration, merge to `main`, or production deployment has been performed.


## Phase 1 — Owner decisions received (2026-10-19)

- Owner phone visibility: keep current behaviour; all logged-in renters may see the owner phone on property details.
- Signup email confirmation: keep disabled/current setting; do not change Supabase Auth configuration.
- Approved listing edits: preserve approval for rent, description, furnishing, photo and availability edits; address or listing-type changes require re-approval.
- Wrong-role login: show a clear message and route the user to the correct dashboard.
- Duplicate email/phone signup errors: use a neutral message to avoid account enumeration.
- Test data: user authorized two ZZ-TEST renters, two ZZ-TEST owners and one ZZ-TEST admin. No accounts have been created yet because no Auth-admin/user-creation tool or interactive browser is available; do not insert fake auth rows via SQL or use real accounts.
- Cleanup: do not delete any ZZ-TEST accounts, rows or files until user separately confirms.

## Phase 0 — Current gate status (updated)

GATE 0 remains **BLOCKED / NOT PASSED**. Remaining required items:
1. Create an actual Git tag from the current main commit (no tag-write tool is available in the current GitHub connector).
2. Save a recoverable schema/policies/functions/triggers/storage-policy/Auth-settings export outside the repository or in a private location.
3. Configure a local/preview test server and Playwright, or obtain an interactive browser automation capability.
4. Create the five authorized test accounts with the actual Auth system.
5. Capture the requested baseline screenshots at 390, 768 and 1366 px for the required pages and dashboard states.

Do not start Phase 2 until Gate 0 passes. No application code, production SQL, auth settings, Cloudflare/DNS settings, GitHub workflows/secrets, main branch, or production deployment has been changed.

## Phase 1 — Additional confirmed read-only findings

- The live database contains migration versions through 20261016175344; this is materially more than the five migration files described in the project-facts section. The repository migration history and live migration history need a reconciliation inventory before proposing SQL.
- The live definitions of get_public_properties() and get_nearby_properties(...) include pending listings, do not filter to verified owners, and return owner_id. This conflicts with the Master Brief's explicit requirement that pending listings remain private and public RPC responses must not expose owner IDs. These are confirmed from function definitions, not yet reproduced through an anonymous HTTP request.
- Supabase security advisors flag anonymous execution of the SECURITY DEFINER functions get_public_properties, get_nearby_properties, and verify_my_login_phone. Do not revoke permissions blindly; inspect actual grants and caller needs first.
- Existing RLS is enabled on inspected public tables. This is not a complete security pass: all policies, function grants/search_path, storage policies and Auth settings still require a full export/inventory.
- The deployed repository contains both Cloudflare Workers and GitHub Pages workflows triggered by pushes to main. Cloudflare is documented as production hosting; confirm Pages custom-domain/environment configuration before changing workflow behaviour. No workflow has been changed.

## Exact recovery point and inventory snapshot

- Current main commit SHA (and starting point of backup-20261019): `abf163e39e10c86ee03971e8198f4dc689e97414`.
- The backup branch currently points to exactly the same commit as main. Working branch `fix/full-qa` has only the QA work-log commits on top; it has no application-code edits.
- Read-only database inventory snapshot: 8 public tables (`admin_users`, `owners`, `properties`, `property_occupancies`, `saved_properties`, `units`, `users`, `visit_requests`); RLS enabled on all 8. The inspected `storage.objects` table has 7 policies across the `property-images` and `owner-documents` buckets. 42 public-schema functions and 14 triggers across `public`, `auth`, and `storage` were counted. Full definitions and grants still need a recoverable export; these counts are not a substitute for the export.
- Repository `main` currently contains 4 SQL migration files (not 5): `20260929103300_lock_admin_read_rpcs.sql`, `20260929104500_fix_property_verification_flow.sql`, `20260929163000_allow_owner_submit_without_exact_location.sql`, and `20261016231500_fix_phone_validation_regex.sql`. The live database has migration versions through `20261016175344`; drift must be investigated before proposing/applying migrations.
- The exact `main` commit SHA above is ready for a Git tag named `backup-20261019` if a tag-writing path is provided. No tag was created by this session.

## User's subsequent execution approval (2026-10-19)

- The user has now explicitly requested SQL work and final deployment. Treat this as the later approval for production SQL/merge/deploy in principle; it does not waive the Master Brief's mandatory safety gates or the requirement to verify each fix before calling it fixed.
- Execution remains blocked at Gate 0: this session cannot create a Git tag with the connected GitHub actions; cannot save a complete recoverable database/Auth-settings export to a private local artifact with the current connector paths; cannot create Supabase Auth test accounts because there is no Auth-admin user-management action; cannot capture the required interactive browser baselines or run the real-click Playwright matrix; and has no connected Cloudflare deployment action.
- SQL changes are not being applied blindly. The production database's recorded migration history includes 40+ migrations absent from the four-file repository migration directory, so a migration reconciliation and recovery export must precede schema changes. Applying the proposed public-listing fix without first verifying the exact live function definitions/grants and regression paths could break anonymous Explore Homes, owner dashboards, or existing role flows.
- Next safe action: complete the recovery/export and browser test setup using an available privileged export path and interactive browser/Cloudflare access; then continue A1–A3, SQL B1–B5, C/D/E fixes in the order specified by the Master Brief. Do not delete ZZ-TEST rows/files until the user confirms after the final inventory.
