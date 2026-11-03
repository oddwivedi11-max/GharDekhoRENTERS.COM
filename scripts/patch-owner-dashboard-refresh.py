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

path.write_text(source, encoding="utf-8")
print("Updated index.html successfully.")
