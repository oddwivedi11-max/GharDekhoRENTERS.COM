const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const controller=read("assets/gdr-owner-command-center-hotfix.js");
const css=read("assets/gdr-owner-command-center.css");
const studioCss=read("assets/gdr-property-studio.css");
const workflow=read(".github/workflows/deploy-cloudflare.yml");

test("Owner My Properties exposes three accessible status filters",()=>{
 assert.match(controller,/data-gdr-owner-property-filter="all"/);
 assert.match(controller,/data-gdr-owner-property-filter="available"/);
 assert.match(controller,/data-gdr-owner-property-filter="occupied"/);
 assert.match(controller,/aria-pressed/);
 assert.match(controller,/dash\.dataset\.gdrOwnerPropertyFilter/);
 assert.match(controller,/classList\.toggle\("is-active",active\)/);
});

test("Available and Occupied filters use real status badges, update counts, and show empty states",()=>{
 assert.match(controller,/statusOf\(card\)\?\.classList\.contains\("available"\)/);
 assert.match(controller,/statusOf\(card\)\?\.classList\.contains\("occupied"\)/);
 assert.match(controller,/counts=\{/);
 assert.match(controller,/card\.hidden=!match/);
 assert.match(controller,/No available properties right now/);
 assert.match(controller,/No occupied properties right now/);
 assert.match(controller,/refreshOwnerPropertyFilter\(dash\)/);
});

test("Owner filters and property cards are responsive and horizontal-touch scrollable",()=>{
 assert.match(css,/\.gdr-owner-property-filters/);
 assert.match(css,/\.gdr-owner-property-filters button\.is-active/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.gdr-owner-property-filters\{[^}]*overflow-x:auto/);
 assert.match(studioCss,/#ownerDashboard #ownerPropertiesContainer\.owner-properties-grid\{[\s\S]*?scroll-snap-type:x mandatory/);
 assert.match(studioCss,/owner-property-premium-card\{[\s\S]*?scroll-snap-align:start/);
});

test("Owner filter regression coverage runs in the Cloudflare deploy gate",()=>{
 assert.match(workflow,/node --test tests\/gdr-owner-property-filters\.test\.cjs/);
});
