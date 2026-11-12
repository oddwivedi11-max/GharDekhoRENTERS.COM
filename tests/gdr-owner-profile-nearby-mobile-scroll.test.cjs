const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const rental=fs.readFileSync(path.join(root,"assets/gdr-rental-suite-v2.js"),"utf8");
const css=fs.readFileSync(path.join(root,"assets/gdr-property-studio.css"),"utf8");
const ownerCss=fs.readFileSync(path.join(root,"assets/gdr-owner-command-center.css"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/deploy-cloudflare.yml"),"utf8");

test("Near Properties is separate from Edit Profile and stays a single dashboard action",()=>{
 const start=rental.indexOf("function addOwnerNearbyAction(){");
 const end=rental.indexOf("\nfunction boot(){",start);
 assert.ok(start>=0&&end>start);
 const fn=rental.slice(start,end);
 assert.match(fn,/\.owner-profile-card/);
 assert.match(fn,/\.dashboard-card-heading/);
 assert.match(fn,/gdrOwnerNearbyActions/);
 assert.match(fn,/profile\.insertAdjacentElement\("afterend",nearbyActions\)/);
 assert.match(fn,/heading\.appendChild\(edit\)/);
 assert.match(fn,/nearbyActions\.appendChild\(button\)/);
 assert.doesNotMatch(fn,/actions\.appendChild\(edit\)/);
 assert.match(fn,/var oldCard=\$\("gdrOwnerNearbyCard"\);if\(oldCard\)oldCard\.remove\(\)/);
 assert.match(fn,/openOwnerNearbyMap/);
 assert.match(fn,/button\.dataset\.gdrNearbyBound/);
 assert.doesNotMatch(fn,/insertBefore\(card/);
});

test("Duplicate injected Report a Problem entry is removed but the original support section stays",()=>{
 assert.match(rental,/gdrOwnerReportProblem/);
 assert.match(rental,/if\(duplicateReport\)duplicateReport\.remove\(\)/);
 assert.doesNotMatch(rental,/report\.textContent="Report a Problem"/);
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(html,/Need help/);
 assert.match(html,/Open Gmail to contact GharDekho Renters/);
});

test("Near Properties has a separate, touch-friendly layout outside the profile header",()=>{
 assert.match(ownerCss,/#ownerDashboard #gdrOwnerNearbyActions/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(ownerCss,/#ownerDashboard #gdrOwnerNearbyActions #gdrOwnerNearbyOpen/);
 assert.doesNotMatch(css,/gdr-owner-profile-actions #gdrOwnerReportProblem/);
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
 assert.match(workflow,/gdr-rental-suite-v2\.js", "20261112-owner-nearby-separate1"/);
 assert.match(workflow,/gdr-property-studio\.css", "20261112-touch-gallery1"/);
 assert.match(workflow,/gdr-owner-profile-nearby-mobile-scroll\.test\.cjs/);
 assert.doesNotMatch(workflow,/gdr-rental-suite-v2\.js\?v=20261107-paymentproof1/);
});

test("Owner profile does not inject a duplicate Report action and original support remains available",()=>{
 assert.match(rental,/if\(duplicateReport\)duplicateReport\.remove\(\)/);
 assert.doesNotMatch(rental,/Report a Problem/);
 assert.doesNotMatch(css,/gdrOwnerReportProblem/);
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(html,/Need help/);
 assert.match(html,/Open Gmail to contact GharDekho Renters/);
});
