# GharDekho Renters QA Work Log

Date: 2026-10-19
Repository: https://github.com/oddwivedi11-max/GharDekhoRENTERS.COM
Working branch: `fix/full-qa`
Backup branch: `backup-20261019`

## Phase 0 — Safety and setup

- Created `backup-20261019` from `main`. This is a Git branch backup, not a Git tag.
- Created `fix/full-qa` from `main`.
- No production code, database rows, auth settings, DNS settings, or deployment settings have been changed.
- A Git tag and a recoverable external export of database schema/policies/functions/triggers/storage policies/Auth settings are not yet confirmed.
- Browser automation and baseline screenshots have not yet been created; the available connected tools do not currently expose an interactive browser automation runner.
- The GitHub file connector returned no content for the approximately 1 MB `index.html` and returned 404 when requesting ranges/alternate encoding. The main crash fixes A1–A3 therefore cannot yet be safely applied or verified from the available file response. A repository ZIP or full `index.html` source export is needed if this limitation persists.

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
