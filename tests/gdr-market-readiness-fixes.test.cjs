const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

function functionBlock(sql, name) {
  const start = sql.indexOf("create or replace function public." + name + "(");
  assert.notEqual(start, -1, "Missing SQL function: " + name);
  const end = sql.indexOf("$function$;", start);
  assert.ok(end > start, "Could not find SQL function terminator: " + name);
  return sql.slice(start, end);
}

test("all public discovery RPCs exclude pending, rejected and archived properties", () => {
  const sql = read("supabase/migrations/20261121120000_restore_verified_only_public_inventory.sql");
  const functions = [
    "get_public_properties",
    "get_nearby_properties",
    "get_map_properties_in_bounds",
    "get_available_map_properties_in_bounds",
    "search_public_properties_for_assistant",
  ];

  for (const name of functions) {
    const body = functionBlock(sql, name);
    assert.match(body, /p\.verification_status\s*=\s*'verified'/i, name + " must require verified properties");
    assert.match(body, /o\.verification_status\s*=\s*'verified'/i, name + " must require verified owners");
    assert.match(body, /p\.deleted_at\s+is\s+null/i, name + " must exclude archived rows");
    assert.doesNotMatch(body, /p\.verification_status\s*=\s*'pending'|p\.status\s*=\s*'pending'/i,
      name + " must not admit pending inventory");
  }
  assert.match(sql, /grant execute on function public\.get_public_properties\(\) to anon,\s*authenticated/i);
  assert.match(sql, /grant execute on function public\.get_nearby_properties\([\s\S]*?\) to anon,\s*authenticated/i);
});

test("public inventory reports active whole-home/full listings as occupied", () => {
  const sql = read("supabase/migrations/20261121120000_restore_verified_only_public_inventory.sql");
  for (const name of ["get_public_properties", "get_nearby_properties", "get_map_properties_in_bounds"]) {
    const body = functionBlock(sql, name);
    assert.match(body, /from public\.property_occupancies po[\s\S]*?po\.released_at is null/i);
    assert.match(body, /then 'occupied'/i);
  }
});

test("Property Studio retains name validation and requires a verified India PIN and coordinates", () => {
  const sql = read("supabase/migrations/20261121121000_sync_occupancy_and_require_verified_pin.sql");
  const publish = functionBlock(sql, "owner_publish_property_studio");
  assert.match(publish, /v_property_name := left\(/i);
  assert.match(publish, /char_length\(v_property_name\) < 3/i);
  assert.match(publish, /p_pincode is null[\s\S]*?'\^\[0-9\]\{6\}\$'/i);
  assert.match(publish, /p_latitude < 5[\s\S]*?p_latitude > 38\.8/i);
  assert.match(publish, /p_longitude < 67[\s\S]*?p_longitude > 98\.2/i);
  assert.match(publish, /'other','room'/i);
  assert.match(publish, /v_property_name,\s*v_property_name,\s*p_location/i);
  assert.match(publish, /grant execute on function public\.owner_publish_property_studio\([\s\S]*?to authenticated/i);
});

test("occupancy lifecycle sync fixes stale verified status without fabricating property coordinates", () => {
  const sql = read("supabase/migrations/20261121121000_sync_occupancy_and_require_verified_pin.sql");
  assert.match(sql, /create trigger property_occupancies_sync_listing_status\s+after insert or update of released_at/i);
  assert.match(sql, /create or replace function public\.sync_property_status_from_occupancy_lifecycle/i);
  assert.match(sql, /update public\.properties p\s+set status = case/i);
  assert.match(sql, /p\.status = 'verified'[\s\S]*?po\.released_at is null/i);
  assert.doesNotMatch(sql, /update public\.properties p[\s\S]*?set pincode\s*=/i);
  assert.doesNotMatch(sql, /update public\.properties p[\s\S]*?set latitude\s*=/i);
});

test("both rent-payment RPC overloads calculate daily late fees after the grace period", () => {
  const sql = read("supabase/migrations/20261121122000_daily_late_fee_and_payment_setup_guard.sql");
  const blocks = [...sql.matchAll(/create or replace function public\.create_rent_payment_submission\([\s\S]*?\$function\$;/gi)]
    .map((match) => match[0]);
  assert.equal(blocks.length, 2, "Both payment RPC overloads must be hardened");

  for (const block of blocks) {
    assert.match(block, /v_today date := \(now\(\) at time zone 'Asia\/Kolkata'\)::date/i);
    assert.match(block, /v_overdue_days := greatest\(0,\s*v_today\s*-\s*\(v_due_date\s*\+\s*v_grace\)\)/i);
    assert.match(block, /v_late := greatest\(0,\s*v_late\)\s*\*\s*v_overdue_days/i);
    assert.match(block, /the owner has not configured rent payment details/i);
    assert.match(block, /the owner must add a valid upi id or upload a working upi qr/i);
    assert.match(block, /storage\.objects/i);
    assert.match(block, /rent-payment-proofs/i);
  }
});

test("owner role array backfill appends only missing owner membership", () => {
  const sql = read("supabase/migrations/20261121123000_normalize_primary_owner_roles.sql");
  assert.match(sql, /lower\(coalesce\(role::text,\s*''\)\)\s*=\s*'owner'/i);
  assert.match(sql, /not \(coalesce\(roles,\s*array\[\]::text\[\]\)\s*@>\s*array\['owner'\]::text\[\]\)/i);
  assert.match(sql, /array_append\(coalesce\(new\.roles,\s*array\[\]::text\[\]\),\s*'owner'\)/i);
  assert.match(sql, /before insert or update of role,\s*roles/i);
});

test("owner listing UI requires and sends the India Post-verified PIN", () => {
  const studio = read("assets/gdr-property-studio.js");
  for (const template of ["assets/gdr-property-studio.html", "assets/gdr-property-studio.txt"]) {
    const html = read(template);
    assert.match(html, /PIN code <small>Required<\/small>/i, template);
    assert.match(html, /id="gdrStudioPincode"[^>]*pattern="\[0-9\]\{6\}"[^>]*required/i, template);
  }
  assert.match(studio, /if\(!\/\^\\d\{6\}\$\/\.test\(state\.pincode\)\)/);
  assert.match(studio, /state\.resolvedPincode!==state\.pincode/);
  assert.match(studio, /p_pincode:state\.pincode,/);
});

test("renter bill preview calculates daily fee consistently and blocks unconfigured payments", () => {
  const renter = read("assets/gdr-rental-suite-v2.js");
  assert.match(renter, /function calculateDailyLateFee\(today,dueDay,graceDays,dailyRate\)/);
  assert.match(renter, /overdueDays=Math\.max\(0,/);
  assert.match(renter, /Number\(dailyRate\|\|0\)\*overdueDays/);
  assert.match(renter, /calculateDailyLateFee\(now,s\.due_day\|\|5,s\.late_fee_grace_days\|\|0,s\.late_fee_amount\|\|0\)/);
  assert.match(renter, /paymentConfigured=validUpi\|\|!!s\.upi_qr_path/);
  assert.match(renter, /paymentConfigured\?'<button class="gdr-rental-primary" id="gdrPayNow">/);
  assert.match(renter, /Payment is unavailable until the owner configures a valid UPI ID or QR code/);
  assert.doesNotMatch(renter, /now>due\?Number\(s\.late_fee_amount\|\|0\):0/);
});

test("owner payment workspace flags missing active-renter setup and labels per-day fees", () => {
  const owner = read("assets/gdr-owner-payments.js");
  const renterSuite = read("assets/gdr-rental-suite-v2.js");
  assert.match(owner, /Required for active renter/);
  assert.match(owner, /Payment setup is required for this active renter/);
  assert.match(owner, /Late fee \(₹ per day\)/);
  assert.match(renterSuite, /Late fee \(₹ per day\)/);
});
