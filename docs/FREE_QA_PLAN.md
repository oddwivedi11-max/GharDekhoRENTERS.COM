# GDR Free QA Plan (No Paid Supabase Branch)

## Goal

Run QA without creating a hosted Supabase development branch or changing production data.

## Cost guardrails

- Do not create Supabase projects or branches for QA.
- Do not apply draft migrations to the production project.
- Do not run write/destructive SQL against production during testing.
- Keep QA fixes on `fix/full-qa-20261020` and use PR #7 for review.
- GitHub Actions static checks are the first no-cost automated gate.

## What can be tested for free right now

1. JavaScript syntax checks for `index.html`, `admin/control.html`, and the PIN resolver.
2. Code review of role routing, property approval rules, owner-contact privacy, and PIN search logic.
3. Responsive UI checks using Chrome DevTools device emulation (390px, 768px, and 1366px).
4. Read-only inspection of production schema and security settings.
5. UI-only tests with synthetic/mock data, provided those tests do not write to the production Supabase project.

## Manual browser checklist

- [ ] Public Explore Homes loads without logging in.
- [ ] Pending/rejected properties are not shown publicly.
- [ ] Search with PIN `486885` matches the Singrauli/Vindhyanagar locality and district correctly.
- [ ] Search radius does not silently exceed the selected radius.
- [ ] Empty search results show a clear message and allow radius adjustment.
- [ ] Renter-only account choosing Owner login is routed to the Renter dashboard without gaining owner permissions.
- [ ] Wrong password shows a neutral error that does not reveal whether an account exists.
- [ ] Owner phone is not revealed until a visit request is approved.
- [ ] Owner property changes to address/listing type require re-verification.
- [ ] Rent/description/photo edits preserve existing approval, per the agreed policy.
- [ ] Saved-property UI handles save and unsave states.
- [ ] Owner, renter, and admin dashboards do not expose each other's private data.
- [ ] Layout is usable at 390px, 768px, and 1366px widths.

## Important safety limitation

Do not use real owner/renter accounts to test write actions on the live site. Those actions can modify real records or notify real people. Until a separate database is available, test destructive or data-changing flows with mocks or in a local environment only.

## Local Supabase option (potentially no hosting charge)

A local Supabase stack can run on the developer's computer using Docker and the Supabase CLI, without creating a hosted branch. However, this repository currently has migration-history drift and does not yet have a complete local Supabase configuration/schema. Do **not** run the current draft migrations locally and assume they represent the full production schema. First reconcile/export the schema and migration history, then configure local Supabase and seed synthetic data.

## Release gate

Static checks passing does not mean full QA has passed. Before production release, finish isolated renter/owner/admin end-to-end tests, verify database policies and RPCs, confirm the actual deployment target, and obtain explicit approval before merging or deploying.
