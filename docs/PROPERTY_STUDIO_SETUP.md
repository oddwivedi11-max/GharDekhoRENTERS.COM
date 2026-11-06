# GharDekho Property Studio — production setup notes

## What is implemented

- The Owner Dashboard receives a premium **List Your Property** hero above the owner statistics.
- **Start Listing** opens a separate, full-page, five-step Property Studio.
- **List by Speaking** starts the browser speech-recognition flow where supported.
- The Studio uses the existing Supabase Auth session, owner profile, `property-images` Storage bucket and existing `owner_add_property` workflow through the new owner-scoped `owner_publish_property_studio` RPC.
- Drafts are stored in the browser for the signed-in owner. Publishing is idempotent through a submission UUID.
- The existing Leaflet/OSM owner map picker and Photon address search are reused when Google Maps is not configured. If a Google browser key is configured, Google Places Autocomplete, Google Maps pin selection and genuine Places nearby results are enabled.
- Renter-facing property details read the added configuration, security deposit, photo gallery and nearby-place fields from `get_public_properties`.
- Existing occupancy and tenancy workflows remain the source of truth. The Studio creates a listing through the existing property-add function and does not fabricate a tenancy or occupancy state.
- Owner/Renter switching controls are removed from the dashboard. The explicit renter **List a Property** role-enablement action, if used, persists the additional role and signs out; the user must authenticate again and choose the portal. Login-time role selection and existing roles are preserved.

## Google Maps / Places configuration still required

The repository did not contain a Google Maps browser key or a Google Maps JavaScript API integration. The Studio therefore fails closed: it will not invent or display nearby places. Until a key is configured, Photon search and the existing Leaflet map remain available, but automatic Google Places results and the Google map/autocomplete mode remain unavailable.

Create a **browser** API key in Google Cloud Console, enable billing, and enable:
- Maps JavaScript API
- Places API (the legacy Places service used by the current nearby-search implementation)

Restrict the key by HTTP referrer to the production site and any explicitly approved preview host. Restrict API access to the APIs above. A browser key is visible to site visitors by design; its security comes from strict referrer and API restrictions, not from pretending it is a server secret.

After creating the restricted key, add this meta tag inside the existing `<head>` in `index.html` (replace the placeholder with the restricted browser key):

```html
<meta name="gdr-google-maps-api-key" content="YOUR_RESTRICTED_BROWSER_KEY">
```

Then redeploy. The Studio will automatically enable Google Places Autocomplete, Google Maps pin selection and nearby-place discovery. Do not use an unrestricted key or a service-role/server secret in browser code.

## Browser support

- Voice input uses the browser's Web Speech API. It is supported in compatible Chromium-based browsers; unsupported browsers retain the complete manual listing flow.
- Camera capture uses the browser file-input capture hint. Device/browser support can vary.
- Location search uses Photon until Google Places Autocomplete is configured.

## Database

Migration `20261107120000_owner_property_studio.sql` is additive. It adds listing metadata columns and a restricted publish RPC, preserves existing property/owner/tenancy records, and extends the public property read RPC with the new renter-visible fields. No table is dropped or reset.


## Occupancy and move-out notices

A renter can submit, update or withdraw a move-out notice from the current-rental panel. The authenticated RPC verifies that the active occupancy belongs to that renter. The database trigger changes a verified property's status to `soon_available` while an active notice exists; withdrawing the last notice restores the status according to the remaining active occupancy and available-bed count. A notice never ends a tenancy. The existing owner **Release this renter** confirmation remains the source of truth for the actual move-out and tenancy release.
