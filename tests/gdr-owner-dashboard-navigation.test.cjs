const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const controller=fs.readFileSync(path.join(root,"assets/gdr-owner-command-center-hotfix.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"assets/gdr-owner-command-center.css"),"utf8");
const rental=fs.readFileSync(path.join(root,"assets/gdr-rental-suite.js"),"utf8");

test("Back to Dashboard is directly bound to restore the owner home view",()=>{
 assert.match(controller,/back\.addEventListener\("click",[\s\S]*?setMode\(dash,"home"\)/);
});

test("Nearby Homes uses the actual owner nearby launcher as its fallback",()=>{
 assert.match(controller,/#gdrOwnerNearbyOpen/);
 assert.match(rental,/window\.__gdrMapExperienceLoadPromise/);
 assert.match(rental,/gdr-map-experience\.js\?owner-nearby-retry=1/);
});

test("properties and visits views hide dashboard-only payment and nearby launch cards",()=>{
 assert.match(styles,/gdr-owner-mode-properties>#gdrPaymentsOpen/);
 assert.match(styles,/gdr-owner-mode-properties>#gdrOwnerNearbyCard/);
 assert.match(styles,/gdr-owner-mode-visits>#gdrPaymentsOpen/);
});

test("owner shortcuts use distinct colour treatments with a forest-green workspace",()=>{
 for(const selector of [".gdr-occ-pink",".gdr-occ-rose",".gdr-occ-blue",".gdr-occ-orange",".gdr-occ-teal"]){
  assert.ok(styles.includes(selector),selector+" style must exist");
 }
 assert.match(styles,/#gdrOwnerCommandCenterHome[\s\S]*?#102f24/);
 assert.match(styles,/#c8f169/);
});


test("owner Nearby Properties has one launch card, not a second command-centre shortcut",()=>{
 assert.doesNotMatch(controller,/data-gdr-module="nearby"/);
 assert.match(rental,/function addOwnerNearbyAction\(\)/);
 assert.match(styles,/gdr-owner-mode-properties>#gdrOwnerNearbyCard/);
 assert.match(styles,/gdr-owner-mode-visits>#gdrOwnerNearbyCard/);
});


test("stylesheet loader replaces an existing unversioned command-centre stylesheet",()=>{
 assert.match(controller,/querySelector\('link\[rel="stylesheet"\]\[href\*="gdr-owner-command-center\.css"\]'\)/);
 assert.match(controller,/if\(link\.getAttribute\("href"\)!==href\)link\.setAttribute\("href",href\)/);
 assert.match(controller,/gdr-owner-command-center\.css\?v=20261113-owner-profile-nearby-report1/);
});
test("workspace heading uses the requested high-contrast premium palette",()=>{
 assert.match(styles,/#e8d18a/);
 assert.match(styles,/#e8f0ea/);
 assert.match(styles,/#b9f36b/);
 assert.match(styles,/-webkit-text-fill-color:#fff!important/);
 assert.match(styles,/font-size:clamp\(32px,3\.1vw,38px\)/);
});

test("the four top owner summary cards expose accessible click and keyboard actions",()=>{
 assert.match(controller,/function ensureOwnerDashboardStatActions\(dash\)/);
 for(const [counter,action] of [
  ["ownerPropertyCount","properties"],
  ["ownerAvailableCount","available"],
  ["ownerOccupiedCount","occupied"],
  ["ownerPendingVisitCount","pending-visits"]
 ]){
  assert.match(controller,new RegExp('\\["'+counter+'","'+action+'"'));
 }
 assert.match(controller,/role","button"/);
 assert.match(controller,/tabindex","0"/);
 assert.match(controller,/data-gdr-owner-stat-action/);
 assert.match(controller,/addEventListener\("keydown"/);
 assert.match(controller,/applyOwnerDashboardStatAction\(dash,stat\.dataset\.gdrOwnerStatAction\)/);
});

test("My Properties, Available and Occupied top cards open the matching inventory filter",()=>{
 assert.match(controller,/dash\.dataset\.gdrOwnerPropertyFilter=action==="properties"\?"all":action/);
 assert.match(controller,/setMode\(dash,"properties"\)/);
 assert.match(controller,/refreshOwnerPropertyFilter\(dash\)/);
 assert.match(controller,/data-gdr-owner-property-filter/);
});

test("Pending Visits top card opens only pending requests without changing the other visit shortcuts",()=>{
 assert.match(controller,/function refreshOwnerVisitFilter\(dash\)/);
 assert.match(controller,/querySelectorAll\("\.premium-visit-card"\)/);
 assert.match(controller,/status\?\.classList\.contains\("pending"\)/);
 assert.match(controller,/dash\.dataset\.gdrOwnerVisitFilter="pending"/);
 assert.match(controller,/No pending visit requests right now\./);
 assert.match(controller,/refreshOwnerVisitFilter\(dash\)/);
});
