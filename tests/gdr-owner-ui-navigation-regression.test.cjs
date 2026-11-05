const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("assets/gdr-owner-command-center.css");
const controller=read("assets/gdr-owner-command-center-hotfix.js");
const payments=read("assets/gdr-owner-payments.js");
const renters=read("assets/gdr-owner-current-renters-dashboard.js");
const profile=read("assets/gdr-owner-renter-page.js");
const patch=read("scripts/patch-owner-dashboard-refresh.py");

test("My Properties and Visit Requests module headers have readable high contrast",()=>{
 assert.match(css,/#gdrOwnerModuleHeader[\s\S]*?background:linear-gradient/);
 assert.match(css,/#gdrOccModuleTitle[\s\S]*?color:#fff!important/);
 assert.match(css,/#gdrOccModuleSubtitle[\s\S]*?color:#e1f2e7!important/);
});

test("Property photos are compact thumbnails and listing details/actions remain in a bounded card",()=>{
 assert.match(css,/owner-property-premium-card\{[\s\S]*?grid-template-columns:112px minmax\(0,1fr\)!important/);
 assert.match(css,/owner-property-photo img\{[\s\S]*?max-height:166px!important;[\s\S]*?object-fit:cover!important/);
 assert.match(css,/premium-property-actions button\{[\s\S]*?overflow-wrap:anywhere!important/);
});

test("Only the command-centre My Payments tile remains; legacy launchers are removed",()=>{
 assert.match(payments,/function injectButton\(\)[\s\S]*?duplicate\.remove\(\)/);
 assert.match(css,/#ownerDashboard>#gdrPaymentsOpen\{display:none!important\}/);
 assert.match(css,/#ownerDashboard>#gdrOwnerPaymentsCard\{display:none!important\}/);
 assert.match(controller,/window\.GDRPayments/);
});

test("Back to Dashboard and Logout controls have explicit, delegated actions",()=>{
 assert.match(controller,/function bindLogout\(\)/);
 assert.match(controller,/button\.removeAttribute\("onclick"\)/);
 assert.match(controller,/window\.logoutUser\(\)/);
 assert.match(controller,/event\.target\.closest\("\[data-gdr-owner-home\]"\)/);
 assert.match(controller,/window\.scrollTo\(\{top:0,behavior:"smooth"\}\)/);
});

test("Current Renters overlay removes its duplicate logo and restores page scroll",()=>{
 assert.match(renters,/\.gdr-ocr-brandbar \.gdr-ocr-brand\{display:none!important\}/);
 assert.match(renters,/gdrOcrHome/);
 assert.match(renters,/document\.body\.style\.overflow = previousBodyOverflow/);
 assert.match(renters,/requestAnimationFrame\(\(\)=>window\.scrollTo/);
});

test("Renter profile controls remain clickable and asynchronous loading cannot stay stuck forever",()=>{
 assert.match(profile,/const withTimeout=/);
 assert.match(profile,/12000,"Move-out date request timed out/);
 assert.match(profile,/12000,"Additional charges request timed out/);
 assert.match(profile,/#gdrOwnerRenterPage button,#gdrOwnerRenterPage input/);
 assert.match(profile,/gdrRpAddCharge/);
 assert.match(profile,/async function saveCharge/);
});

test("Production asset patch references a fresh cache version",()=>{
 assert.match(patch,/20261105-workspace3/);
});
