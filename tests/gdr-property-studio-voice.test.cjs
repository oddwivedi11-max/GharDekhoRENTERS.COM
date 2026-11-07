const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const js=fs.readFileSync(path.join(root,"assets/gdr-property-studio.js"),"utf8");
const markup=fs.readFileSync(path.join(root,"assets/gdr-property-studio.txt"),"utf8");
const css=fs.readFileSync(path.join(root,"assets/gdr-property-studio.css"),"utf8");

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
