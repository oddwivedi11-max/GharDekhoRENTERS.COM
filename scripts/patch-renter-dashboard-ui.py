# Trigger downstream production workflows from the fully patched main branch.
from pathlib import Path

INDEX = Path("index.html")
TESTS = Path("tests/gdr-renter-experience.test.cjs")
OLD_BUTTON = '<button type="button" class="secondary-button renter-edit-profile-compact" id="renterEditProfileBtn">✏️ Edit profile</button>'
STYLE_MARKER = "GDR Renter Dashboard refinement — 2026-11-07"

NEW_CARD = """<div class="renter-account-edit-card" aria-labelledby="renterAccountEditHeading">
                    <div class="renter-account-edit-copy">
                        <span class="renter-account-edit-kicker">RENTER ACCOUNT</span>
                        <h3 id="renterAccountEditHeading">Your profile, kept up to date</h3>
                        <p>Update your name, contact email and phone number whenever your details change.</p>
                    </div>
                    <button type="button" class="secondary-button renter-edit-profile-compact" id="renterEditProfileBtn">✏️ Edit Profile</button>
                </div>"""

STYLE = r'''
/* GDR Renter Dashboard refinement — 2026-11-07. Kept after all legacy styles. */
#renterDashboard .renter-welcome-card,
#renterDashboard.gdrx-premium .renter-welcome-card{
  position:relative!important;isolation:isolate!important;display:block!important;
  min-height:0!important;margin:0 0 20px!important;padding:clamp(25px,4vw,38px)!important;
  overflow:hidden!important;border:1px solid #bfd3c4!important;border-radius:24px!important;
  background:linear-gradient(135deg,#f7fbf7 0%,#eaf3ec 58%,#e0ede4 100%)!important;
  color:#173d32!important;box-shadow:0 15px 36px rgba(21,67,48,.11),inset 0 1px 0 #fff!important;
}
#renterDashboard .renter-welcome-card::before{
  content:""!important;position:absolute!important;z-index:-1!important;inset:0 auto 0 0!important;
  width:6px!important;background:linear-gradient(180deg,#c6a76a,#174b35)!important;
}
#renterDashboard .renter-welcome-card::after{
  content:""!important;position:absolute!important;z-index:-1!important;right:-68px!important;top:-100px!important;
  width:250px!important;height:250px!important;border-radius:50%!important;
  background:radial-gradient(circle,rgba(255,255,255,.78),rgba(255,255,255,0) 70%)!important;
  pointer-events:none!important;
}
#renterDashboard .renter-welcome-copy{position:relative!important;z-index:1!important;width:100%!important;max-width:760px!important;min-width:0!important}
#renterDashboard .renter-welcome-copy h3{
  margin:9px 0 12px!important;color:#153d31!important;font-size:clamp(2rem,4.2vw,3rem)!important;
  font-weight:950!important;letter-spacing:-.045em!important;line-height:1.12!important;text-shadow:none!important;
  overflow-wrap:anywhere!important;
}
#renterDashboard .renter-welcome-copy p{
  max-width:650px!important;margin:0!important;color:#496257!important;
  font-size:clamp(14px,1.3vw,16px)!important;font-weight:550!important;line-height:1.7!important;
}
#renterDashboard .renter-welcome-card .dashboard-section-kicker{
  display:inline-block!important;color:#8a6a35!important;font-size:11px!important;
  font-weight:950!important;letter-spacing:.17em!important;
}
/* Explore Map: pale beige, separate from the Nearby action. */
#renterDashboard #renterExploreMapBtn,
#renterDashboard.gdrx-premium #renterExploreMapBtn{
  background:#E8D8C3!important;border:1px solid #D5C1A8!important;color:#493A2B!important;
  box-shadow:0 6px 0 #c4b097,0 14px 25px rgba(91,68,43,.13),inset 0 1px 0 rgba(255,255,255,.8)!important;
}
#renterDashboard #renterExploreMapBtn strong,
#renterDashboard #renterExploreMapBtn small,
#renterDashboard #renterExploreMapBtn .renter-action-arrow{color:#493A2B!important}
#renterDashboard #renterExploreMapBtn .renter-action-icon{
  background:#f7eee3!important;color:#493A2B!important;
  box-shadow:inset 0 1px 0 #fff,0 5px 12px rgba(73,58,43,.12)!important;
}
#renterDashboard #renterExploreMapBtn:hover{
  background:#e2cfb7!important;transform:translateY(-3px)!important;
  box-shadow:0 9px 0 #c4b097,0 18px 30px rgba(91,68,43,.16)!important;
}
/* Explore Nearby: premium forest green with white copy and accessible contrast. */
#renterDashboard #renterLiveNearbyBtn,
#renterDashboard.gdrx-premium #renterLiveNearbyBtn{
  background:#174B35!important;border:1px solid #103B2A!important;color:#fff!important;
  box-shadow:0 6px 0 #0c3324,0 14px 27px rgba(12,52,35,.22),inset 0 1px 0 rgba(255,255,255,.14)!important;
}
#renterDashboard #renterLiveNearbyBtn strong,
#renterDashboard #renterLiveNearbyBtn small,
#renterDashboard #renterLiveNearbyBtn em,
#renterDashboard #renterLiveNearbyBtn .renter-action-arrow{color:#fff!important}
#renterDashboard #renterLiveNearbyBtn .renter-live-radar-icon,
#renterDashboard #renterLiveNearbyBtn .renter-action-icon{
  background:#e7f1e9!important;color:#174B35!important;
}
#renterDashboard #renterLiveNearbyBtn .renter-radar-core{color:#174B35!important}
#renterDashboard #renterLiveNearbyBtn .renter-live-status-dot{background:#a9e2bd!important;box-shadow:0 0 0 4px rgba(169,226,189,.16)!important}
#renterDashboard #renterLiveNearbyBtn:hover{
  background:#103B2A!important;transform:translateY(-3px)!important;
  box-shadow:0 9px 0 #0c3324,0 18px 32px rgba(12,52,35,.25)!important;
}
/* Profile editing remains the existing single button and existing editor/form. */
#renterDashboard .renter-account-edit-card{
  display:flex!important;align-items:center!important;justify-content:space-between!important;
  gap:20px!important;min-width:0!important;margin:24px 0 8px!important;padding:20px 22px!important;
  border:1px solid #d9e2d8!important;border-radius:19px!important;
  background:linear-gradient(135deg,#fffefa 0%,#f4f7f1 100%)!important;
  box-shadow:0 10px 25px rgba(22,57,43,.07),inset 0 1px 0 #fff!important;
}
#renterDashboard .renter-account-edit-copy{min-width:0!important}
#renterDashboard .renter-account-edit-kicker{
  display:block!important;margin-bottom:7px!important;color:#927344!important;
  font-size:10px!important;font-weight:950!important;letter-spacing:.16em!important;
}
#renterDashboard .renter-account-edit-copy h3{
  margin:0 0 5px!important;color:#183e32!important;font-size:clamp(16px,2vw,19px)!important;
  font-weight:900!important;line-height:1.3!important;
}
#renterDashboard .renter-account-edit-copy p{
  margin:0!important;color:#63746a!important;font-size:13px!important;line-height:1.55!important;
}
#renterDashboard .renter-account-edit-card .renter-edit-profile-compact{
  display:inline-flex!important;flex:0 0 auto!important;align-items:center!important;justify-content:center!important;
  min-height:46px!important;margin:0!important;padding:0 19px!important;border:1px solid #c7ad79!important;
  border-radius:12px!important;background:linear-gradient(145deg,#fffdf7,#f0e4c9)!important;
  color:#173d34!important;font-size:13px!important;font-weight:900!important;white-space:nowrap!important;
  box-shadow:0 5px 0 #a88c58,0 10px 20px rgba(68,53,29,.12)!important;cursor:pointer!important;
}
#renterDashboard .renter-account-edit-card .renter-edit-profile-compact:hover{
  transform:translateY(-2px)!important;box-shadow:0 7px 0 #a88c58,0 14px 22px rgba(68,53,29,.15)!important;
}
#renterDashboard .renter-account-edit-card .renter-edit-profile-compact:focus-visible{
  outline:3px solid #b99756!important;outline-offset:3px!important;
}
@media(max-width:760px){
  #renterDashboard .renter-welcome-card{padding:24px 19px!important}
  #renterDashboard .renter-account-edit-card{align-items:stretch!important;flex-direction:column!important;gap:14px!important;padding:17px!important}
  #renterDashboard .renter-account-edit-card .renter-edit-profile-compact{width:100%!important;min-height:48px!important}
  #renterDashboard #renterExploreMapBtn,#renterDashboard #renterLiveNearbyBtn{width:100%!important;min-width:0!important;max-width:100%!important}
}
@media(max-width:390px){
  #renterDashboard .renter-welcome-copy h3{font-size:clamp(1.75rem,8vw,2.1rem)!important}
  #renterDashboard .renter-account-edit-copy p{font-size:12px!important}
}
@media(prefers-reduced-motion:reduce){
  #renterDashboard #renterExploreMapBtn,#renterDashboard #renterLiveNearbyBtn,
  #renterDashboard .renter-account-edit-card .renter-edit-profile-compact{transition:none!important}
}
'''

TEST_MARKER = "Renter Edit Profile is a single action below the main renter dashboard content"
TESTS_CONTENT = r'''
test('Renter Edit Profile is a single action below the main renter dashboard content', () => {
  const welcomeStart = index.indexOf('<div class="renter-welcome-card">');
  const actionsStart = index.indexOf('<div class="renter-dashboard-actions">', welcomeStart);
  const welcomeMarkup = index.slice(welcomeStart, actionsStart);
  const savedStart = index.indexOf('id="renterSavedPropertiesSection"');
  const editButton = index.indexOf('id="renterEditProfileBtn"');
  assert.ok(welcomeStart >= 0 && actionsStart > welcomeStart, 'renter welcome card is present');
  assert.doesNotMatch(welcomeMarkup, /renterEditProfileBtn/, 'Edit Profile is not inside the welcome card');
  assert.ok(savedStart >= 0 && editButton > savedStart, 'Edit Profile is positioned after the renter dashboard content');
  assert.equal((index.match(/id="renterEditProfileBtn"/g) || []).length, 1, 'only one Edit Profile button exists');
  assert.match(index, /getElementById\("renterEditProfileBtn"\)\?\.addEventListener\("click", openRenterProfileEditor\)/);
  assert.match(index, /getElementById\("renterProfileForm"\)\?\.addEventListener\("submit", saveRenterProfile\)/);
});

test('Renter dashboard action colors match the approved beige Map and forest-green Nearby palette', () => {
  assert.match(index, /#renterDashboard #renterExploreMapBtn[\s\S]*?background:#E8D8C3!important;border:1px solid #D5C1A8!important;color:#493A2B!important/);
  assert.match(index, /#renterDashboard #renterLiveNearbyBtn,[\s\S]*?background:#174B35!important;border:1px solid #103B2A!important;color:#fff!important/);
  assert.match(index, /#renterDashboard #renterLiveNearbyBtn:hover[\s\S]*?background:#103B2A!important/);
});

test('Renter welcome and account-edit cards remain responsive without replacing the existing profile editor', () => {
  assert.match(index, /Find a Home That Fits for You/);
  assert.match(index, /class="renter-account-edit-card"/);
  assert.match(index, /@media\(max-width:760px\)[\s\S]*?renter-account-edit-card\{align-items:stretch!important;flex-direction:column!important/);
  assert.match(index, /id="renterProfileEditor"/);
});

/* The promotional welcome hero is removed; renter actions and account tools remain. */
#renterDashboard .renter-welcome-card,
#renterDashboard.gdrx-premium .renter-welcome-card{display:none!important}
'''

def patch_index():
    source = INDEX.read_text(encoding="utf-8")
    if OLD_BUTTON in source:
        if source.count(OLD_BUTTON) != 1:
            raise SystemExit("Expected exactly one original renter Edit Profile button.")
        source = source.replace(OLD_BUTTON, "", 1)

    old_heading = "<h3>Find a home that fits for you.</h3>"
    new_heading = "<h3>Find a Home That Fits for You.</h3>"
    if old_heading in source:
        source = source.replace(old_heading, new_heading, 1)
    elif new_heading not in source:
        raise SystemExit("Could not find the renter welcome heading.")

    if 'id="renterEditProfileBtn"' not in source:
        saved_anchor = """<div id="renterSavedContainer"><p class="dashboard-empty">No property saved yet.</p></div>
                </div>
            </section>"""
        if source.count(saved_anchor) != 1:
            raise SystemExit("Could not safely locate the end of the renter dashboard.")
        source = source.replace(saved_anchor, saved_anchor.replace(
            "\n            </section>", "\n\n                " + NEW_CARD + "\n            </section>"
        ), 1)

    if STYLE_MARKER not in source:
        if 'id="gdr-renter-dashboard-visual-fix-v4"' not in source:
            raise SystemExit("Expected existing renter dashboard style block is missing.")
        style_end = source.rfind("</style>")
        if style_end < 0:
            raise SystemExit("Could not find the final style block.")
        source = source[:style_end] + STYLE + "\n" + source[style_end:]

    if source.count('id="renterEditProfileBtn"') != 1:
        raise SystemExit("Renter Edit Profile button must exist exactly once.")
    welcome_start = source.find('<div class="renter-welcome-card">')
    actions_start = source.find('<div class="renter-dashboard-actions">', welcome_start)
    saved_start = source.find('id="renterSavedPropertiesSection"')
    edit_start = source.find('id="renterEditProfileBtn"')
    if welcome_start < 0 or actions_start <= welcome_start or edit_start <= saved_start:
        raise SystemExit("Renter Edit Profile placement validation failed.")
    if "openRenterProfileEditor" not in source or "saveRenterProfile" not in source:
        raise SystemExit("Existing renter profile edit/save handlers are missing.")
    # Load the owner archive adapter after the existing dashboard scripts.
    archive_tag = '<script src="/assets/gdr-owner-property-archive.js"></script>'
    if archive_tag not in source:
        body_end = source.lower().rfind("</body>")
        if body_end < 0:
            raise SystemExit("Could not safely insert the owner archive adapter.")
        source = source[:body_end] + archive_tag + "\\n" + source[body_end:]
    INDEX.write_text(source, encoding="utf-8")
    print("Renter dashboard markup and final responsive styles verified.")

def patch_tests():
    source = TESTS.read_text(encoding="utf-8")
    if TEST_MARKER not in source:
        TESTS.write_text(source.rstrip() + "\n\n" + TESTS_CONTENT + "\n", encoding="utf-8")
    print("Renter dashboard acceptance tests are present.")

if __name__ == "__main__":
    patch_index()
    patch_tests()
