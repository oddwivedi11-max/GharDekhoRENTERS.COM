const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const payments=read("assets/gdr-owner-payments.js");
const paymentsCss=read("assets/gdr-owner-payments.css");
const renter=read("assets/gdr-owner-renter-page.js");
const renters=read("assets/gdr-owner-current-renters-dashboard.js");
const controller=read("assets/gdr-owner-command-center-hotfix.js");
const ownerCss=read("assets/gdr-owner-command-center.css");
const rental=read("assets/gdr-rental-suite.js");
const patch=read("scripts/patch-owner-dashboard-refresh.py");
const chargeMigration=read("supabase/migrations/20261105170651_add_occupancy_charge_description.sql");

test("My Payments loads owner-scoped active charges and links them to active renter/property records",()=>{
 assert.match(payments,/from\("occupancy_charges"\)/);
 assert.match(payments,/\.eq\("owner_id",owner\.id\)/);
 assert.match(payments,/occupancy_id/);
 assert.match(payments,/Applicable renter \/ property/);
 assert.match(payments,/saveCharge/);
});

test("Additional charges have name, description, amount, frequency, due day, and owner association",()=>{
 for(const token of ['name="title"','name="description"','name="amount"','name="frequency"','name="occupancy_id"','owner_id:owner.id'])assert.ok(payments.includes(token),token);
 assert.match(payments,/Total monthly payable/);
 assert.match(payments,/Base monthly rent/);
 assert.match(payments,/Additional monthly charges/);
 assert.match(payments,/payments\.filter\(p=>p\.status==="paid"\)/);
});

test("Renter profile never leaves move-out or additional-charge data in permanent Loading state",()=>{
 assert.match(renter,/async function loadMoveOut\(row\)[\s\S]*?catch\(error\)[\s\S]*?value\.textContent="Unavailable"/);
 assert.match(renter,/async function loadCharges\(row\)[\s\S]*?catch\(error\)[\s\S]*?Additional charges could not be loaded/);
 assert.match(renter,/description:description\|\|null/);
 assert.match(renter,/chargeSaving/);
});

test("Current Renters always releases its busy guard and restores previous page overflow",()=>{
 assert.match(renters,/finally\s*\{\s*busy = false;/);
 assert.match(renters,/previousBodyOverflow/);
 assert.match(renters,/page\.scrollTop = 0/);
 assert.match(renters,/\.gdr-ocr-shell[\s\S]*?min-height/);
});

test("Owner Nearby Properties has one dashboard entry point and is hidden inside Properties and Visits modules",()=>{
 assert.doesNotMatch(controller,/data-gdr-module="nearby"/);
 assert.match(rental,/function addOwnerNearbyAction\(\)/);
 assert.match(ownerCss,/gdr-owner-mode-properties>#gdrOwnerNearbyCard/);
 assert.match(ownerCss,/gdr-owner-mode-visits>#gdrOwnerNearbyCard/);
});

test("Property card action patch prevents file picker label activation and event bubbling",()=>{
 assert.match(patch,/prevent property action clicks from bubbling into image\/file controls/);
 assert.match(patch,/e\.preventDefault\(\); e\.stopPropagation\(\); e\.stopImmediatePropagation\(\)/);
});

test("Owner property images are constrained and My Properties remains naturally scrollable",()=>{
 assert.ok(ownerCss.includes("#ownerDashboard{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;"));
 assert.match(ownerCss,/owner-property-photo img\{display:block;width:100%;height:100%;min-height:0;max-height:260px;object-fit:cover\}/);
 assert.match(ownerCss,/@media\(max-width:680px\)/);
});

test("Charge description schema change is additive and bounded",()=>{
 assert.match(chargeMigration,/add column if not exists description text/i);
 assert.match(chargeMigration,/length\(description\) <= 500/);
 assert.doesNotMatch(chargeMigration,/drop column|delete from|truncate/i);
});


test("Owner Analytics paginates owner-scoped data and includes active recurring tenancy charges",()=>{
 assert.match(controller,/async function readAllInsightRows\(queryFactory,label\)/);
 assert.match(controller,/\.range\(offset,offset\+INSIGHT_PAGE_SIZE-1\)/);
 assert.match(controller,/loadInsightRows\(\(\)=>client\.from\("occupancy_charges"\)/);
 assert.match(controller,/monthlyCharges/);
 assert.doesNotMatch(controller,/\.limit\((?:200|300)\)/);
});
