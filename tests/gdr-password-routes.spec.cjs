const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

test.describe('GDR password and route safety regression checks', () => {
  test('owner and renter password change remains simple and does not ask for old password', async () => {
    const html = fs.readFileSync('index.html', 'utf8');

    expect(html).toContain('No old password required. Enter a new password and save it.');
    expect(html).toContain('id="ownerNewPassword"');
    expect(html).toContain('id="ownerConfirmNewPassword"');
    expect(html).toContain('id="renterNewPassword"');
    expect(html).toContain('id="renterConfirmNewPassword"');
    expect(html).not.toMatch(/id=["'][^"']*(owner|renter)[^"']*OldPassword/i);

    const start = html.indexOf('async function setAuthenticatedPassword(role)');
    expect(start, 'Authenticated password change function is missing').toBeGreaterThanOrEqual(0);
    const end = html.indexOf('\nfunction openRenterProfileEditor', start);
    expect(end, 'Could not isolate password-change function').toBeGreaterThan(start);
    const fn = html.slice(start, end);

    expect(fn).toMatch(/if\s*\(!currentUser\)/);
    expect(fn).toMatch(/newPassword\.length\s*<\s*8/);
    expect(fn).toMatch(/newPassword\s*!==\s*confirmPassword/);
    expect(fn).toMatch(/auth\.updateUser\(\{\s*password\s*:\s*newPassword\s*\}\)/);
    expect(fn).toMatch(/Password changed successfully/);
    expect(fn).not.toMatch(/oldPassword|currentPassword|reauthenticate/i);
  });

  test('admin route hard isolation guard remains present', async () => {
    const html = fs.readFileSync('index.html', 'utf8');
    expect(html).toContain('id="gdr-admin-route-hard-isolation"');
    expect(html).toContain('window.__gdAdminHardRoute=true');
    expect(html).toMatch(/path==="\/admin"\s*\|\|\s*path==="\/admin\/"|path==="\/admin"/);
  });

  test('PIN resolver asset is present and wired for search', async () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const pinAsset = fs.readFileSync('assets/gdr-pincode-search.js', 'utf8');
    expect(pinAsset.length).toBeGreaterThan(100);
    expect(pinAsset).toContain('const INPUT_ID = "renterSearchLocation"');
    // The standalone resolver is intentionally not injected by the Pages workflow.
    // Checking for a script tag in index.html would reintroduce the old bug.
    expect(html).toMatch(/renterSearchLocation/);
    expect(html).toMatch(/pincode|pin code|postal code/i);
  });

  test('signup confirmation matches the email-and-password login flow', async () => {
    const html = fs.readFileSync('index.html', 'utf8');
    expect(html).toContain('Confirm your email first, then log in with your registered email address and password.');
    expect(html).not.toContain('Confirm your email first, then log in with your registered +91 phone number and password.');
    expect(html).toMatch(/signInWithPassword\(\{\s*email,\s*password\s*\}\)/);
  });

});
