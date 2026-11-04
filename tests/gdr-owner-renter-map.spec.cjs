const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const map=fs.readFileSync(path.join(__dirname,"..","assets","gdr-map-experience.js"),"utf8");
const editor=fs.readFileSync(path.join(__dirname,"..","assets","gdr-owner-renter-editor.js"),"utf8");
const migration=fs.readFileSync(path.join(__dirname,"..","supabase","migrations","20261104150000_owner_edit_current_renter_contact.sql"),"utf8");
test("owner map uses high-accuracy, fresh GPS and reports measured accuracy",()=>{
 assert.match(map,/enableHighAccuracy:true,timeout:25000,maximumAge:0/);
 assert.match(map,/state\.ownerAccuracyCircle/);
 assert.match(map,/usePreciseOwnerLocation/);
});
test("owner can edit only the current renter contact snapshot through scoped RPC",()=>{
 assert.ok(editor.includes("update_my_current_renter_contact"));
 assert.ok(migration.toLowerCase().includes("security invoker"));
 assert.ok(migration.includes("property_occupancies_owner_update_contact"));
 assert.ok(migration.includes("auth.uid()"));
 assert.ok(migration.includes("po.released_at is null"));
 assert.ok(migration.includes("revoke all on function"));
});
