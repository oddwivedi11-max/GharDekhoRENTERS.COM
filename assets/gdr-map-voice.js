(function(){
"use strict";
const VERSION="20261107-voice1";
const $=id=>document.getElementById(id);
const state={root:null,recognition:null,active:false,finalText:"",interimText:"",silenceTimer:null,session:0,executed:"",language:"hi-IN",muted:false,city:"",prefs:{},speaking:false,manualStop:false};
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
 const s=String(raw||"").trim(),n=normalize(s),p={...state.prefs};
 const moneyMatch=s.match(/(?:under|below|less than|within|upto|up to|ke andar|ke under|tak|से कम|के अंदर|तक)\s*₹?\s*([\d,]+)/i);
 if(moneyMatch)p.maxBudget=Number(moneyMatch[1].replace(/,/g,""));
 const minMatch=s.match(/(?:above|more than|minimum|at least|से ज्यादा|से ऊपर)\s*₹?\s*([\d,]+)/i);
 if(minMatch)p.minBudget=Number(minMatch[1].replace(/,/g,""));
 const bhk=s.match(/\b(1|2|3|4|5|one|two|three|four|five)\s*(?:bhk|bed\s?room)\b/i)||s.match(/\b(1|2|3|4|5)\s*बीएचके\b/i);
 if(bhk){const v=String(bhk[1]).toLowerCase();p.bhk=({one:1,two:2,three:3,four:4,five:5}[v]||Number(v));}
 if(/\b(semi furnished|semi-furnished)\b|सेमी फर्निश्ड/i.test(s))p.furnishing="Semi-Furnished";
 else if(/\b(unfurnished|without furniture)\b|बिना फर्नीचर/i.test(s))p.furnishing="Unfurnished";
 else if(/\b(furnished|fully furnished)\b|फर्निश्ड/i.test(s))p.furnishing="Furnished";
 if(/\b(pg|paying guest)\b/i.test(s))p.stayType="pg";
 else if(/\b(hostel)\b/i.test(s))p.stayType="hostel";
 else if(/\b(flat|apartment)\b/i.test(s))p.propertyType="flat";
 else if(/\b(independent house|villa|house)\b/i.test(s))p.propertyType="house";
 const locationText=s
  .replace(/(?:under|below|less than|within|upto|up to|ke andar|ke under|tak|से कम|के अंदर|तक)\s*₹?\s*[\d,]+/ig," ")
  .replace(/(?:above|more than|minimum|at least|से ज्यादा|से ऊपर)\s*₹?\s*[\d,]+/ig," ")
  .replace(/\b\d+\s*(?:bhk|bed\s?room|बीएचके)\b/ig," ")
  .replace(/\b(1|2|3|4|5)\s*(?:bhk|bedroom)\b/ig," ")
  .replace(/\b(mujhe|please|show|find|search|available|rental|rent|property|properties|home|homes|house|houses|flat|flats|apartment|apartments|room|rooms|dikhao|dikhaiye|dikhana|chahiye|mein|me|mai|ke|ka|ki|par|near|in|at|all|saare|sare|jitne|bhi|ghar|makan|kiraye|wala|wale|wali|sirf|only|furnished|unfurnished|semi furnished|pg|hostel|under|within|budget)\b/ig," ")
  .replace(/(मुझे|दिखाओ|दिखाइए|दिखाना|चाहिए|में|मे|के|का|की|पर|सारे|सारे|जितने|भी|घर|मकान|किराये|वाले|वाली|सिर्फ|उपलब्ध|दिखा दो|कितने)/g," ");
 const candidate=locationText.replace(/[₹,]/g," ").replace(/\s+/g," ").trim();
 const locationOnly=n.length>0&&candidate.length>1&&!/^(mere aas paas|near me|around me|my location)$/.test(normalize(candidate));
 return {prefs:p,location:locationOnly?candidate:"",nearMe:/\b(near me|around me|my location|aas paas|mere paas|mere aas paas)\b|आस पास|मेरे पास/i.test(s),raw:s};
}
function setMic(on){
 state.active=on;
 const btn=$("gdrMapVoiceMic");if(btn){btn.classList.toggle("is-listening",on);btn.setAttribute("aria-pressed",String(on));btn.innerHTML=on?'<span aria-hidden="true">■</span><span class="gdr-map-voice-mic-label">Stop</span>':'<span aria-hidden="true">🎙</span><span class="gdr-map-voice-mic-label">Speak</span>';}
}
function finishTurn(){
 if(state.silenceTimer){clearTimeout(state.silenceTimer);state.silenceTimer=null;}
 const final=[state.finalText,state.interimText].filter(Boolean).join(" ").trim();
 state.interimText="";transcript();setMic(false);
 if(state.recognition){const r=state.recognition;state.recognition=null;state.session++;try{r.stop();}catch(_){}}
 if(final&&final!==state.executed){state.executed=final;runTurn(final);}
 else if(!final)status(text("आवाज़ साफ़ नहीं मिली। कृपया दोबारा बोलें।","I couldn't hear a clear request. Please try again."),"error");
}
function startListening(){
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){status(text("इस browser में voice recognition उपलब्ध नहीं है। नीचे लिखकर Search करें।","Voice recognition is unavailable in this browser. Type below and search."),"error");$("gdrMapVoiceTranscript")?.focus();return;}
 if(!window.isSecureContext){status("Microphone requires a secure HTTPS connection.","error");return;}
 if(state.recognition){try{state.recognition.stop();}catch(_){}state.recognition=null;}
 state.finalText="";state.interimText="";state.executed="";state.manualStop=false;transcript();
 const r=new Speech(),session=++state.session;state.recognition=r;r.lang=state.language;r.continuous=true;r.interimResults=true;r.maxAlternatives=1;
 r.onstart=()=>{if(session!==state.session)return;setMic(true);status(text("सुन रहा हूँ… बोलिए, रुकने पर अपने आप search होगा।","Listening… speak naturally. Search starts automatically after you pause."),"listening");};
 r.onresult=e=>{
  if(session!==state.session)return;let interim="";
  for(let i=e.resultIndex;i<e.results.length;i++){const item=e.results[i],spoken=item[0]?.transcript||"";if(item.isFinal&&spoken.trim())state.finalText+=(state.finalText?" ":"")+spoken.trim();else interim+=spoken;}
  state.interimText=interim;transcript();
  if(state.silenceTimer)clearTimeout(state.silenceTimer);
  if(state.finalText.trim()||state.interimText.trim())state.silenceTimer=setTimeout(finishTurn,1800);
 };
 r.onerror=e=>{
  if(session!==state.session)return;
  const fatal=["not-allowed","service-not-allowed","audio-capture","language-not-supported"].includes(e.error);
  if(fatal){state.active=false;state.recognition=null;setMic(false);status(e.error==="not-allowed"||e.error==="service-not-allowed"?text("Microphone permission blocked है। Browser site settings में अनुमति दें।","Microphone permission is blocked. Allow it in browser site settings."):text("Microphone उपलब्ध नहीं है। Text search इस्तेमाल करें।","Microphone is unavailable. Use text search."),"error");}
  else if(e.error==="network")status(text("Browser speech recognition को network चाहिए। Connection check करें।","Browser speech recognition needs a network connection. Check your connection."),"error");
 };
 r.onend=()=>{if(session!==state.session)return;state.recognition=null;if(state.silenceTimer){clearTimeout(state.silenceTimer);state.silenceTimer=setTimeout(finishTurn,350);}else if(state.finalText.trim()||state.interimText.trim())finishTurn();else{setMic(false);status(text("फिर से बोलने के लिए mic दबाएँ।","Tap the mic to speak again."),"idle");}};
 try{r.start();}catch(e){state.recognition=null;setMic(false);status(text("Microphone start नहीं हो पाया। दोबारा कोशिश करें।","Could not start the microphone. Please try again."),"error");}
}
async function runTurn(raw){
 const api=window.GDRMapExperience;if(!api){status("Map search is still loading. Please try again.","error");return;}
 const intent=extractIntent(raw);state.prefs=intent.prefs;
 const hasFilters=Object.keys(intent.prefs).length>0;
 api.setRenterSearchPreferences(intent.prefs);
 const city=intent.location||state.city;
 if(!city&&!intent.nearMe&&!hasFilters){status(text("कृपया city या locality बताइए, जैसे Singrauli।","Please mention a city or locality, such as Singrauli."),"error");speak(text("कृपया city या locality बताइए।","Please tell me a city or locality."));return;}
 const acknowledgement=intent.location?text("ठीक है! मैं "+intent.location+" में उपलब्ध घर खोज रहा हूँ।","Okay! Searching available homes in "+intent.location+"."):hasFilters?text("समझ गया! आपकी search preferences update कर रहा हूँ।","Got it! Updating your search filters."):text("ठीक है! आपके आसपास घर खोज रहा हूँ।","Okay! Searching for homes near you.");
 status(text("आपकी request समझ रहा हूँ…","Understanding your request…"),"processing");speak(acknowledgement);
 try{
  let rows=[];
  if(intent.nearMe){
   await new Promise((resolve,reject)=>navigator.geolocation?.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:60000})||reject(new Error("Location permission is unavailable."))).then(async pos=>{state.city="";api.setRenterRadius(5,true);rows=await api.searchAtCoordinates(pos.coords.latitude,pos.coords.longitude,"My location");});
  }else if(intent.location){
   status(text("Location verify कर रहा हूँ…","Verifying the requested location…"),"processing");
   const point=await api.resolveMapQuery(intent.location);
   state.city=point.properties?.city||point.properties?.district||intent.location;
   api.setRenterRadius(10,true);
   status(text("अब "+state.city+" में properties search कर रहा हूँ…","Now searching properties in "+state.city+"…"),"searching");
   rows=await api.searchAtCoordinates(point.lat,point.lng,state.city);
   if(Array.isArray(rows))rows=api.filterVisibleByLocation(state.city);
   if(Array.isArray(rows)&&!rows.length&&normalize(state.city)!==normalize(intent.location))rows=api.filterVisibleByLocation(intent.location);
  }else{
   status(text("आपकी मौजूदा location पर filters लागू कर रहा हूँ…","Applying filters to your current map search…"),"searching");
   rows=await api.searchRenterArea(intent.prefs);
   if(state.city&&Array.isArray(rows))rows=api.filterVisibleByLocation(state.city);
  }
  if(!Array.isArray(rows))rows=api.getRenterVisibleProperties();
  const count=rows.length;
  if(count){status(text(count+" matching homes मिल गए।","Found "+count+" matching homes."),"success");speak(text(count+" घर मिले हैं। Map और list में देखिए।","Found "+count+" homes. You can view them on the map and in the list."));}
  else{status(text("इस location और filters में कोई matching home नहीं मिला।","No matching homes found for this location and filters."),"empty");speak(text("अभी इस location में कोई matching घर नहीं मिला। आप filters या radius बदल सकते हैं।","No matching homes found there. You can change the filters or search radius."));}
 }catch(error){console.error("GDR map voice search failed:",error);status(error.message||text("Search पूरी नहीं हो पाई। दोबारा कोशिश करें।","Search could not be completed. Please try again."),"error");speak(error.message||text("माफ़ कीजिए, search पूरी नहीं हो पाई।","Sorry, the search could not be completed."));}
}
function mount(panel){
 if(!panel||state.root)return;
 const root=document.createElement("section");root.className="gdr-map-voice";root.id="gdrMapVoiceAssistant";
 root.innerHTML='<div class="gdr-map-voice-head"><div><span class="gdr-map-voice-kicker">TALK TO GDR · MAP SEARCH</span><h3>Find homes with your voice</h3><p>Speak in Hindi, English or Hinglish. Pause to search automatically.</p></div><label class="gdr-map-voice-language">Language<select id="gdrMapVoiceLanguage"><option value="hi-IN">हिंदी / Hinglish</option><option value="en-IN">English (India)</option></select></label></div><div class="gdr-map-voice-controls"><textarea id="gdrMapVoiceTranscript" rows="2" placeholder="Try: Mujhe Singrauli mein 7000 ke andar ghar dikhao…" aria-label="Voice transcript or typed property search"></textarea><button type="button" id="gdrMapVoiceMic" class="gdr-map-voice-mic" aria-label="Start voice search" aria-pressed="false"><span aria-hidden="true">🎙</span><span class="gdr-map-voice-mic-label">Speak</span></button></div><div class="gdr-map-voice-footer"><span id="gdrMapVoiceStatus" data-state="idle" role="status" aria-live="polite">Tap the microphone to speak, or type a search.</span><div><button type="button" id="gdrMapVoiceSearch" class="gdr-map-voice-search">Search</button><button type="button" id="gdrMapVoiceMute" class="gdr-map-voice-mute" aria-pressed="false">Mute voice</button></div></div><p id="gdrMapVoiceReply" class="gdr-map-voice-reply" aria-live="polite"></p>';
 const heading=panel.querySelector(".gdr-map-header, .gdr-explore-map-header, header");
 if(heading&&heading.parentNode===panel)heading.insertAdjacentElement("afterend",root);else panel.insertBefore(root,panel.firstChild);
 state.root=root;
 $("gdrMapVoiceLanguage").addEventListener("change",e=>{state.language=e.target.value;});
 $("gdrMapVoiceMic").addEventListener("click",()=>{if(state.active){if(state.recognition){try{state.recognition.stop();}catch(_){}}finishTurn();}else startListening();});
 $("gdrMapVoiceSearch").addEventListener("click",()=>{const value=$("gdrMapVoiceTranscript").value.trim();if(value){state.finalText=value;state.interimText="";runTurn(value);}else status("Type a city or property request first.","error");});
 $("gdrMapVoiceTranscript").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("gdrMapVoiceSearch").click();}});
 $("gdrMapVoiceMute").addEventListener("click",e=>{state.muted=!state.muted;e.currentTarget.textContent=state.muted?"Unmute voice":"Mute voice";e.currentTarget.setAttribute("aria-pressed",String(state.muted));if(state.muted&&window.speechSynthesis)window.speechSynthesis.cancel();});
}
function destroy(){if(state.silenceTimer)clearTimeout(state.silenceTimer);if(state.recognition){try{state.recognition.stop();}catch(_){}}state.recognition=null;state.active=false;setMic(false);}
window.addEventListener("pagehide",destroy);
window.GDRMapVoiceAssistant={mount,destroy,runTurn,version:VERSION};
})();