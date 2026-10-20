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
