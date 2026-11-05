const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pages = ['index.html', 'admin/control.html'];

test('admin uses one dedicated dashboard and hides the shared account shell', () => {
  for (const relativePath of pages) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
    const roleUiStart = source.indexOf('function setRoleSpecificUI(role) {');
    const roleUiEnd = source.indexOf('function openOwnerNearbyHomes()', roleUiStart);
    assert.ok(roleUiStart >= 0 && roleUiEnd > roleUiStart, relativePath + ': role UI function must exist');
    const roleUi = source.slice(roleUiStart, roleUiEnd);
    assert.match(roleUi, /if \(isAdmin && dashboardSection\) \{[\s\S]*?dashboardSection\.style\.display = "none";[\s\S]*?setAttribute\("aria-hidden", "true"\)/, relativePath + ': admin must hide the shared account shell');

    const renderStart = source.indexOf('async function renderActiveDashboard() {');
    const renderEnd = source.indexOf('function showAdminDenied()', renderStart);
    assert.ok(renderStart >= 0 && renderEnd > renderStart, relativePath + ': dashboard renderer must exist');
    const render = source.slice(renderStart, renderEnd);
    const adminStart = render.indexOf('if (roles.length === 1 && roles[0] === "admin")');
    assert.ok(adminStart >= 0, relativePath + ': admin renderer branch must exist');
    const adminBranch = render.slice(adminStart);
    assert.match(adminBranch, /dashboard\.style\.display = "none";[\s\S]*?dashboard\.setAttribute\("aria-hidden", "true"\);[\s\S]*?dashboardLogoutBtn\.style\.display = "none";/, relativePath + ': duplicate shared heading and logout must be hidden');

    const adminAreaStart = source.indexOf('function openAdminArea() {');
    const adminAreaEnd = source.indexOf('async function loadAdminDashboard()', adminAreaStart);
    assert.ok(adminAreaStart >= 0 && adminAreaEnd > adminAreaStart, relativePath + ': admin area entrypoint must exist');
    const adminArea = source.slice(adminAreaStart, adminAreaEnd);
    assert.match(adminArea, /dashboard\.style\.display="none";[\s\S]*?setAttribute\("aria-hidden","true"\)/, relativePath + ': direct admin entry must keep the shared shell hidden');

    assert.match(source, /<section id="adminDashboard"[\s\S]*?<h2>Admin Control Center<\/h2>/, relativePath + ': dedicated admin dashboard must remain present');
  }
});
