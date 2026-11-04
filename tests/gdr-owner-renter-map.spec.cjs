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
 assert.match(editor,/update_my_current_renter_contact/);
 assert.match(migration,/security invoker/i);\n assert.match(migration,/property_occupancies_owner_update_contact/);\n assert.match(migration,/o\\.user_id = \\(select auth\\.uid\\(\\)\\)/);
 assert.match(migration,/po\.released_at is null/);
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/revoke all on function/);
});