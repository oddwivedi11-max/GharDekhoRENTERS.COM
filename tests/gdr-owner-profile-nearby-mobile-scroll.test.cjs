const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const rental=fs.readFileSync(path.join(root,"assets/gdr-rental-suite-v2.js"),"utf8");
const css=fs.readFileSync(path.join(root,"assets/gdr-property-studio.css"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/deploy-cloudflare.yml"),"utf8");

test("Nearby Properties is a compact on-demand action beside Edit Profile",()=>{
 const start=rental.indexOf("function addOwnerNearbyAction(){");
 const end=rental.indexOf("\nfunction boot(){",start);
 assert.ok(start>=0&&end>start);
 const fn=rental.slice(start,end);
 assert.match(fn,/\.owner-profile-card/);
 assert.match(fn,/\.dashboard-card-heading/);
 assert.match(fn,/gdr-owner-profile-actions/);
 assert.match(fn,/actions\.appendChild\(edit\)/);
 assert.match(fn,/actions\.appendChild\(button\)/);
 assert.match(fn,/var oldCard=\$\("gdrOwnerNearbyCard"\);\s*if\(oldCard\)oldCard\.remove\(\)/);
 assert.match(fn,/openOwnerNearbyMap/);
 assert.match(fn,/button\.dataset\.gdrNearbyBound/);
 assert.doesNotMatch(fn,/insertBefore\(card/);
});

test("Existing Report a problem/support entry is not removed by the Nearby launcher",()=>{
 assert.doesNotMatch(rental,/remove\(\).*Report a problem/i);
 assert.doesNotMatch(rental,/querySelector(All)?\([^)]*support[^)]*\).*remove/i);
});

test("Owner profile action layout remains compact and usable on phones",()=>{
 assert.match(css,/#ownerDashboard \.gdr-owner-profile-actions/);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css,/#ownerDashboard \.gdr-owner-profile-actions #gdrOwnerNearbyOpen/);
});

test("Property Studio, owner map, renter profile and current renters use native touch scrolling",()=>{
 for(const id of ["gdrPropertyStudio","gdrOwnerNearbyExperience","gdrOwnerRenterPage","gdrOwnerCurrentRentersPage"]){
  assert.ok(css.includes("#"+id),id+" scroll root");
 }
 assert.match(css,/-webkit-overflow-scrolling:touch!important/);
 assert.match(css,/overscroll-behavior-y:contain!important/);
 assert.match(css,/touch-action:auto!important/);
 assert.match(css,/html,body\{-webkit-overflow-scrolling:touch\}/);
});

test("Deployment serves the updated JS and CSS with fresh cache versions and runs regression coverage",()=>{
 assert.match(workflow,/gdr-rental-suite-v2\.js", "20261111-profile-nearby-scroll1"/);
 assert.match(workflow,/gdr-property-studio\.css", "20261111-profile-nearby-scroll1"/);
 assert.match(workflow,/gdr-owner-profile-nearby-mobile-scroll\.test\.cjs/);
 assert.doesNotMatch(workflow,/gdr-rental-suite-v2\.js\?v=20261107-paymentproof1/);
 assert.doesNotMatch(workflow,/gdr-property-studio\.css\?v=20261109-draft-gallery2/);
});
