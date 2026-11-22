from pathlib import Path
import re

path = Path("index.html")
source = path.read_text(encoding="utf-8")

def replace_once(old, new, label):
    global source
    if new in source:
        print("Already applied: " + label)
        return
    count = source.count(old)
    if count != 1:
        raise SystemExit("Stopped safely for " + label + ": expected one exact match, found " + str(count))
    source = source.replace(old, new, 1)
    print("Applied: " + label)

def replace_function(signature, next_signature, replacement, label):
    global source
    start = source.find(signature)
    if start < 0:
        raise SystemExit("Stopped safely for " + label + ": start marker missing")
    end = source.find(next_signature, start + len(signature))
    if end < 0:
        raise SystemExit("Stopped safely for " + label + ": end marker missing")
    current = source[start:end]
    if replacement.strip() in current:
        print("Already applied: " + label)
        return
    source = source[:start] + replacement.rstrip() + "\n\n" + source[end:]
    print("Applied: " + label)

def replace_region(old, new, label):
    replace_once(old, new, label)

# Keep the selected portal and the selected auth mode independent. Changing
# Owner/Renter while creating an account must never switch back to Login.
replace_function(
    "function setAuthLoginMode(isLoginMode)",
    "function showSignInPage()",
    '''function setAuthLoginMode(isLoginMode){
    const mode = isLoginMode ? "signin" : "signup";
    window.__gdAuthMode = mode;
    const phoneField = document.getElementById("userPhone")?.closest(".gd-v4-field");
    const phoneInput = document.getElementById("userPhone");
    const nameField = document.getElementById("userName")?.closest(".gd-v4-field");
    const termsField = document.getElementById("signupTermsField");
    const title = document.getElementById("premiumAuthTitle");
    const intro = document.getElementById("premiumAuthIntro");
    const signupButton = document.getElementById("signupBtn");
    const loginButton = document.getElementById("loginSubmitBtn");
    const signInTab = document.getElementById("authSignInTab");
    const signUpTab = document.getElementById("authSignUpTab");

    if (phoneField) {
        phoneField.dataset.gdAuthMode = mode;
        phoneField.style.display = isLoginMode ? "none" : "grid";
    }
    if (phoneInput) {
        phoneInput.required = !isLoginMode;
        phoneInput.setAttribute("aria-required", isLoginMode ? "false" : "true");
    }
    if (nameField) nameField.style.display = isLoginMode ? "none" : "";
    if (termsField) termsField.style.display = isLoginMode ? "none" : "grid";
    if (signupButton) signupButton.style.display = isLoginMode ? "none" : "";
    if (loginButton) loginButton.style.display = isLoginMode ? "" : "none";
    if (signInTab) {
        signInTab.style.background = isLoginMode ? "#0b3430" : "transparent";
        signInTab.style.color = isLoginMode ? "#fff" : "#0b3430";
    }
    if (signUpTab) {
        signUpTab.style.background = isLoginMode ? "transparent" : "#0b3430";
        signUpTab.style.color = isLoginMode ? "#0b3430" : "#fff";
    }
    if (title) title.textContent = isLoginMode
        ? (pendingLoginRole === "owner" ? "Welcome back, Owner" : "Welcome back, Renter")
        : "Create your GharDekho account";
    if (intro) intro.textContent = isLoginMode
        ? (pendingLoginRole === "owner"
            ? "Sign in to manage properties, listings and renter visits."
            : "Sign in to discover homes, save properties and manage visits.")
        : "Create one account for the portal you want to use. You can add Owner access later without creating a second account.";

    if (typeof window.__gdSyncAuthPhoneMode === "function") {
        window.__gdSyncAuthPhoneMode();
    }
}''',
    "separate login and signup fields"
)

replace_function(
    "function applyLoginRolePresentation(role)",
    "function bindLoginRoleControls()",
    '''function applyLoginRolePresentation(role){
    const selectedRole = role === "owner" ? "owner" : "renter";
    const signupMode = window.__gdAuthMode === "signup";
    setAuthLoginMode(!signupMode);

    const title = document.getElementById("premiumAuthTitle");
    const intro = document.getElementById("premiumAuthIntro");
    const brand = document.getElementById("gdAuthBrandText");
    const hint = document.getElementById("loginRoleHint");
    const benefit = document.getElementById("gdAuthBenefit3");

    if (signupMode) {
        if (title) title.textContent = selectedRole === "owner" ? "Create your Owner account" : "Create your Renter account";
        if (intro) intro.textContent = selectedRole === "owner"
            ? "Create your Owner profile, then list your property after signing in."
            : "Create your Renter profile to discover homes, save favourites and request visits.";
        if (hint) hint.textContent = selectedRole === "owner"
            ? "Owner selected. Enter your name, email, Indian mobile number and password to create your Owner account."
            : "Renter selected. Enter your name, email, Indian mobile number and password to create your Renter account.";
    } else {
        if (title) title.textContent = selectedRole === "owner" ? "Welcome back, Owner" : "Welcome back, Renter";
        if (intro) intro.textContent = selectedRole === "owner"
            ? "Sign in to manage properties, listings and renter visits."
            : "Sign in to discover homes, save properties and manage visits.";
        if (hint) hint.textContent = selectedRole === "owner"
            ? "Use your registered email and password. An existing Renter account can enable Owner access from its dashboard."
            : "Sign in with your registered email and password. No phone number is needed on this screen.";
    }

    if (brand) brand.textContent = selectedRole === "owner"
        ? "A dedicated workspace for owners to list, edit and manage rental properties."
        : "A simple rental experience for discovering homes and arranging visits.";
    if (benefit) benefit.textContent = selectedRole === "owner"
        ? "Manage your listings with ease"
        : "Find homes that fit your needs";
}''',
    "preserve signup mode when selecting account role"
)

# The signup fallback must return the complete role array; dual-role accounts
# must not be reduced to whichever primary role happens to be stored.
replace_once(
    '.select("id,name,email,phone,role")\n            .maybeSingle();',
    '.select("id,name,email,phone,role,roles")\n            .maybeSingle();',
    "include role memberships in auth profile recovery"
)

# Use the existing retry/self-healing profile loader for both password-login
# destinations, rather than a single fragile immediate SELECT.
login_start = source.find("async function loginUser() {")
login_end = source.find("// Keep auth actions available", login_start)
if login_start < 0 or login_end < 0:
    raise SystemExit("Stopped safely: loginUser block markers missing")
login_block = source[login_start:login_end]

old_renter = '''        if (selectedLoginRole === "renter") {
            const { data: profileBeforeRoleSync } = await withAuthTimeout(
                supabaseClient
                    .from("users")
                    .select("id,name,email,phone,role,roles")
                    .eq("id", currentUser.id)
                    .maybeSingle(),
                "Profile loading",
                10000
            );

            currentProfile = profileBeforeRoleSync || currentProfile;'''
new_renter = '''        if (selectedLoginRole === "renter") {
            const { profile: profileBeforeRoleSync, error: profileLoadError } = await withAuthTimeout(
                loadOwnProfileWithRetry(),
                "Profile loading",
                10000
            ).catch(error => ({ profile: null, error }));

            currentProfile = profileBeforeRoleSync || currentProfile;
            if (profileLoadError || !currentProfile) {
                authMessage.textContent = "Your password was accepted, but your account profile is still syncing. Please try logging in again in a moment.";
                return;
            }'''
if new_renter not in login_block:
    login_block = login_block.replace(old_renter, new_renter)
    if new_renter not in login_block:
        raise SystemExit("Stopped safely: renter login profile query could not be replaced")
    print("Applied: retry profile loading for Renter login")
else:
    print("Already applied: retry profile loading for Renter login")

old_owner = '''            const { data: profileBeforeOwnerSync } = await withAuthTimeout(
                supabaseClient
                    .from("users")
                    .select("id,name,email,phone,role,roles")
                    .eq("id", currentUser.id)
                    .maybeSingle(),
                "Owner profile loading",
                10000
            );

            currentProfile = profileBeforeOwnerSync || currentProfile;'''
new_owner = '''            const { profile: profileBeforeOwnerSync, error: ownerProfileLoadError } = await withAuthTimeout(
                loadOwnProfileWithRetry(),
                "Owner profile loading",
                10000
            ).catch(error => ({ profile: null, error }));

            currentProfile = profileBeforeOwnerSync || currentProfile;
            if (ownerProfileLoadError || !currentProfile) {
                authMessage.textContent = "Your password was accepted, but your Owner profile is still syncing. Please try logging in again in a moment.";
                return;
            }'''
if new_owner not in login_block:
    login_block = login_block.replace(old_owner, new_owner)
    if new_owner not in login_block:
        raise SystemExit("Stopped safely: Owner login profile query could not be replaced")
    print("Applied: retry profile loading for Owner login")
else:
    print("Already applied: retry profile loading for Owner login")

owner_role_guard_old = '''            if (!getAccountRoles(currentProfile).includes("owner")) {
                const availableRoles = getAccountRoles(currentProfile);
                if (availableRoles.includes("renter")) {
                    // A valid renter signed in from the Owner tab: keep the
                    // authenticated session and route to the role they actually have.
                    activeRole = "renter";
                    pendingLoginRole = "renter";
                    sessionStorage.setItem("gd_active_role", "renter");
                    sessionStorage.setItem("gd_pending_login_role", "renter");
                    sessionStorage.setItem("gd_login_destination", "renter");
                    authMessage.textContent = "This account has Renter access, so we opened your Renter dashboard. Create an Owner account to list properties.";
                    await withAuthTimeout(updateAuthUI(), "Renter dashboard preparation", 12000);
                    setRoleSpecificUI("renter");
                    const landing = document.getElementById("loggedOutLanding");
                    const loginSection = document.getElementById("loginSection");
                    const homeSection = document.getElementById("homeSection");
                    const propertiesSection = document.getElementById("propertiesSection");
                    const dashboard = document.getElementById("dashboardSection");
                    if (landing) landing.style.display = "none";
                    if (loginSection) loginSection.style.display = "none";
                    if (homeSection) homeSection.style.display = "none";
                    if (propertiesSection) propertiesSection.style.display = "none";
                    if (dashboard) dashboard.style.display = "block";
                    document.body.classList.remove("gd-auth-page", "gd-renter-explore-mode");
                    await withAuthTimeout(renderActiveDashboard(), "Renter dashboard loading", 12000).catch(error => {
                        console.warn("Renter dashboard loading timed out:", error);
                    });
                    scrollToSection("dashboardSection");
                    return;
                }
old_message = 'authMessage.textContent = "This account has Renter access, so we opened your Renter dashboard. Create an Owner account to list properties.";'
new_message = 'authMessage.textContent = "This email already has a Renter account. You do not need a second account: use List a Property in your Renter dashboard and choose Enable Owner access.";'
if old_message in login_block:
    login_block = login_block.replace(old_message, new_message, 1)
elif new_message in login_block:
    pass
else:
    raise SystemExit("Stopped safely: renter-to-owner guidance text not found")
source = source[:login_start] + login_block + source[login_end:]

# A duplicate email cannot create a second Owner identity. Explain the safe
# existing-account route instead of displaying a generic failed-signup message.
old_duplicate = '''                authMessage.textContent = "We couldn't complete sign-up with those details. Please check the information and try again, or use Login/Forgot password if you already have an account.";
                return;'''
new_duplicate = '''                authMessage.textContent = selectedRole === "owner"
                    ? "This email already has an account. Choose Login. If it is your Renter account, sign in and use List a Property → Enable Owner access. You do not need a second account."
                    : "This email or phone is already registered. Choose Login or Forgot password to access your existing account.";
                return;'''
replace_once(old_duplicate, new_duplicate, "show actionable duplicate-account signup guidance")

old_obfuscated = '''        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            authMessage.textContent = "We couldn't complete sign-up with those details. If you already have an account, try logging in or resetting your password.";
            return;
        }'''
new_obfuscated = '''        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            authMessage.textContent = selectedRole === "owner"
                ? "This email already has an account. Choose Login. If it is your Renter account, sign in and use List a Property → Enable Owner access. You do not need a second account."
                : "This email is already registered. Choose Login or Forgot password to access your existing account.";
            return;
        }'''
replace_once(old_obfuscated, new_obfuscated, "handle obfuscated duplicate signup consistently")

# Phone is mandatory only when creating a new account. Password login remains
# Email + Password, matching the actual Supabase signInWithPassword call.
login_comment_old = '''        // Phone is a required login field, but it is NOT used as a password
        // credential or a unique identity key. Authenticate with Email + Password;
        // the phone field only needs to contain a valid Indian mobile number.
        // This keeps password-reset accounts and Google-created accounts usable
        // even when their older profile row has no stored phone value.

        /*
         * LOGIN AUTHENTICATION:
         * Renter/Owner login uses email + password.
         * A valid phone number is required in the form, but it is not used
         * as the authentication credential. Google is optional.
         */'''
login_comment_new = '''        // Password login uses the registered Email + Password only.
        // Indian mobile validation is required during account creation, not
        // again on every login. Older and Google-created accounts remain usable.'''
replace_once(login_comment_old, login_comment_new, "align login copy and validation with real credentials")

# Allow Google sign-in without asking for a phone number. A new Google signup
# still validates the phone and carries the explicit role choice through OAuth.
replace_function(
    "async function loginWithGoogle()",
    "async function forgotPassword()",
    '''async function loginWithGoogle() {
    const button = document.getElementById("googleLoginBtn");
    const authMessage = document.getElementById("authMessage");
    const isSignupMode = window.__gdAuthMode === "signup";
    const selectedGoogleRole = document.querySelector('input[name="accountRole"]:checked')?.value === "owner" ? "owner" : "renter";
    const googlePhoneInput = document.getElementById("userPhone");
    const googlePhone = normalizePhone(googlePhoneInput?.value || "");

    if (isSignupMode) {
        const googlePhoneError = gharDekhoPhoneError(googlePhone);
        if (googlePhoneError) {
            if (authMessage) authMessage.textContent = googlePhoneError;
            googlePhoneInput?.focus();
            return;
        }
        sessionStorage.setItem("gd_pending_oauth_signup", "true");
        sessionStorage.setItem("gd_pending_oauth_signup_role", selectedGoogleRole);
        sessionStorage.setItem("gd_pending_oauth_phone", googlePhone);
    } else {
        // Existing Google accounts can sign in without re-entering a phone.
        sessionStorage.removeItem("gd_pending_oauth_signup");
        sessionStorage.removeItem("gd_pending_oauth_signup_role");
        sessionStorage.removeItem("gd_pending_oauth_phone");
    }

    pendingLoginRole = selectedGoogleRole;
    sessionStorage.setItem("gd_pending_login_role", selectedGoogleRole);
    sessionStorage.setItem("gd_login_destination", selectedGoogleRole);

    if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="google-g-icon" aria-hidden="true">G</span><span>Opening Google...</span>';
    }
    if (authMessage) authMessage.textContent = "Opening Google account selection...";

    try {
        const redirectTo = window.location.origin + window.location.pathname;
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo,
                queryParams: { prompt: "select_account" }
            }
        });

        if (error) {
            console.error("Google login error:", error);
            if (authMessage) authMessage.textContent = getFriendlyAuthError(error);
            sessionStorage.removeItem("gd_pending_oauth_signup");
            sessionStorage.removeItem("gd_pending_oauth_signup_role");
            sessionStorage.removeItem("gd_pending_oauth_phone");
        }
    } catch (error) {
        console.error("Google login error:", error);
        if (authMessage) authMessage.textContent = "Google sign-in could not be started. Please try again.";
        sessionStorage.removeItem("gd_pending_oauth_signup");
        sessionStorage.removeItem("gd_pending_oauth_signup_role");
        sessionStorage.removeItem("gd_pending_oauth_phone");
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = '<span class="google-g-icon" aria-hidden="true">G</span><span>Continue with Google</span>';
        }
    }
}''',
    "make Google login optional-phone and preserve explicit signup role"
)

# Complete an explicit Google signup after Supabase has restored the session.
# Owner membership is added only when the user chose Owner on the Sign Up tab.
complete_oauth = '''async function completePendingOAuthSignup() {
    if (sessionStorage.getItem("gd_pending_oauth_signup") !== "true") return true;
    const selectedRole = sessionStorage.getItem("gd_pending_oauth_signup_role") === "owner" ? "owner" : "renter";
    const phone = normalizePhone(sessionStorage.getItem("gd_pending_oauth_phone") || "");
    const clearPending = () => {
        sessionStorage.removeItem("gd_pending_oauth_signup");
        sessionStorage.removeItem("gd_pending_oauth_signup_role");
        sessionStorage.removeItem("gd_pending_oauth_phone");
    };

    if (!currentUser || !currentProfile || !isValidGharDekhoPhone(phone)) {
        clearPending();
        showMessage("backendMessage", "Google sign-in succeeded, but the signup phone details could not be verified. Please edit your profile and try again.", "error");
        return false;
    }

    const { data: updatedProfile, error } = await supabaseClient
        .from("users")
        .update({ phone })
        .eq("id", currentUser.id)
        .select("id,name,email,phone,role,roles")
        .maybeSingle();

    if (error || !updatedProfile) {
        clearPending();
        showMessage("backendMessage", error?.message || "Your phone number could not be saved. Please use a different registered mobile number or edit your profile.", "error");
        return false;
    }

    currentProfile = updatedProfile;
    if (selectedRole === "owner") {
        const ownerReady = await saveActiveAccountRole("owner");
        if (!ownerReady) {
            clearPending();
            activeRole = "renter";
            pendingLoginRole = "renter";
            sessionStorage.setItem("gd_active_role", "renter");
            sessionStorage.setItem("gd_pending_login_role", "renter");
            showMessage("backendMessage", "Your Google account is ready as a Renter. Owner access could not be enabled yet; use List a Property → Enable Owner access from your Renter dashboard.", "error");
            return false;
        }
    }

    clearPending();
    activeRole = selectedRole;
    pendingLoginRole = selectedRole;
    sessionStorage.setItem("gd_active_role", selectedRole);
    sessionStorage.setItem("gd_pending_login_role", selectedRole);
    sessionStorage.setItem("gd_login_destination", selectedRole);
    return true;
}

'''
if "async function completePendingOAuthSignup()" not in source:
    marker = "async function switchAccountRole(role) {"
    pos = source.find(marker)
    if pos < 0:
        raise SystemExit("Stopped safely: could not locate account role helper insertion point")
    source = source[:pos] + complete_oauth + source[pos:]
    print("Applied: persist explicit Google signup phone and selected role")
else:
    print("Already applied: persist explicit Google signup phone and selected role")

oauth_call = '''    if(await requireMandatoryPhoneProfile())return;

    const emailInput = document.getElementById("userEmail");'''
oauth_call_new = '''    if(await requireMandatoryPhoneProfile())return;
    await completePendingOAuthSignup();

    const emailInput = document.getElementById("userEmail");'''
replace_once(oauth_call, oauth_call_new, "complete pending Google signup after profile load")

# Replace the legacy always-visible phone override with a mode-aware guard.
phone_mode_block = '''<style id="gdr-login-phone-mode-v2">
body.gd-auth-page #gdAuthFormShell #gdLoginPhoneField[data-gd-auth-mode="signin"]{
  display:none!important;
}
body.gd-auth-page #gdAuthFormShell #gdLoginPhoneField[data-gd-auth-mode="signup"]{
  display:grid!important;
  visibility:visible!important;
  opacity:1!important;
  position:relative!important;
  height:auto!important;
  max-height:none!important;
  overflow:visible!important;
  grid-column:1/-1!important;
}
body.gd-auth-page #gdAuthFormShell #gdLoginPhoneField .gd-phone-wrap{
  display:flex!important;
  width:100%!important;
  min-height:50px!important;
}
body.gd-auth-page #gdAuthFormShell #gdLoginPhoneField .gd-phone-prefix{display:flex!important}
@media(max-width:560px){
  body.gd-auth-page #gdAuthFormShell #gdLoginPhoneField[data-gd-auth-mode="signup"]{grid-column:auto!important}
}
</style>
<script id="gdr-login-phone-mode-v2-js">
(function(){
  function syncPhoneMode(){
    const field=document.getElementById("gdLoginPhoneField");
    if(!field)return;
    const signup=window.__gdAuthMode==="signup";
    const input=document.getElementById("userPhone");
    field.dataset.gdAuthMode=signup?"signup":"signin";
    field.style.setProperty("display",signup?"grid":"none","important");
    field.style.setProperty("visibility",signup?"visible":"hidden","important");
    if(input){
      input.required=signup;
      input.setAttribute("aria-required",signup?"true":"false");
    }
  }
  window.__gdSyncAuthPhoneMode=syncPhoneMode;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",syncPhoneMode,{once:true});
  else syncPhoneMode();
  window.addEventListener("load",syncPhoneMode);
})();
</script>'''
phone_pattern = re.compile(r'<style id="gdr-login-phone-force-v1">.*?<script id="gdr-login-phone-force-v1-js">.*?</script>', re.S)
source, phone_count = phone_pattern.subn(phone_mode_block, source, count=1)
if phone_count != 1:
    if 'id="gdr-login-phone-mode-v2"' not in source:
        raise SystemExit("Stopped safely: legacy forced-phone CSS/JS block was not found exactly once")
    print("Already applied: mode-aware phone visibility")
else:
    print("Applied: remove forced phone field from password login")

path.write_text(source, encoding="utf-8")
print("Updated index.html auth flow safely.")
