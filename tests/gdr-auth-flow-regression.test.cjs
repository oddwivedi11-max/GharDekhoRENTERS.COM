const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");

function functionSource(signature, nextSignature) {
  const start = html.indexOf(signature);
  assert.notEqual(start, -1, "Missing function: " + signature);
  const end = html.indexOf(nextSignature, start + signature.length);
  assert.notEqual(end, -1, "Could not find end marker for: " + signature);
  return html.slice(start, end);
}

test("login and signup modes show the correct fields and required phone state", () => {
  const source = functionSource("function setAuthLoginMode(isLoginMode)", "function showSignInPage()");
  assert.match(source, /window\.__gdAuthMode = mode/);
  assert.match(source, /phoneField\.style\.display = isLoginMode \? "none" : "grid"/);
  assert.match(source, /phoneInput\.required = !isLoginMode/);
  assert.match(source, /signupButton\.style\.display = isLoginMode \? "none" : ""/);
  assert.match(source, /loginButton\.style\.display = isLoginMode \? "" : "none"/);
});

test("changing Owner/Renter while signing up does not force the Login tab", () => {
  const source = functionSource("function applyLoginRolePresentation(role)", "function bindLoginRoleControls()");
  assert.match(source, /const signupMode = window\.__gdAuthMode === "signup"/);
  assert.match(source, /setAuthLoginMode\(!signupMode\)/);
  assert.match(source, /Create your Owner account/);
  assert.match(source, /Create your Renter account/);

  const roleBinder = functionSource("function forceSelectedRole(role)", "function bind()");
  assert.match(roleBinder, /applyLoginRolePresentation\(selected\)/);
  assert.doesNotMatch(roleBinder, /setAuthLoginMode\(true\)/);
  assert.doesNotMatch(roleBinder, /role cards are LOGIN selectors, never Sign Up selectors/i);
});

test("password login authenticates with email and password and retries profile loading", () => {
  const source = functionSource("async function loginUser()", "// Keep auth actions available");
  assert.match(source, /signInWithPassword\(\{ email, password \}\)/);
  assert.equal((source.match(/loadOwnProfileWithRetry\(\)/g) || []).length, 2);
  assert.match(source, /This email already has a Renter account/);
  assert.match(source, /window\\.confirm\\(/);
  assert.match(source, /saveActiveAccountRole\\("owner"\\)/);
  assert.doesNotMatch(source, /gharDekhoPhoneError\(/);
});

test("the auth profile recovery helper returns role memberships", () => {
  const source = functionSource("async function loadOwnProfileWithRetry()", "async function ensureOwnerAccess()");
  assert.match(source, /\.select\("id,name,email,phone,role,roles"\)/);
  assert.match(source, /roles: normalizedRoles/);
});

test("an existing Renter email is guided to enable Owner access without a duplicate signup", () => {
  const loginSource = functionSource("async function loginUser()", "// Keep auth actions available");
  assert.match(loginSource, /List a Property → Enable Owner access/);
  assert.match(loginSource, /You do not need a second account/);

  const signupSource = functionSource("async function signupUser()", "/* =========================================================\n   GDR AUTH ROUTE");
  assert.match(signupSource, /This email already has an account/);
  assert.match(signupSource, /Forgot password/);
});

test("Google passwordless login does not require a phone, while Google signup preserves its explicit role", () => {
  const source = functionSource("async function loginWithGoogle()", "async function forgotPassword()");
  assert.match(source, /const isSignupMode = window\.__gdAuthMode === "signup"/);
  assert.match(source, /if \(isSignupMode\)/);
  assert.match(source, /gd_pending_oauth_signup_role/);
  assert.match(source, /signInWithOAuth/);
  assert.match(html, /async function completePendingOAuthSignup\(\)/);
});

test("the auth phone field is mode-aware rather than forcibly visible for every login", () => {
  assert.match(html, /id="gdr-login-phone-mode-v2"/);
  assert.match(html, /data-gd-auth-mode="signin"/);
  assert.match(html, /data-gd-auth-mode="signup"/);
  assert.doesNotMatch(html, /id="gdr-login-phone-force-v1"/);
});

test("Admin authentication route and account allow-list remain unchanged", () => {
  assert.match(html, /const ADMIN_EMAILS = new Set\(\["dwivedijiod@gmail\.com"\]\)/);
  assert.match(html, /if \(window\.__gdAdminLoginRequested\)/);
  assert.match(html, /Only the authorized admin account can enter the Admin Control Center/);
});
