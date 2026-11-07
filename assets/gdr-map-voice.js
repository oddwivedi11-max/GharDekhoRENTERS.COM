(function(){
"use strict";
const VERSION="20261107-map-voice6";
const $=id=>document.getElementById(id);
const state={root:null,recognition:null,active:false,finalText:"",interimText:"",silenceTimer:null,session:0,searchId:0,executed:"",language:"hi-IN",muted:false,city:"",prefs:{},speaking:false,lastError:""};
const text=(hi,en)=>state.language==="en-IN"?en:hi;
function status(message,kind){const el=$("gdrMapVoiceStatus");if(el){el.textContent=message||"";el.dataset.state=kind||"idle";}}
function transcript(){const el=$("gdrMapVoiceTranscript");if(el)el.value=[state.finalText,state.interimText].filter(Boolean).join(" ").trim();}
function speak(message){
 const reply=$("gdrMapVoiceReply");if(reply)reply.textContent=message;
 if(state.muted||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
 try{
  window.speechSynthesis.cancel();state.speaking=true;
  const u=new SpeechSynthesisUtterance(message),lang=state.language;
  u.lang=lang;
  const voices=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
  const selected=voices.find(v=>String(v.lang||"").toLowerCase()===lang.toLowerCase())||voices.find(v=>String(v.lang||"").toLowerCase().startsWith(lang.slice(0,2)));
  if(selected)u.voice=selected;
  u.onend=()=>{state.speaking=false;};u.onerror=()=>{state.speaking=false;};
  window.speechSynthesis.speak(u);
 }catch(_){state.speaking=false;}
}
function normalize(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();}
function extractIntent(raw){
 const assistant=window.GDRRenterExperience;
 if(assistant&&typeof assistant.parseRequest==="function"){
  const parsed=assistant.parseRequest(raw)||{},prefs={...state.prefs};
  ["minBudget","maxBudget","bhk","furnishing","stayType","propertyType"].forEach(key=>{
   if(parsed[key]!==undefined&&parsed[key]!==null&&parsed[key]!=="")prefs[key]=parsed[key];
  });
  const request=String(raw||"");
  const allListings=/(?:\b(?:all|every|any)\s+(?:(?:available|rental)\s+)*(?:properties|listings|homes|houses)\b|(?:जितने\s+भी|सभी|सारे|सारी)\s*(?:उपलब्ध\s*)?(?:प्रॉपर्टी|प्रॉपर्टीज|लिस्टिंग|घर|मकान))/i.test(request);
  if(allListings){["bhk","minBudget","maxBudget","furnishing","stayType","propertyType"].forEach(key=>delete prefs[key]);}
  if(/\b(?:any|all)\s+(?:bhk|bedrooms?)\b|(?:कोई भी|सभी)\s*(?:बीएचके|बेडरूम)|सभी प्रकार के घर/i.test(request))delete prefs.bhk;
  if(/\b(?:clear|remove|reset)\s+(?:budget|rent)\b|\b(?:budget|rent)\s+(?:hatao|remove)\b|बजट हटाओ|किराया हटाओ/i.test(request)){delete prefs.minBudget;delete prefs.maxBudget;}
  if(/\b(?:clear|remove|reset)\s+(?:bhk|bedrooms?)\b|\b(?:bhk|bedroom)\s+(?:hatao|remove)\b|बीएचके हटाओ|बेडरूम हटाओ/i.test(request))delete prefs.bhk;
  if(/\b(?:clear|remove|reset)\s+(?:furnishing|furnished)\b|\bfurnishing\s+(?:hatao|remove)\b|फर्निशिंग हटाओ/i.test(request))delete prefs.furnishing;
  if(/\b(?:clear|remove|reset)\s+(?:property type|flat type|home type)\b|प्रॉपर्टी टाइप हटाओ/i.test(request)){delete prefs.propertyType;delete prefs.stayType;}
  return {prefs,location:String(parsed.location||""),nearMe:!!parsed.useMyLocation,radiusKm:parsed.radiusKm==null?null:Number(parsed.radiusKm),raw:request};
 }
 return {prefs:{...state.prefs},location:String(raw||"").trim(),nearMe:false,radiusKm:null,raw:String(raw||"")};
}
function setMic(on){
 state.active=on;
 const btn=$("gdrMapVoiceMic");
 if(btn){
  btn.classList.toggle("is-listening",on);
  btn.setAttribute("aria-pressed",String(on));
  btn.setAttribute("aria-label",on?"Stop map voice search":"Start map voice search");
  btn.innerHTML=on
   ?'<span class="gdr-map-voice-mic-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg></span><span class="gdr-map-voice-mic-label">Stop</span>'
   :'<span class="gdr-map-voice-mic-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="9" y="2.5" width="6" height="12" rx="3"></rect><path d="M5.5 10.5v1.2a6.5 6.5 0 0 0 13 0v-1.2M12 18.2v3.3m-4 0h8"></path></svg></span><span class="gdr-map-voice-mic-label">Speak</span>';
 }
}
function finishTurn(){
 if(state.silenceTimer){clearTimeout(state.silenceTimer);state.silenceTimer=null;}
 const final=String(state.finalText||"").trim();
 state.interimText="";transcript();
 const recognition=state.recognition;state.recognition=null;state.session++;
 if(recognition){try{recognition.stop();}catch(_){}}
 setMic(false);
 if(final&&final!==state.executed){state.executed=final;runTurn(final);}
 else if(!final)status(state.lastError||text("आवाज़ का final transcript नहीं मिला। कृपया दोबारा बोलें।","No final speech transcript was received. Please try again."),state.lastError?"error":"error");
}
function startListening(){
 if(state.active||state.recognition)return;
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){status(text("इस browser में speech recognition उपलब्ध नहीं है। आप नीचे लिखकर Search कर सकते हैं।","Speech recognition is unavailable in this browser. You can type and search below."),"error");$("gdrMapVoiceTranscript")?.focus();return;}
 if(!window.isSecureContext){status("Microphone requires a secure HTTPS connection.","error");return;}
 state.finalText="";state.interimText="";state.executed="";state.lastError="";transcript();
 const r=new Speech(),session=++state.session;state.recognition=r;state.active=true;setMic(true);
 r.lang=state.language;r.continuous=false;r.interimResults=true;r.maxAlternatives=3;
 r.onstart=()=>{if(session!==state.session)return;setMic(true);status(text("सुन रहा हूँ… अपना पूरा सवाल बोलें। बोलना पूरा होते ही search शुरू होगा।","Listening… say your complete request. Search starts as soon as speech recognition finishes."),"listening");};
 r.onresult=e=>{
  if(session!==state.session)return;
  let interim="";
  for(let i=e.resultIndex;i<e.results.length;i++){
   const item=e.results[i],spoken=String(item[0]?.transcript||"").trim();
   if(!spoken)continue;
   if(item.isFinal){
    const current=normalize(state.finalText),next=normalize(spoken);
    if(!current)state.finalText=spoken;
    else if(next===current||current.endsWith(" "+next)){}
    else if(next.startsWith(current+" "))state.finalText=spoken;
    else state.finalText=(state.finalText+" "+spoken).trim();
    state.interimText="";
   }else interim+=(interim?" ":"")+spoken;
  }
  if(interim&&!state.finalText)state.interimText=interim;
  transcript();
  if(state.finalText.trim()){
   if(state.silenceTimer)clearTimeout(state.silenceTimer);
   state.silenceTimer=setTimeout(finishTurn,450);
  }
 };
 r.onerror=e=>{
  if(session!==state.session)return;
  const messages={
   "not-allowed":text("Microphone permission blocked है। Browser site settings में Microphone Allow करें।","Microphone permission is blocked. Allow it in browser site settings."),
   "service-not-allowed":text("इस browser में speech service अनुमति नहीं मिली। Microphone permission और browser settings जाँचें।","The browser speech service is not permitted. Check microphone permission and browser settings."),
   "audio-capture":text("Microphone नहीं मिला। सही input device connect करके दोबारा कोशिश करें।","No microphone was detected. Connect an input device and try again."),
   "language-not-supported":text("चुनी हुई भाषा speech recognition में उपलब्ध नहीं है। Language बदलें।","The selected language is unavailable for speech recognition. Change the language."),
   "network":text("Browser speech recognition service तक network connection नहीं पहुँच पाया। Connection जाँचें और फिर कोशिश करें।","The browser speech recognition service could not be reached. Check your connection and retry."),
   "no-speech":text("कोई आवाज़ detect नहीं हुई। Mic दबाकर फिर बोलें।","No speech was detected. Tap the microphone and try again.")
  };
  state.lastError=messages[e.error]||text("Speech recognition में समस्या आई: "+String(e.error||"unknown"),"Speech recognition error: "+String(e.error||"unknown"));
  status(state.lastError,"error");
 };
 r.onend=()=>{
  if(session!==state.session)return;
  state.recognition=null;
  if(state.silenceTimer){clearTimeout(state.silenceTimer);state.silenceTimer=null;}
  if(state.finalText.trim()){finishTurn();return;}
  setMic(false);
  if(state.lastError){status(state.lastError,"error");return;}
  state.active=false;status(text("आवाज़ पूरी तरह समझ नहीं आई। Mic दबाकर दोबारा बोलें।","I couldn't recognize a complete request. Tap the mic and try again."),"error");
 };
 try{r.start();}
 catch(error){state.recognition=null;state.active=false;setMic(false);state.lastError=text("Microphone शुरू नहीं हो पाया। दोबारा कोशिश करें।","The microphone could not start. Please try again.");status(state.lastError,"error");}
}
async function runTurn(raw){
 const assistant=window.GDRRenterExperience,api=window.GDRMapExperience;
 if(!assistant||typeof assistant.searchAssistantListings!=="function"){
  status(text("Smart Home Search अभी load हो रहा है। कृपया दोबारा कोशिश करें।","Smart Home Search is still loading. Please try again."),"error");return;
 }
 const intent=extractIntent(raw),location=intent.location||state.city;
 if(intent.location)state.city=intent.location;
 state.prefs={...intent.prefs};
 if(!location&&!intent.nearMe){
  status(text("Location साफ़ समझ नहीं आई। कृपया locality और शहर बोलें, जैसे बड़े नगर या सिंगरौली।","I couldn't identify the location. Please say the locality and city, such as Bade Nagar or Singrauli."),"error");
  speak(text("कृपया locality और शहर का नाम दोबारा बोलें।","Please repeat the locality and city name."));return;
 }
 const target=$("gdrMapVoiceResults"),searchId=++state.searchId;
 if(target)target.replaceChildren();
 status(text("समझ गया। आपकी बताई location और filters के अनुसार असली घर खोज रहा हूँ…","Got it. Searching real homes using your location and filters…"),"processing");
  speak(text("समझ गया। "+(location?location+" में ":"")+"आपकी बताई शर्तों के अनुसार घर खोज रहा हूँ।","Got it. Searching homes "+(location?"in "+location+" ":"")+"using your requested filters."));
 try{
  let rows=[],mapSummary=null;
  if(intent.nearMe){
   if(!api||typeof api.searchAtCoordinates!=="function")throw new Error(text("Nearby map search अभी उपलब्ध नहीं है।","Nearby map search is not available right now."));
   if(typeof api.setRenterSearchPreferences==="function")api.setRenterSearchPreferences(state.prefs);
   if(intent.radiusKm!=null&&typeof api.setRenterRadius==="function")api.setRenterRadius(intent.radiusKm,true);
   const position=await new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject(new Error("This browser does not support location access."));return;}
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
   });
   if(searchId!==state.searchId)return;
   const point=await api.searchAtCoordinates(position.coords.latitude,position.coords.longitude,"My location");
   rows=Array.isArray(point)?point:(api.getRenterVisibleProperties()||[]);
   if(target){
    const note=document.createElement("p");
    note.textContent=rows.length?text("आपके आसपास के घर map और list में दिख रहे हैं।","Nearby homes are shown on the map and list."):text("आपके आसपास कोई matching home नहीं मिला।","No matching homes found nearby.");
    target.append(note);
   }
  }else{
   if(api&&typeof api.setRenterSearchPreferences==="function")api.setRenterSearchPreferences(state.prefs);
   rows=await assistant.searchAssistantListings({...state.prefs,location},raw,target);
   if(searchId!==state.searchId)return;
   if(api&&typeof api.showVoiceSearchResults==="function"){
    let point=null;
    try{if(typeof api.resolveMapQuery==="function")point=await api.resolveMapQuery(location);}
    catch(error){console.warn("GDR voice result map-centering skipped:",error);}
    if(searchId!==state.searchId)return;
    mapSummary=api.showVoiceSearchResults(rows,point,location);
   }
  }
  if(searchId!==state.searchId)return;
  if(!Array.isArray(rows))throw new Error(text("Property search response सही नहीं मिला।","The property search returned an invalid response."));
  const count=Number(rows.totalCount??rows.length),loaded=rows.length,place=intent.nearMe?text("आपकी current location","your current location"):location;
  if(count){
   const mapNote=mapSummary&&mapSummary.unmapped?text(" "+mapSummary.mapped+" घर map पर pin हुए हैं और "+mapSummary.unmapped+" बिना verified coordinates वाले घर list में दिख रहे हैं।"," "+mapSummary.mapped+" homes are pinned on the map; "+mapSummary.unmapped+" without verified coordinates remain visible in the results list."):"";
   const pageNote=loaded<count?text(" अभी "+loaded+" दिखाए जा रहे हैं; बाकी properties के लिए Load More दबाएँ।"," Showing "+loaded+" now; use Load More to fetch the remaining properties."):"";
   status(text(place+" में कुल "+count+" matching properties मिली हैं।"+pageNote+mapNote+" उनकी details नीचे Available Rental Properties में देखें।","Found "+count+" matching properties in "+place+"."+pageNote+mapNote+" See their details in Available Rental Properties below."),"success");
   speak(text(place+" में कुल "+count+" properties मिली हैं।"+pageNote+mapNote,"Found "+count+" properties in "+place+"."+pageNote+mapNote));
  }else{
   status(text(place+" में इन filters के साथ कोई matching घर नहीं मिला। Location या filters जाँचें।","No matching homes found in "+place+" with these filters. Check the location or filters."),"empty");
   speak(text("इस location में matching घर नहीं मिले। आप locality या budget बदलकर बोल सकते हैं।","No matching homes found. You can try another locality or budget."));
  }
 }catch(error){
  if(searchId!==state.searchId)return;
  console.error("GDR database voice search failed:",error);
  const message=error.message||text("Search पूरी नहीं हो सकी। दोबारा कोशिश करें।","Search could not be completed. Please try again.");
  status(message,"error");speak(message);
 }
}
function mount(panel){
 if(!panel||state.root)return;
 const root=document.createElement("section");root.className="gdr-map-voice";root.id="gdrMapVoiceAssistant";
 root.innerHTML='<div class="gdr-map-voice-head"><div><span class="gdr-map-voice-kicker">GHARDEKHO SMART HOME ASSISTANT</span><h3>Find your home by talking naturally</h3><p>Say a locality, BHK and budget in Hindi, Hinglish or English. Results appear below.</p></div><label class="gdr-map-voice-language">Language<select id="gdrMapVoiceLanguage"><option value="hi-IN">हिंदी / Hinglish</option><option value="en-IN">English (India)</option></select></label></div><div class="gdr-map-voice-controls"><textarea id="gdrMapVoiceTranscript" rows="2" placeholder="बोलें या यहाँ अपनी property search लिखें…" aria-label="Voice transcript or typed property search"></textarea><button type="button" id="gdrMapVoiceMic" class="gdr-map-voice-mic" aria-label="Start map voice search" aria-pressed="false"><span class="gdr-map-voice-mic-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="9" y="2.5" width="6" height="12" rx="3"></rect><path d="M5.5 10.5v1.2a6.5 6.5 0 0 0 13 0v-1.2M12 18.2v3.3m-4 0h8"></path></svg></span><span class="gdr-map-voice-mic-label">Speak</span></button></div><div class="gdr-map-voice-footer"><span id="gdrMapVoiceStatus" class="gdr-map-voice-status" data-state="idle" role="status" aria-live="polite">Tap the microphone to speak, or type a search.</span><div><button type="button" id="gdrMapVoiceSearch" class="gdr-map-voice-search">Search map</button><button type="button" id="gdrMapVoiceMute" class="gdr-map-voice-mute" aria-pressed="false">Mute voice</button></div></div><p id="gdrMapVoiceReply" class="gdr-map-voice-reply" aria-live="polite">नमस्ते! मैं GDRS, आपका GharDekho Personal Property Assistant हूँ। आप 1, 2, 3 या 4 BHK, location और rent budget बोल सकते हैं।</p><div id="gdrMapVoiceResults" class="gdr-map-voice-results" aria-live="polite"></div>';
 const heading=panel.querySelector(".gdr-map-head, .gdr-map-header, .gdr-explore-map-header, header");
 if(heading&&heading.parentNode===panel)heading.insertAdjacentElement("afterend",root);else panel.insertBefore(root,panel.firstChild);
 state.root=root;
 $("gdrMapVoiceLanguage").addEventListener("change",e=>{state.language=e.target.value;});
 $("gdrMapVoiceMic").addEventListener("click",()=>{if(state.active){if(state.recognition){try{state.recognition.stop();}catch(_){}}finishTurn();}else startListening();});
 $("gdrMapVoiceSearch").addEventListener("click",()=>{const value=$("gdrMapVoiceTranscript").value.trim();if(value){state.finalText=value;state.interimText="";runTurn(value);}else status("Type a city or property request first.","error");});
 $("gdrMapVoiceTranscript").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("gdrMapVoiceSearch").click();}});
 $("gdrMapVoiceMute").addEventListener("click",e=>{state.muted=!state.muted;e.currentTarget.textContent=state.muted?"Unmute voice":"Mute voice";e.currentTarget.setAttribute("aria-pressed",String(state.muted));if(state.muted&&window.speechSynthesis)window.speechSynthesis.cancel();});
}
function destroy(){state.session++;if(state.silenceTimer)clearTimeout(state.silenceTimer);if(state.recognition){try{state.recognition.stop();}catch(_){}}state.recognition=null;state.active=false;setMic(false);if(window.speechSynthesis)window.speechSynthesis.cancel();}
window.addEventListener("pagehide",destroy);
window.GDRMapVoiceAssistant={mount,destroy,runTurn,version:VERSION};
})();