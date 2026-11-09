const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const page=fs.readFileSync(path.join(__dirname,"..","assets","gdr-owner-renter-page.js"),"utf8");
const migration=fs.readFileSync(path.join(__dirname,"..","supabase","migrations","20261104190000_owner_renter_charges_and_expected_moveout.sql"),"utf8");
const chargeDescriptionMigration=fs.readFileSync(path.join(__dirname,"..","supabase","migrations","20261105170651_add_occupancy_charge_description.sql"),"utf8");
test("owner renter profile is a dedicated responsive page with rental timeline and charges",()=>{
 assert.match(page,/gdrOwnerRenterPage/);assert.match(page,/Move-in date/);assert.match(page,/Expected move-out/);assert.match(page,/Monthly charges/);assert.match(page,/ownerRenter/);assert.match(page,/name="description"/);assert.match(page,/async function loadMoveOut\(row\)[\s\S]*?catch\(error\)/);assert.match(page,/async function loadCharges\(row\)[\s\S]*?catch\(error\)/);assert.match(page,/gdrRpPrimaryActionsBound/);assert.match(page,/gdrRpEditDates/);assert.match(page,/gdrRpEditContact/);assert.match(page,/gdrRpAddCharge/);
});
test("renter charge writes are backed by owner-scoped RLS and occupancy ownership",()=>{
 assert.match(migration,/enable row level security/i);assert.match(migration,/occupancy_charges_owner_insert/);assert.match(migration,/auth\.uid\(\)/);assert.match(migration,/po\.owner_id = occupancy_charges\.owner_id/);assert.match(migration,/expected_move_out_at/);assert.match(chargeDescriptionMigration,/add column if not exists description text/i);
});
test("Nearby workflow is not referenced or replaced by the renter profile",()=>{assert.doesNotMatch(page,/get_nearby_properties|loadRenterNearbyHomes/);});
