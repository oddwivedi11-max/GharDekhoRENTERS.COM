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


## Free Playwright browser smoke tests (2026-10-20)
- Added `tests/gdr-smoke.spec.cjs` and `playwright.config.cjs`, plus `.github/workflows/qa-browser-smoke.yml`. These run on the QA branch using GitHub Actions and install Chromium; no paid Supabase branch or hosted QA database is created.
- Browser smoke run `39448442571` passed on commit `58f1ef23a47c94afd2bd09f5cf408b50e5a7e877`.
- Covered page rendering, title/body availability, uncaught page exceptions, and horizontal overflow at 390px, 768px, and 1366px. The tests deliberately do not click login/signup, save, visit, owner edit, or admin actions.
- This is a local static-page browser smoke test, not full renter/owner/admin end-to-end validation. Public data/API requests may still use configured Supabase endpoints, but tests perform no intentional database writes.
- Production SQL, main merge, and deployment remain unchanged and approval-gated.


## Expanded browser QA and fixes (2026-10-20)
- Added `tests/gdr-controls.spec.cjs` to check core renter/owner/admin controls, blank renter-search validation, and duplicate concrete DOM IDs. The browser workflow now runs all `tests/*.spec.cjs` files.
- First expanded run found duplicate IDs shared by style/script pairs: `ghardekho-property-location-autocomplete-v1` and `ghardekho-renter-action-fix-v2`. Renamed the CSS and JS IDs independently in `index.html`.
- Follow-up browser run passed on commit `aa7736820b9da8843a56a3c37817e2fc2e76546c`; it passed the three responsive checks, public access check, core-control presence, blank renter-search validation, and duplicate-ID check.
- Added a frontend fail-closed check before calling `get_verified_owner_contact`: the signed-in renter must have an `approved` visit request for the exact property. This reduces accidental UI disclosure while the database RPC migration remains unapplied. It is **not a substitute** for enforcing the approval check inside the database RPC; direct RPC calls remain a release blocker until that migration is reviewed/tested/applied with explicit approval.
- Browser smoke tests passed again on commit `e2e0d860df0b67c124c7daaba0602fdbeda69b52` after the owner-contact UI guard. Static checks passed on the same commit.
- No production SQL, merge to `main`, or deployment was performed. Authenticated renter/owner/admin E2E, database policy testing, and real PIN-to-listing behavior remain unverified without isolated synthetic test data.


## Master prompt execution — 2026-11-04

### Phase 0 audit
- Confirmed the production app is a static HTML/JavaScript app, not a framework build.
- Confirmed Cloudflare Workers is the active deployment workflow; the latest deployment (#60) succeeded and printed https://ghardekhorenters-com.od-dwivedi11.workers.dev.
- Confirmed production Supabase project gktmaiwqvtusnegevdle is healthy on PostgreSQL 17.6.1.155.
- Confirmed live rows exist in owners (21), properties (11), visit_requests (4), saved_properties (13), users (46), property_occupancies (2), and admin_users (2). No data was changed.
- Confirmed the current Nearby frontend calls get_nearby_properties and applies a 1–10 km radius. This implementation is preserved.
- Confirmed no current map library is used in the main application. The owner add-property flow already has geolocation/address selection and a verifiedPropertyLocation object; the new picker feeds that existing submission path.
- Confirmed there are no current rental agreement, payments, charges, notification or property media tables. Those require additive schema work after isolated QA.
- Confirmed 48 production migration records while only a subset of historical migrations is tracked in the repository. Production migration history must be reconciled before applying any schema changes.
- Security advisor reports 3 anon-executable SECURITY DEFINER functions. get_public_properties and get_nearby_properties are public discovery endpoints; get_my_owner_properties is owner-scoped and should be authenticated-only. No blanket function revokes were applied.
- A Supabase development branch quote is USD $0.01344/hour. Branch creation was not completed because cost confirmation is required.

### Phase 1 frontend changes prepared
- Added a dedicated renter map-first Explore surface with OpenStreetMap/Leaflet, clustered price markers, city/locality search, map/list toggle, Search this area, current-location centering, 1–10 km radius filtering and a property preview sheet.
- Added an owner map pin picker that sets coordinates through the existing property-location validation/submission flow. Manual address entry and the existing current-location action remain available.
- Existing renter Live Nearby and shared Nearby actions are not removed or replaced.
- The map first attempts get_map_properties_in_bounds; if it is not installed, it falls back to the existing public listing RPC and filters to current map bounds. This keeps the frontend compatible until the additive migration is tested.
- Added a draft additive SQL migration for get_map_properties_in_bounds and authenticated-only execution of get_my_owner_properties. It is not applied to production.
- Added a focused Playwright structural test for renter map controls, owner map picker and Nearby preservation.
- Added a master phase plan and updated QA workflows to run on this feature branch.

### Not yet verified
- The map feature still needs browser execution against the Cloudflare deployment and real location/geocoder behavior.
- The viewport RPC migration has not been applied; the fallback path is used until isolated QA validation.
- No role, payment, rental agreement, charge or 3D media schema changes have been applied.
- No production database rows, storage files or existing migrations were modified.


## Additional read-only audit — role and storage compatibility
- 46 user profile rows were grouped without exposing email or phone values. Seven have an explicit two-role array. Six more have role=owner while roles=[tenant]; the current frontend adds the primary role to roles, so these are effectively dual-role accounts too. Total accounts requiring a deliberate primary-role decision: 13.
- users.email has a unique index; users.roles defaults to ['tenant']. The auth-user trigger creates an owner profile when metadata role is owner. The self-role-change trigger protects users.role but does not fully enforce the roles array as a single-role value.
- A role migration must use users.role as the canonical role only after checking existing owner profiles and preserving all existing occupancy, visit and payment history. No role rows were changed.
- The existing property-images bucket is public and limited to JPEG, PNG and WEBP, max 5 MB. owner-documents is private. Neither supports GLB/GLTF model uploads as configured.
- properties(latitude, longitude) already has a composite B-tree index. property_occupancies has occupied_at/released_at and active-row uniqueness constraints, so extend this table for tenancy lifecycle instead of duplicating its history.
- Production migration ledger contains 51 records; latest version is 20261103162447. Repository migration history is incomplete and must be reconciled before applying any migration.


## PIN-to-map correction and exact property location guard (2026-11-09)
- On the QA branch `fix/gdr-pin-location-safety-20261109`, updated the Property Studio PIN flow so changing a six-digit PIN clears the previous address, coordinates, hidden map selection, nearby-place results and prior marker before resolving the new PIN.
- Six-digit PIN entry now starts a short debounced India Post lookup without waiting for blur; stale requests are aborted and response sequence/input checks prevent older responses from overwriting the latest selection.
- Photon results are filtered to India and ranked only when the returned state and district are consistent with the verified postal record. A failed or mismatched lookup leaves the old location cleared rather than retaining a Bhopal/default pin.
- PIN/address results remain explicitly approximate. Property publication now requires valid Indian coordinates and the owner’s explicit exact-marker confirmation through the existing map picker. Map-confirmed selections outside 35 km of the PIN area show a warning instead of being silently treated as matching.
- Changed the owner map's empty-state view from a Bhopal city default to a broad India view and added a map-selection clearing method. Renter map defaults and renter search logic are unchanged.
- Bumped Property Studio and Cloudflare map cache versions so deployed browsers load the corrected scripts/fragment.
- No Supabase schema, production records, credentials, payment logic, owner/renter relationships or storage objects were changed.
- Tests added/updated: stale-PIN invalidation, response sequencing, district/state match, automatic six-digit lookup, exact pin publish guard and owner map reset. Automated workflow results are pending at commit time; live PIN geocoding and authenticated owner publishing remain to be browser-verified.


## Owner Analytics, Notifications and Property Studio draft/gallery upgrade — 2026-11-09

- Added two dashboard-level owner sections, **Owner Analytics** and **Notifications**, while preserving the existing My Properties, Current Renters, My Payments and Visit Requests entry points.
- Owner Analytics reads account-scoped property, occupancy, visit, payment and payment-setting rows using the authenticated Supabase user and owner id. It presents database-derived property/occupancy/payment/enquiry counts and recent records; it does not fabricate seed data.
- Notifications are derived from existing owner records (pending visits, pending payment verification, pending property verification, near-term move-out dates and due-day reminders). Read/unread/dismiss state is stored in browser-local storage scoped to the owner id. This is a browser-local derived notification centre, not a cross-device notification table or push notification service.
- Property Studio now supports separately categorized optional Interior and Exterior photo groups. One or two photos are allowed, the combined maximum remains eight, and each file remains limited to 5 MB in the existing supported JPEG/PNG/WEBP types.
- Category folders are nested under the existing authenticated owner's storage prefix (`<auth.uid>/interior/` and `<auth.uid>/exterior/`) so the current `property-images` Storage policy continues to enforce the first path segment as the signed-in owner id. No Storage RLS policy was loosened.
- Up to three image uploads run concurrently. Failed batch uploads attempt to remove partial objects; the owner receives an error and can reselect/retry.
- Property Studio drafts save only the current owner's non-sensitive form fields and step to local storage. Previously uploaded photo metadata can be restored only when both owner-prefix path and expected project public URL prefix match. Browser-held file objects are not persisted; if a photo was selected but not uploaded before refresh, the UI asks the owner to select those files again. Restored location coordinates are approximate until the owner confirms the exact map marker again.
- Publishing remains a manual owner action through the existing `owner_publish_property_studio` RPC. The local draft clears only after the server confirms a successful publish.
- No production database migration, table, storage bucket configuration, payment provider, paid API, secret or live user record was added or changed in this pass.
- Cloudflare cache verification was updated to require the new `20261109-draft-gallery2` JavaScript/CSS/fragment versions and the draft/gallery UI markers. Automated workflow and live deployment results are pending until the branch is tested and merged.
- Remaining limitations: renter-facing gallery grouping by Interior/Exterior is not yet fully reflected in the shared property detail gallery; 360-degree/GLB/GLTF media remains separate pending work because the current bucket allowlist and media metadata model do not support it. Analytics notifications are browser-local and do not send push/email/SMS.


## Draft privacy hardening — 2026-11-10

- Corrected Property Studio draft persistence so local storage contains only the signed-in owner's non-location listing fields, current step, submission id and validated references to uploaded owner images.
- Exact address, Indian PIN code, latitude and longitude are no longer written into local storage. Draft schema version 3 invalidates previous version-2 drafts, which may have contained those values.
- Restored drafts that had reached Location or a later step resume at Location. The owner must re-enter the address/PIN and reconfirm the exact map marker before publishing.
- No production database, storage policy, payment data, account data or existing property records were changed.


## Owner dashboard follow-up — 2026-11-13

- Restored the existing dedicated Owner Dashboard Nearby Properties card in the home view. It continues to use the existing GDRMapExperience owner map launcher and the 5 KM owner-nearby experience; no second command-centre shortcut or duplicate map implementation was added.
- Updated Report a Problem removal to detect buttons/cards whose visible text also includes the support subtitle, and remove the small enclosing tile when it contains no other action. Existing Support and contact CTAs remain excluded.
- Collapsed the Owner Profile details grid by default. The existing Edit Profile control continues to open the current profile editor with the saved owner fields.
- Updated the asset cache versions in the Cloudflare deployment workflow so the changes are served as fresh production assets.
- No Supabase schema, production data, authentication, renter dashboard or payment logic was modified.


- Follow-up validation note (2026-11-13): the first push's automated checks caught an over-escaped regular-expression and over-strict test assertions. Corrected the detector and assertions in a follow-up commit. The Cloudflare deployment gate stopped before Wrangler; production deployment has not yet occurred.
