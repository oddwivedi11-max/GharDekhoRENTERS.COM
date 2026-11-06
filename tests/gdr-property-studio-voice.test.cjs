const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const js=fs.readFileSync(path.join(root,"assets/gdr-property-studio.js"),"utf8");
const markup=fs.readFileSync(path.join(root,"assets/gdr-property-studio.html"),"utf8");
const css=fs.readFileSync(path.join(root,"assets/gdr-property-studio.css"),"utf8");
test("owner voice recognition is continuous and shows interim transcript",()=>{
 assert.match(js,/rec\.continuous=true/);
 assert.match(js,/rec\.interimResults=true/);
 assert.match(js,/state\.voice\.turnText/);
 assert.match(js,/scheduleVoiceRestart/);
 assert.match(js,/state\.voice\.interimText\.trim\(\)/);
});
test("owner voice assistant restarts after normal browser session end but respects manual stop",()=>{
 assert.match(js,/state\.voice\.active&&!state\.voice\.manualStop/);
 assert.match(js,/state\.voice\.permissionBlocked/);
 assert.match(js,/function stopVoice\(\)/);
});
test("owner voice assistant requires confirmation before committing recognized values",()=>{
 assert.match(js,/function applyVoicePending/);
 assert.match(js,/state\.voice\.awaitingConfirmation&&isVoiceYes/);
 assert.match(js,/gdrStudioVoiceConfirm/);
 assert.match(js,/function processVoiceTurn/);
 assert.match(js,/const correction=extractVoiceDetails\(raw\)/);
});
test("owner voice assistant uses browser-native speech synthesis and no paid AI API",()=>{
 assert.match(js,/SpeechSynthesisUtterance/);
 assert.match(js,/window\.speechSynthesis/);
 assert.doesNotMatch(js,/openai\.com\/v1|generativelanguage|elevenlabs|api\.openai/i);
});
test("owner voice UI includes reply, confirmation, mute and transcript controls",()=>{
 for(const id of ["gdrStudioVoiceAssistant","gdrStudioVoiceReply","gdrStudioVoicePending","gdrStudioVoiceConfirm","gdrStudioVoiceMute","gdrStudioVoiceTranscript"])assert.ok(markup.includes(id),id);
 assert.match(css,/gdr-studio-voice-assistant/);
});
