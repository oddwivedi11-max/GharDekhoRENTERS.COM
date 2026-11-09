# GharDekho Property Studio — production setup notes

## What is implemented

- The Owner Dashboard receives a premium **List Your Property** hero above the owner statistics.
- **Start Listing** opens a separate, full-page, five-step Property Studio.
- **List by Speaking** starts the browser speech-recognition flow where supported.
- The Studio uses the existing Supabase Auth session, owner profile, `property-images` Storage bucket and existing `owner_add_property` workflow through the new owner-scoped `owner_publish_property_studio` RPC.
- Drafts are stored in the browser for the signed-in owner. Publishing is idempotent through a submission UUID.
- Location search and reverse geocoding use the existing Photon endpoint where available, with manual address entry as fallback.
- The map picker reuses the existing Leaflet + OpenStreetMap experience. Browser GPS is optional and requires owner permission.
- Nearby facilities are queried in one bounded 5 km request against the OpenStreetMap Overpass API. Only named OSM objects with real coordinates are shown; distances are calculated with Haversine. Results are cached locally for 24 hours per rounded location, and a new request cancels any previous in-flight request. The app does not automatically retry rate-limit or overload errors. If the public endpoint is unavailable or returns no named facilities, the Studio clearly reports that state and allows the owner to continue. OpenStreetMap attribution is shown beside the results. The public Overpass instance is a best-effort community service with aggregate usage limits; if the site grows beyond its fair-use guidance, this feature must be disabled or moved to a self-hosted data service rather than repeatedly retrying.
- No Google Maps, Google Places, paid geocoder, paid AI, or payment gateway is used or required. Photon and public Overpass instances are community services with usage limits; the app does not assume unlimited requests or retry in a loop.
- Voice input uses browser SpeechRecognition where supported; unsupported browsers retain manual entry.
- The Studio uses the existing Supabase Auth session, owner profile, `property-images` Storage bucket and existing `owner_add_property` workflow through the owner-scoped `owner_publish_property_studio` RPC. Drafts are stored locally for the signed-in owner and publishing is idempotent through a submission UUID.
- Existing occupancy and tenancy workflows remain the source of truth. The Studio creates a listing through the existing property-add function and does not fabricate a tenancy or occupancy state.
- Owner/Renter switching controls are removed from the dashboard. Existing login-time role selection and stored roles are preserved.

## Database

Migration `20261106195955_owner_property_studio.sql` is additive. It adds listing metadata columns and a restricted publish RPC, preserves existing property/owner/tenancy records, and extends the public property read RPC with the new renter-visible fields. No table is dropped or reset.


## Occupancy and move-out notices

A renter can submit, update or withdraw a move-out notice from the current-rental panel. The authenticated RPC verifies that the active occupancy belongs to that renter. The database trigger changes a verified property's status to `soon_available` while an active notice exists; withdrawing the last notice restores the status according to the remaining active occupancy and available-bed count. A notice never ends a tenancy. The existing owner **Release this renter** confirmation remains the source of truth for the actual move-out and tenancy release.


## Draft recovery and categorized photo gallery (2026-11-09)

- Property Studio keeps a non-sensitive draft per signed-in owner in browser local storage. The draft includes listing fields and the current step, not passwords, access tokens or refresh tokens.
- A recovered draft restores text fields and its previous step. It deliberately clears exact-marker confirmation; the owner must open the map and confirm the exact property location again before publishing.
- Already uploaded images are restored only when their storage object path starts with the current owner's auth uid and their public URL belongs to this project's `property-images` bucket. Unuploaded browser File objects are not written to local storage and must be selected again after a refresh.
- Exterior and Interior uploads are separate optional categories. Either category may remain empty; one or two total images are sufficient. The combined maximum remains eight photos, with a 5 MB limit per supported JPEG/PNG/WEBP file.
- Files are stored within the existing owner prefix under `interior/` or `exterior/`. The existing Storage policy checks the first object path segment against `auth.uid()`, so no policy relaxation or bucket change is required.
- Up to three uploads are attempted concurrently. On a partial upload failure, uploaded objects from that batch are removed where possible; retry remains available.
- Category is carried in the stored path and in the image URL query marker for the new viewer code. The existing property publish RPC and `photo_urls` array are preserved for compatibility with older listings.
- Owner Analytics and Notifications are separate dashboard sections. Analytics reads actual owner-scoped records; Notifications currently derive events from existing visits, payments, property verification and tenancy dates. Read/unread/dismiss preferences are browser-local, not cross-device notifications.

## Explicitly not part of this release

- Genuine 360-degree image capture/viewer and GLB/glTF model viewing are not included. The current `property-images` bucket allowlist is JPEG/PNG/WEBP and the repository does not yet have a compatible secure media metadata/RLS model for GLB/GLTF.
- Renter-side detail-gallery category tabs still require a separate frontend pass. Legacy `image_url` and `photo_urls` continue to be read as before.
- Push/email/SMS notifications and synchronized read state are not included.
