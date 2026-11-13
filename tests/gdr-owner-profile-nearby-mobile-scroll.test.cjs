const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const rental=read("assets/gdr-rental-suite-v2.js");
const css=read("assets/gdr-property-studio.css");
const ownerCss=read("assets/gdr-owner-command-center.css");
const renterExperience=read("assets/gdr-renter-experience.js");
const html=read("index.html");
const workflow=read(".github/workflows/deploy-cloudflare.yml");

test("Nearby Properties is a separate dashboard action; Edit Profile stays in its original profile card",()=>{
 const start=rental.indexOf("function addOwnerNearbyAction(){");
 const end=rental.indexOf("\nfunction removeDuplicateReportButtons(){",start);
 assert.ok(start>=0&&end>start);
 const fn=rental.slice(start,end);
 assert.match(fn,/\.owner-dashboard-quick-grid/);
 assert.match(fn,/gdr-owner-nearby-entry/);
 assert.match(fn,/grid\.appendChild\(card\)/);
 assert.match(fn,/button\.parentElement!==card\)card\.appendChild\(button\)/);
 assert.match(fn,/openOwnerNearbyMap/);
 assert.match(fn,/button\.dataset\.gdrNearbyBound/);
 assert.doesNotMatch(fn,/owner-profile-card|gdr-owner-profile-actions|ownerEditProfileBtn|gdrOwnerReportProblem/);
 assert.doesNotMatch(fn,/insertBefore\(card/);
});

test("Duplicate Report a Problem controls are removed without removing Support or contact CTAs",()=>{
 assert.match(rental,/function removeDuplicateReportButtons\(\)/);
 assert.match(rental,/\["#renterDashboard","#ownerDashboard","#gdrPropertyStudio"\]/);
 assert.match(rental,/selector==="#ownerDashboard"/);
 assert.match(rental,/scope\.querySelectorAll\("#gdrxSupport"\)/);
 assert.match(rental,/target\.remove\(\)/);
 assert.match(rental,/control\.closest\("#gd-contact-section,\.gd-contact-section"\)/);
 assert.match(renterExperience,/function addSupport\(\)/);
 assert.match(renterExperience,/b\.id="gdrxSupport"/);
 assert.match(html,/Need help/);
 assert.match(html,/or want to get/);
 assert.doesNotMatch(rental,/gdrOwnerReportProblem.*mailto:|mailto:ghardekhorenters@gmail\.com/);
});

test("Owner Profile Edit Profile is not moved, removed, or expanded by the Nearby controller",()=>{
 assert.match(html,/id="ownerEditProfileBtn"/);
 assert.doesNotMatch(rental,/actions\.appendChild\(edit\)/);
 assert.doesNotMatch(rental,/ownerEditProfileBtn/);
 assert.doesNotMatch(css,/gdr-owner-profile-actions|gdrOwnerReportProblem/);
});

test("Owner property gallery and dashboard use native touch scrolling",()=>{
 assert.match(css,/\.gdr-property-detail-thumbs\{[^}]*overflow-x:auto/);
 assert.match(css,/\.gdr-property-detail-thumbs\{[^}]*touch-action:pan-x pan-y/);
 assert.match(css,/#gdrPropertyStudio \.gdr-studio-photo-grid\{[\s\S]*?overflow-x:auto!important/);
 assert.match(css,/#ownerDashboard #ownerPropertiesContainer\.owner-properties-grid\{[\s\S]*?overflow-x:auto!important/);
 assert.match(css,/scroll-snap-type:x mandatory/);
 assert.match(css,/touch-action:pan-x pan-y!important/);
 assert.match(css,/-webkit-overflow-scrolling:touch!important/);
});

test("Nearby Properties has a premium standalone dashboard action style",()=>{
 assert.match(ownerCss,/gdr-owner-nearby-entry/);
 assert.match(ownerCss,/gdr-owner-nearby-entry #gdrOwnerNearbyOpen/);
 assert.doesNotMatch(ownerCss,/gdr-owner-profile-actions/);
});

test("Deployment versions corrected owner/map/gallery assets and runs regression coverage",()=>{
 assert.match(workflow,/gdr-rental-suite-v2\.js", "20261113-owner-report-remove1"/);
 assert.match(workflow,/gdr-map-experience\.js", "20261112-pin-accuracy1"/);
 assert.match(workflow,/gdr-property-studio\.js", "20261112-owner-pin1"/);
 assert.match(workflow,/gdr-property-studio\.css", "20261112-touch-swipe1"/);
 assert.match(workflow,/gdr-owner-property-filters\.test\.cjs/);
 assert.match(workflow,/gdr-owner-profile-nearby-mobile-scroll\.test\.cjs/);
});

test("Owner home restores only the dedicated Nearby Properties action and keeps profile details collapsed until Edit Profile",()=>{
 assert.ok(ownerCss.includes("#ownerDashboard.gdr-owner-mode-home>.owner-dashboard-quick-grid{"));
 assert.ok(ownerCss.includes("display:grid!important;grid-template-columns:minmax(0,1fr)!important"));
 assert.ok(ownerCss.includes("#ownerDashboard.gdr-owner-mode-home>.owner-dashboard-quick-grid>:not(.gdr-owner-nearby-entry)"));
 assert.ok(ownerCss.includes("#ownerDashboard.gdr-owner-mode-home>.owner-profile-card>.renter-profile-grid"));
 assert.ok(ownerCss.includes("display:none!important"));
 assert.match(html,/id="ownerEditProfileBtn"/);
 assert.match(html,/id="ownerProfileEditor"/);
});
test("Retired Owner Report a Problem tile is removed by legacy ID without touching Renter support",()=>{
 assert.ok(rental.includes("var isReportControl="));
 assert.ok(rental.includes('if(selector==="#ownerDashboard")'));
 assert.ok(rental.includes('scope.querySelectorAll("#gdrxSupport")'));
 assert.ok(rental.includes("target.remove()"));
 assert.ok(rental.includes('control.closest("#gd-contact-section,.gd-contact-section")'));
});
