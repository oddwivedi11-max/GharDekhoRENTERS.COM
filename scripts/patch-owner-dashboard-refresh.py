from pathlib import Path

path = Path("index.html")
source = path.read_text(encoding="utf-8")

def replace_once(old, new, label):
    global source
    if new in source:
        print(f"Already applied: {label}")
        return
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"Stopped safely for {label}: expected 1 match, found {count}")
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

path.write_text(source, encoding="utf-8")
print("Updated index.html successfully.")
