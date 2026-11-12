const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"assets/gdr-owner-command-center.css"),"utf8");
const owner=fs.readFileSync(path.join(root,"assets/gdr-rental-suite-v2.js"),"utf8");

test("the existing My Properties, Available and Occupied stat cards are the inventory filters",()=>{
  for(const [id,filter] of [["ownerPropertyCount","all"],["ownerAvailableCount","available"],["ownerOccupiedCount","occupied"]]){
    assert.match(html,new RegExp('data-gdr-owner-filter="'+filter+'"[^>]*>[\\s\\S]{0,600}id="'+id+'"'));
  }
  assert.match(html,/function bindOwnerPropertyFilterControls\(\)/);
  assert.match(html,/function applyOwnerPropertyFilter\(filter\)/);
  assert.match(html,/control\.addEventListener\("click", activate\)/);
  assert.match(html,/event\.key === "Enter" \|\| event\.key === " "/);
});

test("filter results use the actual rendered listing status, including live occupancy updates",()=>{
  assert.match(html,/badge\.classList\.contains\("occupied"\)/);
  assert.match(html,/badge\.classList\.contains\("available"\)/);
  assert.match(html,/await loadOwnerCurrentRenters\(data\);[\s\S]{0,260}applyOwnerPropertyFilter/);
  assert.match(html,/data-owner-status="\$\{statusClass\}"/);
});

test("filter selection and empty states are accessible and visibly selected",()=>{
  assert.match(html,/aria-pressed/);
  assert.match(html,/gdrOwnerPropertiesFilterEmpty/);
  assert.match(css,/#ownerDashboard \.owner-stat-card\[data-gdr-owner-filter\]\.is-filter-active/);
  assert.match(css,/owner-property-premium-card\[hidden\]\{display:none!important\}/);
});

test("My Properties becomes a native horizontal touch carousel on small screens",()=>{
  assert.match(css,/@media\(max-width:680px\)[\s\S]*?#ownerDashboard #ownerPropertiesContainer\.owner-properties-grid/);
  assert.match(css,/scroll-snap-type:x mandatory/);
  assert.match(css,/overscroll-behavior-x:contain/);
  assert.match(css,/touch-action:pan-x pan-y!important/);
  assert.match(css,/flex:0 0 min\(88vw,360px\)!important/);
});

test("Near Properties stays outside the Owner Profile header and has no duplicate report action",()=>{
  assert.match(owner,/gdrOwnerNearbyActions/);
  assert.match(owner,/profile\.insertAdjacentElement\("afterend",nearbyActions\)/);
  assert.match(owner,/if\(duplicateReport\)duplicateReport\.remove\(\)/);
  assert.doesNotMatch(owner,/report\.textContent="Report a Problem"/);
});
