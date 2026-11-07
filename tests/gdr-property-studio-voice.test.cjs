const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const js=fs.readFileSync(path.join(root,"assets/gdr-property-studio.js"),"utf8");
const markup=fs.readFileSync(path.join(root,"assets/gdr-property-studio.txt"),"utf8");
const css=fs.readFileSync(path.join(root,"assets/gdr-property-studio.css"),"utf8");

test("owner voice recognition is one-shot and never automatically restarts",()=>{
 assert.match(js,/rec\\.continuous=false/);
 assert.match(js,/rec\\.interimResults=true/);
 assert.match(js,/state\\.voice\\.turnText/);
 assert.doesNotMatch(js,/scheduleVoiceRestart/);
 assert.match(js,/state\\.voice\\.active=false;state\\.recording=false/);
});
test("owner microphone starts only from the explicit Start button and Stop aborts the session",()=>{
 assert.match(js,/gdrStudioVoiceStart.*addEventListener\\("click",startVoice\\)/);
 assert.match(js,/function stopVoice\\(\\)/);
 assert.match(js,/rec\\.abort\\?rec\\.abort\\(\\):rec\\.stop\\(\\)/);
 assert.match(js,/state\\.voice\\.session\\+\\+/);
});
test("owner voice updates the actual existing form immediately and preserves edit state",()=>{
 assert.match(js,/function applyVoiceValues\\(pending\\)/);
 assert.match(js,/applyVoiceValues\\(extracted\\)/);
 assert.match(js,/syncFormFromState\\(\\);saveDraft\\(\\)/);
 assert.match(js,/function applyVoicePending\\(\\)/);
 assert.match(js,/state\\.step=key\\?steps\\[key\\]:0/);
 assert.match(js,/The original form is open/);
});
test("owner voice requires explicit confirmation and never auto-publishes",()=>{
 assert.match(js,/state\\.voice\\.awaitingConfirmation&&isVoiceYes/);
 assert.match(js,/gdrStudioVoiceConfirm/);
 assert.match(js,/I won't publish automatically/);
 assert.match(js,/owner_publish_property_studio/);
});
test("owner voice maps Room separately and the existing runtime form exposes it",()=>{
 assert.match(js,/room:"Room"/);
 assert.match(js,/out\\.propertyType="room"/);
 assert.match(markup,/data-gdr-property-type="room"/);
});
test("owner voice uses browser-native speech synthesis and no paid AI API",()=>{
 assert.match(js,/SpeechSynthesisUtterance/);
 assert.match(js,/window\\.speechSynthesis/);
 assert.doesNotMatch(js,/openai\\.com\\/v1|generativelanguage|elevenlabs|api\\.openai/i);
});
test("owner voice UI includes reply, confirmation, mute and transcript controls",()=>{
 for(const id of ["gdrStudioVoiceAssistant","gdrStudioVoiceReply","gdrStudioVoicePending","gdrStudioVoiceConfirm","gdrStudioVoiceMute","gdrStudioVoiceTranscript"])assert.ok(markup.includes(id),id);
 assert.match(css,/gdr-studio-voice-assistant/);
});
test("PG and hostel voice listing keeps its room and bed fields",()=>{
 assert.match(js,/field="roomType"/);
 assert.match(js,/field="gender"/);
 assert.match(js,/field="totalBeds"/);
 assert.match(js,/field="availableBeds"/);
 assert.match(js,/field="foodIncluded"/);
});
