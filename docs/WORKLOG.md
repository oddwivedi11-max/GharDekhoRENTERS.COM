# GharDekho Renters QA Work Log

Date: 2026-10-20
Working branch: `fix/full-qa-20261020`
Production baseline: `main` at `d48941bce2e1e200635bd657bcd8b2b2d880fd5a`
Backup branch: `backup-20261020` at the same baseline commit.

## Scope and safety
- No production database changes have been applied.
- No production deployment has been triggered.
- No real user rows, property rows, visit requests, or storage files were changed.
- The existing `fix/full-qa` branch is behind `main`; a fresh working branch was created to preserve the PIN-code commit and avoid rewriting history.

## Code changes prepared on the QA branch
- A1: removed the stale `recentPasswordResetRequest` reference from startup recovery detection.
- A2: corrected malformed trailing-slash regexes in `index.html` and `admin/control.html`.
- A3: changed the renter Find Home click handler to call `window.openRenterFindHomePage()` at click time.
- D1: preserved the Sign Up tab when switching renter/owner role from that flow and restored the selected role.
- D4: changed the invalid-credentials popup to a neutral `Incorrect email or password.` message.
- D10: added bare six-digit PIN resolution through the existing India Post lookup, distinguishes invalid PIN from no listings, ignores PIN marker words, and matches district/state for full postal suggestions when the post-office name is absent from a listing.
- D5: PG/hostel cards now show room type and available beds instead of `- BHK`; property-location display removes repeated comma-separated parts such as duplicate PIN and India segments.
- D2: no new modal change has been made yet; existing CSS already has scrolling rules, so the reported desktop clipping still needs browser reproduction.
- B2/B5: added a guarded `owner_update_property` RPC migration draft, switched the owner edit UI to call it, and added server-side validation for rent, text lengths, furnishing and owner-scoped property-image URLs in owner add/edit. The migration is not applied to any database and requires QA validation before production approval.
- C1: added baseline security headers and a CSP in Report-Only mode in `_headers`; do not enforce CSP until browser violations are checked.
- E1/E4: updated sitemap to canonical public routes and added a short development/deployment README.
- D9: removed the duplicate `ownerCount` declaration from the stale `admin/control.html` copy so its inline script parses.
- C2: expanded `.assetsignore` to exclude Supabase migrations, Wrangler configuration, Markdown docs, tests and tools from public static assets.

## Static validation
- Parsed all inline JavaScript blocks in `index.html` after the changes: 36 scripts checked, zero syntax errors.
- Parsed inline JavaScript blocks in `admin/control.html` after the changes: 31 scripts checked, zero syntax errors.
- These are syntax checks only; they do not prove browser workflows pass.

## Not yet verified / blocked
- Browser end-to-end tests at 390/768/1366 px still need to be run with Playwright or a browser session.
- The live PIN lookup and property matching must be tested against seeded QA data; no synthetic data has been inserted into production.
- Supabase schema/RLS/functions have been inspected read-only. Database fixes require a QA database and the user's answers/approval before production SQL.
- Security advisor warnings about SECURITY DEFINER functions and leaked-password protection require per-function privilege review and an explicit decision before Auth-wide changes.
- No production deployment has been run. Merge/deploy and production migrations remain approval-gated.

## User decisions requested
See the conversation for PIN choice, public pending-listing policy, Explore login policy, owner-phone visibility, email confirmation, QA database, and wrong-role login behavior.

## Read-only Supabase observations
- The current `toggle_saved_property(uuid)` function already deletes all saved duplicates for the current user/property, returns one `saved=false` row when removing, and returns one `saved=true` row when adding. B1 appears fixed in the current database definition, but the renter UI regression still needs testing.
- Current `get_public_properties()` and `get_nearby_properties(...)` definitions filter to verified properties and verified owners. Both still return `owner_id`; the frontend uses this field in visit-request/self-booking logic, so it must not be removed without updating that flow.
- No Supabase development branches were found. No QA database has been created, and no production SQL has been applied.
- Supabase security advisor reports leaked-password protection disabled and generic SECURITY DEFINER warnings. Admin RPC definitions were checked: the current non-legacy admin functions include an internal admin check; legacy variants need privilege/grant review before any changes.

## Additional fixes and static/logic checks
- D5: renter property cards now display PG/hostel room type and available beds instead of a BHK placeholder; duplicate comma-separated location segments are removed from card/detail/saved displays.
- D5: the renter budget presets labelled `Under ₹5,000` (and other preset caps) now use a strict less-than comparison; custom numeric max budgets remain inclusive.
- D7: added a Terms of Use / Privacy Policy checkbox to signup and validation before account creation; the checkbox is shown only in Sign Up mode.
- D8: Explore Homes now opens approved public listings without forcing the visitor to log in. Contact/visit actions remain in their existing protected flows.
- D2: added a viewport-aware property editor scroll container and sticky action row to keep Save/Cancel/Delete reachable on short screens. Browser visual verification remains pending.
- D11: Nearby UI now states the 10 km maximum and surfaces a clean user-facing error instead of the raw database error.
- B2/B5: owner edit now calls the new guarded RPC; migration file `20261020190000_guard_owner_property_updates_and_validate_images.sql` is prepared but not applied. This remains BLOCKED pending isolated QA database testing and approval.
- Static validation rerun after latest code edits: `index.html` 36 inline scripts, zero syntax errors; `admin/control.html` 31 inline scripts, zero syntax errors.
- Synthetic logic simulation: 6/6 PIN/location/budget cases passed after correcting the test expectations to distinguish listings that do and do not store PIN text. This is a small isolated logic simulation, not a browser or live database test.

## Further findings and work status
- D8: changed the Explore Homes action to load public approved listings without forcing login. The direct `?property=` startup route already calls `openPropertyDetails`; the end-to-end route still needs a browser test after the startup fix.
- D6: added a shared in-flight promise for concurrent `get_my_owner_profile` calls so simultaneous dashboard widgets can reuse one request. Sequential duplicate requests may remain and must be measured in browser network logs.
- D2: viewport scroll/sticky action rules are now inside a style block; browser visual comparison still pending.
- D7: signup now requires acceptance of Terms of Use and Privacy Policy; the checkbox hides in Login mode.
- D5: budget presets labelled `Under` now use strict less-than; custom max budgets remain inclusive.
- D11: the Nearby radius label explicitly states the 10 km maximum, and backend errors are replaced with a clean message in both Nearby call paths.
- The new `_headers` policy is CSP Report-Only only. It has not been tested against the live browser and must not be switched to enforcing until all CSP reports are reviewed.
- The current live Cloudflare deployment has not been changed by this branch. No merge, production migration, or deployment has been performed.


## Continuation after user decisions (2026-10-20)
User decisions recorded:
- Singrauli PIN to verify/use: 486885.
- Pending/rejected property listings must not be public.
- Explore Homes remains public for approved/verified inventory without forcing login.
- Owner phone is disclosed only after the renter has an approved visit request.
- Keep current email-confirmation setting unchanged.
- Use an isolated QA database; check cost and obtain approval before creating it.
- Normal rent/description/photo edits preserve an approved listing; address or listing-type changes require admin re-verification.
- If someone selects Owner login but the account only has Renter access, route them to the Renter dashboard with a clear message.
- Duplicate email/phone/account errors must be neutral and must not reveal whether an account exists.
- Production SQL, merge to main, and production deployment remain approval-gated.

## Changes prepared on QA branch after decisions
- Updated signup and profile error messages to be neutral for duplicate email/phone/account conditions; removed automatic switch-to-login behaviour when signup identifies an existing account.
- Owner-tab login for a Renter-only account now keeps the authenticated session and routes to the Renter dashboard; it does not grant Owner permissions.
- Corrected the public listing comment so it matches the actual verified-only public RPC behavior.
- Owner editor now displays a clear pending re-verification notice when the RPC reports an address/listing-type change.
- Updated the prepared owner-edit migration so address/listing-type changes set property status and verification status to pending; normal rent/description/photo edits preserve current statuses. It blocks address/type changes while occupied and preserves an existing full address when the location value did not change.
- Added prepared migration `20261020200000_limit_owner_contact_to_approved_visits.sql`. It restricts `get_verified_owner_contact` to authenticated users who have an `approved` visit request for that owner. Frontend explains the owner phone is available after visit approval.
- These database migrations are drafts on the QA branch only. They have NOT been applied to production or any database.

## Additional audit findings / blockers
- Supabase production has 43 recorded migrations and the repository contains only a small subset of historical migration files. This is migration-history drift; do not apply repository migrations to production until schema/history reconciliation and a recoverable backup/export are complete.
- No Supabase development branches currently exist. A QA branch or separate QA project must be cost-checked and approved before creation. Production data is not to be copied into QA; use synthetic test accounts and listings only.
- Security advisor warns about `SECURITY DEFINER` routines. The current production admin legacy RPCs with no internal admin guard were observed as executable only by `postgres` and `service_role`; the currently named admin RPCs checked include an internal admin guard. Do not blanket-revoke all function grants: public listing RPCs intentionally support logged-out Explore Homes and must return verified inventory only.
- Production currently grants anonymous execution to `get_public_properties()` and `get_nearby_properties(...)`; this is intentional only if their verified-only filtering remains enforced. Keep both under focused tests.
- Existing production `get_verified_owner_contact(uuid)` currently returns contact for any verified owner to authenticated callers, without checking for an approved visit. The prepared migration closes this policy gap once isolated QA tests pass.
- The separate `deploy-pages.yml` injects a PIN resolver script into the build, while the Cloudflare workflow deploys repository assets directly. The inline renter search already contains a PIN lookup path. Deployment target parity and PIN behavior for PIN 486885 still require browser tests; no deployment was triggered.
- Supabase Auth leaked-password protection remains disabled per advisor. Do not change Auth-wide settings until the effect and user impact are reviewed and explicitly approved.

## Current verification status
- Existing branch worklog's inline-JavaScript syntax checks reported 36 scripts in `index.html` and 31 in `admin/control.html` with zero syntax errors before the latest targeted edits. Re-run syntax checks after the new edits.
- No authenticated browser session or isolated QA database is available in this turn, so renter/owner/admin end-to-end tests, responsive viewport tests, actual PIN 486885 lookup, and migration execution are still unverified.
- No production SQL, real-user data changes, main-branch merge, or live deployment has been performed.


## Follow-up review: verification-trigger compatibility (2026-10-20)
- Read-only production inspection found two BEFORE UPDATE triggers protecting `properties.verification_status`: `properties_protect_verification_status` and `trg_protect_property_verification_status`.
- The first draft of the owner-edit migration would have been rejected by these existing guards when attempting to move an approved listing to pending after an address/type change. The QA-only migration has now been updated to replace both trigger functions consistently: only the authenticated owner of that property may downgrade it to pending when changing address/listing type; owners still cannot set verification to verified/rejected, and address/type changes while occupied are blocked. Admin behavior is preserved.
- Owner-profile duplicate phone/email errors are also neutralized in the frontend. Remaining literal matches for duplicate phrases are error-code detection or comments, not user-facing disclosure copy.
- Static QA workflow was added and its regex escaping corrected. The latest run on commit `ab89dca` passed the commit-formatting check, inline JavaScript syntax checks for the public/admin pages, and standalone PIN resolver syntax check.
- No production functions/triggers were modified. Trigger changes exist only in the unapplied migration draft on the QA branch.


## Search and visit-state follow-up (2026-10-20)
- Verified PIN `486885` maps to Vindhyanagar, Singrauli, Madhya Pradesh. The bare-PIN search now matches a property against either the post-office locality or district instead of requiring both district and state to be stored in the property address. This is a best-effort fallback because the current schema has no dedicated property PIN column; exact PIN matching remains preferred when the listing itself stores the PIN.
- Removed the standalone PIN resolver injection from the GitHub Pages build. It previously replaced the entered PIN with a single post-office name before the existing search ran, which could make valid district-level listings disappear. Both deployment builds now rely on the shared inline PIN lookup/matching logic. No deployment was triggered.
- Read-only review found an unused legacy `owner_update_visit_status(uuid,text)` RPC could change a visit away from pending even after it had already been approved/rejected/completed. Added an unapplied migration to restrict that legacy function to owner-scoped pending requests only.
- The new legacy-RPC migration, owner-contact migration, and owner-edit/trigger migration remain unapplied. These are drafts for isolated QA only.
