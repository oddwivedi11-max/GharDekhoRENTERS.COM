const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const html = read("index.html");
const studio = read("assets/gdr-property-studio.js");
const studioMarkup = read("assets/gdr-property-studio.txt");
const studioCss = read("assets/gdr-property-studio.css");
const migration = read("supabase/migrations/20261106195955_owner_property_studio.sql");
const patcher = read("scripts/patch-property-studio.py");

test("List Your Property is the first major owner dashboard action before statistics", () => {
  const hero = html.indexOf('id="gdrListPropertyHero"');
  const firstStat = html.indexOf('class="dashboard-stat-card owner-stat-card');
  assert.notEqual(hero, -1);
  assert.notEqual(firstStat, -1);
  assert.ok(hero < firstStat);
  assert.match(html, /id="gdrListPropertyStart"/);
  const heroEnd = html.indexOf("</section>", hero);
  const heroMarkup = html.slice(hero, heroEnd);
  assert.doesNotMatch(heroMarkup, /id="gdrListPropertySpeak"/);
  assert.match(studioMarkup, /Manual entry is the primary option/);
  assert.ok(studioMarkup.indexOf('class="gdr-studio-voice"') > studioMarkup.indexOf('data-gdr-studio-panel="4"'));
});

test("dashboard role switch is removed while role choice remains at login", () => {
  assert.doesNotMatch(html, /id="dashboardRoleSwitch"/);
  assert.doesNotMatch(html, /data-role-switch=/);
  assert.doesNotMatch(html, /ghardekho-final-role-switch-v11/);
  assert.match(html, /gd-owner-choice/);
  assert.match(html, /gd-renter-choice/);
  assert.match(html, /openLoginAs\("owner"\)/);
  assert.match(html, /openLoginAs\("renter"\)/);
});

test("cross-role access requires sign-out and a fresh role-guarded login", () => {
  const start = html.indexOf("async function switchAccountRole(role)");
  const end = html.indexOf("\nfunction updateDashboardRoleSwitcher()", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const fn = html.slice(start, end);
  assert.match(fn, /await saveActiveAccountRole\(target\)/);
  assert.match(fn, /await supabaseClient\.auth\.signOut\(\)/);
  assert.match(fn, /window\.location\.reload\(\)/);
  assert.doesNotMatch(fn, /activeRole\s*=\s*target/);
  assert.doesNotMatch(fn, /renderActiveDashboard\(\)/);
  assert.match(html, /activeRole === "owner" && roles\.includes\("owner"\)/);
  assert.match(html, /activeRole === "renter" && roles\.includes\("renter"\)/);
});

test("Property Studio is a separate guided page with the required simple listing fields", () => {
  assert.match(html, /gdrPropertyStudioMount/);
  for (const token of [
    "gdrStudioStepTitle", "gdrStudioRent",
    "gdrStudioDeposit", "gdrStudioFurnishing", "gdrStudioLocation", "gdrStudioUseGps",
    "gdrStudioOpenMap", "gdrStudioPhotoFiles", "gdrStudioCameraFiles",
    "gdrStudioVoiceStart", "gdrStudioPublish"
  ]) assert.ok(studioMarkup.includes(token), token);
  for (const type of ["apartment", "room", "independent_house", "villa", "pg", "hostel", "other"]) {
    assert.ok(studioMarkup.includes('data-gdr-property-type="' + type + '"'), type);
  }
  for (const configuration of ["1 RK", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "5+ BHK"]) {
    assert.ok(studioMarkup.includes('data-gdr-configuration="' + configuration + '"'), configuration);
  }
});

test("Room is a distinct supported property type without changing the existing listing workflow", () => {
  const roomMigration = read("supabase/migrations/20261107130000_add_room_property_type.sql");
  assert.match(roomMigration, /properties_property_type_check/);
  assert.match(roomMigration, /'room'/);
  assert.match(roomMigration, /owner_publish_property_studio/);
  assert.match(studio, /propertyType==="room"\?null/);
});

test("Property Studio starts each new listing blank and uses the secure publish RPC", () => {
  assert.ok(studio.includes("function resetNewListing(preserveDraft)"));
  assert.ok(studio.includes("function clearLegacyDraft()"));
  assert.ok(studio.includes("function restoreDraft()"));
  assert.ok(studio.includes("localStorage.setItem(draftKey(),JSON.stringify(payload))"));
  assert.ok(studio.includes("payload.ownerId!==state.user.id"));
  assert.ok(studio.includes("state.locationConfirmed=false"));
  assert.ok(studio.includes('storage.from("property-images").upload'));
  assert.ok(studio.includes("owner_publish_property_studio"));
  assert.ok(studio.includes("p_submission_id"));
  assert.ok(studio.includes("p_photo_urls"));
  assert.ok(studio.includes("p_furnishing:state.furnishing||null"));
  assert.ok(studio.includes("SpeechRecognition"));
  assert.ok(studio.includes("GDRMapExperience.openOwnerMapPicker"));
  assert.ok(studio.includes("overpass-api.de/api/interpreter"));
  assert.ok(studio.includes("distanceMeters(lat,lng,placeLat,placeLng)"));
  assert.ok(studio.includes("Please review and correct every field before continuing"));
});

test("Property Studio drafts never persist address, PIN or precise coordinates",()=>{
  const saveStart=studio.indexOf("function saveDraft(){");
  const restoreStart=studio.indexOf("function restoreDraft(){",saveStart);
  const dismissStart=studio.indexOf("function dismissDraftRecovery(){",restoreStart);
  assert.ok(saveStart>=0&&restoreStart>saveStart&&dismissStart>restoreStart);
  const save=studio.slice(saveStart,restoreStart);
  const restore=studio.slice(restoreStart,dismissStart);
  assert.match(save,/version:3/);
  assert.doesNotMatch(save,/address:state\.address|pincode:state\.pincode|lat:state\.lat|lng:state\.lng/);
  assert.match(restore,/payload\.version!==3/);
  assert.match(restore,/clearLegacyDraft\(\);dismissDraftRecovery\(\);return false/);
  assert.match(restore,/state\.address="";state\.pincode="";state\.lat=null;state\.lng=null;state\.locationConfirmed=false/);
  assert.match(restore,/savedStep>=2\?2:savedStep/);
});
 
test("Studio layout is loaded from a separately deployed text fragment asset", () => {
  assert.match(studio, /gdr-property-studio\.txt\?v=\"\+VERSION/);
  assert.match(studio, /const VERSION="20261110-review-panel-markup1"/);
  assert.ok(read("assets/gdr-property-studio.txt").includes('<section class="gdr-studio-panel" data-gdr-studio-panel="4" hidden>'));
  assert.doesNotMatch(read("assets/gdr-property-studio.txt"), /^\s*data-gdr-studio-panel="4" hidden>/m);
  assert.match(read("assets/gdr-property-studio.txt"), /gdrStudioPhotoFiles/);
  assert.match(read("assets/gdr-property-studio.txt"), /gdrStudioFurnishing/);
});

test("renter preview shows actual nearby place names, categories and distances", () => {
  assert.match(studio, /state\.nearbyPlaces\.slice\(0,8\)/);
  assert.match(studio, /escapeHtml\(place\.name/);
  assert.match(studio, /distanceLabel\(place\.distance_m\)/);
  assert.ok(studio.includes("showSuggestions(india);"));
});

test("Property Studio uses only free Photon, Leaflet and OpenStreetMap nearby discovery", () => {
  assert.match(studio, /photon\.komoot\.io/);
  assert.match(studio, /GDRMapExperience\.openOwnerMapPicker/);
  assert.match(studio, /overpass-api\.de\/api\/interpreter/);
  assert.match(studio, /out center tags/);
  assert.match(studio, /gdr_osm_nearby_v1/);
  assert.match(studio, /86400000/);
  assert.match(studio, /nearbyController\.abort\(\)/);
  assert.match(studio, /cached\.places\.filter/);
  assert.match(studio, /distance_m:Math\.round\(distanceMeters/);
  assert.match(studioMarkup, /© OpenStreetMap contributors/);
  assert.match(read("assets/gdr-property-studio.txt"), /© OpenStreetMap contributors/);
  assert.match(studio, /distanceMeters\(lat,lng,placeLat,placeLng\)/);
  assert.doesNotMatch(studio, /google\.maps|PlacesService|GDR_GOOGLE_MAPS_API_KEY|gdr-google-maps-api-key/i);
  assert.match(studioMarkup, /gdrStudioNearbyStatus/);
});

test("production migration adds only listing metadata and an authenticated owner-scoped publish RPC", () => {
  for (const column of ["property_type", "configuration", "security_deposit", "pincode", "photo_urls", "nearby_places", "studio_submission_id"]) {
    assert.match(migration, new RegExp("add column if not exists " + column));
  }
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /public\.owner_add_property/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/i);
  assert.match(migration, /from public, anon/i);
  assert.doesNotMatch(migration, /drop table|truncate|delete from public\.properties/i);
});

test("local property placeholder and responsive Studio styles are present", () => {
  assert.match(html, /gdr-property-placeholder\.svg/);
  assert.match(html, /property\.property_type === "apartment"/);
  assert.match(studioCss, /@media\(max-width:760px\)/);
  assert.match(studioCss, /gdr-studio-photo-remove/);
  assert.match(studioCss, /gdr-property-nearby-public/);
  assert.match(studioCss, /gdr-moveout-notice/);
  assert.match(patcher, /gdrListPropertyHero/);
});

test("Owner profile editing is available from the Owner Dashboard and uses the existing secure save flow", () => {
  assert.match(html, /id="ownerEditProfileBtn">✏️ Edit Profile<\/button>/);
  assert.match(html, /id="ownerProfileEditor"/);
  assert.match(html, /id="ownerProfileForm"/);
  assert.match(html, /rpc\("update_my_owner_profile"/);
  assert.match(html, /addEventListener\("submit", saveOwnerProfile\)/);
  assert.match(html, /addEventListener\("click", openOwnerProfileEditor\)/);
  assert.match(read("assets/gdr-property-studio.css"), /#ownerDashboard \.owner-profile-card #ownerEditProfileBtn/);
});

test("Manual form Next and final Submit are separate from GDR voice Continue",()=>{
  const markup=read("assets/gdr-property-studio.txt");
  const manualNav=markup.indexOf('class="gdr-studio-form-navigation"');
  const voice=markup.indexOf('class="gdr-studio-voice"');
  const assistantFooter=markup.indexOf('data-gdr-studio-assistant-footer');
  assert.ok(manualNav>=0 && manualNav<voice && voice<assistantFooter);
  assert.match(markup,/id="gdrStudioFormNext"/);
  assert.match(markup,/Submit Your Property/);
  assert.match(markup,/id="gdrStudioNext">Continue →/);
  assert.match(studio,/gdrStudioFormNext/);
  assert.match(studio,/assistantNext/);
  assert.match(studio,/Submit Your Property/);
});

test("New listing fields are blanked and browser autocomplete is disabled",()=>{
  assert.ok(studio.includes('setAttribute("autocomplete","off")'));
  assert.ok(studio.includes('state.rent="";state.deposit=""'));
  assert.ok(studio.includes('state.address="";state.pincode=""'));
  assert.ok(read("assets/gdr-property-studio.txt").includes('id="gdrStudioRent" type="number" autocomplete="off"'));
  assert.ok(read("assets/gdr-property-studio.txt").includes('id="gdrStudioPincode" type="text" autocomplete="off"'));
  for (const id of ["gdrStudioRent","gdrStudioDeposit","gdrStudioLocation","gdrStudioPincode"]) {
    const input = read("assets/gdr-property-studio.txt").match(new RegExp('id="'+id+'"[^>]*'));
    assert.ok(input, id + " input exists");
    assert.equal((input[0].match(/autocomplete="off"/g)||[]).length, 1, id + " has one autocomplete policy");
  }
});
test("Returning from a successful listing refreshes Owner Dashboard without reload or sign-out",()=>{
  assert.ok(studio.includes("async function returnToOwnerDashboard(scrollToProperties)"));
  assert.ok(studio.includes("window.renderActiveDashboard()"));
  assert.ok(studio.includes("returnToOwnerDashboard(true)"));
  assert.ok(studio.includes("returnToOwnerDashboard(false)"));
  assert.ok(!studio.includes("window.location.reload()"));
  assert.ok(!studio.includes("auth.signOut"));
});

test("owner photo gallery offers Exterior, Interior and Other categories",()=>{
 for(const category of ["exterior","interior"])assert.ok(studioMarkup.includes('data-gdr-studio-photo-upload="'+category+'"'),category);
 assert.match(studioMarkup,/Both categories are optional/);
 assert.match(studioMarkup,/No category has a minimum requirement/);
 assert.ok(studio.includes('file.gdrCategory=["exterior","interior","other"].includes(state.photoCategory)?state.photoCategory:"exterior"'));
 assert.ok(studio.includes('state.user.id+"/"+category+"/"+uuid()'));
});
test("owner photo uploads use bounded parallel batches and preserve cover-first ordering",()=>{
 assert.ok(studio.includes("for(let start=0;start<pending.length;start+=3)"));
 assert.ok(studio.includes("await Promise.allSettled(batch.map"));
 assert.ok(studio.includes("const combined=existing.concat(newUploads)"));
 assert.ok(studio.includes("state.uploadedPaths=ordered.map(photo=>photo.path)"));
 assert.ok(studio.includes('c.storage.from("property-images").remove(newPaths)'));
 assert.ok(studio.includes("current+incoming.length>8"));
});

test("Owner Property Studio assets are loaded once and deployment patcher keeps the same cache versions",()=>{
 assert.equal(html.split("gdr-property-studio.js").length-1,1);
 assert.ok(html.includes("gdr-property-studio.css") || patcher.includes("css_ref_v6"));
 assert.match(patcher,/if css_ref_v6 not in source:/);
 assert.match(patcher,/Normalized Property Studio controller include to exactly one script tag/);
 assert.match(patcher,/gdr-property-studio\.js\?v=20261110-review-panel-markup1/);
 assert.match(patcher,/gdr-property-studio\.css\?v=20261111-profile-nearby-scroll1/);
 assert.match(patcher,/20261109-start-listing-resetfix2/);
 assert.match(patcher,/20261109-start-listing-clickfix1/);
 assert.match(patcher,/20261109-gallery-batch1/);
 assert.match(patcher,/20261109-gallery-categories1/);
});

test("Start Listing opens only from a visible Owner Dashboard and verifies the authenticated owner", () => {
  assert.match(studio, /const dashboardVisible=!!dash&&!dash\.hidden&&!!dashStyle&&dashStyle\.display!=="none"&&dashStyle\.visibility!=="hidden"&&!!dashRect&&dashRect\.width>0&&dashRect\.height>0/);
  assert.doesNotMatch(studio, /getAttribute\("aria-hidden"\)!=="true"/);
  assert.match(studio, /function showLauncherFeedback\(text,tone\)/);
  assert.match(studio, /state\.opening=false/);
  assert.match(studio, /const account=await getOwner\(\);state\.user=account\.user;state\.owner=account\.owner/);
  assert.match(studio, /__gdrListPropertyLauncherBound/);
  assert.match(studio, /window\.addEventListener\("click",function\(event\)\{/);
  assert.match(studio, /closest\(selector\)/);
  assert.match(studio, /stopImmediatePropagation\(\)/);
  assert.match(studio, /Opening Property Studio…/);
  assert.match(studio, /setAttribute\("aria-busy","true"\)/);
  assert.match(studio, /if\(state\.publishing\|\|state\.opening\)return false/);
  assert.doesNotMatch(studio, /(?<!\$)\$\([^)]*\)\.forEach/);
  assert.match(studio, /\$\$\("\[data-gdr-photo-category\]"\)\.forEach/);
  assert.match(html, /id="gdrListPropertyStart"/);
});

test("Recovered draft is owner-scoped and restored coordinates require a new exact pin",()=>{
  assert.match(studio,/payload\.ownerId!==state\.user\.id/);
  assert.match(studio,/Date\.now\(\)-savedAt>14\*86400000/);
  assert.match(studio,/state\.locationConfirmed=false/);
  assert.match(studio,/photo\.path\.startsWith\(state\.user\.id\+"\/"\)/);
  assert.match(studio,/photo\.url\.startsWith\(publicPrefix\)/);
  assert.match(studio,/gdrStudioDraftRecovery/);
  assert.match(studio,/dismissDraftRecovery/);
  assert.match(studio,/resetNewListing\(true\)/);
});
test("Interior and Exterior photo groups are optional and share the eight-photo cap",()=>{
  assert.match(studioMarkup,/Exterior Photos/);
  assert.match(studioMarkup,/Interior Photos/);
  assert.match(studioMarkup,/data-gdr-studio-photo-upload="exterior"/);
  assert.match(studioMarkup,/data-gdr-studio-photo-upload="interior"/);
  assert.match(studio,/function photoEntries\(\)/);
  assert.match(studio,/function movePhotoWithinCategory\(/);
  assert.match(studio,/Choose up to 8 photos across both categories/);
  assert.match(studio,/file\.gdrCategory/);
});
test("Adding new images preserves previously uploaded property photos",()=>{
  assert.match(studio,/const existing=state\.uploadedPhotos\.slice\(\)/);
  assert.match(studio,/const combined=existing\.concat\(newUploads\)/);
  assert.match(studio,/state\.uploadedPhotos=existing;state\.uploadedPaths=existing\.map\(photo=>photo\.path\)/);
});

test("Owner Analytics uses scoped production tables and derives payment renter names from occupancy",()=>{
  const ownerWorkspace=read("assets/gdr-owner-command-center-hotfix.js");
  assert.match(ownerWorkspace,/async function fetchOwnerInsights\(force\)/);
  assert.equal((ownerWorkspace.match(/\.eq\("owner_id",insightOwnerId\)/g)||[]).length,6);
  assert.match(ownerWorkspace,/from\("properties"\)/);
  assert.match(ownerWorkspace,/from\("property_occupancies"\)/);
  assert.match(ownerWorkspace,/from\("visit_requests"\)/);
  assert.match(ownerWorkspace,/from\("rent_payment_records"\)/);
  assert.match(ownerWorkspace,/from\("owner_payment_settings"\)/);
  assert.match(ownerWorkspace,/from\("occupancy_charges"\)/);
  assert.doesNotMatch(ownerWorkspace,/from\("rent_payment_records"\)\.select\([^)]*renter_name/);
  assert.match(ownerWorkspace,/const renterForPayment=payment=>data\.occupancies\.find/);
  assert.match(ownerWorkspace,/data\.notifications=buildOwnerNotifications\(data\)/);
  assert.match(ownerWorkspace,/function notificationsMarkup\(data\)/);
  assert.match(ownerWorkspace,/data-insight-read/);
  assert.match(ownerWorkspace,/data-insight-dismiss/);
  assert.match(ownerWorkspace,/gdr_owner_notice_state_v1:/);
});
