const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const js=fs.readFileSync(path.join(root,"assets/gdr-property-studio.js"),"utf8");
const markup=fs.readFileSync(path.join(root,"assets/gdr-property-studio.txt"),"utf8");
const css=fs.readFileSync(path.join(root,"assets/gdr-property-studio.css"),"utf8");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");

test("owner voice recognition is one-shot and never automatically restarts",()=>{
 assert.ok(js.includes("rec.continuous=false"));
 assert.ok(js.includes("rec.interimResults=true"));
 assert.ok(js.includes("state.voice.turnText"));
 assert.ok(js.includes("String(state.voice.turnText||\"\").trim()"));
 assert.ok(!js.includes("scheduleVoiceRestart"));
 assert.ok(js.includes("state.voice.active=false;state.recording=false"));
});
test("owner microphone starts only from the explicit Start button and Stop aborts the session",()=>{
 assert.ok(js.includes('$("#gdrStudioVoiceStart")?.addEventListener("click",startVoice)'));
 assert.ok(js.includes("function stopVoice()"));
 assert.ok(js.includes("rec.abort?rec.abort():rec.stop()"));
 assert.ok(js.includes("state.voice.session++"));
});
test("owner voice updates the actual existing form immediately and preserves edit state",()=>{
 assert.ok(js.includes("function applyVoiceValues(pending)"));
 assert.ok(js.includes("applyVoiceValues(extracted)"));
 assert.ok(js.includes("syncFormFromState();saveDraft()"));
 assert.ok(js.includes("function applyVoicePending()"));
 assert.ok(js.includes("state.step=key?steps[key]:0"));
 assert.ok(js.includes("The original form is open"));
});
test("owner voice requires explicit confirmation and never auto-publishes",()=>{
 assert.ok(js.includes("state.voice.awaitingConfirmation&&isVoiceYes"));
 assert.ok(js.includes("gdrStudioVoiceConfirm"));
 assert.ok(js.includes("I won't publish automatically"));
 assert.ok(js.includes("owner_publish_property_studio"));
});
test("owner voice maps Room separately and the existing runtime form exposes it",()=>{
 assert.ok(js.includes('room:"Room"'));
 assert.ok(js.includes('out.propertyType="room"'));
 assert.ok(markup.includes('data-gdr-property-type="room"'));
});
test("owner voice uses browser-native speech synthesis and no paid AI API",()=>{
 assert.ok(js.includes("SpeechSynthesisUtterance"));
 assert.ok(js.includes("window.speechSynthesis"));
 assert.doesNotMatch(js,/openai\.com\/v1|generativelanguage|elevenlabs|api\.openai/i);
});
test("owner voice UI includes reply, confirmation, mute and transcript controls",()=>{
 for(const id of ["gdrStudioVoiceAssistant","gdrStudioVoiceReply","gdrStudioVoicePending","gdrStudioVoiceConfirm","gdrStudioVoiceMute","gdrStudioVoiceTranscript"])assert.ok(markup.includes(id),id);
 assert.ok(css.includes("gdr-studio-voice-assistant"));
});
test("PG and hostel voice listing keeps its room and bed fields",()=>{
 for(const field of ['field="roomType"','field="gender"','field="totalBeds"','field="availableBeds"','field="foodIncluded"'])assert.ok(js.includes(field));
});

test("owner voice assistant has a prominent microphone and three language choices",()=>{
 assert.ok(markup.includes('class="gdr-studio-mic-button"'));
 assert.ok(markup.includes('value="hi-IN-hinglish"'));
 assert.ok(markup.includes('value="en-IN"'));
 assert.ok(markup.includes('id="gdrStudioVoiceStop"'));
});
test("owner voice form preview shows live fields and manual edit controls",()=>{
 assert.ok(markup.includes('id="gdrStudioLiveFields"'));
 assert.ok(js.includes("function renderLiveVoiceForm()"));
 assert.ok(js.includes('data-gdr-voice-edit'));
 assert.ok(js.includes("function editVoiceField(key)"));
 assert.ok(js.includes("renderLiveVoiceForm();"));
 assert.ok(css.includes(".gdr-studio-live-field"));
});
test("owner voice uses only browser-native recognition locales and retains explicit mic start",()=>{
 assert.ok(js.includes('startsWith("en")?"en-IN":"hi-IN"'));
 assert.ok(js.includes('$("#gdrStudioVoiceStart")?.addEventListener("click",startVoice)'));
});

test("owner voice extracts a bare city/locality and context-only rent or deposit answers",()=>{
 assert.ok(js.includes('state.voice.lastField==="address"'));
 assert.ok(js.includes("cityPattern"));
 assert.ok(js.includes('state.voice.lastField==="rent"'));
 assert.ok(js.includes('state.voice.lastField==="deposit"'));
});
test("owner voice interprets partly furnished wording as semi-furnished",()=>{
 assert.ok(js.includes("partly furnished|partially furnished|thoda furnished"));
 assert.ok(js.includes('/semi|partly|partially|thoda/'));
});

test("manual listing panels come first and optional voice assistance follows them",()=>{
 const voice=markup.indexOf('class="gdr-studio-voice"');
 const first=markup.indexOf('data-gdr-studio-panel="0"');
 const preview=markup.indexOf('data-gdr-studio-panel="4"');
 const footer=markup.indexOf('class="gdr-studio-footer"');
 assert.ok(first>=0&&preview>first&&voice>preview&&footer>voice);
 assert.ok(markup.includes("Manual entry is the primary option"));
 assert.ok(js.includes('roomType:"gdrStudioRoomType"'));
 assert.ok(js.includes('availableBeds:"gdrStudioAvailableBeds"'));
 assert.ok(js.includes('foodIncluded:"gdrStudioFoodIncluded"'));
});

test("owner listing hero makes manual listing primary and keeps voice only in the optional form",()=>{
 const hero=index.slice(index.indexOf('id="gdrListPropertyHero"'),index.indexOf("</section>",index.indexOf('id="gdrListPropertyHero"')));
 assert.ok(hero.includes('id="gdrListPropertyStart"'));
 assert.ok(!hero.includes('id="gdrListPropertySpeak"'));
 assert.ok(markup.includes("Manual entry is the primary option"));
 assert.ok(markup.indexOf('class="gdr-studio-voice"')>markup.indexOf('data-gdr-studio-panel="4"'));
 assert.match(index,/gdr-property-studio\.js\?v=20261113-pin-auto-map1/);
 assert.match(index,/gdr-property-studio\.css\?v=20261112-touch-swipe1/);
});
test("owner profile edit remains connected to its existing secure update flow",()=>{
 assert.ok(index.includes('id="ownerEditProfileBtn">✏️ Edit Profile</button>'));
 assert.ok(index.includes('id="ownerProfileForm"'));
 assert.ok(index.includes('id="ownerProfileEditor"'));
 assert.ok(index.includes('rpc("update_my_owner_profile"'));
 assert.ok(index.includes('addEventListener("submit", saveOwnerProfile)'));
 assert.ok(index.includes('addEventListener("click", openOwnerProfileEditor)'));
 assert.ok(css.includes("#ownerDashboard .owner-profile-card #ownerEditProfileBtn"));
});

test("new owner listings restore only their own saved text draft and re-confirm exact location",()=>{
  assert.ok(js.includes("resetNewListing(true);"));
  assert.ok(js.includes("const recovered=restoreDraft();"));
  assert.ok(js.includes("payload.ownerId!==state.user.id"));
  assert.ok(js.includes("state.locationConfirmed=false"));
  assert.ok(js.includes("function dismissDraftRecovery()"));
  assert.ok(js.includes("function clearLegacyDraft()"));
});
test("successful listing returns to the dashboard without a new auth/login navigation",()=>{
 assert.ok(js.includes("window.renderActiveDashboard()"));
 assert.ok(js.includes("window.history.replaceState"));
 assert.ok(!js.includes("window.location.reload()"));
 assert.ok(!js.includes("supabaseClient.auth.signOut"));
});
