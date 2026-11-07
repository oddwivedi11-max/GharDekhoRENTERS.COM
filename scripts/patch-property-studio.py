from pathlib import Path
import re

path = Path("index.html")
source = path.read_text(encoding="utf-8")

def replace_once(old, new, label):
    global source
    if new in source:
        print("Already applied: " + label)
        return
    count = source.count(old)
    if count != 1:
        raise SystemExit("Stopped safely for " + label + ": expected one match, found " + str(count))
    source = source.replace(old, new, 1)
    print("Applied: " + label)

def replace_regex(pattern, replacement, label):
    global source
    source, count = re.subn(pattern, replacement, source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit("Stopped safely for " + label + ": expected one match, found " + str(count))
    print("Applied: " + label)

def replace_once_in_region(start_anchor, end_anchor, old, new, label):
    global source
    start = source.find(start_anchor)
    end = source.find(end_anchor, start + len(start_anchor))
    if start < 0 or end < 0:
        raise SystemExit("Stopped safely for " + label + ": function region was not found")
    region = source[start:end]
    if new in region:
        print("Already applied: " + label)
        return
    count = region.count(old)
    if count != 1:
        raise SystemExit("Stopped safely for " + label + ": expected one match in target function, found " + str(count))
    region = region.replace(old, new, 1)
    source = source[:start] + region + source[end:]
    print("Applied: " + label)

source, switch_count = re.subn(r'<div class="dashboard-role-switch" id="dashboardRoleSwitch"[^>]*>.*?</div>', "", source, count=1, flags=re.S)
if switch_count:
    print("Removed Owner/Renter dashboard switch UI.")

switch_new = '''async function switchAccountRole(role) {
    const target = role === "owner" ? "owner" : "renter";
    if (!currentUser || !currentProfile) {
        showMessage("backendMessage", "Please sign in before choosing a portal.", "error");
        return false;
    }
    const availableRoles = getAccountRoles(currentProfile);
    const explicitOwnerRequest = target === "owner" && activeRole === "renter" && !!document.getElementById("renterBecomeOwnerBtn");
    if (!availableRoles.includes(target) && !explicitOwnerRequest) {
        showMessage("backendMessage", "This account is not enabled for that portal.", "error");
        return false;
    }
    if (!availableRoles.includes(target)) {
        const saved = await saveActiveAccountRole(target);
        if (!saved) {
            showMessage("backendMessage", "Owner access could not be enabled. Your Renter account is unchanged.", "error");
            return false;
        }
    }
    // Never switch dashboards in the same authenticated session. Re-authenticate
    // and let the existing login role guard open exactly one portal.
    sessionStorage.setItem("gd_active_role", target);
    sessionStorage.setItem("gd_pending_login_role", target);
    localStorage.setItem("gd_preferred_role", target);
    await supabaseClient.auth.signOut();
    window.location.reload();
    return true;
}
function updateDashboardRoleSwitcher'''
if switch_new not in source:
    replace_regex(r'async function switchAccountRole\(role\)\s*\{.*?\n\}\s*\nfunction updateDashboardRoleSwitcher', switch_new, "disable in-session account switching")

update_new = '''function updateDashboardRoleSwitcher() {
    const switcher = document.getElementById("dashboardRoleSwitch");
    if (switcher) {
        switcher.hidden = true;
        switcher.style.display = "none";
        switcher.querySelectorAll("[data-role-switch]").forEach(button => {
            button.disabled = true;
            button.hidden = true;
        });
    }
}
function setRoleSpecificUI'''
if update_new not in source:
    replace_regex(r'function updateDashboardRoleSwitcher\(\)\s*\{.*?\n\}\s*\nfunction setRoleSpecificUI', update_new, "hide legacy dashboard role switcher")

source, _ = re.subn(r'<script id="ghardekho-final-role-switch-v11">.*?</script>', "", source, flags=re.S)
source, _ = re.subn(r'<script id="ghardekho-dual-role-v1-js">.*?</script>', "", source, flags=re.S)

replace_once(
'''function getDefaultPropertyImage() {
            return "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80";
        }''',
'''function getDefaultPropertyImage() {
            return "/assets/gdr-property-placeholder.svg";
        }''',
"replace stock fallback with local placeholder"
)

hero = '''<section id="gdrListPropertyHero" aria-labelledby="gdrListPropertyHeading">
  <div class="gdr-list-hero-copy">
    <span class="gdr-list-eyebrow">✦ YOUR NEXT LISTING STARTS HERE</span>
    <h2 id="gdrListPropertyHeading">List Your Property</h2>
    <p>Your property deserves the right tenants. List it in just a few simple steps.</p>
    <div class="gdr-list-hero-actions">
      <button type="button" id="gdrListPropertyStart">＋ Start Listing</button>
      <button type="button" id="gdrListPropertySpeak">♬ List by Speaking</button>
    </div>
  </div>
  <div class="gdr-list-hero-art"><img src="/assets/gdr-list-property-hero.svg" alt="Illustration of a premium rental home" loading="lazy"></div>
</section>
'''
owner_open = '<section id="ownerDashboard" class="dashboard-section owner-dashboard" aria-label="Owner dashboard">'
if 'id="gdrListPropertyHero"' not in source:
    replace_once(owner_open, owner_open + "\n" + hero, "place List Your Property before owner statistics")

if 'id="gdrPropertyStudioMount"' not in source:
    body_pos = source.rfind("</body>")
    if body_pos < 0:
        raise SystemExit("Stopped safely: closing body tag missing.")
    source = source[:body_pos] + '<div id="gdrPropertyStudioMount"></div>\n' + source[body_pos:]

css_ref_v1 = '<link rel="stylesheet" href="/assets/gdr-property-studio.css?v=20261107-studio1">'
css_ref_v2 = '<link rel="stylesheet" href="/assets/gdr-property-studio.css?v=20261107-studio2">'
css_ref_v3 = '<link rel="stylesheet" href="/assets/gdr-property-studio.css?v=20261107-studio3">'
css_ref_v4 = '<link rel="stylesheet" href="/assets/gdr-property-studio.css?v=20261107-voiceassistant2">'
if css_ref_v4 not in source:
    if css_ref_v3 in source:
        source = source.replace(css_ref_v3, css_ref_v4, 1)
        print("Updated: refresh conversational Property Studio voice styles")
    elif css_ref_v2 in source:
        source = source.replace(css_ref_v2, css_ref_v4, 1)
        print("Updated: refresh Property Studio nearby preview styles")
    elif css_ref_v1 in source:
        source = source.replace(css_ref_v1, css_ref_v4, 1)
        print("Updated: refresh Property Studio and renter notice stylesheet")
    else:
        head_pos = source.rfind("</head>")
        if head_pos < 0:
            raise SystemExit("Stopped safely: closing head tag missing.")
        source = source[:head_pos] + css_ref_v4 + "\n" + source[head_pos:]

renter_js_old = '<script src="/assets/gdr-rental-suite.js?v=20261107-moveout3"></script>'
renter_js_old2 = '<script src="/assets/gdr-rental-suite.js?v=20261107-moveout2"></script>'
renter_js_new = '<script src="/assets/gdr-rental-suite-v2.js?v=20261107-moveout-v2"></script>'
if renter_js_new not in source:
    if renter_js_old in source:
        source = source.replace(renter_js_old, renter_js_new, 1)
        print("Updated: switch renter move-out controller to a fresh asset path")
    elif renter_js_old2 in source:
        source = source.replace(renter_js_old2, renter_js_new, 1)
        print("Updated: switch renter move-out controller to a fresh asset path")
    elif 'src="/assets/gdr-rental-suite-v2.js' in source:
        print("Already applied: renter move-out controller uses the v2 asset path")
    else:
        replace_once(
            '<script src="/assets/gdr-rental-suite.js"></script>',
            renter_js_new,
            "switch renter move-out controller to a fresh asset path"
        )
renter_css_variants = [
    '<link rel="stylesheet" href="/assets/gdr-rental-suite-v2.css?v=20261107-moveout-v2">',
    '<link rel="stylesheet" href="/assets/gdr-rental-suite.css?v=20261107-moveout3">',
    '<link rel="stylesheet" href="/assets/gdr-rental-suite.css?v=20261107-moveout2">',
    '<link rel="stylesheet" href="/assets/gdr-rental-suite.css?v=20261107-moveout1">'
]
renter_css_original = '<link rel="stylesheet" href="/assets/gdr-rental-suite.css">'
if renter_css_original not in source:
    for old_css_ref in renter_css_variants:
        if old_css_ref in source:
            source = source.replace(old_css_ref, renter_css_original, 1)
            print("Updated: use the existing renter dashboard stylesheet plus verified Studio styles")
            break
    else:
        raise SystemExit("Stopped safely: renter dashboard stylesheet reference could not be resolved.")
source = source.replace("● Soon available", "● Vacating Soon")
source = source.replace("● Soon Available", "● Vacating Soon")
source = source.replace('"Soon Available"', '"Vacating Soon"')
source = source.replace('"Soon available"', '"Vacating Soon"')

script_ref = '<script src="/assets/gdr-property-studio.js?v=20261107-voiceassistant5" defer></script>'
old_script_ref = '<script src="/assets/gdr-property-studio.js?v=20261107-studio6" defer></script>'
if script_ref not in source:
    if old_script_ref in source:
        source = source.replace(old_script_ref, script_ref, 1)
        print("Updated: refresh Property Studio controller asset")
    else:
        body_pos = source.rfind("</body>")
        if body_pos < 0:
            raise SystemExit("Stopped safely: closing body tag missing.")
        source = source[:body_pos] + script_ref + "\n" + source[body_pos:]

enrichment = '''            // Enrich map/Nearby result rows with renter-safe Property Studio fields.
            if (property && (!Array.isArray(property.photo_urls) || !Object.prototype.hasOwnProperty.call(property, "nearby_places"))) {
                const { data: studioRows, error: studioRowsError } = await supabaseClient.rpc("get_public_properties");
                if (!studioRowsError && Array.isArray(studioRows)) {
                    const enriched = studioRows.find(item => String(item.id) === propertyId);
                    if (enriched) property = { ...property, ...enriched };
                }
            }
            currentProperty = property;'''
replace_once("\n            currentProperty = property;", "\n" + enrichment, "enrich renter property details")

image_var = '''            const image = property.image_url || getDefaultPropertyImage();'''
image_var_new = '''            const photos = Array.isArray(property.photo_urls) && property.photo_urls.length
                ? property.photo_urls.filter(Boolean)
                : (property.image_url ? [property.image_url] : []);
            const image = photos[0] || property.image_url || getDefaultPropertyImage();
            const photoGalleryHtml = photos.length > 1
                ? '<div class="gdr-property-detail-thumbs">' + photos.slice(1, 8).map((url, index) =>
                    '<button type="button" data-gdr-gallery-src="' + escapeHtml(url) + '" aria-label="View property photo ' + (index + 2) + '"><img src="' + escapeHtml(url) + '" alt="Property photo ' + (index + 2) + '" loading="lazy"></button>'
                  ).join("") + '</div>'
                : "";'''
replace_once_in_region(
    "async function openPropertyDetails(propertyId) {",
    "\n        function openVisitForm()",
    image_var,
    image_var_new,
    "read multiple uploaded property photos"
)

dollar = chr(36)
old_img = '''                    <img
                        class="property-detail-image"
                        src="__DOLLAR__{escapeHtml(image)}"
                        alt="__DOLLAR__{escapeHtml(property.title || "Rental property")}"
                        loading="lazy"
                        onerror="this.src='__DOLLAR__{getDefaultPropertyImage()}'"
                    >'''.replace("__DOLLAR__", dollar)
new_img = '''                    <div class="gdr-property-detail-gallery">
                      <img class="property-detail-image" id="gdrPropertyDetailMainImage" src="__DOLLAR__{escapeHtml(image)}" alt="__DOLLAR__{escapeHtml(property.title || "Rental property")}" loading="lazy" onerror="this.src='__DOLLAR__{getDefaultPropertyImage()}'">
                      __DOLLAR__{photoGalleryHtml}
                    </div>'''.replace("__DOLLAR__", dollar)
replace_once(old_img, new_img, "render renter-facing property photo gallery")

stay_type_old = '''<span class="detail-meta-value">__DOLLAR__{property.listing_type === "pg" ? "🛏️ PG" : property.listing_type === "hostel" ? "🏫 Hostel" : "🏠 Home"}</span>'''.replace("__DOLLAR__", dollar)
stay_type_new = '''<span class="detail-meta-value">__DOLLAR__{property.property_type === "apartment" ? "Apartment / Flat" : property.property_type === "independent_house" ? "Independent House" : property.property_type === "villa" ? "Villa" : property.property_type === "other" ? "Other" : property.listing_type === "pg" ? "🛏️ PG" : property.listing_type === "hostel" ? "🏫 Hostel" : "🏠 Home"}</span>'''.replace("__DOLLAR__", dollar)
replace_once(stay_type_old, stay_type_new, "show exact property type to renters")

config_old = '''<span class="detail-meta-value">__DOLLAR__{property.listing_type === "home" || !property.listing_type ? escapeHtml(property.bhk || "-") + " BHK" : escapeHtml(property.room_type || "Shared stay")}</span>'''.replace("__DOLLAR__", dollar)
config_new = '''<span class="detail-meta-value">__DOLLAR__{property.listing_type === "home" || !property.listing_type ? escapeHtml(property.configuration || (property.bhk ? property.bhk + " BHK" : "-")) : escapeHtml(property.room_type || "Shared stay")}</span>'''.replace("__DOLLAR__", dollar)
replace_once(config_old, config_new, "display 1 RK and exact configuration")

deposit_old = '''                            <div class="detail-meta-item">
                                <span class="detail-meta-label">Status</span>
                                <span class="detail-meta-value">__DOLLAR__{statusHtml}</span>
                            </div>'''.replace("__DOLLAR__", dollar)
deposit_new = '''                            <div class="detail-meta-item">
                                <span class="detail-meta-label">Security deposit</span>
                                <span class="detail-meta-value">__DOLLAR__{property.security_deposit !== null && property.security_deposit !== undefined ? "₹" + Number(property.security_deposit).toLocaleString("en-IN") : "Not specified"}</span>
                            </div>
                            <div class="detail-meta-item">
                                <span class="detail-meta-label">Status</span>
                                <span class="detail-meta-value">__DOLLAR__{statusHtml}</span>
                            </div>'''.replace("__DOLLAR__", dollar)
replace_once(deposit_old, deposit_new, "show security deposit to renters")

about_old = '''                        <h3>About this property</h3>
                        <p>__DOLLAR__{escapeHtml(property.description || "No description provided.")}</p>'''.replace("__DOLLAR__", dollar)
nearby_new = '''                        <h3>About this property</h3>
                        <p>__DOLLAR__{escapeHtml(property.description || "No description provided.")}</p>

                        __DOLLAR__{Array.isArray(property.nearby_places) && property.nearby_places.length ? (
                          '<section class="gdr-property-nearby-public" aria-label="Nearby public places"><h3>Nearby places</h3><div class="gdr-property-nearby-grid">' +
                          property.nearby_places.slice(0,30).map(place =>
                            '<div class="gdr-property-nearby-item"><span><strong>' + escapeHtml(place.name || "Nearby place") + '</strong><small>' + escapeHtml(place.category || "Public place") + '</small></span><b>' +
                            (Number(place.distance_m) < 1000 ? Math.round(Number(place.distance_m)) + " m" : (Number(place.distance_m)/1000).toFixed(1) + " km") +
                            '</b></div>'
                          ).join("") + '</div></section>'
                        ) : ""}'''.replace("__DOLLAR__", dollar)
replace_once(about_old, nearby_new, "display Google Places results on renter details")

details_old = '''            details.style.display = "block";'''
details_new = '''            details.style.display = "block";
            content.querySelectorAll("[data-gdr-gallery-src]").forEach(button => {
                button.addEventListener("click", () => {
                    const mainImage = document.getElementById("gdrPropertyDetailMainImage");
                    if (mainImage) mainImage.src = button.getAttribute("data-gdr-gallery-src");
                });
            });'''
replace_once(details_old, details_new, "bind renter property gallery thumbnails")

path.write_text(source, encoding="utf-8")
print("Updated index.html successfully with Property Studio, role isolation and renter-facing gallery.")
