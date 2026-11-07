(function(){
"use strict";
/* GDR_COMPARE_AUTOFILL_V2: seed the clicked home with up to two nearest visible real listings. */
if(window.GDRRenterExperience)return;
const $=id=>document.getElementById(id),esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={compare:[],parsed:null,recognition:null,lang:"hi-IN",lastMapSearch:null,mapReplyLanguage:"hi"};
function toast(s){let n=$("gdrxToast");if(!n){n=document.createElement("div");n.id="gdrxToast";n.className="gdrx-toast";document.body.appendChild(n)}n.textContent=s;n.classList.add("on");clearTimeout(n.t);n.t=setTimeout(()=>n.classList.remove("on"),2600)}
function openFind(){const f=$("renterFindHomeSection"),d=$("dashboardSection");if(!f)return;document.body.classList.add("gd-renter-explore-mode");f.hidden=false;f.style.display="block";if(d)d.style.display="none";f.scrollIntoView({behavior:"smooth",block:"start"})}
function closeFind(){const f=$("renterFindHomeSection"),d=$("dashboardSection");if(f){f.hidden=true;f.style.display="none"}document.body.classList.remove("gd-renter-explore-mode");if(d){d.style.display="block";d.scrollIntoView({behavior:"smooth",block:"start"})}}
function addSupport(){const root=$("renterDashboard"),actions=root?.querySelector(".renter-dashboard-actions");if(!root||!actions||$("gdrxSupport"))return;const b=document.createElement("button");b.type="button";b.id="gdrxSupport";b.className="renter-dashboard-action gdrx-support";b.innerHTML='<span class="renter-action-icon">✉</span><span><strong>Support</strong><small>We’re here to help with your rental journey</small></span><span class="renter-action-arrow">↗</span>';b.onclick=()=>location.href="/contact.html";actions.appendChild(b)}
function normalizeSearchText(value){
 const consonants={"क":"k","ख":"kh","ग":"g","घ":"gh","ङ":"ng","च":"ch","छ":"chh","ज":"j","झ":"jh","ञ":"ny","ट":"t","ठ":"th","ड":"d","ढ":"dh","ण":"n","त":"t","थ":"th","द":"d","ध":"dh","न":"n","प":"p","फ":"ph","ब":"b","भ":"bh","म":"m","य":"y","र":"r","ल":"l","व":"v","श":"sh","ष":"sh","स":"s","ह":"h","क़":"q","ख़":"kh","ग़":"g","ज़":"z","ड़":"r","ढ़":"rh","फ़":"f"};
 const vowels={"अ":"a","आ":"aa","इ":"i","ई":"ee","उ":"u","ऊ":"oo","ऋ":"ri","ए":"e","ऐ":"ai","ओ":"o","औ":"au"};
 const matras={"ा":"a","ि":"i","ी":"ee","ु":"u","ू":"oo","ृ":"ri","े":"e","ै":"ai","ो":"o","ौ":"au"};
 const transliterateWord=word=>{
  const chars=Array.from(word);let out="",endsInherent=false;
  for(let i=0;i<chars.length;i++){
   const ch=chars[i];
   if(consonants[ch]){
    out+=consonants[ch];endsInherent=true;
    const next=chars[i+1];
    if(matras[next]){out+=matras[next];i++;endsInherent=false;}
    else if(next==="्"){i++;endsInherent=false;}
    else if(next==="़"){i++;endsInherent=true;}
    else out+="a";
   }else if(vowels[ch]){out+=vowels[ch];endsInherent=false;}
   else if(ch==="ं"||ch==="ँ"){out+="n";endsInherent=false;}
   else if(ch==="ः"){out+="h";endsInherent=false;}
   else if(ch==="़"||ch==="्"){endsInherent=false;}
   else{out+=ch;endsInherent=false;}
  }
  if(endsInherent&&out.endsWith("a"))out=out.slice(0,-1);
  return out;
 };
 const raw=String(value||"").toLowerCase().normalize("NFKC");
 const aliases={"सिंगरौली":"singrauli","इंदौर":"indore","रीवा":"rewa","भोपाल":"bhopal","जबलपुर":"jabalpur","ग्वालियर":"gwalior","उज्जैन":"ujjain","सतना":"satna","देवास":"dewas","सीधी":"sidhi"};
 const latin=raw.replace(/[\u0900-\u097F]+/gu,word=>aliases[word]||transliterateWord(word));
 const normalized=latin.replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
 return normalized;
}

function parseRequest(raw){
 const original=String(raw||"").trim(),n=original.toLowerCase().normalize("NFKC");
  const clean=original.replace(/^(?:show|find)\s+me\b\s*/i,"").replace(/^i\s+(?:need|want)\b\s*/i,"").replace(/^please\s+/i,"").replace(/^(?:mujhe(?:\s+ek)?|mujhko|मुझे|मुझको)\s*/i,"").replace(/^(?:a|an)\s+/i,"").trim();
 const p={raw:original,location:"",minBudget:"",maxBudget:"",stayType:"",bhk:"",furnishing:"",nearby:"",propertyType:"",radiusKm:null,useMyLocation:false,familyFriendly:false};
 const bhk=n.match(/\b([1-5])\s*(?:bhk|bed(?:room)?s?|bed\s*room|कमरे)\b/);if(bhk)p.bhk=bhk[1];
 const radius=n.match(/(?:within|radius(?: of)?|around|के अंदर|तक)\s*(\d+(?:\.\d+)?)\s*(?:km|kms|kilomet(?:er|re)s?|किलोमीटर|कि\.?मी\.?)\b/i)||n.match(/\b(\d+(?:\.\d+)?)\s*(?:km|kms|kilomet(?:er|re)s?|किलोमीटर)\s*(?:के अंदर|तक|radius)?/i);
 if(radius)p.radiusKm=Math.max(.5,Math.min(10,Number(radius[1])));
 if(/\b(pg|paying guest)\b|पीजी/.test(n))p.stayType="pg";
 else if(/\b(hostel)\b|हॉस्टल/.test(n))p.stayType="hostel";
 else if(/\b(flat|apartment|house|home|villa|room)\b|फ्लैट|मकान|घर|कमरा/.test(n))p.stayType="home";
 if(/\b(semi[\s-]?furnished)\b|सेमी फर्निश/.test(n))p.furnishing="Semi-Furnished";
 else if(/\b(unfurnished)\b|अनफर्निश/.test(n))p.furnishing="Unfurnished";
 else if(/\b(furnished)\b|फर्निश/.test(n))p.furnishing="Furnished";
 if(/\b(independent house)\b|स्वतंत्र मकान/.test(n))p.propertyType="independent_house";
 else if(/\b(villa)\b/.test(n))p.propertyType="villa";
 else if(/\b(apartment|flat)\b|अपार्टमेंट|फ्लैट/.test(n))p.propertyType="apartment";
 const range=n.match(/(?:between|from|budget)?\s*(?:₹|rs\.?\s*)?([\d,]{3,8})\s*(?:to|and|-)\s*(?:₹|rs\.?\s*)?([\d,]{3,8})/i);
 if(range){p.minBudget=range[1].replace(/,/g,"");p.maxBudget=range[2].replace(/,/g,"");}
 else{
  const min=n.match(/(?:at least|minimum|min|above|more than|greater than|कम से कम|से ज्यादा|से अधिक)\s*(?:₹|rs\.?\s*|rupees?\s*|रुपये\s*)?([\d,]{3,8})/i);
  if(min)p.minBudget=min[1].replace(/,/g,"");
  const max=n.match(/(?:under|below|up to|upto|maximum|max|budget|not more than|less than|तक|से कम)\s*(?:₹|rs\.?\s*|rupees?\s*|रुपये\s*)?([\d,]{3,8})/i);
  if(max)p.maxBudget=max[1].replace(/,/g,"");
  if(!p.maxBudget){const amount=n.match(/([\d,]{3,8})\s*(?:rupees?|rs\.?|रुपये|रु\.?)/i);if(amount)p.maxBudget=amount[1].replace(/,/g,"");}
 }
 if(/\b(my|current) location\b|मेरी लोकेशन|मेरी जगह|मेरे पास/.test(n))p.useMyLocation=true;
 if(/\b(college|university)\b|कॉलेज|विश्वविद्यालय/.test(n))p.nearby="college";
 else if(/\b(hospital|clinic)\b|अस्पताल/.test(n))p.nearby="hospital";
 else if(/\b(market|bazaar)\b|बाजार|मार्केट/.test(n))p.nearby="market";
 else if(/\b(railway station|train station)\b|रेलवे स्टेशन|स्टेशन/.test(n))p.nearby="railway station";
 if(/family[ -]?friendly|for family|परिवार के लिए|फैमिली/.test(n))p.familyFriendly=true;
 const stop="under|below|upto|up to|budget|maximum|max|minimum|min|above|at least|more than|₹|rs\.?|rupees?|रुपये|रु\.?|furnished|unfurnished|semi|[1-5]\s*(?:bhk|bed|bedroom)|pg|hostel|flat|apartment|house|villa|room|within|radius|around|college|hospital|market|railway|family";
 let m=clean.match(/\b(?:near|around|in|at)\b\s+(.+?)(?=\s+(?:under|below|upto|up to|budget|maximum|max|minimum|min|above|at least|more than|furnished|unfurnished|semi|[1-5]\s*(?:bhk|bed|bedroom)|pg|hostel|flat|apartment|house|villa|room|within|radius|around|college|hospital|market|railway|family)\b|$)/i);
 if(m)p.location=m[1].replace(/[.,!?]+$/,"").trim();
 if(!p.location){
  m=clean.match(/^(.+?)\s+(?:mein|me|में)(?=\s|$)/i);
  if(m)p.location=m[1].replace(/[.,!?]+$/,"").trim();
 }
 if(!p.location){
  m=clean.match(/^(.+?)\s+(?:ke paas|ke pass|के पास)(?=\s|$)/i);
  if(m)p.location=m[1].replace(/[.,!?]+$/,"").trim();
 }
 if(/^(?:my|current) location$/i.test(p.location))p.location="";
 return p;
}


function detectReplyLanguage(raw){
 const value=String(raw||"");
 if(/[\u0900-\u097F]/.test(value))return "hi";
 if(/\b(mujhe|mujhko|mein|me|dikhao|ghar|makaan|chahiye|kiraye|khali|wala|wali|wale|ab|sirf|batao|karo)\b/i.test(value))return "hinglish";
 return "en";
}
function assistantReply(language,count,location,error){
 const place=String(location||"").trim();
 if(error){
  if(language==="hi")return "माफ़ कीजिए, अभी "+(place||"इस जगह")+" की प्रॉपर्टी खोज पूरी नहीं हो सकी। "+error;
  if(language==="hinglish")return "Sorry, abhi "+(place||"is location")+" ki property search complete nahi ho saki. "+error;
  return "Sorry, I couldn't complete the property search for "+(place||"that location")+". "+error;
 }
 if(count>0){
  if(language==="hi")return "बिल्कुल! "+(place?place+" में ":"")+"मुझे "+count+" उपलब्ध रेंटल प्रॉपर्टीज़ मिली हैं। मैंने उन्हें मैप और लिस्ट में दिखा दिया है। आप अगली शर्त भी बोल सकते हैं।";
  if(language==="hinglish")return "Bilkul! "+(place?place+" mein ":"")+"mujhe "+count+" available rental properties mili hain. Maine unhe map aur list mein dikha diya hai. Aap next filter bol sakte hain.";
  return "Absolutely! I found "+count+" available rental propert"+(count===1?"y":"ies")+" "+(place?"in "+place+" ":"")+"and displayed "+(count===1?"it":"them")+" on the map and list. You can tell me another filter.";
 }
 if(language==="hi")return (place?place+" में ":"")+"अभी कोई उपलब्ध रेंटल प्रॉपर्टी नहीं मिली। क्या आप आसपास के इलाके में भी खोज करना चाहेंगे?";
 if(language==="hinglish")return (place?place+" mein ":"")+"abhi koi available rental property nahi mili. Kya main aas-paas ke area mein bhi search karun?";
 return "I couldn't find any available rental properties"+(place?" in "+place:"")+". Would you like me to search nearby areas?";
}
function speakAssistantReply(message,language){
 if(!message||!window.speechSynthesis||typeof SpeechSynthesisUtterance==="undefined")return;
 try{
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(message);
  utterance.lang=language==="hi"||language==="hinglish"?"hi-IN":"en-IN";
  const voices=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
  const prefix=utterance.lang.toLowerCase().split("-")[0];
  const voice=voices.find(v=>String(v.lang||"").toLowerCase().startsWith(prefix));
  if(voice)utterance.voice=voice;
  utterance.rate=1;utterance.pitch=1;window.speechSynthesis.speak(utterance);
 }catch(error){console.info("GDR spoken response is unavailable in this browser.",error);}
}

function setValue(id,v){const el=$(id);if(!el||v==null||v==="")return;el.value=String(v);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}
function applyToForm(p){
 setValue("renterSearchLocation",p.location);setValue("renterStayType",p.stayType);setValue("renterSearchBhk",p.bhk);setValue("renterSearchFurnishing",p.furnishing);
 if(p.minBudget){setValue("renterMinBudgetPreset","custom");setValue("renterMinBudgetCustom",p.minBudget);setValue("renterMinBudget",p.minBudget)}
 if(p.maxBudget){setValue("renterMaxBudgetPreset","custom");setValue("renterMaxBudgetCustom",p.maxBudget);setValue("renterMaxBudget",p.maxBudget)}
}
function review(raw){
 const p=parseRequest(raw);if(!p.location&&!p.maxBudget&&!p.bhk&&!p.stayType&&!p.furnishing){$("gdrxStatus").textContent="Add a locality, budget, BHK or property type and try again.";return}
 state.parsed=p;applyToForm(p);
 const vals=[["Location",p.location||"Not detected"],["Property type",p.stayType||"Any"],["BHK",p.bhk?p.bhk+" BHK":"Any"],["Maximum rent",p.maxBudget?"₹"+Number(p.maxBudget).toLocaleString("en-IN"):"No limit"],["Minimum rent",p.minBudget?"₹"+Number(p.minBudget).toLocaleString("en-IN"):"No minimum"],["Furnishing",p.furnishing||"Any"]];
 const note=p.nearby?"Nearby preference noted: "+p.nearby+". The current property records do not store verified nearby-facility distances, so this is not used to claim a match.":"";
 const box=$("gdrxReview");box.hidden=false;box.innerHTML='<div class="gdrx-review-title"><b>Here is what I understood</b><span>✓ REVIEW</span></div><div class="gdrx-review-grid">'+vals.map(x=>'<div><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join("")+'</div>'+(note?'<p class="gdrx-note">'+esc(note)+'</p>':"")+'<div class="gdrx-review-actions"><button type="button" id="gdrxEdit">Edit preferences</button><button type="button" id="gdrxFind">Find matching homes →</button></div>';
 $("gdrxStatus").textContent="Extracted with a local parser. You can edit any field before searching.";
 $("gdrxEdit").onclick=()=>$("renterFindHomeForm").scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxFind").onclick=()=>$("renterFindHomeForm").requestSubmit()
}
function startVoice(target,lang){
 const mapMode=target==="gdrxMapPrompt";
 const micId=mapMode?"gdrxMapMic":"gdrxMic";
 const statusId=mapMode?"gdrxMapStatus":"gdrxStatus";
 const status=$(statusId),mic=$(micId),API=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!API){if(status)status.textContent="Speech recognition is not supported in this browser. Type your request instead.";return}
 try{
  state.recognition?.stop();
  const chosen=mapMode?($("gdrxMapLang")?.value||state.lang):(lang||state.lang);
  const r=new API();state.recognition=r;r.lang=chosen;r.interimResults=true;r.maxAlternatives=1;let finalTranscript="";
  mic?.classList.add("listening");if(status)status.textContent=mapMode?"Listening… बोलिए / I'm listening…":"Listening… speak your home requirements.";
  r.onresult=e=>{
   let interim="";
   for(let i=e.resultIndex||0;i<e.results.length;i++){const item=e.results[i],value=item&&item[0]&&item[0].transcript||"";if(item.isFinal)finalTranscript+=value+" ";else interim+=value;}
   const field=$(target);if(field&&interim){field.value=(finalTranscript+interim).trim();field.dispatchEvent(new Event("input",{bubbles:true}));}
   if(finalTranscript.trim()&&mapMode&&status)status.textContent="Understanding your request…";
  };
  r.onerror=e=>{if(!status)return;status.textContent=(e.error==="not-allowed"||e.error==="service-not-allowed")?"Microphone access was blocked. Allow microphone access for ghardekhorenters.com in Chrome site settings, then retry. You can still type.":e.error==="no-speech"?"No speech detected. Tap the microphone and try again.":"Voice input unavailable. Please type your request.";};
  r.onend=()=>{
   mic?.classList.remove("listening");if(state.recognition===r)state.recognition=null;
   const transcript=finalTranscript.trim();if(!transcript)return;
   const field=$(target);if(field){field.value=transcript;field.dispatchEvent(new Event("input",{bubbles:true}));}
   if(mapMode){state.mapReplyLanguage=detectReplyLanguage(transcript);if(status)status.textContent="Speech captured. Review or edit the text, then tap Search map.";}else review(transcript);
  };
  r.start();
 }catch(error){mic?.classList.remove("listening");if(status)status.textContent="Could not start the microphone. Check browser microphone permission or use text search.";}
}
function mountFinder(){
 const sec=$("renterFindHomeSection"),form=$("renterFindHomeForm");if(!sec||!form||$("gdrxFinder"))return;
 const box=document.createElement("section");box.id="gdrxFinder";box.className="gdrx-finder";
 box.innerHTML='<div class="gdrx-finder-heading"><span>GHARDEKHO SMART FINDER</span><h3>Tell GDR what home you are looking for.</h3><p>Talk naturally or type your requirements. Review the details, then search actual GharDekho listings.</p></div><div class="gdrx-choices"><button type="button" id="gdrxTalk"><i>✦</i><span><b>Find your home with GDR Assistant</b><small>Voice or text · Hindi, English & Hinglish</small></span><em>01</em></button><button type="button" id="gdrxManual"><i>⌕</i><span><b>Search yourself</b><small>Use the manual filters below</small></span><em>02</em></button></div><div class="gdrx-assistant" id="gdrxAssistant"><div class="gdrx-assistant-head"><div><span>● GDR ASSISTANT</span><h4>Tell GDR What Home You are Looking For</h4><p>Speak naturally. We will find homes that match your needs.</p></div><div class="gdrx-orb">⌂</div></div><label for="gdrxPrompt">DESCRIBE YOUR IDEAL HOME</label><textarea id="gdrxPrompt" rows="3" placeholder="Mujhe Patel Nagar Bhopal mein 2 BHK furnished flat chahiye. Budget 8000 rupees hai."></textarea><div class="gdrx-tools"><select id="gdrxLang" aria-label="Speech language"><option value="hi-IN">Hindi / Hinglish</option><option value="en-IN">English (India)</option><option value="en-US">English (US)</option></select><button type="button" id="gdrxMic">● FIND MY HOME BY SPEAKING</button><button type="button" id="gdrxUnderstand">Understand my request →</button></div><p id="gdrxStatus" role="status">Voice input is available in supported browsers. Text search always works.</p><div id="gdrxReview" hidden></div></div>';
 form.parentNode.insertBefore(box,form);
 $("gdrxTalk").onclick=()=>$("gdrxAssistant").scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxManual").onclick=()=>form.scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxUnderstand").onclick=()=>review($("gdrxPrompt").value);
 $("gdrxLang").onchange=e=>state.lang=e.target.value;
 $("gdrxMic").onclick=()=>startVoice("gdrxPrompt",state.lang)
}
function mountMapVoice(){
 const panel=$("gdrExploreMapPanel"),toolbar=panel?.querySelector(".gdr-map-toolbar");if(!panel||!toolbar||$("gdrxMapVoice"))return;
 const w=document.createElement("div");w.id="gdrxMapVoice";w.className="gdrx-map-voice";
 w.innerHTML='<label for="gdrxMapPrompt">TALK TO GDR · MAP SEARCH</label><div><input id="gdrxMapPrompt" autocomplete="off" aria-label="Describe the home you want on the map" placeholder="मुझे सिंगरौली में उपलब्ध घर दिखाओ / Show available homes in Singrauli"><select id="gdrxMapLang" aria-label="Voice input language"><option value="hi-IN">हिंदी / Hinglish</option><option value="en-IN">English (India)</option><option value="en-US">English (US)</option></select><button type="button" id="gdrxMapMic" aria-label="Search by voice" title="Search by voice">🎙 Speak</button><button type="button" id="gdrxMapGo">Search map</button></div><p id="gdrxMapStatus" role="status" aria-live="polite">Speak or type naturally. GDR will understand, reply in your language and search real available homes automatically.</p><div id="gdrxMapReply" class="gdrx-map-reply" role="status" aria-live="polite" hidden></div>';
 toolbar.appendChild(w);$("gdrxMapGo").onclick=()=>runMapSearch();
 $("gdrxMapMic").onclick=()=>startVoice("gdrxMapPrompt",$("#gdrxMapLang")?.value||state.lang);
 $("gdrxMapLang").onchange=e=>state.lang=e.target.value;
 $("gdrxMapPrompt").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();runMapSearch();}};
}
async function runMapSearch(rawOverride){
 const prompt=$("gdrxMapPrompt"),status=$("gdrxMapStatus"),go=$("gdrxMapGo"),reply=$("gdrxMapReply");if(!prompt||!status||!go)return;
 const raw=String(rawOverride||prompt.value||"").trim();if(!raw){status.textContent="Please speak or type a location and property requirement.";return;}
 const parsed=parseRequest(raw),previous=state.lastMapSearch||{},p=Object.assign({},previous);
 ["location","minBudget","maxBudget","stayType","bhk","furnishing","nearby","propertyType","radiusKm"].forEach(key=>{if(parsed[key]!==""&&parsed[key]!==null&&parsed[key]!==undefined)p[key]=parsed[key];});
 p.useMyLocation=parsed.useMyLocation||false;p.raw=raw;
 const language=detectReplyLanguage(raw);state.mapReplyLanguage=language;
 if(!p.location&&!p.useMyLocation){
  const question=language==="hi"?"कृपया शहर या इलाके का नाम बताइए, ताकि मैं सही जगह के घर खोज सकूँ।":language==="hinglish"?"Please city ya locality ka naam bata dijiye, taaki main sahi jagah ke homes search kar sakun.":"Please tell me the city or locality so I can search the correct homes.";
  if(reply){reply.hidden=false;reply.textContent=question;}status.textContent=question;speakAssistantReply(question,language);return;
 }
 const api=window.GDRMapExperience;
 if(!api||typeof api.searchTypedMapLocation!=="function"){status.textContent=language==="hi"?"मैप अभी लोड हो रहा है। कृपया दोबारा कोशिश करें।":"The map is still loading. Please try again.";return;}
 try{
  go.disabled=true;status.textContent=language==="hi"?"आपकी लोकेशन समझ रहा हूँ…":language==="hinglish"?"Aapki location samajh raha hoon…":"Understanding your location…";
  if(reply){reply.hidden=false;reply.textContent=language==="hi"?"बिल्कुल, मैं "+p.location+" में उपलब्ध घर खोज रहा हूँ…":language==="hinglish"?"Bilkul, main "+p.location+" mein available homes search kar raha hoon…":"Absolutely, I'm searching available homes in "+p.location+"…";}
  state.lastMapSearch=p;const locationInput=$("gdrMapPlaceSearch");if(locationInput)locationInput.value="";
  if(typeof api.openRenterMap==="function")await api.openRenterMap();
  if(locationInput)locationInput.value=p.location||"";
  if(p.radiusKm&&typeof api.setRenterRadius==="function")api.setRenterRadius(p.radiusKm,true);
  else if(typeof api.setRenterRadius==="function"&&!previous.location&&p.location)api.setRenterRadius(10,true);
  if(typeof api.setRenterSearchPreferences==="function")api.setRenterSearchPreferences(p);
  if(p.useMyLocation){
   const located=await new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error("Location is not supported. Search for a locality instead."));navigator.geolocation.getCurrentPosition(resolve,err=>reject(new Error(err.code===1?"Location permission was denied. You can type a locality instead.":"Could not get your location. Try typing a locality.")),{enableHighAccuracy:true,timeout:12000,maximumAge:60000});});
   if(typeof api.searchAtCoordinates!=="function")throw new Error("The map location service is not available for GPS search.");
   const result=await api.searchAtCoordinates(located.coords.latitude,located.coords.longitude,"My location");if(result===false)throw new Error("Could not search around your current location.");
  }else{
   const searchResult=await api.searchTypedMapLocation();if(searchResult===false)throw new Error("We could not search that location. Check the locality name or try a nearby PIN code.");
   if(typeof api.applyRenterFilters==="function")api.applyRenterFilters(p);
  }
  const rows=api.getRenterVisibleProperties?api.getRenterVisibleProperties():[],message=assistantReply(language,rows.length,p.location,"");
  if(reply){reply.hidden=false;reply.textContent=message;}status.textContent=message;speakAssistantReply(message,language);
 }catch(error){
  const message=assistantReply(language,0,p.location,error&&error.message?error.message:"Please try again.");
  if(reply){reply.hidden=false;reply.textContent=message;}status.textContent=message;speakAssistantReply(message,language);
 }finally{go.disabled=false}
}
function mountCompare(){
 if($("gdrxCompare"))return;const d=document.createElement("section");d.id="gdrxCompare";d.className="gdrx-compare";d.hidden=true;
 d.innerHTML='<div class="gdrx-compare-head"><div><span>SHORTLIST SIDE BY SIDE</span><h3>Compare homes <small id="gdrxCompareCount">0 / 3</small></h3></div><div class="gdrx-compare-actions"><button id="gdrxCompareClear" type="button">Clear all</button><button id="gdrxCompareClose" type="button" aria-label="Close comparison">×</button></div></div><div id="gdrxCompareGrid"></div><div class="gdrx-compare-foot">Estimated monthly total = rent + recorded monthly maintenance. Refundable deposits remain separate.</div>';
 document.body.appendChild(d);try{const saved=JSON.parse(sessionStorage.getItem("gdrxCompareHomes")||"[]");if(Array.isArray(saved))state.compare=saved.filter(p=>p&&p.id!=null).slice(0,3)}catch(_){}$("gdrxCompareClose").onclick=()=>d.hidden=true;$("gdrxCompareClear").onclick=()=>{state.compare=[];renderCompare();toast("Comparison cleared.")};if(state.compare.length)renderCompare()
}
function buildCompareSelection(primary,available){
 const key=p=>String(p&&p.id!=null?p.id:"");
 if(!key(primary))return [];
 const unique=new Map([[key(primary),primary]]);
 (Array.isArray(available)?available:[]).filter(p=>key(p)&&key(p)!==key(primary)).slice().sort((a,b)=>{
  const da=Number(a.gdrDistanceKm),db=Number(b.gdrDistanceKm);
  return (Number.isFinite(da)?da:Number.POSITIVE_INFINITY)-(Number.isFinite(db)?db:Number.POSITIVE_INFINITY);
 }).forEach(p=>{if(unique.size<3&&!unique.has(key(p)))unique.set(key(p),p)});
 return Array.from(unique.values()).slice(0,3);
}
function toggleCompare(p){
 if(!p||p.id==null)return;
 const id=String(p.id),existing=state.compare.findIndex(x=>String(x.id)===id);
 if(existing>=0){renderCompare();toast("This home is already in your comparison.");return}
 if(state.compare.length>=3){toast("Compare up to three homes at a time.");return}
 if(!state.compare.length){
  const visible=window.GDRMapExperience&&typeof window.GDRMapExperience.getRenterVisibleProperties==="function"?window.GDRMapExperience.getRenterVisibleProperties():[];
  state.compare=buildCompareSelection(p,visible);
  toast(state.compare.length>1?state.compare.length+" nearby homes added for comparison":"Added. Search a wider area to find more homes to compare.");
 }else{state.compare.push(p);toast("Added to comparison.")}
 renderCompare();
}
function renderCompare(){
 const d=$("gdrxCompare"),grid=$("gdrxCompareGrid");if(!d||!grid)return;
 const count=state.compare.length;d.hidden=!count;$("gdrxCompareCount").textContent=count+" / 3";grid.replaceChildren();
 grid.style.gridTemplateColumns=count?"repeat("+count+", minmax(0, 1fr))":"";
 d.style.width=count===1?"min(560px, calc(100vw - 26px))":count===2?"min(900px, calc(100vw - 26px))":"min(1120px, calc(100vw - 26px))";
 try{if(count)sessionStorage.setItem("gdrxCompareHomes",JSON.stringify(state.compare));else sessionStorage.removeItem("gdrxCompareHomes")}catch(_){}
 if(!count)return;
 const fields=[
  {label:"Monthly rent",value:p=>p.rent==null?"Not listed":"₹"+Number(p.rent).toLocaleString("en-IN"),key:"rent"},
  {label:"Security deposit",value:p=>p.security_deposit==null?"Not listed":"₹"+Number(p.security_deposit).toLocaleString("en-IN"),key:"security_deposit"},
  {label:"Configuration",value:p=>p.bhk?p.bhk+" BHK":p.room_type||p.listing_type||"Not listed"},
  {label:"Furnishing",value:p=>p.furnishing||"Not listed"},
  {label:"Distance",value:p=>Number.isFinite(Number(p.gdrDistanceKm))?Number(p.gdrDistanceKm).toFixed(1)+" km":"Not available"},
  {label:"Availability",value:p=>{
   const raw=String(p.availability_status||p.availability||p.occupancy_status||"").toLowerCase();
   if(raw)return raw.replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase());
   const status=String(p.status||"").toLowerCase();
   if(status==="occupied")return "Occupied";if(status==="soon_available")return "Vacating soon";
   if(status==="available"||status==="vacant")return "Available";return "Not listed";
  }},
  {label:"Owner verification",value:p=>{
   const verified=p.owner_verified===true||String(p.owner_verification_status||"").toLowerCase()==="verified";
   const unverified=p.owner_verified===false||String(p.owner_verification_status||"").toLowerCase()==="not_verified";
   return verified?"✓ Verified":unverified?"Not verified":"Not listed";
  }},
  {label:"Monthly maintenance",value:p=>p.monthly_maintenance==null?"Not listed":"₹"+Number(p.monthly_maintenance).toLocaleString("en-IN")},
  {label:"Estimated monthly total",value:p=>p.monthly_maintenance==null?"Rent only; maintenance not listed":p.rent==null?"Not listed":"₹"+(Number(p.rent)+Number(p.monthly_maintenance)).toLocaleString("en-IN")}
 ];
 const minFor=key=>{const values=state.compare.map(p=>Number(p[key])).filter(v=>Number.isFinite(v)&&v>=0);return values.length>1?Math.min(...values):null};
 state.compare.forEach(p=>{
  const card=document.createElement("article");card.className="gdrx-compare-card";
  const image=document.createElement("img");image.alt="Property photo";image.loading="lazy";
  if(p.image_url&&/^https?:\/\//i.test(String(p.image_url)))image.src=p.image_url;else image.hidden=true;image.onerror=()=>{image.hidden=true};
  const title=document.createElement("h4");title.textContent=p.title||p.name||"Rental property";
  const location=document.createElement("p");location.textContent=[p.location,p.address].filter(Boolean).join(", ")||"Location not listed";
  card.append(image,title,location);
  fields.forEach(field=>{
   const row=document.createElement("div");row.className="gdrx-row";
   const label=document.createElement("small"),value=document.createElement("strong");label.textContent=field.label;value.textContent=field.value(p);
   if(field.key&&minFor(field.key)!==null&&Number(p[field.key])===minFor(field.key))row.classList.add("gdrx-best-value");
   row.append(label,value);card.append(row);
  });
  const remove=document.createElement("button");remove.type="button";remove.textContent="Remove home";
  remove.setAttribute("aria-label","Remove "+(p.title||p.name||"property")+" from comparison");
  remove.onclick=()=>{state.compare=state.compare.filter(x=>String(x.id)!==String(p.id));renderCompare();toast("Home removed from comparison.")};
  card.append(remove);grid.append(card);
 });
 if(count<2){const hint=document.createElement("p");hint.className="gdrx-compare-hint";hint.textContent="Only one listing is available in this map area. Search a wider area or increase the radius to compare more real homes.";grid.append(hint)}
}
function applyManualScores(){
 const root=$("propertiesContainer"),p=state.parsed;if(!root||!p)return;
 const cards=Array.from(root.querySelectorAll(".property-card[data-property-id]"));
 const scored=cards.map(card=>{const text=(card.innerText||"").toLowerCase(),checks=[];
  if(p.location)checks.push(text.includes(p.location.toLowerCase()));if(p.bhk)checks.push(text.includes(p.bhk+" bhk"));if(p.furnishing)checks.push(text.includes(p.furnishing.toLowerCase()));if(p.stayType)checks.push(text.includes(p.stayType));
  const rent=Number((card.querySelector(".property-rent")?.textContent||"").replace(/[^0-9.]/g,""));if(p.maxBudget)checks.push(Number.isFinite(rent)&&rent<=Number(p.maxBudget));if(p.minBudget)checks.push(Number.isFinite(rent)&&rent>=Number(p.minBudget));
  const score=checks.length?Math.round(checks.filter(Boolean).length/checks.length*100):null;let badge=card.querySelector(".gdrx-match-pill");
  if(score!==null){if(!badge){badge=document.createElement("span");badge.className="gdrx-match-pill";card.querySelector(".property-card-body")?.prepend(badge)}if(badge)badge.textContent=score+"% preference match"}return {card,score:score===null?0:score}});
 const ordered=scored.slice().sort((x,y)=>y.score-x.score).map(x=>x.card);if(ordered.some((el,i)=>cards[i]!==el))ordered.forEach(el=>root.appendChild(el));
}
function moveEditProfileToAccount(){
 const root=$("renterDashboard"),button=root?.querySelector(".renter-edit-profile-compact");
 if(!root||!button)return;
 if(button.closest(".renter-account-edit-stack"))return;
 const normalize=value=>String(value||"").replace(/\\s+/g," ").trim();
 const candidates=Array.from(document.querySelectorAll("body *")).filter(el=>{
  if(el===button||el.contains(button))return false;
  const value=normalize(el.innerText||el.textContent);
  return /ODD\\s+JI/i.test(value)&&/Renter/i.test(value)&&value.length<=100;
 });
 candidates.sort((a,b)=>normalize(a.innerText||a.textContent).length-normalize(b.innerText||b.textContent).length);
 const badge=candidates[0];
 if(!badge||!badge.parentElement)return;
 const stack=document.createElement("div");
 stack.className="renter-account-edit-stack";
 badge.parentElement.insertBefore(stack,badge);
 stack.append(badge,button);
}
function bind(){
 moveEditProfileToAccount();addSupport();mountFinder();mountCompare();$("renterDashboard")?.classList.add("gdrx-premium");
 const results=$("propertiesContainer");if(results&&!results.dataset.gdrxScoreObserver){results.dataset.gdrxScoreObserver="1";new MutationObserver(()=>applyManualScores()).observe(results,{childList:true,subtree:true})}
 const form=$("renterFindHomeForm");if(form&&!form.dataset.gdrxScoreCapture){form.dataset.gdrxScoreCapture="1";form.addEventListener("submit",()=>{state.parsed={location:$("renterSearchLocation")?.value||"",bhk:$("renterSearchBhk")?.value||"",furnishing:$("renterSearchFurnishing")?.value||"",stayType:$("renterStayType")?.value||"",minBudget:$("renterMinBudget")?.value||"",maxBudget:$("renterMaxBudget")?.value||""};setTimeout(applyManualScores,1000)})}
 const fbtn=$("renterFindHomeBtn");if(fbtn&&!fbtn.dataset.gdrx){fbtn.dataset.gdrx="1";fbtn.addEventListener("click",openFind)}
 ["renterFindHomeBackBtn","renterFindHomeCancelBtn"].forEach(id=>{const b=$(id);if(b&&!b.dataset.gdrx){b.dataset.gdrx="1";b.addEventListener("click",closeFind)}})
 const map=$("gdrExploreMapPanel");if(map&&!map.dataset.gdrx){map.dataset.gdrx="1";new MutationObserver(()=>{if(!map.hidden)mountMapVoice()}).observe(map,{attributes:true,attributeFilter:["hidden","class"]})}
 const mapBtn=$("renterExploreMapBtn");if(mapBtn&&!mapBtn.dataset.gdrx){mapBtn.dataset.gdrx="1";mapBtn.addEventListener("click",()=>setTimeout(mountMapVoice,150))}
}
window.GDRRenterExperience={toggleCompare,buildCompareSelection,parseRequest,normalizeSearchText,openFindHome:openFind,closeFindHome:closeFind};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();window.addEventListener("load",bind);
new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});
})();