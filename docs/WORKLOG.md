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
- D10: ignored PIN marker words in text matching and avoid requiring the first postal office name when a full four-part postal suggestion is selected.
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
