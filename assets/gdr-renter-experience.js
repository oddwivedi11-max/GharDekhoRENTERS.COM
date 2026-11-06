(function(){
"use strict";
/* GDR_COMPARE_AUTOFILL_V2: seed the clicked home with up to two nearest visible real listings. */
if(window.GDRRenterExperience)return;
const $=id=>document.getElementById(id),esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={compare:[],parsed:null,recognition:null,lang:"hi-IN"};
function toast(s){let n=$("gdrxToast");if(!n){n=document.createElement("div");n.id="gdrxToast";n.className="gdrx-toast";document.body.appendChild(n)}n.textContent=s;n.classList.add("on");clearTimeout(n.t);n.t=setTimeout(()=>n.classList.remove("on"),2600)}
function openFind(){const f=$("renterFindHomeSection"),d=$("dashboardSection");if(!f)return;document.body.classList.add("gd-renter-explore-mode");f.hidden=false;f.style.display="block";if(d)d.style.display="none";f.scrollIntoView({behavior:"smooth",block:"start"})}
function closeFind(){const f=$("renterFindHomeSection"),d=$("dashboardSection");if(f){f.hidden=true;f.style.display="none"}document.body.classList.remove("gd-renter-explore-mode");if(d){d.style.display="block";d.scrollIntoView({behavior:"smooth",block:"start"})}}
function addSupport(){const root=$("renterDashboard"),actions=root?.querySelector(".renter-dashboard-actions");if(!root||!actions||$("gdrxSupport"))return;const b=document.createElement("button");b.type="button";b.id="gdrxSupport";b.className="renter-dashboard-action gdrx-support";b.innerHTML='<span class="renter-action-icon">✉</span><span><strong>Support</strong><small>Get help with your account or rental</small></span><span class="renter-action-arrow">↗</span>';b.onclick=()=>location.href="/contact.html";actions.appendChild(b)}
function parseRequest(raw){
 const original=String(raw||"").trim(),n=original.toLowerCase().normalize("NFKC");
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
 else if(/\b(other property)\b/.test(n))p.propertyType="other";
 const range=n.match(/(?:between|from|budget)?\s*(?:₹|rs\.?\s*)?([\d,]{3,8})\s*(?:to|and|-)\s*(?:₹|rs\.?\s*)?([\d,]{3,8})/i);
 if(range){p.minBudget=range[1].replace(/,/g,"");p.maxBudget=range[2].replace(/,/g,"");}
 else{
  const min=n.match(/(?:at least|minimum|min|above|more than|greater than|कम से कम|से ज्यादा|से अधिक)\s*(?:₹|rs\.?\s*|rupees?\s*|रुपये\s*)?([\d,]{3,8})/i);
  if(min)p.minBudget=min[1].replace(/,/g,"");
  const max=n.match(/(?:under|below|up to|upto|maximum|max|budget|not more than|less than|तक|से कम|₹|rs\.?\s*|rupees?\s*|रुपये\s*)\s*(?:₹|rs\.?\s*)?([\d,]{3,8})(?!\s*(?:km|kms|kilomet))/i);
  if(max)p.maxBudget=max[1].replace(/,/g,"");
  if(!p.maxBudget){const amount=n.match(/([\d,]{3,8})\s*(?:rupees?|rs\.?|रुपये|रु\.?)/i);if(amount)p.maxBudget=amount[1].replace(/,/g,"");}
 }
 if(/\b(my|current) location\b|मेरी लोकेशन|मेरी जगह|मेरे पास/.test(n))p.useMyLocation=true;
 if(/\b(college|university)\b|कॉलेज|विश्वविद्यालय/.test(n))p.nearby="college";
 else if(/\b(hospital|clinic)\b|अस्पताल/.test(n))p.nearby="hospital";
 else if(/\b(market|bazaar)\b|बाजार|मार्केट/.test(n))p.nearby="market";
 else if(/\b(railway station|train station)\b|रेलवे स्टेशन|स्टेशन/.test(n))p.nearby="railway station";
 if(/family[ -]?friendly|for family|परिवार के लिए|फैमिली/.test(n))p.familyFriendly=true;
 const stop="under|below|upto|up to|budget|maximum|max|minimum|min|above|at least|more than|₹|rs\\.?|rupees?|रुपये|रु\\.?|furnished|unfurnished|semi|[1-5]\\s*(?:bhk|bed|bedroom)|pg|hostel|flat|apartment|house|villa|room|within|radius|around|college|hospital|market|railway|family";
 const strip=/^(?:mujhe|mujhko|mujhe ek|show me|find me|i need|i want|please|mujhe chahiye|मुझे|मुझको)\s+/i;
 let m=original.match(new RegExp("^(.+?)\\s+(?:mein|me|में)(?=\\s|$)","i"));
 if(m)p.location=m[1].replace(strip,"").trim();
 if(!p.location){
  m=original.match(new RegExp("(.+?)\\s+(?:ke paas|ke pass|के पास)(?=\\s|$)","i"));
  if(m)p.location=m[1].replace(strip,"").trim();
 }
 if(!p.location){
  const re=new RegExp("(?:in|at|near|around|nearby)\\s+(.+?)(?=\\s+(?:"+stop+")\\b|$)","i");
  m=original.match(re);if(m)p.location=m[1].replace(strip,"").replace(/[.,!?]+$/,"").trim();
 }
 if(/^(?:my|current) location$/i.test(p.location))p.location="";
 return p;
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
 const status=$(statusId),mic=$(micId);
 const API=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!API){if(status)status.textContent="Speech recognition is not supported in this browser. Type your request instead.";return}
 try{
  state.recognition?.stop();
  const r=new API();state.recognition=r;r.lang=lang||state.lang;r.interimResults=false;r.maxAlternatives=1;
  mic?.classList.add("listening");
  if(status)status.textContent="Listening… speak your home requirements.";
  r.onresult=e=>{
   const transcript=e.results?.[0]?.[0]?.transcript||"";
   const field=$(target);if(field){field.value=transcript;field.dispatchEvent(new Event("input",{bubbles:true}));}
   if(mapMode)runMapSearch();else review(transcript);
  };
  r.onerror=e=>{
   if(!status)return;
   status.textContent=(e.error==="not-allowed"||e.error==="service-not-allowed")
    ?"Microphone access was blocked. Allow microphone access for ghardekhorenters.com in Chrome site settings, then retry. You can still type."
    :e.error==="no-speech"?"No speech detected. Tap the microphone and try again."
    :"Voice input unavailable. Please type your request.";
  };
  r.onend=()=>{mic?.classList.remove("listening");if(state.recognition===r)state.recognition=null};
  r.start();
 }catch(error){
  mic?.classList.remove("listening");
  if(status)status.textContent="Could not start the microphone. Check browser microphone permission or use text search.";
 }
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
 w.innerHTML='<label for="gdrxMapPrompt">TALK TO GDR · MAP SEARCH</label><div><input id="gdrxMapPrompt" autocomplete="off" aria-label="Describe the home you want on the map" placeholder="2 BHK under ₹8,000 near Patel Nagar"><button type="button" id="gdrxMapMic" aria-label="Search by voice" title="Search by voice">🎙 Speak</button><button type="button" id="gdrxMapGo">Search map</button></div><p id="gdrxMapStatus" role="status" aria-live="polite">Type or speak your requirements. GDR will search real listings in the selected area.</p>';
 toolbar.appendChild(w);
 $("gdrxMapGo").onclick=runMapSearch;
 $("gdrxMapMic").onclick=()=>startVoice("gdrxMapPrompt",state.lang);
 $("gdrxMapPrompt").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();runMapSearch()}}
}
async function runMapSearch(){
 const prompt=$("gdrxMapPrompt"),status=$("gdrxMapStatus"),go=$("gdrxMapGo");
 if(!prompt||!status||!go)return;
 const p=parseRequest(prompt.value),api=window.GDRMapExperience;
 if(!p.location){status.textContent="Include a city, locality or PIN code (for example, Patel Nagar Bhopal) to locate your map search.";return}
 if(!api||typeof api.searchTypedMapLocation!=="function"){status.textContent="The map is still loading. Close and reopen Explore Map, then try again.";return}
 try{
  go.disabled=true;status.textContent="Locating "+p.location+" and searching real GharDekho listings…";
  const locationInput=$("gdrMapPlaceSearch");if(locationInput)locationInput.value=p.location;
  if(p.radiusKm&&typeof api.setRenterRadius==="function")api.setRenterRadius(p.radiusKm,true);
  const searchResult=await api.searchTypedMapLocation();
  if(searchResult===false)throw new Error("We could not search that location. Check the locality name or try a nearby PIN code.");
  if(api.applyRenterFilters)api.applyRenterFilters(p);
  status.textContent="Map updated with matching GharDekho listings."+(p.nearby?" Nearby "+p.nearby+" preference is noted; distance matching is shown only where verified facility data exists.":"");
 }catch(error){status.textContent=error.message||"Map search failed. Try another locality."}
 finally{go.disabled=false}
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
function bind(){
 addSupport();mountFinder();mountCompare();$("renterDashboard")?.classList.add("gdrx-premium");
 const results=$("propertiesContainer");if(results&&!results.dataset.gdrxScoreObserver){results.dataset.gdrxScoreObserver="1";new MutationObserver(()=>applyManualScores()).observe(results,{childList:true,subtree:true})}
 const form=$("renterFindHomeForm");if(form&&!form.dataset.gdrxScoreCapture){form.dataset.gdrxScoreCapture="1";form.addEventListener("submit",()=>{state.parsed={location:$("renterSearchLocation")?.value||"",bhk:$("renterSearchBhk")?.value||"",furnishing:$("renterSearchFurnishing")?.value||"",stayType:$("renterStayType")?.value||"",minBudget:$("renterMinBudget")?.value||"",maxBudget:$("renterMaxBudget")?.value||""};setTimeout(applyManualScores,1000)})}
 const fbtn=$("renterFindHomeBtn");if(fbtn&&!fbtn.dataset.gdrx){fbtn.dataset.gdrx="1";fbtn.addEventListener("click",openFind)}
 ["renterFindHomeBackBtn","renterFindHomeCancelBtn"].forEach(id=>{const b=$(id);if(b&&!b.dataset.gdrx){b.dataset.gdrx="1";b.addEventListener("click",closeFind)}})
 const map=$("gdrExploreMapPanel");if(map&&!map.dataset.gdrx){map.dataset.gdrx="1";new MutationObserver(()=>{if(!map.hidden)mountMapVoice()}).observe(map,{attributes:true,attributeFilter:["hidden","class"]})}
 const mapBtn=$("renterExploreMapBtn");if(mapBtn&&!mapBtn.dataset.gdrx){mapBtn.dataset.gdrx="1";mapBtn.addEventListener("click",()=>setTimeout(mountMapVoice,150))}
}
window.GDRRenterExperience={toggleCompare,buildCompareSelection,parseRequest,openFindHome:openFind,closeFindHome:closeFind};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();window.addEventListener("load",bind);
new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});
})();