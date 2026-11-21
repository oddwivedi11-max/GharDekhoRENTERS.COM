# Market-readiness remediation — 21 November 2026

## Scope

This branch prepares code and SQL changes for the findings in the GharDekho production market-readiness audit. It is deliberately **not merged, deployed, or applied to the production Supabase project**.

Branch: \`fix/market-readiness-20261121\`

## Changes prepared

1. **Public inventory:** replace the five renter-facing discovery RPCs so they return verified properties from verified owners only, exclude soft-archived rows, and retain the existing public (logged-out) browsing experience for approved properties. Pending and rejected listings remain in owner/admin workflows, not public search.
2. **Occupancy consistency:** add a lifecycle trigger and a guarded backfill so an actively occupied whole-home or fully booked listing cannot retain a stale \`verified\` status. Multi-bed PG/hostel inventory with remaining beds is not automatically marked fully occupied.
3. **New listing identity/location:** preserve the database-side property-name validation and Room type support, while requiring a six-digit India Post-verified PIN and India-bounded coordinates for new Property Studio submissions.
4. **Rent calculations:** change the configured late-fee value to a daily rate, multiplied by overdue days after the configured grace period. Both payment RPC overloads keep authentication, active-occupancy, screenshot-object, UTR, payment-method, and duplicate-period checks. India local date is used for rent due and payment-date calculations.
5. **Payment setup guard:** payment screenshot submissions now require the owner to have a valid UPI ID or an uploaded QR object. The renter interface will not offer a payment action when neither destination exists; the owner dashboard highlights missing setup for active renters.
6. **Role consistency:** add \`owner\` to the role array only when the account's primary role is already \`owner\` and the array is missing it. Other roles are retained.
7. **Regression coverage:** add static tests covering the public RPC predicates, occupancy sync, listing identity/PIN validation, both payment RPC overloads, daily fee logic, role-array repair, and owner/renter payment setup UI.

## Existing data that still needs verified human input

- The current 11 production property records have no structured PIN codes; two lack coordinates. The migration does **not** invent PINs, coordinates, post offices, or addresses for those existing listings. Owners/admins must verify each record against the real property location before a data-repair update.
- One authenticated user has no public profile. No profile is auto-created because the correct name, role, and contact details are not known.
- Payment settings cover only one property. Owners must configure and verify the UPI ID or QR destination for each property with an active renter. The new server guard prevents accepting a payment submission without a usable destination.
- The seven owner-role inconsistencies are repaired deterministically by the role migration: primary role \`owner\` gains missing \`owner\` membership while preserving all other roles.

## Important policy decision: late-fee interpretation

The existing \`late_fee_amount\` database field was previously charged as a one-time amount after the grace period. This patch interprets it as **₹ per overdue day**, consistent with the requested ₹10/day rule. The existing configured value of ₹10 therefore becomes ₹10 per day after the existing configured grace period (the observed setting was 20 days). Confirm this change with the product owner before applying the migration to production; historical payment rows are not rewritten.

## Required QA before merge or production

- Obtain approval and create/use an isolated Supabase QA project/branch with synthetic accounts and listings only. Do not use real production accounts for write tests.
- Reconcile repository migrations against the live migration history before applying anything. The repository contains only a subset of production migration history; do not replay all repository migrations wholesale.
- Apply these four new migration files to the isolated QA database, then run the repository's static and browser regression suites.
- Verify anonymous callers cannot retrieve pending/rejected records from each public RPC, while verified logged-out Explore Homes remains available.
- Verify occupancy insert, release, move-out notice, whole-home availability, and multi-bed PG capacity transitions.
- Verify PIN 486885 plus other test PINs in the Property Studio, including invalid PIN, stale result, exact marker confirmation, and missing PIN. Verify the listing saves pincode/coordinates correctly.
- Verify daily fee boundary dates (due date, final grace day, first overdue day, multiple overdue days) against both the displayed renter bill and the inserted payment row.
- Verify valid UPI-only, QR-only, both, missing, malformed, and missing-storage-object cases.
- Verify owner/renter role navigation and all existing admin login flows. Do not change the existing admin account, credentials, memberships, or authentication settings.
- Obtain separate explicit approval before merging to \`main\`, applying production migrations, or triggering the Cloudflare deployment.

## What has not been done

- No production Supabase rows, functions, policies, buckets, Auth settings, or storage objects were changed.
- No production deployment or Cloudflare cache purge was triggered.
- Existing missing PIN/coordinate records and the orphan Auth profile remain unresolved pending verified owner/admin input.
- Browser/Playwright tests have not been run in this environment. The added tests are committed for CI/QA execution; static source parsing is not a substitute for database or browser execution.


## Final source-level verification — 21 November 2026

- 34/34 source checks passed for the latest remediation source: frontend parsing, all five verified-only RPC predicates, publish identity/PIN/coordinate validation, occupancy lifecycle trigger/backfill, both payment RPC overloads, owner role migration, payment UI guards, cache version updates, and test workflow wiring.
- 10/10 regression cases executed successfully in an isolated in-memory harness against the exact branch file contents, including fee boundary outcomes of ₹0 on the due date, ₹0 on the final grace day, ₹10 on the first overdue day, ₹20 on the second, and ₹30 on the third. This is **not** a Node.js test-runner execution.
- The GitHub connector returned no workflow-run records and no commit status checks for the latest commit. A passing GitHub Actions run has therefore not been confirmed.
- The Supabase organization currently uses the Free plan and has no existing development branches. Supabase preview database branching is a Pro-plan feature; the quoted branch compute rate is USD $0.01344/hour. No branch was created and no paid upgrade or compute was initiated.
- Live production schema metadata was queried read-only. The existing identity argument lists and result types for all five public discovery functions, both rent-payment overloads, and the Property Studio publish RPC match the signatures targeted by the drafts. This validates signature compatibility only; it does not compile or execute the new function bodies.
