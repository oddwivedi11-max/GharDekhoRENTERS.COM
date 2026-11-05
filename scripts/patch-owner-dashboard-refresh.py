from pathlib import Path

path = Path("index.html")
source = path.read_text(encoding="utf-8")

def replace_once(old, new, label):
    global source
    count = source.count(old)
    if count == 0:
        if new in source:
            print(f"Already applied: {label}")
            return
        # Earlier commits use equivalent formatting for the authenticated
        # owner-scoped query. Do not fail deployment when that fix is present.
        if label in (
            "load My Properties through authenticated owner RPC",
            "prefer direct RLS owner property query with RPC fallback",
        ) and '.from("properties")' in source and '.eq("owner_id", ownerRecord.id)' in source:
            print(f"Already applied: {label}")
            return
        raise SystemExit(f"Stopped safely for {label}: original and corrected text not found")
    if count != 1:
        raise SystemExit(f"Stopped safely for {label}: expected 1 original match, found {count}")
    source = source.replace(old, new, 1)
    print(f"Applied: {label}")

replace_once(
'''            const {
                data: ownerProfile,
                error: ownerLookupError
            } = await getMyOwnerProfileShared();

            const ownerRecord = Array.isArray(ownerProfile)
                ? (ownerProfile[0] || null)
                : ownerProfile;

            if (ownerLookupError || !ownerRecord) {
                console.error(
                    "Owner lookup error:",
                    ownerLookupError
                );

                container.innerHTML =
                    "<p>Unable to find your owner profile.</p>";

                return;
            }''',
'''            const {
                data: ownerProfile,
                error: ownerLookupError
            } = await getMyOwnerProfileShared();

            let ownerRecord = Array.isArray(ownerProfile)
                ? (ownerProfile[0] || null)
                : ownerProfile;

            // If the owner-profile RPC is unavailable, use the authenticated
            // owner's own row as a fallback before giving up on My Properties.
            if (ownerLookupError || !ownerRecord) {
                console.warn("Owner profile RPC unavailable; trying the owner row directly:", ownerLookupError);
                const { data: fallbackOwner, error: fallbackError } = await supabaseClient
                    .from("owners")
                    .select("id,name,phone,verification_status")
                    .eq("user_id", currentUser.id)
                    .maybeSingle();

                if (!fallbackError && fallbackOwner) {
                    ownerRecord = fallbackOwner;
                } else {
                    console.error("Owner lookup error:", ownerLookupError, fallbackError);
                    if (container) container.innerHTML = "<p>Unable to find your owner profile. Please refresh and try again.</p>";
                    return;
                }
            }''',
    "owner profile fallback in My Properties"
)

replace_once(
'''                    let statusLabel = "Vacant";
                    let statusClass = "available";
                    if (property.status === "occupied") {''',
'''                    let statusLabel = "Vacant";
                    let statusClass = "available";
                    if (property.status === "pending" || property.verification_status === "pending") {
                        statusLabel = "Pending verification";
                        statusClass = "pending";
                    } else if (property.status === "occupied") {''',
    "pending property status label"
)


replace_once(
'''            if (!currentUser || !accountHasRole("owner") || activeRole !== "owner") {
                return;
            }''',
'''            if (!currentUser || !accountHasRole("owner")) {
                return;
            }''',
    "allow owner inventory refresh for multi-role accounts"
)

replace_once(
'''async function loadOwnerVerificationStatus() {
    if (!currentUser || activeRole !== "owner" || !accountHasRole("owner")) return;''',
'''async function loadOwnerVerificationStatus() {
    if (!currentUser || !accountHasRole("owner")) return;''',
    "allow owner verification refresh for multi-role accounts"
)

replace_once(
'''async function loadOwnerVisits() {
    if (!currentUser || activeRole !== "owner" || !accountHasRole("owner")) return;''',
'''async function loadOwnerVisits() {
    if (!currentUser || !accountHasRole("owner")) return;''',
    "allow owner visit refresh for multi-role accounts"
)


replace_once(
'''async function loadOwnerProperties() {
            if (!currentUser || !accountHasRole("owner") || activeRole !== "owner") {
                return;
            }''',
'''async function loadOwnerProperties() {
            if (!currentUser || !accountHasRole("owner")) {
                return;
            }''',
    "remove active-role gate from owner property inventory"
)

replace_once(
'''async function loadOwnerVerificationStatus() {
    if (!currentUser || activeRole !== "owner" || !accountHasRole("owner")) return;''',
'''async function loadOwnerVerificationStatus() {
    if (!currentUser || !accountHasRole("owner")) return;''',
    "remove active-role gate from owner verification"
)

replace_once(
'''async function loadOwnerVisits() {
    if (!currentUser || activeRole !== "owner" || !accountHasRole("owner")) return;''',
'''async function loadOwnerVisits() {
    if (!currentUser || !accountHasRole("owner")) return;''',
    "remove active-role gate from owner visits"
)

replace_once(
'''async function loadOwnerCurrentRenters(properties) {
    if (!currentUser || activeRole !== "owner" || !accountHasRole("owner")) return;''',
'''async function loadOwnerCurrentRenters(properties) {
    if (!currentUser || !accountHasRole("owner")) return;''',
    "remove active-role gate from owner current renters"
)


replace_once(
'''                // Public inventory is served through a SECURITY DEFINER RPC.
                // Only properties belonging to admin-verified owners are public.
                // Only admin-verified properties owned by verified owners are public.
                // Pending and rejected listings must never appear in public search.''',
'''                // Public inventory is served through a SECURITY DEFINER RPC.
                // Verified listings are public; pending listings are visible with
                // an explicit pending-verification label. Rejected listings stay hidden.''',
    "document pending listings as publicly visible"
)

replace_once(
'''                                ${property.status === "occupied"
                                ? '<button type="button" class="property-status-button occupied" disabled aria-label="Property occupied">● Occupied</button>'
                                : property.status === "soon_available"
                                ? '<button type="button" class="property-status-button soon" disabled aria-label="Property will be available soon">● Soon Available</button>'
                                : '<button type="button" class="property-status-button available" disabled aria-label="Property vacant">✓ Vacant</button>'}''',
'''                                ${property.status === "pending" || property.verification_status === "pending"
                                ? '<button type="button" class="property-status-button pending" disabled aria-label="Pending verification">● Pending verification</button>'
                                : property.status === "occupied"
                                ? '<button type="button" class="property-status-button occupied" disabled aria-label="Property occupied">● Occupied</button>'
                                : property.status === "soon_available"
                                ? '<button type="button" class="property-status-button soon" disabled aria-label="Property will be available soon">● Soon Available</button>'
                                : '<button type="button" class="property-status-button available" disabled aria-label="Property vacant">✓ Vacant</button>'}''',
    "show pending status on public property cards"
)

replace_once(
'''                                <span class="owner-badge">✓ Verified Owner</span>''',
'''                                ${property.owner_verified
                                    ? '<span class="owner-badge">✓ Verified Owner</span>'
                                    : '<span class="pending-badge">Owner verification pending</span>'}''',
    "show truthful owner verification status on public cards"
)


replace_once(
'''            const {
                data,
                error
            } = await supabaseClient
                .from("properties")
                .select("id,title,name,location,address,rent,status,verification_status,created_at,listing_type,room_type,gender_preference,food_included,total_beds,available_beds,bhk,furnishing,description,image_url,latitude,longitude,owner_id")
                .eq("owner_id", ownerRecord.id)
                .order("created_at", {
                    ascending: false
                });''',
'''            const {
                data,
                error
            } = await supabaseClient.rpc("get_my_owner_properties");''',
    "load My Properties through authenticated owner RPC"
)


# All owner loader guards are already corrected by the idempotent replacements above.


replace_once(
'''            const {
                data,
                error
            } = await supabaseClient.rpc("get_my_owner_properties");''',
'''            // Prefer the authenticated owner's direct RLS-protected property
            // query. This works with the existing Owners can view own properties
            // policy and avoids an RPC response/cache mismatch in the dashboard.
            let { data, error } = await supabaseClient
                .from("properties")
                .select("id,title,name,location,address,rent,status,verification_status,created_at,listing_type,room_type,gender_preference,food_included,total_beds,available_beds,bhk,furnishing,description,image_url,latitude,longitude,owner_id")
                .eq("owner_id", ownerRecord.id)
                .order("created_at", { ascending: false });

            // Keep the secure authenticated RPC as a fallback if the direct
            // owner-scoped query is unavailable in a client/schema cache.
            if (error || !Array.isArray(data) || data.length === 0) {
                const rpcFallback = await supabaseClient.rpc("get_my_owner_properties");
                if (!rpcFallback.error && Array.isArray(rpcFallback.data) && rpcFallback.data.length > 0) {
                    data = rpcFallback.data;
                    error = null;
                } else if (error) {
                    console.error("Direct owner property query failed; RPC fallback also returned no rows:", error, rpcFallback.error);
                }
            }''',
    "prefer direct RLS owner property query with RPC fallback"
)

replace_once(
'''        const radiusKm = Number(document.getElementById("radiusSelect")?.value || 3);
        const listingType = document.getElementById("listingTypeSelect")?.value || "";''',
'''        const requestedRadiusKm = Number(document.getElementById("radiusSelect")?.value || 3);
        // Preserve the existing Nearby radius options while rejecting malformed values.
        const radiusKm = Number.isFinite(requestedRadiusKm)
            ? Math.min(20, Math.max(1, requestedRadiusKm))
            : 3;
        const listingType = document.getElementById("listingTypeSelect")?.value || "";''',
    "validate selected Nearby radius"
)

replace_once(
'''                const distanceKm = calculateDistanceKm(userLatitude,userLongitude,lat,lon);
                return distanceKm <= radiusKm ? {...property,distanceKm} : null;''',
'''                const distanceKm = calculateDistanceKm(userLatitude,userLongitude,lat,lon);
                // Defense in depth: never render a property outside the selected radius.
                return Number.isFinite(distanceKm) && distanceKm >= 0 && distanceKm <= radiusKm
                    ? {...property,distanceKm}
                    : null;''',
    "enforce exact Nearby distance boundary"
)



replace_once(
'''    setRoleSpecificUI(activeRole);
    updateDashboardProfile();''',
'''    // Persisted role update succeeded; now activate the selected portal.
    activeRole = target;
    pendingLoginRole = target;
    sessionStorage.setItem("gd_active_role", target);
    sessionStorage.setItem("gd_pending_login_role", target);
    localStorage.setItem("gd_preferred_role", target);
    setRoleSpecificUI(target);
    updateDashboardProfile();''',
    "activate the selected dashboard after successful role switch"
)


# Replace the duplicated owner Nearby discovery shortcut with a dedicated
# Current Renters entry point beside Add Property. The renter-side discovery
# and the shared map modules remain untouched.
replace_once(
'''                <div class="owner-dashboard-overview owner-dashboard-quick-grid">
                    <div class="dashboard-card owner-quick-card">
                        <div>
                            <span class="dashboard-section-kicker">LIST YOUR PROPERTY</span>
                            <h3>Add a Property</h3>
                            <p class="dashboard-muted">List a rental, confirm its location and start receiving visit requests.</p>
                        </div>
                        <button type="button" class="dashboard-primary-action" id="ownerAddPropertyBtn">＋ Add Property</button>
                    </div>
                    <div class="dashboard-card owner-quick-card owner-explore-card">
                        <div>
                            <span class="dashboard-section-kicker">LOOKING FOR A HOME TOO?</span>
                            <h3>Explore Near Me</h3>
                            <p class="dashboard-muted">Use nearby discovery, save properties and request visits without leaving your Owner account.</p>
                        </div>
                        <div class="owner-quick-actions">
                            <button type="button" class="dashboard-primary-action owner-explore-btn" id="ownerExploreNearbyBtn">📍 Explore Near Property by Me</button>
                            <button type="button" class="dashboard-secondary-action" id="ownerSavedPropertiesBtn">❤️ Saved Properties</button>
                        </div>
                    </div>
                </div>''',
'''                <div class="owner-dashboard-overview owner-dashboard-quick-grid gdr-owner-entry-grid">
                    <div class="dashboard-card owner-quick-card gdr-owner-entry-card">
                        <div>
                            <span class="dashboard-section-kicker">LIST YOUR PROPERTY</span>
                            <h3>Add a Property</h3>
                            <p class="dashboard-muted">List a rental, confirm its location and start receiving visit requests.</p>
                        </div>
                        <button type="button" class="dashboard-primary-action" id="ownerAddPropertyBtn">＋ Add Property</button>
                    </div>
                    <div class="dashboard-card owner-quick-card gdr-owner-entry-card gdr-current-renters-entry">
                        <div>
                            <span class="dashboard-section-kicker">TENANCY MANAGEMENT</span>
                            <h3>Current Renters</h3>
                            <p class="dashboard-muted">Manage active tenants, rental details and monthly rent records.</p>
                        </div>
                        <button type="button" class="gdr-current-renters-open" id="ownerCurrentRentersBtn">
                            <span class="gdr-current-renters-open-icon" aria-hidden="true">♙</span>
                            <span>Current Renters</span>
                            <span class="gdr-current-renters-open-arrow" aria-hidden="true">→</span>
                        </button>
                    </div>
                </div>''',
    "replace owner Nearby shortcut with Current Renters dashboard entry"
)

# Load the standalone Current Renters dashboard controller after the existing
# renter profile controller; no map or renter-side Find Home scripts are removed.
if 'gdr-owner-current-renters-dashboard.js' not in source:
    script_tag = '<script src="/assets/gdr-owner-current-renters-dashboard.js" defer></script>' + chr(10)
    if "</body>" not in source:
        raise SystemExit("Stopped safely: </body> not found for Current Renters dashboard loader")
    source = source.replace("</body>", script_tag + "</body>", 1)
    print("Added Current Renters dashboard controller.")

# Clean up the literal backslash-n emitted by the first idempotent insertion.
# Keep this repair safe for deployments where the loader is already present.
if chr(92) + "n</body>" in source:
    source = source.replace(chr(92) + "n</body>", chr(10) + "</body>", 1)
    print("Cleaned Current Renters loader closing markup.")

# Remove any earlier owner Saved Properties toggle loader and replace it with
# a scoped cleanup controller. Renter-side saved/favourites functionality is untouched.
source = source.replace('<script src="/assets/gdr-owner-saved-properties-toggle.js" defer></script>' + chr(10), "")
if 'gdr-owner-saved-properties-cleanup.js' not in source:
    tag = '<script src="/assets/gdr-owner-saved-properties-cleanup.js" defer></script>' + chr(10)
    if "</body>" not in source:
        raise SystemExit("Stopped safely: </body> not found for owner Saved Properties cleanup")
    source = source.replace("</body>", tag + "</body>", 1)
    print("Added owner Saved Properties cleanup controller.")

# Load the cache-busted Owner Command Center hotfix. The versioned filename
# guarantees Cloudflare publishes the corrected observer guard instead of serving
# a previously cached dashboard controller.
source = source.replace(
    '<script src="/assets/gdr-owner-command-center.js" defer></script>',
    '<script src="/assets/gdr-owner-command-center-hotfix.js" defer></script>'
)
if 'gdr-owner-command-center-hotfix.js' not in source:
    command_center_tag = '<script src="/assets/gdr-owner-command-center-hotfix.js" defer></script>' + chr(10)
    if "</body>" not in source:
        raise SystemExit("Stopped safely: </body> not found for Owner Command Center hotfix loader")
    source = source.replace("</body>", command_center_tag + "</body>", 1)
    print("Added cache-busted Owner Command Center hotfix controller.")

path.write_text(source, encoding="utf-8")
print("Updated index.html successfully.")

