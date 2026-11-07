(function(){
"use strict";
/* GDR_COMPARE_AUTOFILL_V2: seed the clicked home with up to two nearest visible real listings. */
if(window.GDRRenterExperience)return;
const $=id=>document.getElementById(id),esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={compare:[],parsed:null,recognition:null,voiceSession:0,voiceActive:false,voiceDraft:"",lang:"hi-IN",lastMapSearch:null,mapReplyLanguage:"hi",assistantSearchId:0};
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
 const aliases={"सिंगरौली":"singrauli","इंदौर":"indore","रीवा":"rewa","भोपाल":"bhopal","जबलपुर":"jabalpur","ग्वालियर":"gwalior","उज्जैन":"ujjain","सतना":"satna","देवास":"dewas","सीधी":"sidhi","बड़े":"bade","बड़ा":"bada","बड़ा":"bada","नगर":"nagar","पटेल":"patel","वैढ़न":"waidhan","विंध्यनगर":"vindhyanagar","मध्य":"madhya","प्रदेश":"pradesh"};
 const latin=raw.replace(/[\u0900-\u097F]+/gu,word=>aliases[word]||transliterateWord(word));
 const normalized=latin.replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
 return normalized;
}


function filterAssistantListings(rows,prefs){
 const p=prefs||{},query=normalizeSearchText(p.location||"");
 const tokens=query.split(" ").filter(Boolean);
 const knownCities=["singrauli","bhopal","indore","jabalpur","gwalior","ujjain","rewa","satna","dewas","sidhi","delhi","mumbai","pune","jaipur","lucknow","noida","gurgaon","gurugram","hyderabad","chennai","kolkata","bengaluru","bangalore"];
 const requestedCities=knownCities.filter(city=>tokens.includes(city));
 const cityCenters={bhopal:[23.2599,77.4126],singrauli:[24.0724946,82.6246537]};
 const distanceKm=(a,b)=>{const rad=value=>value*Math.PI/180,lat1=rad(a[0]),lat2=rad(b[0]),dLat=rad(b[0]-a[0]),dLng=rad(b[1]-a[1]),h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));};
 const number=value=>value==null||value===""?null:Number(value);
 return (Array.isArray(rows)?rows:[]).filter(row=>{
  if(!row||!row.id)return false;
  const status=String(row.status||"").toLowerCase();
  const verification=String(row.verification_status||"").toLowerCase();
  const available=(status==="verified"&&verification==="verified"&&row.owner_verified===true)
   ||(status==="pending"&&verification==="pending");
  if(!available)return false;
  if((String(row.listing_type||"home").toLowerCase()==="pg"||String(row.listing_type||"home").toLowerCase()==="hostel")&&number(row.available_beds)!==null&&number(row.available_beds)<=0)return false;
  if((String(row.listing_type||"home").toLowerCase()==="pg"||String(row.listing_type||"home").toLowerCase()==="hostel")&&number(row.available_beds)===null)return false;
  const haystack=normalizeSearchText([row.location,row.address,row.city,row.district,row.state,row.postcode].filter(Boolean).join(" "));
  if(tokens.length&&!tokens.every(token=>haystack.split(" ").includes(token)))return false;
  if(requestedCities.length){
   const address=normalizeSearchText(row.address||"");
   const addressCities=knownCities.filter(city=>new RegExp("(?:^| )"+city+"(?: |$)").test(address));
   if(addressCities.some(city=>!requestedCities.includes(city)))return false;
   const center=cityCenters[requestedCities[0]],hasCoordinates=row.latitude!=null&&row.longitude!=null&&row.latitude!==""&&row.longitude!=="",lat=Number(row.latitude),lng=Number(row.longitude);
   if(center&&hasCoordinates&&Number.isFinite(lat)&&Number.isFinite(lng)&&distanceKm(center,[lat,lng])>120)return false;
  }
  const rent=number(row.rent),min=number(p.minBudget),max=number(p.maxBudget);
  if(min!==null&&rent!==null&&rent<min)return false;
  if(max!==null&&(rent===null||rent>max))return false;
  if(p.bhk&&Number(row.bhk)!==Number(p.bhk))return false;
  if(p.furnishing&&String(row.furnishing||"").toLowerCase()!==String(p.furnishing).toLowerCase())return false;
  if(p.stayType&&String(row.listing_type||"home").toLowerCase()!==String(p.stayType).toLowerCase())return false;
  if(p.propertyType&&String(row.property_type||"").toLowerCase()!==String(p.propertyType).toLowerCase())return false;
  return true;
 }).sort((a,b)=>(number(a.rent)??Number.POSITIVE_INFINITY)-(number(b.rent)??Number.POSITIVE_INFINITY));
}
async function searchAssistantListings(prefs,raw,target){
 const id=++state.assistantSearchId,assistant=$("gdrxAssistant"),reviewBox=$("gdrxReview");
 if((!assistant||!reviewBox)&&!target)return [];
 let panel=$("gdrxAssistantResults");
 if(!panel){panel=document.createElement("section");panel.id="gdrxAssistantResults";panel.className="gdrx-assistant-results";panel.setAttribute("aria-live","polite");}
 if(target){if(panel.parentElement!==target)target.append(panel);}
 else if(!panel.isConnected)reviewBox.insertAdjacentElement("afterend",panel);
 panel.replaceChildren();
 const language=detectReplyLanguage(raw||"");
 const loading=document.createElement("p");loading.className="gdrx-assistant-results-status";loading.textContent=language==="hi"?"मैं GharDekho database में उपलब्ध घर खोज रहा हूँ…":"Searching actual available homes in GharDekho…";panel.append(loading);
 try{
  const client=window.__gdrSupabaseClient;
  if(!client||typeof client.rpc!=="function")throw new Error("Property database is not ready. Please refresh and try again.");
  const response=await client.rpc("get_public_properties");
  if(response.error)throw response.error;
  const rows=filterAssistantListings(response.data,prefs);
  if(id!==state.assistantSearchId)return rows;
  panel.replaceChildren();
  const location=String(prefs.location||"").trim();
  const heading=document.createElement("div");heading.className="gdrx-assistant-results-heading";
  const title=document.createElement("h4");title.textContent=(location?location+" — ":"")+rows.length+" Available "+(rows.length===1?"Home":"Homes");
  const count=document.createElement("span");count.className="gdrx-assistant-results-count";count.textContent=String(rows.length);
  heading.append(title,count);panel.append(heading);
  if(target){
   const mapped=rows.filter(property=>property.latitude!=null&&property.longitude!=null&&Number.isFinite(Number(property.latitude))&&Number.isFinite(Number(property.longitude))).length;
   const summary=document.createElement("p");summary.className="gdrx-assistant-results-status";
   summary.textContent=rows.length
    ?(language==="hi"?"मैप पर "+mapped+" घरों के price markers दिखाए जा रहे हैं। कुल "+rows.length+" matching listings मिलीं।":"Showing "+mapped+" mapped home price markers. "+rows.length+" matching listings found.")
    :(language==="hi"?"इस location में matching घर नहीं मिले। कृपया locality या filters बदलें।":"No matching homes found. Try another locality or adjust the filters.");
   panel.append(summary);
   const status=$("gdrxStatus");if(status)status.textContent=summary.textContent;
   return rows;
  }
  if(!rows.length){
   const empty=document.createElement("p");empty.className="gdrx-assistant-results-empty";
   empty.textContent=language==="hi"?"इस location में अभी कोई matching available home नहीं मिला। कृपया locality या filters बदलकर देखें।":"No matching available homes were found in this location. Try another locality or adjust your filters.";
   panel.append(empty);
  }else{
   const grid=document.createElement("div");grid.className="gdrx-assistant-results-grid";
   rows.forEach(property=>{
    const card=document.createElement("article");card.className="gdrx-assistant-property-card property-card";card.dataset.propertyId=String(property.id);
    const image=document.createElement("img");image.className="gdrx-assistant-property-image";image.alt="Property photograph";image.loading="lazy";
    const imageUrl=property.image_url||(Array.isArray(property.photo_urls)?property.photo_urls[0]:"");
    if(imageUrl&&/^https:\/\//i.test(String(imageUrl)))image.src=String(imageUrl);else image.hidden=true;
    image.onerror=()=>{image.hidden=true;};
    const body=document.createElement("div");body.className="gdrx-assistant-property-body property-card-body";
    const name=document.createElement("h5");name.textContent=property.title||property.name||"GharDekho rental home";
    const rent=document.createElement("strong");rent.className="gdrx-assistant-property-rent property-rent";rent.textContent="₹"+Number(property.rent||0).toLocaleString("en-IN")+" / month";
    const address=document.createElement("p");address.className="gdrx-assistant-property-location";address.textContent=[property.location,property.address].filter(Boolean).join(" · ")||"Location details not provided";
    const meta=document.createElement("p");meta.className="gdrx-assistant-property-meta";meta.textContent=[property.bhk?property.bhk+" BHK":"",property.furnishing||"",String(property.listing_type||"home").toUpperCase(),property.owner_verified?"Verified owner":"Owner verification pending",property.latitude==null||property.longitude==null?"Map pin unavailable":""].filter(Boolean).join(" · ");
    const badge=document.createElement("span");badge.className="gdrx-assistant-property-status";badge.textContent=String(property.status||"Available")==="pending"?"Pending verification":"Available";
    const actions=document.createElement("div");actions.className="gdrx-assistant-property-actions";
    const details=document.createElement("button");details.type="button";details.textContent="View details";
    details.addEventListener("click",()=>{if(typeof window.openPropertyDetails==="function")window.openPropertyDetails(property.id);else if(typeof window.openPropertyDetailsModal==="function")window.openPropertyDetailsModal(property.id);else toast("Property details are not available right now.");});
    const save=document.createElement("button");save.type="button";save.textContent="♡ Save";
    save.addEventListener("click",async()=>{const db=window.__gdrSupabaseClient;if(!db||!db.auth){toast("Please sign in as a renter to save this home.");return;}save.disabled=true;try{const auth=await db.auth.getUser(),user=auth&&auth.data&&auth.data.user;if(!user){toast("Please sign in as a renter to save this home.");return;}const saved=await db.from("saved_properties").upsert({user_id:user.id,property_id:property.id},{onConflict:"user_id,property_id",ignoreDuplicates:true});if(saved.error)throw saved.error;save.textContent="✓ Saved";toast("Home saved to your account.");}catch(error){console.error("GDR assistant save failed:",error);toast("Could not save this home. Please try again.");}finally{save.disabled=false;}});
    const compare=document.createElement("button");compare.type="button";compare.textContent="Compare";
    compare.addEventListener("click",()=>toggleCompare(property));
    actions.append(details,save,compare);body.append(name,rent,address,meta,badge,actions);card.append(image,body);grid.append(card);
   });
   panel.append(grid);
  }
  const status=$("gdrxStatus");
  if(status)status.textContent=language==="hi"?"समझ गया! "+location+" में "+rows.length+" available homes मिले हैं। नीचे असली listings दिखाई गई हैं।":"Found "+rows.length+" available homes in "+location+". Real listings are shown below.";
  if(rows.length){
   const reply=language==="hi"?"बिल्कुल! "+location+" में मुझे "+rows.length+" available घर मिले हैं। मैंने उनके details नीचे दिखा दिए हैं।":"I found "+rows.length+" available homes in "+location+". Their details are shown below.";
   if(!target)speakAssistantReply(reply,language);
  }
  return rows;
 }catch(error){
  if(id!==state.assistantSearchId)return [];
  panel.replaceChildren();const message=document.createElement("p");message.className="gdrx-assistant-results-error";message.textContent=error&&error.message?error.message:"The property search could not be completed. Please try again.";panel.append(message);
  const status=$("gdrxStatus");if(status)status.textContent=message.textContent;
  console.error("GDR Smart Finder database search failed:",error);if(target)throw error;return [];
 }
}

function parseRequest(raw){
 const original=String(raw||"").trim(),n=original.toLowerCase().normalize("NFKC");
  const clean=original.replace(/^(?:show|find)\s+me\b\s*/i,"").replace(/^i\s+(?:need|want)\b\s*/i,"").replace(/^please\s+/i,"").replace(/^(?:mujhe(?:\s+ek)?|mujhko|mere\s+mobile|meri\s+mobile|my\s+mobile|मेरे\s+मोबाइल|मेरी\s+मोबाइल|मुझे|मुझको)\s*/i,"").replace(/^(?:a|an)\s+/i,"").trim();
 const p={raw:original,location:"",minBudget:"",maxBudget:"",stayType:"",bhk:"",furnishing:"",nearby:"",propertyType:"",radiusKm:null,useMyLocation:false,familyFriendly:false};
 const bhk=n.match(/(?:^|\s)([1-5])\s*(?:bhk|bed(?:room)?s?|bed\s*room|बीएचके|कमरे)(?=\s|$|[^a-z0-9])/i);if(bhk)p.bhk=bhk[1];
 const radius=n.match(/(?:within|radius(?: of)?|around|के अंदर|तक)\s*(\d+(?:\.\d+)?)\s*(?:km|kms|kilomet(?:er|re)s?|किलोमीटर|कि\.?मी\.?)\b/i)||n.match(/\b(\d+(?:\.\d+)?)\s*(?:km|kms|kilomet(?:er|re)s?|किलोमीटर)\s*(?:के अंदर|तक|radius)?/i);
 if(radius)p.radiusKm=Math.max(.5,Math.min(10,Number(radius[1])));
 if(/\b(pg|paying guest)\b|पीजी/.test(n))p.stayType="pg";
 else if(/\b(hostel)\b|हॉस्टल/.test(n))p.stayType="hostel";
 else if(/\b(flat|apartment|independent house|villa|room)\b|फ्लैट|अपार्टमेंट|स्वतंत्र मकान|विला|कमरा/.test(n))p.stayType="home";
 // Generic home/house/घर requests mean all available rental listing types.
 if(/(?:all|every|any)\s+(?:available\s+)?(?:rental\s+)?(?:homes?|houses?|properties)|(?:jitne\s+bhi|sabhi|saare|saari)\s+(?:available\s+)?(?:rental\s+)?(?:homes?|houses?|properties)|(?:जितने\s+भी|सभी|सारे|सारी)\s+(?:उपलब्ध\s+)?(?:रेंटल\s+)?(?:घर|मकान|प्रॉपर्टी|प्रॉपर्टीज)/i.test(original))p.stayType="";
 if(/\b(semi[\s-]?furnished)\b|सेमी फर्निश/.test(n))p.furnishing="Semi-Furnished";
 else if(/\b(unfurnished)\b|अनफर्निश/.test(n))p.furnishing="Unfurnished";
 else if(/\b(furnished)\b|फर्निश/.test(n))p.furnishing="Furnished";
 if(/\b(independent house)\b|स्वतंत्र मकान/.test(n))p.propertyType="independent_house";
 else if(/\b(villa)\b/.test(n))p.propertyType="villa";
 else if(/\b(apartment|flat)\b|अपार्टमेंट|फ्लैट/.test(n))p.propertyType="apartment";
 else if(/\b(single\s+)?room\b|कमरा|कमरे/.test(n))p.propertyType="room";
 const range=n.match(/(?:between|from|budget)?\s*(?:₹|rs\.?\s*)?([\d,]{3,8})\s*(?:to|and|-)\s*(?:₹|rs\.?\s*)?([\d,]{3,8})/i);
 if(range){p.minBudget=range[1].replace(/,/g,"");p.maxBudget=range[2].replace(/,/g,"");}
 else{
  const min=n.match(/(?:at least|minimum|min|above|more than|greater than|कम से कम|से ज्यादा|से अधिक)\s*(?:₹|rs\.?\s*|rupees?\s*|रुपये\s*)?([\d,]{3,8})/i);
  if(min)p.minBudget=min[1].replace(/,/g,"");
  const max=n.match(/(?:under|below|up to|upto|maximum|max|budget|not more than|less than|ke kam|se kam|ke neeche|se neeche|के कम|से कम|के नीचे|से नीचे|तक)\s*(?:₹|rs\.?\s*|rupees?\s*|रुपये\s*)?([\d,]{3,8})/i)
   ||n.match(/(?:₹|rs\.?\s*|rupees?\s*|रुपये\s*)?([\d,]{3,8})\s*(?:(?:rupees?|rs\.?|रुपये|रु\.?)\s*)?(?:ke kam|se kam|ke neeche|se neeche|के कम|से कम|के नीचे|से नीचे|तक)/i);
  if(max)p.maxBudget=max[1].replace(/,/g,"");
  if(!p.maxBudget){const amount=n.match(/([\d,]{3,8})\s*(?:rupees?|rs\.?|रुपये|रु\.?)/i);if(amount)p.maxBudget=amount[1].replace(/,/g,"");}
  if(!p.maxBudget){const compact=n.match(/(?:under|below|upto|up to)\s*(\d+(?:\.\d+)?)\s*k|(\d+(?:\.\d+)?)\s*k\s*(?:ke kam|se kam|ke neeche|se neeche|के कम|से कम|के नीचे|से नीचे)/i);if(compact)p.maxBudget=String(Math.round(Number(compact[1]||compact[2])*1000));}
  if(!p.maxBudget&&/दस\s*हजार/.test(n)&&/(से कम|के कम|से नीचे|के नीचे)/.test(n))p.maxBudget="10000";
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
  const hindiCityLead=clean.match(/^(.+?)\s+(?:में|mein|me)\s+(.+)$/i);
  if(hindiCityLead){
   const cityPart=hindiCityLead[1].replace(/[.,!?]+$/,"").trim();
   let localityPart=hindiCityLead[2].trim();
   const stop=localityPart.search(/(?:^|\s)(?:(?:के|की|का)\s+)?(?:सभी|सारे|सारी|जितने|sabhi|saare|saari|jitne|sirf|only|[1-5]\s*(?:bhk|bed(?:room)?s?|बीएचके|कमरे)|घर|मकान|फ्लैट|अपार्टमेंट|दिखाओ|दिखा|बताओ|dikhao|dikha|batao|show|find|available|rent|किराये|रेंट|under|below|upto|budget|से कम|के कम|से नीचे|के नीचे|में|mein|me|rental|rent|houses?|homes?|properties?|\d[\d,]*(?:\.\d+)?\s*(?:k|rupees?|rs\.?|रुपये|रु\.?)?|दस\s*हजार)(?=\s|$)/i);
   if(stop>=0)localityPart=localityPart.slice(0,stop).trim();
   localityPart=localityPart.replace(/\s+(?:के|की|का)$/i,"").trim();
   p.location=localityPart?localityPart+", "+cityPart:cityPart;
  }
 }
 if(!p.location){
  m=clean.match(/^(.+?)\s+(?:ke paas|ke pass|के पास)(?=\s|$)/i);
  if(m)p.location=m[1].replace(/[.,!?]+$/,"").trim();
 }
 if(!p.location){
  const cityToken=normalizeSearchText(clean);
  const cities=[["bhopal","Bhopal"],["singrauli","Singrauli"],["indore","Indore"],["jabalpur","Jabalpur"],["gwalior","Gwalior"],["ujjain","Ujjain"],["rewa","Rewa"],["satna","Satna"],["dewas","Dewas"],["sidhi","Sidhi"]];
  const city=cities.find(([key])=>new RegExp("(?:^| )"+key+"(?: |$)").test(cityToken));
  if(city)p.location=city[1];
 }
 if(/^(?:my|current) location$/i.test(p.location))p.location="";
 // Resolve common Madhya Pradesh state-plus-city phrases to the actual requested city.
 const locationKey=normalizeSearchText(p.location);
 const knownCities=[
  ["indore","Indore"],["bhopal","Bhopal"],["singrauli","Singrauli"],["jabalpur","Jabalpur"],
  ["gwalior","Gwalior"],["ujjain","Ujjain"],["rewa","Rewa"],["satna","Satna"],["dewas","Dewas"],["sidhi","Sidhi"]
 ];
 const matchedCity=knownCities.find(([key])=>new RegExp("(?:^| )"+key+"(?: |$)").test(locationKey));
 if(matchedCity&&/(madhya pradesh|m p|mp|मध्य प्रदेश)/i.test(original)){
  const withoutState=String(p.location||"").replace(/मध्य\s*प्रदेश|madhya\s+pradesh|\bmp\b/ig," ").replace(/\bke\b|के/ig," ").replace(/\s+/g," ").trim();
  p.location=normalizeSearchText(withoutState)===matchedCity[0]?matchedCity[1]:(withoutState||matchedCity[1]);
 }else if(!p.location&&matchedCity){
  p.location=matchedCity[1];
 }
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

function setValue(id,v,allowEmpty){const el=$(id);if(!el||v==null||(v===""&&!allowEmpty))return;el.value=String(v);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}
function applyToForm(p){
 setValue("renterSearchLocation",p.location);setValue("renterStayType",p.stayType,true);setValue("renterSearchPropertyType",p.propertyType,true);setValue("renterSearchBhk",p.bhk);setValue("renterSearchFurnishing",p.furnishing);
 if(p.minBudget){setValue("renterMinBudgetPreset","custom");setValue("renterMinBudgetCustom",p.minBudget);setValue("renterMinBudget",p.minBudget)}
 if(p.maxBudget){setValue("renterMaxBudgetPreset","custom");setValue("renterMaxBudgetCustom",p.maxBudget);setValue("renterMaxBudget",p.maxBudget)}
}
function review(raw,options){
 const extracted=parseRequest(raw),previous=state.parsed||{};
 const p={...previous,...extracted,raw:String(raw||"")};
 const broadHomes=/(?:all|every|any)\s+(?:available\s+)?(?:homes?|houses?|properties)|(?:जितने\s+भी|सभी|सारे|सारी)\s+(?:घर|मकान|प्रॉपर्टी|प्रॉपर्टीज)/i.test(String(raw||""));
 if(broadHomes){p.stayType="";p.propertyType="";}
 ["location","minBudget","maxBudget","stayType","bhk","furnishing","nearby","propertyType"].forEach(key=>{
  if(!extracted[key]&&!(broadHomes&&(key==="stayType"||key==="propertyType")))p[key]=previous[key]||"";
 });
 p.radiusKm=extracted.radiusKm==null?(previous.radiusKm??null):extracted.radiusKm;
 p.useMyLocation=!!(extracted.useMyLocation||previous.useMyLocation);
 p.familyFriendly=!!(extracted.familyFriendly||previous.familyFriendly);
 if(/\\b(reset|clear|start over|new search)\\b|फिल्टर हटाओ|नई खोज/i.test(String(raw||""))){
  state.parsed=null;
  ["location","minBudget","maxBudget","stayType","bhk","furnishing","nearby","propertyType"].forEach(key=>{if(!extracted[key])p[key]="";});
  p.radiusKm=extracted.radiusKm??null;p.useMyLocation=!!extracted.useMyLocation;p.familyFriendly=!!extracted.familyFriendly;
 }
 if(!p.location&&!p.maxBudget&&!p.bhk&&!p.stayType&&!p.furnishing){
  $("gdrxStatus").textContent="I couldn't identify a location or filter. Please add a city, area, budget, BHK or property type.";
  return false;
 }
 state.parsed=p;applyToForm(p);
 const vals=[["Location",p.location||"Not detected"],["Stay type",p.stayType||"Any"],["Property type",p.propertyType||"Any"],["BHK",p.bhk?p.bhk+" BHK":"Any"],["Maximum rent",p.maxBudget?"₹"+Number(p.maxBudget).toLocaleString("en-IN"):"No limit"],["Minimum rent",p.minBudget?"₹"+Number(p.minBudget).toLocaleString("en-IN"):"No minimum"],["Furnishing",p.furnishing||"Any"]];
 const note=p.nearby?"Nearby preference noted: "+p.nearby+". The current property records do not store verified nearby-facility distances, so this is not used to claim a match.":"";
 const box=$("gdrxReview");box.hidden=false;box.innerHTML='<div class="gdrx-review-title"><b>Here is what I understood</b><span>✓ REVIEW</span></div><div class="gdrx-review-grid">'+vals.map(x=>'<div><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join("")+'</div>'+(note?'<p class="gdrx-note">'+esc(note)+'</p>':"")+'<div class="gdrx-review-actions"><button type="button" id="gdrxEdit">Edit preferences</button><button type="button" id="gdrxFind">Find matching homes →</button></div>';
 const status=$("gdrxStatus");
 if(options&&options.autoSearch){
  if(!p.location&&!p.useMyLocation){status.textContent="I understood the filters, but I still need a city or locality before searching. Please add one below.";return false;}
  status.textContent="Voice request understood. Applying your filters and searching actual GharDekho listings…";
  const replyLanguage=detectReplyLanguage(raw),spokenReply=replyLanguage==="hi"
   ?"समझ गया। मैं "+(p.location||"आपकी चुनी हुई location")+" में उपलब्ध rental homes खोज रहा हूँ।"
   :"Got it. I'm searching available rental homes in "+(p.location||"your selected location")+".";
  speakAssistantReply(spokenReply,replyLanguage);
 }else status.textContent="Extracted with a local parser. You can edit any field before searching.";
 $("gdrxEdit").onclick=()=>$("renterFindHomeForm").scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxFind").onclick=()=>{const form=$("renterFindHomeForm");if(form)form.requestSubmit();searchAssistantListings(p,raw);};
 if(options&&options.autoSearch){
  const form=$("renterFindHomeForm");
  if(form)setTimeout(()=>{if(form.isConnected)form.requestSubmit();},0);searchAssistantListings(p,raw);
 }
 return true;
}
function setRenterMicState(mic,listening){
 if(!mic)return;
 mic.classList.toggle("listening",!!listening);
 mic.setAttribute("aria-pressed",listening?"true":"false");
 mic.setAttribute("aria-label",listening?"Stop voice search":"Find a home by speaking");
 mic.innerHTML=(listening?'<span class="gdrx-mic-visual is-listening" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="9" y="2.5" width="6" height="12" rx="3"></rect><path d="M5.5 10.5v1.2a6.5 6.5 0 0 0 13 0v-1.2M12 18.2v3.3m-4 0h8"></path><path d="M3 8v5m18-5v5"></path></svg></span><span>Stop Listening</span>':'<span class="gdrx-mic-visual" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="9" y="2.5" width="6" height="12" rx="3"></rect><path d="M5.5 10.5v1.2a6.5 6.5 0 0 0 13 0v-1.2M12 18.2v3.3m-4 0h8"></path><path d="M3 8v5m18-5v5"></path></svg></span><span>Find a Home by Speaking</span>');
}
function finishRenterVoice(target,mapMode,session,transcript){
 if(session!==state.voiceSession)return;
 const status=$(mapMode?"gdrxMapStatus":"gdrxStatus"),field=$(target),mic=$(mapMode?"gdrxMapMic":"gdrxMic");
 state.recognition=null;state.voiceActive=false;
 setRenterMicState(mic,false);
 const finalText=String(transcript||"").trim();
 if(!finalText){
  if(status&&status.dataset.voiceError!=="1")status.textContent="No clear speech was captured. Tap the microphone and try again, or type your request.";
  return;
 }
 if(field){field.value=finalText;field.dispatchEvent(new Event("input",{bubbles:true}));}
 if(mapMode){
  state.mapReplyLanguage=detectReplyLanguage(finalText);
  if(status)status.textContent="Speech captured. Review or edit the text, then tap Search map.";
 }else{
  review(finalText,{autoSearch:true});
 }
}
function stopRenterVoice(target,mapMode,processCaptured){
 const session=state.voiceSession,r=state.recognition;
 state.voiceSession++;state.voiceActive=false;state.recognition=null;
 const mic=$(mapMode?"gdrxMapMic":"gdrxMic"),status=$(mapMode?"gdrxMapStatus":"gdrxStatus");
 if(r){try{r.abort?r.abort():r.stop();}catch(_){}}
 setRenterMicState(mic,false);
 const transcript=state.voiceDraft.trim();state.voiceDraft="";
 if(processCaptured&&transcript){
  if($(target))$(target).value=transcript;
  if(mapMode){state.mapReplyLanguage=detectReplyLanguage(transcript);if(status)status.textContent="Speech stopped. Review your transcript and tap Search map.";}
  else review(transcript,{autoSearch:true});
 }else if(status)status.textContent="Microphone stopped. Tap the microphone when you want to speak again.";
}
function startVoice(target,lang){
 const mapMode=target==="gdrxMapPrompt",micId=mapMode?"gdrxMapMic":"gdrxMic",statusId=mapMode?"gdrxMapStatus":"gdrxStatus";
 const status=$(statusId),mic=$(micId),API=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(state.voiceActive&&state.recognition){stopRenterVoice(target,mapMode,true);return;}
 if(!API){
  if(status){status.dataset.voiceError="1";status.textContent="Voice recognition is not available in this browser session. Check Chrome is up to date and use HTTPS; you can still type your request.";}
  return;
 }
 if(!window.isSecureContext){
  if(status)status.textContent="Microphone access requires a secure HTTPS page. You can still type your request.";
  return;
 }
 if(state.recognition){try{state.recognition.abort?state.recognition.abort():state.recognition.stop();}catch(_){}}
 state.voiceSession++;const session=state.voiceSession;
 state.voiceActive=true;state.voiceDraft="";
 const chosen=mapMode?($("gdrxMapLang")?.value||state.lang):(lang||state.lang);
 const r=new API();state.recognition=r;r.lang=chosen;r.continuous=false;r.interimResults=true;r.maxAlternatives=1;
 let finalTranscript="",interimTranscript="",finished=false;
 setRenterMicState(mic,true);
 if(status){status.dataset.voiceError="0";status.textContent="Listening… बोलिए / I'm listening. Press Stop to end the microphone session.";}
 r.onstart=()=>{if(session!==state.voiceSession)return;setRenterMicState(mic,true);};
 r.onresult=e=>{
  if(session!==state.voiceSession||finished)return;
  for(let i=e.resultIndex||0;i<e.results.length;i++){
   const item=e.results[i],value=item&&item[0]&&item[0].transcript||"";
   if(item.isFinal&&value.trim())finalTranscript+=(finalTranscript?" ":"")+value.trim();
   else if(value.trim())interimTranscript=value.trim();
  }
  state.voiceDraft=finalTranscript.trim();
  const field=$(target);if(field){field.value=state.voiceDraft;field.dispatchEvent(new Event("input",{bubbles:true}));}
 };
 r.onerror=e=>{
  if(session!==state.voiceSession||finished)return;
  finished=true;state.voiceActive=false;state.recognition=null;state.voiceSession++;
  setRenterMicState(mic,false);
  if(status){
   status.dataset.voiceError="1";
   const messages={
    "not-allowed":"Microphone permission is blocked. Allow microphone access for ghardekhorenters.com in Chrome site settings, then try again.",
    "service-not-allowed":"Chrome speech recognition service is blocked. Check browser permissions and network access.",
    "no-speech":"No speech was detected. Tap the microphone and speak a little closer to it.",
    "audio-capture":"No microphone input device is available. Check your Windows input device and Chrome microphone permission.",
    "network":"Chrome speech recognition could not reach its speech service. Check your internet connection; typed search remains available.",
    "language-not-supported":"This speech language is not supported by the browser. Select another language or type your request.",
    "aborted":"Microphone session was stopped."
   };
   status.textContent=messages[e.error]||("Voice recognition failed ("+String(e.error||"unknown error")+"). You can type your request instead.");
  }
 };
 r.onend=()=>{
  if(session!==state.voiceSession||finished)return;
  finished=true;
  const transcript=finalTranscript.trim();
  state.voiceDraft=transcript;
  finishRenterVoice(target,mapMode,session,transcript);
 };
 try{r.start();}
 catch(error){
  finished=true;state.voiceActive=false;state.recognition=null;state.voiceSession++;
  setRenterMicState(mic,false);
  if(status)status.textContent="Could not start microphone ("+(error&&error.name||"unknown error")+"). Check Chrome microphone permission or type your request.";
 }
}
function hideUpperAvailableRentalPanel(){
 // One bounded pass is enough: observing the entire document here caused repeated
 // full-page heading scans while property cards and dashboard panels were updating.
 const headings=document.querySelectorAll("h1,h2,h3,h4,h5,[role=heading]");
 for(const heading of headings){
  if(String(heading.textContent||"").replace(/\\s+/g," ").trim().toLowerCase()!=="available rental properties")continue;
  let node=heading;
  for(let depth=0;depth<7&&node&&node!==document.body;depth++,node=node.parentElement){
   const text=String(node.textContent||"").replace(/\\s+/g," ").trim();
   if(/available rental properties/i.test(text)&&/loading properties/i.test(text)){
    node.hidden=true;node.setAttribute("aria-hidden","true");node.setAttribute("data-gdr-hidden-duplicate-rentals","true");node.style.setProperty("display","none","important");
    break;
   }
  }
 }
}
function mountFinder(){
 hideUpperAvailableRentalPanel();
 const sec=$("renterFindHomeSection"),form=$("renterFindHomeForm");if(!sec||!form||$("gdrxFinder"))return;
 const box=document.createElement("section");box.id="gdrxFinder";box.className="gdrx-finder";
 box.innerHTML='<div class="gdrx-finder-heading"><span>GHARDEKHO SMART FINDER</span><h3>Tell GDR what home you are looking for.</h3><p>Talk naturally or type your requirements. Review the details, then search actual GharDekho listings.</p></div><div class="gdrx-choices"><button type="button" id="gdrxTalk"><i>✦</i><span><b>Find your home with GDR Assistant</b><small>Voice or text · Hindi, English & Hinglish</small></span><em>01</em></button><button type="button" id="gdrxManual"><i>⌕</i><span><b>Search yourself</b><small>Use the manual filters below</small></span><em>02</em></button></div><div class="gdrx-assistant" id="gdrxAssistant"><div class="gdrx-assistant-head"><div><span>● GDR ASSISTANT</span><h4>Tell GDR What Home You are Looking For</h4><p>Speak naturally. We will find homes that match your needs.</p></div><div class="gdrx-orb">⌂</div></div><div class="gdrx-assistant-greeting" id="gdrxWelcome" role="status">Hello! मैं GDR Assistant हूँ — GharDekho का आपका personal assistant. बताइए, आपको किस शहर या locality में घर चाहिए? मैं आपके लिए available rental homes खोज दूँगा।</div><label for="gdrxPrompt">DESCRIBE YOUR IDEAL HOME</label><textarea id="gdrxPrompt" rows="3" placeholder="Mujhe Patel Nagar Bhopal mein 2 BHK furnished flat chahiye. Budget 8000 rupees hai."></textarea><div class="gdrx-tools"><select id="gdrxLang" aria-label="Speech language"><option value="hi-IN">Hindi / Hinglish</option><option value="en-IN">English (India)</option><option value="en-US">English (US)</option></select><button type="button" id="gdrxMic" aria-label="Find a home by speaking" aria-pressed="false"><span class="gdrx-mic-visual" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="9" y="2.5" width="6" height="12" rx="3"></rect><path d="M5.5 10.5v1.2a6.5 6.5 0 0 0 13 0v-1.2M12 18.2v3.3m-4 0h8"></path><path d="M3 8v5m18-5v5"></path></svg></span><span>Find a Home by Speaking</span></button><button type="button" id="gdrxUnderstand">Understand my request →</button></div><p id="gdrxStatus" role="status">Microphone is OFF until you click. It listens for one request, then stops. Text search always works.</p><div id="gdrxReview" hidden></div></div>';
 form.parentNode.insertBefore(box,form);
 $("gdrxTalk").onclick=()=>$("gdrxAssistant").scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxManual").onclick=()=>form.scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxUnderstand").onclick=()=>review($("gdrxPrompt").value);
 $("gdrxLang").onchange=e=>state.lang=e.target.value;
 $("gdrxMic").onclick=()=>startVoice("gdrxPrompt",state.lang)
}
// Map voice is owned exclusively by GDRMapVoiceAssistant in gdr-map-voice.js.
// The former gdrxMapVoice toolbar injected a second microphone and recognition
// instance, which caused overlapping controls and competing search flows.
function mountMapVoice(){
 const legacy=$("gdrxMapVoice");
 if(legacy)legacy.remove();
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
 const normalize=value=>String(value||"").replace(/\s+/g," ").trim();
 const candidates=Array.from(document.querySelectorAll("body *")).filter(el=>{
  if(el===button||el.contains(button))return false;
  const value=normalize(el.innerText||el.textContent);
  return /ODD\s+JI/i.test(value)&&/Renter/i.test(value)&&value.length<=100;
 });
 candidates.sort((a,b)=>normalize(a.innerText||a.textContent).length-normalize(b.innerText||b.textContent).length);
 const badge=candidates[0];
 if(!badge||!badge.parentElement)return;
 const stack=document.createElement("div");
 stack.className="renter-account-edit-stack";
 badge.parentElement.insertBefore(stack,badge);
 stack.append(badge,button);
}
function ensureAssistantResultStyles(){
 if(document.querySelector("link[data-gdrx-assistant-result-styles]"))return;
 const link=document.createElement("link");link.rel="stylesheet";link.href="/assets/gdr-renter-experience.css?v=20261107-smart-assistant-results-1";link.dataset.gdrxAssistantResultStyles="true";document.head.appendChild(link);
}
function bind(){
 ensureAssistantResultStyles();moveEditProfileToAccount();addSupport();mountFinder();mountCompare();$("renterDashboard")?.classList.add("gdrx-premium");
 const results=$("propertiesContainer");if(results&&!results.dataset.gdrxScoreObserver){results.dataset.gdrxScoreObserver="1";let scoreFrame=0;new MutationObserver(()=>{if(scoreFrame)return;scoreFrame=requestAnimationFrame(()=>{scoreFrame=0;applyManualScores();});}).observe(results,{childList:true,subtree:true})}
 const form=$("renterFindHomeForm");if(form&&!form.dataset.gdrxScoreCapture){form.dataset.gdrxScoreCapture="1";form.addEventListener("submit",()=>{state.parsed={location:$("renterSearchLocation")?.value||"",bhk:$("renterSearchBhk")?.value||"",furnishing:$("renterSearchFurnishing")?.value||"",stayType:$("renterStayType")?.value||"",minBudget:$("renterMinBudget")?.value||"",maxBudget:$("renterMaxBudget")?.value||""};setTimeout(applyManualScores,1000)})}
 const fbtn=$("renterFindHomeBtn");if(fbtn&&!fbtn.dataset.gdrx){fbtn.dataset.gdrx="1";fbtn.addEventListener("click",openFind)}
 ["renterFindHomeBackBtn","renterFindHomeCancelBtn"].forEach(id=>{const b=$(id);if(b&&!b.dataset.gdrx){b.dataset.gdrx="1";b.addEventListener("click",closeFind)}})
 const map=$("gdrExploreMapPanel");if(map)map.querySelector("#gdrxMapVoice")?.remove();
}
window.GDRRenterExperience={toggleCompare,buildCompareSelection,parseRequest,normalizeSearchText,filterAssistantListings,searchAssistantListings,openFindHome:openFind,closeFindHome:closeFind};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();window.addEventListener("load",bind);
// Bind once after DOM readiness and once after full load. Do not observe the
// entire document: bind() scans/moves dashboard nodes and would be re-run for
// every property-card mutation, creating avoidable main-thread work.
})();