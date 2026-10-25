const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');

function functionSource(signature, nextSignature) {
  const start = html.indexOf(signature);
  assert.notEqual(start, -1, `Missing function: ${signature}`);
  const end = html.indexOf(nextSignature, start);
  assert.notEqual(end, -1, `Could not find end marker for: ${signature}`);
  return html.slice(start, end);
}

test('explicit dashboard role action persists a missing role before rendering it', () => {
  const source = functionSource(
    'async function switchAccountRole(role)',
    '\nfunction updateDashboardRoleSwitcher()'
  );

  assert.match(source, /isExplicitCrossRoleAction/);
  assert.match(source, /const ok = await saveActiveAccountRole\(target\)/);
  assert.match(source, /if \(!ok\)/);
  assert.match(source, /setRoleSpecificUI\(activeRole\)/);
  assert.ok(
    source.indexOf('const ok = await saveActiveAccountRole(target)') <
    source.indexOf('setRoleSpecificUI(activeRole)'),
    'The role must be persisted before the UI changes'
  );
});

test('failed role persistence never fabricates a role in client memory', () => {
  const source = functionSource(
    'async function switchAccountRole(role)',
    '\nfunction updateDashboardRoleSwitcher()'
  );

  assert.match(source, /Your Renter account is unchanged/);
  assert.match(source, /Your Owner account is unchanged/);
  assert.doesNotMatch(source, /currentProfile\.roles\s*=|currentProfile\.role\s*=/);
});

test('the renter List a Property action calls the shared role-enablement path', () => {
  assert.match(html, /switchAccountRole\(["']owner["']\)/);
  assert.match(html, /renterBecomeOwnerBtn/);
});

test('ordinary Owner login does not silently grant Owner access to a renter-only account', () => {
  assert.match(html, /Never create Owner access during an ordinary login/);
  assert.match(html, /This account is not registered as an Owner/);
});

test('role persistence preserves the existing role when enabling the second mode', () => {
  const source = functionSource(
    'async function saveActiveAccountRole(role)',
    '\\nasync function switchAccountRole(role)'
  );

  assert.match(source, /const existingRoles = getAccountRoles\\(currentProfile\\)/);
  assert.match(source, /existingRoles\\.map/);
  assert.match(source, /normalized/);
  assert.match(source, /update\\(\\{ roles: roleValues \\}\\)/);
  assert.doesNotMatch(source, /update\\(\\{[^}]*role:\\s*normalized/);
});
