# GharDekho Renters — Master Implementation Plan

Date: 2026-11-04
Repository: oddwivedi11-max/GharDekhoRENTERS.COM
Production baseline: 387cbfc18738449bfcf5c786c5029000881619cb

## Audit snapshot

- The production frontend is a static, single-page HTML application with a large inline JavaScript bundle in index.html; owner/admin surfaces are role-gated sections in the same document.
- Existing hosting is Cloudflare Workers static assets, deployed by .github/workflows/deploy-cloudflare.yml on pushes to main.
- GitHub Pages is also configured, but the Cloudflare workflow is the verified current deployment target. The latest Cloudflare run (#60) completed successfully and printed the workers.dev deployment URL.
- Supabase project gktmaiwqvtusnegevdle is healthy on PostgreSQL 17.6.1.155 in ap-southeast-1.
- Current public tables include owners, properties, units, visit_requests, saved_properties, users, property_occupancies and admin_users. They contain live records and must be preserved.
- The current get_nearby_properties RPC uses a bounded 1–10 km Haversine calculation and is used by the existing Nearby UI. It must not be replaced.
- The existing public listing RPC returns a maximum of 100 rows. A dedicated viewport RPC is required before map search can scale to a large inventory.
- The current schema contains no rental agreement, payment, charge, notification, or property-media tables. The requested modules must be added additively after isolated QA and migration-history reconciliation.
- There are 48 production migration records, while only a subset of historical migrations is in this repository. Do not replay the repository migration folder against production.
- The security advisor flags 3 anon-executable SECURITY DEFINER functions, including get_my_owner_properties, get_nearby_properties, and get_public_properties. The latter two are intentionally public discovery endpoints; get_my_owner_properties should be authenticated-only. Other SECURITY DEFINER routines need per-function review, not blanket revocation.
- Auth leaked-password protection is disabled. It is a project-wide Auth setting and must be reviewed separately rather than changed as a side effect of UI work.
- Existing account schema supports multiple roles in users.roles, and the frontend supports owner/renter switching for multi-role accounts. The new strict one-email/one-role rule needs a compatibility migration plan for existing multi-role accounts before enforcement.

## Phase plan

### Phase 0 — Audit and safety baseline
- [x] Identify frontend, deployment target, database project, existing tables and current migrations.
- [x] Confirm current Nearby RPC and frontend use.
- [x] Review SECURITY DEFINER findings and avoid blanket permission changes.
- [x] Confirm production contains real data; preserve it.
- [ ] Obtain isolated Supabase development branch approval; quoted branch cost is USD $0.01344/hour.

### Phase 1 — Discovery and location foundation
- [x] Add a separate renter map-first discovery surface without replacing the existing Nearby feature.
- [x] Add an owner map pin picker that feeds the existing validated property submission path.
- [x] Keep city/locality search on the existing Photon geocoder and preserve manual address entry.
- [ ] Test viewport RPC on an isolated Supabase branch and deploy the additive migration.
- [ ] Run responsive browser tests at mobile, tablet and desktop widths.

### Phase 2 — Account and portal separation
- [ ] Define canonical single-role assignment for new accounts.
- [ ] Inventory existing dual-role accounts and map each to a safe migration plan.
- [ ] Enforce role selection server-side; direct URLs must not bypass authorization.
- [ ] Remove the owner/renter switch only after migration and regression tests.
- [ ] Separate navigation and route state while reusing the existing Supabase auth session.

### Phase 3 — Owner operations and renter lifecycle
- [ ] Add rental agreements, invitations/acceptance, renter-specific records and immutable rental history.
- [ ] Add property-level and renter-specific additional charges with disclosure/acceptance.
- [ ] Add owner analytics only from verified database records.
- [ ] Add renter request, active rental and document views.

### Phase 4 — Payments
- [ ] Add payment attempts, verification records, UPI configuration and transaction ledger.
- [ ] Implement UPI intent initiation where supported.
- [ ] Keep QR/UTR payments explicitly manual until a compliant provider webhook is configured.
- [ ] Do not claim automatic payment confirmation without trusted provider verification.

### Phase 5 — Immersive media
- [ ] Add property media metadata and secure storage policies.
- [ ] Support ordinary images, equirectangular 360 images and GLB/GLTF models as distinct types.
- [ ] Add owner media management and renter viewer.
- [ ] Optimize uploads, image/model size and mobile GPU usage.

### Phase 6 — Security, QA and production release
- [ ] Review every SECURITY DEFINER function and all RLS/storage policies.
- [ ] Reconcile migration history and create recoverable backups.
- [ ] Run Playwright workflows using synthetic QA accounts only.
- [ ] Run Supabase advisors and verify sensitive operations.
- [ ] Merge to main and verify the Cloudflare deployment URL and live workflows.

## Phase 1 notes

The map module uses the existing Supabase client exposed from the current application. It first attempts get_map_properties_in_bounds; if that function is not yet installed, it falls back to the existing public listing RPC and filters the current inventory by visible map bounds. The separate Nearby feature continues to use its existing get_nearby_properties RPC unchanged.

No production database schema or live user data is modified by this frontend phase.
