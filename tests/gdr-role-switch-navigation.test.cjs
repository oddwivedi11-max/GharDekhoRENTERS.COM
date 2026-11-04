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

test('explicit role switch activates the selected portal only after persistence succeeds', () => {
  const source = functionSource(
    'async function switchAccountRole(role)',
    '\nfunction updateDashboardRoleSwitcher()'
  );
  const persist = source.indexOf('const ok = await saveActiveAccountRole(target)');
  const activate = source.indexOf('activeRole = target;');
  const render = source.indexOf('await renderActiveDashboard()');

  assert.notEqual(persist, -1);
  assert.notEqual(activate, -1);
  assert.notEqual(render, -1);
  assert.ok(persist < activate, 'Role persistence must succeed before the active portal changes');
  assert.ok(activate < render, 'The selected portal must be active before its dashboard renders');
  assert.match(source, /sessionStorage\.setItem\("gd_active_role", target\)/);
  assert.match(source, /setRoleSpecificUI\(target\)/);
});

test('failed role persistence leaves the current portal unchanged', () => {
  const source = functionSource(
    'async function switchAccountRole(role)',
    '\nfunction updateDashboardRoleSwitcher()'
  );
  const failureBranch = source.slice(source.indexOf('if (!ok)'), source.indexOf('activeRole = target;'));
  assert.match(failureBranch, /return;/);
  assert.doesNotMatch(failureBranch, /activeRole\s*=\s*target/);
});

test('portal renderer hard-hides both dashboards before showing the authorized active one', () => {
  const source = functionSource(
    'async function renderActiveDashboard()',
    '\n        /* =========================================================\n           ADMIN CONTROL CENTER'
  );
  assert.match(source, /renter\.style\.display = "none"/);
  assert.match(source, /owner\.style\.display = "none"/);
  assert.match(source, /activeRole === "owner" && roles\.includes\("owner"\)/);
  assert.match(source, /activeRole === "renter" && roles\.includes\("renter"\)/);
});
