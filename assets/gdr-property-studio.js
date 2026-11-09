(function(){
"use strict";
const VERSION="20261109-draft-gallery2";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state={
  user:null,owner:null,step:0,publishing:false,published:false,propertyType:"",configuration:"",
  rent:"",deposit:"",furnishing:"",description:"",address:"",pincode:"",lat:null,lng:null,
  locationConfirmed:false,resolvedPincode:"",pinCenter:null,
  roomType:"",gender:"",totalBeds:"",availableBeds:"",foodIncluded:"",
  files:[],coverIndex:0,uploadedPhotos:[],uploadedPaths:[],nearbyPlaces:[],draftPhotosNeedReselect:false,draftUpdatedAt:null,
  submissionId:"",recognition:null,recording:false,mapParent:null,mapNext:null,voice:{active:false,manualStop:false,speaking:false,restartTimer:null,turnTimer:null,turnText:"",finalText:"",interimText:"",pending:{},awaitingConfirmation:false,lastReply:"",lastQuestion:"",lastField:"",muted:false,language:"hi",session:0,permissionBlocked:false,skippedDeposit:false,skippedFood:false}
};
const typeLabels={
 apartment:"Apartment / Flat",independent_house:"Independent House",villa:"Villa",room:"Room",
 pg:"PG",hostel:"Hostel",other:"Other"
};
const configurations=["1 RK","1 BHK","2 BHK","3 BHK","4 BHK","5+ BHK"];
const allowedTypes=["image/jpeg","image/png","image/webp"];
let searchTimer=null,searchController=null,nearbyRun=0,nearbyController=null;
function client(){return window.__gdrSupabaseClient||null;}
function studio(){return $("#gdrPropertyStudio");}
function message(text,tone){
 const el=$("#gdrStudioMessage");if(!el)return;
 el.textContent=text||"";el.dataset.tone=tone||"info";el.hidden=!text;
}
function setStatus(text){const el=$("#gdrStudioDraftStatus");if(el)el.textContent=text;}
function uuid(){
 if(window.crypto&&typeof window.crypto.randomUUID==="function")return window.crypto.randomUUID();
 return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16);});
}
function draftKey(){return "gdr_property_studio_draft_v1:"+String(state.user&&state.user.id||"guest");}
function clearLegacyDraft(){
 try{localStorage.removeItem(draftKey());}catch(e){console.warn("Could not clear an older Property Studio draft",e);}
}
function saveDraft(){
 if(!state.user)return;
 const fields={propertyType:state.propertyType,configuration:state.configuration,rent:state.rent,deposit:state.deposit,
  furnishing:state.furnishing,description:state.description,address:state.address,pincode:state.pincode,
  lat:state.lat,lng:state.lng,roomType:state.roomType,gender:state.gender,totalBeds:state.totalBeds,
  availableBeds:state.availableBeds,foodIncluded:state.foodIncluded};
 const meaningful=Object.values(fields).some(value=>value!==null&&value!==undefined&&String(value).trim()!=="");
 if(!meaningful){clearLegacyDraft();return;}
 const payload={version:2,ownerId:state.user.id,submissionId:state.submissionId,savedAt:new Date().toISOString(),step:state.step,fields,
  pendingPhotoCount:state.files.length+state.uploadedPhotos.length,
  uploadedPhotos:state.uploadedPhotos.map(photo=>({url:photo.url,path:photo.path,category:photo.category||"interior"})),coverIndex:state.coverIndex,
  photoCategories:state.files.map(file=>file.gdrCategory||"interior").concat(state.uploadedPhotos.map(photo=>photo.category||"interior"))};
 try{
  localStorage.setItem(draftKey(),JSON.stringify(payload));state.draftUpdatedAt=payload.savedAt;
  setStatus("Draft saved on this device · "+new Date(payload.savedAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));
 }catch(error){console.warn("Property Studio draft could not be saved",error);setStatus("Draft storage is unavailable in this browser. Keep this page open while editing.");}
}
function restoreDraft(){
 if(!state.user)return false;
 let payload;
 try{payload=JSON.parse(localStorage.getItem(draftKey())||"null");}catch(error){console.warn("Saved listing draft could not be read",error);return false;}
 if(!payload||payload.version!==2||payload.ownerId!==state.user.id||!payload.fields||typeof payload.fields!=="object")return false;
 const savedAt=Date.parse(payload.savedAt||"");
 if(!Number.isFinite(savedAt)||savedAt>Date.now()+300000||Date.now()-savedAt>14*86400000){clearLegacyDraft();dismissDraftRecovery();return false;}
 const fields=payload.fields,validTypes=["apartment","room","independent_house","villa","pg","hostel","other"];
 state.propertyType=validTypes.includes(fields.propertyType)?fields.propertyType:"";
 state.configuration=configurations.includes(fields.configuration)?fields.configuration:(fields.configuration==="Other"?"Other":"");
 state.rent=String(fields.rent??"").slice(0,12);state.deposit=String(fields.deposit??"").slice(0,12);
 state.furnishing=["Furnished","Semi-Furnished","Unfurnished"].includes(fields.furnishing)?fields.furnishing:"";
 state.description=String(fields.description??"").slice(0,2000);state.address=String(fields.address??"").slice(0,300);
 state.pincode=/^\d{6}$/.test(String(fields.pincode??""))?String(fields.pincode):"";
 const lat=Number(fields.lat),lng=Number(fields.lng),validPoint=validIndiaPoint(lat,lng);
 state.lat=validPoint?lat:null;state.lng=validPoint?lng:null;state.locationConfirmed=false;
 state.pinCenter=validPoint?{lat,lng}:null;state.resolvedPincode="";
 state.roomType=String(fields.roomType??"").slice(0,80);state.gender=String(fields.gender??"").slice(0,40);
 state.totalBeds=String(fields.totalBeds??"").slice(0,5);state.availableBeds=String(fields.availableBeds??"").slice(0,5);
 state.foodIncluded=["yes","no"].includes(fields.foodIncluded)?fields.foodIncluded:"";
 state.step=Math.max(0,Math.min(4,Number(payload.step)||0));
 const savedSubmissionId=String(payload.submissionId||"");
 state.submissionId=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedSubmissionId)?savedSubmissionId:uuid();
 state.files=[];state.uploadedPhotos=[];state.uploadedPaths=[];state.coverIndex=0;
 const publicPrefix="https://gktmaiwqvtusnegevdle.supabase.co/storage/v1/object/public/property-images/"+state.user.id+"/";
 state.uploadedPhotos=(Array.isArray(payload.uploadedPhotos)?payload.uploadedPhotos:[]).filter(photo=>photo&&typeof photo.path==="string"&&photo.path.startsWith(state.user.id+"/")&&typeof photo.url==="string"&&photo.url.startsWith(publicPrefix)).slice(0,8).map(photo=>({url:photo.url,path:photo.path,category:photo.category==="exterior"?"exterior":"interior"}));
 state.uploadedPaths=state.uploadedPhotos.map(photo=>photo.path);
 state.coverIndex=Math.max(0,Math.min(state.uploadedPhotos.length-1,Number(payload.coverIndex)||0));
 state.draftPhotosNeedReselect=Number(payload.pendingPhotoCount||0)>state.uploadedPhotos.length;
 state.draftUpdatedAt=typeof payload.savedAt==="string"?payload.savedAt:null;
 syncFormFromState();renderPhotos();
 const banner=$("#gdrStudioDraftRecovery"),note=$("#gdrStudioDraftNote");
 if(banner){banner.hidden=false;if(note)note.textContent="Recovered "+(state.draftUpdatedAt?new Date(state.draftUpdatedAt).toLocaleString("en-IN"):"saved")+" · "+(state.draftPhotosNeedReselect?"Select any unuploaded image files again; uploaded images have been restored.":"Your text details and uploaded images are ready to continue.");}
 setStatus("Saved draft recovered · Review your details before publishing");
 return true;
}
function dismissDraftRecovery(){const banner=$("#gdrStudioDraftRecovery");if(banner)banner.hidden=true;}
function syncFormFromState(){
 const values={
  gdrStudioLocation:state.address,gdrStudioPincode:state.pincode,gdrStudioRent:state.rent,
  gdrStudioDeposit:state.deposit,gdrStudioFurnishing:state.furnishing,gdrStudioDescription:state.description,
  gdrStudioRoomType:state.roomType,gdrStudioGender:state.gender,
  gdrStudioTotalBeds:state.totalBeds,gdrStudioAvailableBeds:state.availableBeds
 };
 Object.keys(values).forEach(id=>{const el=document.getElementById(id);if(el)el.value=values[id]??"";});
 const food=$("#gdrStudioFoodIncluded");if(food)food.value=state.foodIncluded||"";
 updateTypeCards();updateConfigurationCards();updateConditionalFields();updateLocationStatus();renderLiveVoiceForm();
}

function resetNewListing(){
 stopVoice();restoreMapPanel();
 if(searchTimer){clearTimeout(searchTimer);searchTimer=null;}
 if(searchController){try{searchController.abort();}catch(e){}searchController=null;}
 if(nearbyController){try{nearbyController.abort();}catch(e){}nearbyController=null;}
 if(pincodeResolveController){try{pincodeResolveController.abort();}catch(e){}pincodeResolveController=null;}
 if(pinResolveTimer){clearTimeout(pinResolveTimer);pinResolveTimer=null;}
 pinResolveSequence++;state.resolvedPincode="";state.pinCenter=null;state.locationConfirmed=false;
 state.step=0;state.publishing=false;state.published=false;
 state.propertyType="";state.configuration="";state.rent="";state.deposit="";
 state.furnishing="";state.description="";state.address="";state.pincode="";
 state.lat=null;state.lng=null;state.roomType="";state.gender="";
 state.totalBeds="";state.availableBeds="";state.foodIncluded="";
 state.files.forEach(file=>{if(file.previewUrl&&String(file.previewUrl).startsWith("blob:")){try{URL.revokeObjectURL(file.previewUrl);}catch(e){}}});
 state.files=[];state.coverIndex=0;state.uploadedPhotos=[];state.uploadedPaths=[];
 state.nearbyPlaces=[];state.draftPhotosNeedReselect=false;state.draftUpdatedAt=null;state.submissionId=uuid();state.recognition=null;state.recording=false;
 state.mapParent=null;state.mapNext=null;
 Object.assign(state.voice,{
  active:false,manualStop:false,speaking:false,restartTimer:null,turnTimer:null,
  turnText:"",finalText:"",interimText:"",pending:{},awaitingConfirmation:false,
  lastReply:"",lastQuestion:"",lastField:"",permissionBlocked:false,
  skippedDeposit:false,skippedFood:false,session:state.voice.session+1
 });
 syncFormFromState();
 const photoFiles=$("#gdrStudioPhotoFiles"),cameraFiles=$("#gdrStudioCameraFiles");
 if(photoFiles)photoFiles.value="";if(cameraFiles)cameraFiles.value="";
 const transcript=$("#gdrStudioVoiceTranscript");if(transcript)transcript.value="";
 const reply=$("#gdrStudioVoiceReply");if(reply)reply.textContent="Hi! I’m GDR. Tell me about your property. I’ll help only when you choose Start speaking.";
 const pending=$("#gdrStudioVoicePending");if(pending){pending.innerHTML="";pending.hidden=true;}
 const confirmActions=$("#gdrStudioVoiceConfirmActions");if(confirmActions)confirmActions.hidden=true;
 const preview=$("#gdrStudioPhotoPreview");if(preview){preview.innerHTML="";preview.hidden=true;}
 const suggestions=$("#gdrStudioLocationSuggestions");if(suggestions){suggestions.innerHTML="";suggestions.hidden=true;}
 renderPhotos();renderNearby();updateStep();message("");
 setStatus("Manual entry · No previous listing details loaded");
}
function updateTypeCards(){
 $$("[data-gdr-property-type]").forEach(b=>{
  const active=b.dataset.gdrPropertyType===state.propertyType;
  b.classList.toggle("is-selected",active);b.setAttribute("aria-pressed",active?"true":"false");
 });
}
function updateConfigurationCards(){
 $$("[data-gdr-configuration]").forEach(b=>{
  const active=b.dataset.gdrConfiguration===state.configuration;
  b.classList.toggle("is-selected",active);b.setAttribute("aria-pressed",active?"true":"false");
 });
}
function updateConditionalFields(){
 const home=["apartment","independent_house","villa"].includes(state.propertyType);
 const other=state.propertyType==="other";
 const pg=["pg","hostel"].includes(state.propertyType);
 const config=$("#gdrStudioConfigurationWrap");if(config)config.hidden=!(home||other);
 const pgWrap=$("#gdrStudioPgDetails");if(pgWrap)pgWrap.hidden=!pg;
 const confLabel=$("#gdrStudioConfigurationLabel");if(confLabel)confLabel.textContent=other?"Property configuration":"BHK configuration";
 if(other){
  const wrap=$("#gdrStudioConfigurationOptions");if(wrap)wrap.hidden=true;
  const hint=$("#gdrStudioOtherHint");if(hint)hint.hidden=false;
 }else{
  const wrap=$("#gdrStudioConfigurationOptions");if(wrap)wrap.hidden=false;
  const hint=$("#gdrStudioOtherHint");if(hint)hint.hidden=true;
 }
}
function updateLocationStatus(){
 const el=$("#gdrStudioLocationStatus");if(!el)return;
 if(state.lat!==null&&state.lng!==null){
  const coordinates=state.lat.toFixed(5)+", "+state.lng.toFixed(5);
  el.textContent=state.locationConfirmed?"Exact property pin confirmed · "+coordinates:"Approximate area located · open Select on Map, then tap or drag to the exact property entrance · "+coordinates;
 }else el.textContent="Choose a search result, use GPS or place the exact property point on the map.";
}
function validIndiaPoint(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=6&&lat<=38.5&&lng>=68&&lng<=98.5;}
function setLocation(address,lat,lng,pincode,confirmed){
 state.address=String(address||"").trim();
 const valid=validIndiaPoint(Number(lat),Number(lng));
 state.lat=valid?Number(lat):null;state.lng=valid?Number(lng):null;
 state.locationConfirmed=confirmed===true&&valid;
 if(pincode)state.pincode=String(pincode).replace(/\D/g,"").slice(0,6);
 const input=$("#gdrStudioLocation");if(input)input.value=state.address;
 const pin=$("#gdrStudioPincode");if(pin)pin.value=state.pincode;
 const ownerLocation=$("#propertyLocation");
 if(ownerLocation){
  ownerLocation.value=state.address;
  if(valid){ownerLocation.dataset.gdSelectedLat=String(state.lat);ownerLocation.dataset.gdSelectedLng=String(state.lng);ownerLocation.dataset.gdSelectedDisplayName=state.address;}
  else ["gdSelectedLat","gdSelectedLng","gdSelectedDisplayName"].forEach(key=>delete ownerLocation.dataset[key]);
 }
 updateLocationStatus();saveDraft();renderLiveVoiceForm();
 if(valid)loadNearbyPlaces();
}
function clearStudioCoordinateSelection(){
 if(pincodeResolveController){try{pincodeResolveController.abort();}catch(e){}pincodeResolveController=null;}
 if(pinResolveTimer){clearTimeout(pinResolveTimer);pinResolveTimer=null;}
 pinResolveSequence++;
 state.lat=null;state.lng=null;state.locationConfirmed=false;state.pinCenter=null;state.resolvedPincode="";
 const ownerLocation=$("#propertyLocation");
 if(ownerLocation){ownerLocation.value=state.address||"";["gdSelectedLat","gdSelectedLng","gdSelectedDisplayName"].forEach(key=>delete ownerLocation.dataset[key]);}
 if(window.GDRMapExperience&&typeof window.GDRMapExperience.clearOwnerMapSelectionForPinChange==="function")window.GDRMapExperience.clearOwnerMapSelectionForPinChange();
 updateLocationStatus();
}
function invalidateStudioLocationForPinChange(nextPin){
 if(pincodeResolveController){try{pincodeResolveController.abort();}catch(e){}pincodeResolveController=null;}
 if(pinResolveTimer){clearTimeout(pinResolveTimer);pinResolveTimer=null;}
 pinResolveSequence++;state.pincode=String(nextPin||"").replace(/\D/g,"").slice(0,6);
 state.address="";state.nearbyPlaces=[];clearStudioCoordinateSelection();
 const address=$("#gdrStudioLocation");if(address)address.value="";
 const suggestions=$("#gdrStudioLocationSuggestions");if(suggestions){suggestions.innerHTML="";suggestions.hidden=true;}
 const status=$("#gdrStudioLocationStatus");if(status)status.textContent="PIN changed. The previous address and map pin have been cleared; locating the latest PIN code.";
 renderNearby();saveDraft();renderLiveVoiceForm();
}
let pincodeResolveController=null,pinResolveTimer=null,pinResolveSequence=0;
async function resolveStudioPincode(rawPin){
 const input=$("#gdrStudioPincode"),pin=String(rawPin||"").replace(/\D/g,"").slice(0,6);
 if(!/^\d{6}$/.test(pin))return false;
 if(input&&String(input.value||"").replace(/\D/g,"").slice(0,6)!==pin)return false;
 if(state.resolvedPincode===pin&&validIndiaPoint(Number(state.lat),Number(state.lng)))return true;
 if(pinResolveTimer){clearTimeout(pinResolveTimer);pinResolveTimer=null;}
 if(pincodeResolveController){try{pincodeResolveController.abort();}catch(e){}}
 pincodeResolveController=new AbortController();
 const signal=pincodeResolveController.signal,run=++pinResolveSequence;
 const isCurrent=()=>run===pinResolveSequence&&(!input||String(input.value||"").replace(/\D/g,"").slice(0,6)===pin);
 const status=$("#gdrStudioLocationStatus");state.pincode=pin;
 if(status)status.textContent="Verifying PIN "+pin+" and locating its matching post office…";
 try{
  const postalResponse=await fetch("https://api.postalpincode.in/pincode/"+encodeURIComponent(pin),{headers:{Accept:"application/json"},signal});
  if(!isCurrent())return false;
  if(!postalResponse.ok)throw new Error("India Post lookup is unavailable");
  const postalPayload=await postalResponse.json();if(!isCurrent())return false;
  const record=Array.isArray(postalPayload)?postalPayload[0]:null;
  const offices=record&&record.Status==="Success"&&Array.isArray(record.PostOffice)?record.PostOffice.filter(item=>item&&item.Name):[];
  if(!offices.length)throw new Error("No post office was found for PIN "+pin+". Check the six digits or enter the locality manually.");
  const office=offices[0],officeName=String(office.Name||"").trim(),district=String(office.District||office.Block||"").trim(),region=String(office.State||"").trim();
  const query=[officeName,district,region,"India"].filter(Boolean).join(", ");
  const geoResponse=await fetch("https://photon.komoot.io/api/?limit=12&lang=en&q="+encodeURIComponent(query),{headers:{Accept:"application/json"},signal});
  if(!isCurrent())return false;
  if(!geoResponse.ok)throw new Error("Map location lookup is unavailable");
  const geoPayload=await geoResponse.json();if(!isCurrent())return false;
  const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\bdistrict\b/g," ").replace(/[^a-z0-9]+/g," ").trim();
  const expectedDistrict=normalize(district),expectedState=normalize(region);
  const candidates=(Array.isArray(geoPayload.features)?geoPayload.features:[]).map(feature=>{
   const props=feature&&feature.properties||{},coords=feature&&feature.geometry&&feature.geometry.coordinates||[];
   const stateText=normalize(props.state||props.state_name||"");
   const districtText=normalize([props.county,props.city,props.district,props.locality,props.suburb,props.village,props.town,props.name].filter(Boolean).join(" "));
   const stateMatch=!expectedState||!!stateText&&(stateText===expectedState||stateText.includes(expectedState)||expectedState.includes(stateText));
   const districtMatch=!expectedDistrict||districtText.includes(expectedDistrict);
   return {props,coords,stateMatch,districtMatch,score:(stateMatch?10:0)+(districtMatch?20:0)+(normalize(props.name).includes(normalize(officeName))?4:0)};
  }).filter(item=>String(item.props.countrycode||"").toLowerCase()==="in"&&item.coords.length>=2&&validIndiaPoint(Number(item.coords[1]),Number(item.coords[0]))&&item.stateMatch&&item.districtMatch).sort((a,b)=>b.score-a.score);
  if(!candidates.length)throw new Error("PIN "+pin+" was verified, but no map result matched "+[district,region].filter(Boolean).join(", ")+". The previous location remains cleared; search the locality manually.");
  if(!isCurrent())return false;
  const coords=candidates[0].coords,lat=Number(coords[1]),lng=Number(coords[0]),label=[officeName,district,region,"India"].filter(Boolean).join(", ");
  state.pinCenter={lat,lng};state.resolvedPincode=pin;setLocation(label,lat,lng,pin,false);
  if(window.GDRMapExperience&&typeof window.GDRMapExperience.centerOwnerMapPicker==="function")window.GDRMapExperience.centerOwnerMapPicker(lat,lng,label);
  if(status)status.textContent="✓ PIN "+pin+" verified · "+label+". This is an approximate post-office centre, not the house location. Open the map, zoom in and tap or drag to the exact entrance before submitting.";
  message("PIN verified and the map moved to the matching district. Confirm the exact property entrance on the map before submitting.","success");
  return true;
 }catch(error){
  if(error&&error.name==="AbortError")return false;
  if(!isCurrent())return false;
  console.warn("Property Studio PIN resolution:",error);
  state.lat=null;state.lng=null;state.locationConfirmed=false;state.pinCenter=null;state.resolvedPincode="";
  const ownerLocation=$("#propertyLocation");if(ownerLocation){ownerLocation.value="";["gdSelectedLat","gdSelectedLng","gdSelectedDisplayName"].forEach(key=>delete ownerLocation.dataset[key]);}
  if(window.GDRMapExperience&&typeof window.GDRMapExperience.clearOwnerMapSelectionForPinChange==="function")window.GDRMapExperience.clearOwnerMapSelectionForPinChange();
  updateLocationStatus();
  if(status)status.textContent=error.message||"Could not locate this PIN. The old map pin was cleared; enter the locality manually or use GPS.";
  return false;
 }
}
function escapeHtml(value){
 return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function distanceMeters(a,b,c,d){
 const rad=x=>x*Math.PI/180,R=6371000;
 const dLat=rad(c-a),dLng=rad(d-b);
 const q=Math.sin(dLat/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLng/2)**2;
 return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
function distanceLabel(m){
 const n=Number(m||0);return n<1000?Math.round(n)+" m":(n/1000).toFixed(1)+" km";
}
function formatINR(v){
 const n=Number(v||0);return "₹"+n.toLocaleString("en-IN",{maximumFractionDigits:0});
}
function showSuggestions(items){
 const box=$("#gdrStudioLocationSuggestions");if(!box)return;
 box.innerHTML="";
 if(!items.length){box.hidden=true;return;}
 items.forEach(item=>{
  const p=item.properties||{},coords=item.geometry&&item.geometry.coordinates||[];
  const label=[p.name,p.street,p.locality,p.district,p.city,p.state,p.postcode,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(", ");
  if(!label||coords.length<2)return;
  const b=document.createElement("button");b.type="button";b.className="gdr-studio-suggestion";
  const strong=document.createElement("strong");strong.textContent=label;
  const small=document.createElement("small");small.textContent="Use this address and save its map coordinates";
  b.append(strong,small);
  b.addEventListener("click",()=>{
   setLocation(label,Number(coords[1]),Number(coords[0]),p.postcode||"");
   box.hidden=true;
   const status=$("#gdrStudioLocationStatus");if(status)status.textContent="✓ Address selected. Exact coordinates saved.";
  });
  box.appendChild(b);
 });
 box.hidden=!box.childElementCount;
}
async function searchAddress(query){
 if(searchController)searchController.abort();
 searchController=new AbortController();
 const box=$("#gdrStudioLocationSuggestions"),status=$("#gdrStudioLocationStatus");
 if(box){box.innerHTML="";box.hidden=false;}
 if(status)status.textContent="Searching Indian addresses…";
 try{
  const url="https://photon.komoot.io/api/?limit=8&lang=en&q="+encodeURIComponent(query);
  const res=await fetch(url,{headers:{Accept:"application/json"},signal:searchController.signal});
  if(!res.ok)throw new Error("Location search is temporarily unavailable.");
  const data=await res.json();
  const features=(Array.isArray(data.features)?data.features:[]).filter(f=>f&&f.geometry&&Array.isArray(f.geometry.coordinates)&&Number.isFinite(Number(f.geometry.coordinates[0]))&&Number.isFinite(Number(f.geometry.coordinates[1])));
  const india=features.filter(f=>String(f.properties&&f.properties.countrycode||"").toLowerCase()==="in");
   showSuggestions(india);
   if(status)status.textContent=india.length?"Choose the correct Indian locality from the suggestions.":"No matching Indian address found. Try adding the city or PIN code.";
 }catch(e){
  if(e.name==="AbortError")return;
  if(status)status.textContent="Address suggestions are unavailable. You can still use GPS or the map pin.";
  if(box)box.hidden=true;
 }
}
async function reverseGeocode(lat,lng){
 const url="https://photon.komoot.io/reverse?lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lng)+"&lang=en";
 const res=await fetch(url,{headers:{Accept:"application/json"}});
 if(!res.ok)throw new Error("Address lookup unavailable");
 const data=await res.json(),p=data&&data.features&&data.features[0]&&data.features[0].properties||{};
 return {
  address:[p.name,p.street,p.locality,p.district,p.city,p.state,p.postcode,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(", "),
  pincode:p.postcode||""
 };
}
async function useGps(){
 if(!navigator.geolocation){message("GPS is not supported in this browser. Search for the address or use the map pin.","error");return;}
 message("Finding the property location…","info");
 navigator.geolocation.getCurrentPosition(async pos=>{
  const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude);
  try{
   const found=await reverseGeocode(lat,lng);
   if(!found.address)throw new Error("Address could not be identified");
   setLocation(found.address,lat,lng,found.pincode);
   message("Your current location has been added. Please confirm it is the property address.","success");
  }catch(e){
   setLocation(state.address,lat,lng,state.pincode);
   message("GPS coordinates found, but the address could not be identified. Enter the locality in the address field.","error");
  }
 },err=>{
  const reason=err.code===1?"Location permission was denied. You can search or place the pin manually.":"Could not detect GPS location. Please try again or search the address.";
  message(reason,"error");
 },{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
}
function moveMapToStudio(){
 const panel=$("#gdrOwnerMapPicker"),host=$("#gdrStudioMapHost");
 if(!panel||!host)return false;
 if(!state.mapParent){state.mapParent=panel.parentNode;state.mapNext=panel.nextSibling;}
 const oldInput=$("#propertyLocation");if(oldInput)oldInput.value=state.address;
 host.appendChild(panel);panel.hidden=false;
 return true;
}
function restoreMapPanel(){
 const panel=$("#gdrOwnerMapPicker");
 if(!panel||!state.mapParent)return;
 panel.hidden=true;
 try{state.mapParent.insertBefore(panel,state.mapNext&&state.mapNext.parentNode===state.mapParent?state.mapNext:null);}catch(e){}
}
async function openMap(){
 const host=$("#gdrStudioMapHost");
 if(!host)return;
 if(!moveMapToStudio()){
  message("The map picker is unavailable. Please use address search or GPS.","error");
  return;
 }
 if(!window.GDRMapExperience||typeof window.GDRMapExperience.openOwnerMapPicker!=="function"){
  message("The free OpenStreetMap picker is still loading. Please try again.","error");
  restoreMapPanel();
  return;
 }
 try{
  await window.GDRMapExperience.openOwnerMapPicker();
  message("Tap the property entrance or drag the pin, then confirm its location.","info");
 }catch(e){
  message(e.message||"Could not open the map picker.","error");
  restoreMapPanel();
 }
}
function wrapMapCallback(){
 const original=window.__gdrSetPropertyLocation;
 if(typeof original!=="function"||original.__gdrStudioWrapped)return;
 const wrapped=function(address,lat,lng){
  const inStudio=!!(studio()&&!studio().hidden);
  if(inStudio&&!validIndiaPoint(Number(lat),Number(lng))){message("Choose a property location within India.","error");return false;}
  const outsidePinArea=!!(inStudio&&state.pinCenter&&distanceMeters(state.pinCenter.lat,state.pinCenter.lng,Number(lat),Number(lng))>35000);
  const ok=original(address,lat,lng);
  if(ok&&inStudio){
   setLocation(address,Number(lat),Number(lng),state.pincode,true);
   message(outsidePinArea?"Map pin confirmed, but it is more than 35 km from the PIN-code area. Double-check the address and PIN before publishing.":"Exact property pin confirmed. Nearby place discovery is refreshing.","info");
   setTimeout(restoreMapPanel,120);
  }
  return ok;
 };
 wrapped.__gdrStudioWrapped=true;
 window.__gdrSetPropertyLocation=wrapped;
}
const osmCategory=tags=>{
 if(tags.railway==="station")return "Railway station";
 if(tags.amenity==="bus_station")return "Bus station";
 if(tags.public_transport==="station")return "Transit station";
 if(tags.highway==="bus_stop"||tags.public_transport==="platform")return "Bus stop";
 if(tags.amenity==="hospital"||tags.healthcare==="hospital")return "Hospital";
 if(tags.amenity==="school")return "School";
 if(tags.amenity==="college")return "College";
 if(tags.amenity==="university")return "University";
 if(tags.amenity==="marketplace")return "Market";
 if(tags.shop==="supermarket"||tags.shop==="mall")return "Market / shopping";
 if(tags.leisure==="park")return "Park";
 if(tags.leisure==="stadium")return "Stadium";
 return "Public place";
};
function renderNearby(){
 const box=$("#gdrStudioNearbyList"),status=$("#gdrStudioNearbyStatus");
 if(!box||!status)return;
 box.innerHTML="";
 if(state.lat===null||state.lng===null){
  status.textContent="Confirm the property location to discover nearby public places.";
  return;
 }
 if(!state.nearbyPlaces.length){
  status.textContent="Checking OpenStreetMap for named public facilities within 5 km…";
  return;
 }
 state.nearbyPlaces.forEach(place=>{
  const row=document.createElement("div");row.className="gdr-studio-nearby-row";
  const left=document.createElement("span"),name=document.createElement("strong"),category=document.createElement("small");
  name.textContent=place.name;category.textContent=place.category;
  left.append(name,category);
  const dist=document.createElement("b");dist.textContent=distanceLabel(place.distance_m);
  row.append(left,dist);box.appendChild(row);
 });
 status.textContent=state.nearbyPlaces.length+" named nearby places found · © OpenStreetMap contributors.";
}
async function loadNearbyPlaces(){
 const run=++nearbyRun;
 if(nearbyController){nearbyController.abort();nearbyController=null;}
 state.nearbyPlaces=[];
 const status=$("#gdrStudioNearbyStatus");
 if(status)status.textContent="Searching OpenStreetMap for nearby public facilities…";
 renderNearby();saveDraft();
 if(state.lat===null||state.lng===null)return;
 const lat=Number(state.lat),lng=Number(state.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
 const radius=5000;
 // Cache nearby results for 24 hours per rounded location to avoid repeat public API calls.
 const cacheKey="gdr_osm_nearby_v1:"+lat.toFixed(4)+":"+lng.toFixed(4);
 try{
  const cached=JSON.parse(localStorage.getItem(cacheKey)||"null");
  if(cached&&Number.isFinite(cached.savedAt)&&Date.now()-cached.savedAt<86400000&&Array.isArray(cached.places)){
   state.nearbyPlaces=cached.places.filter(p=>Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude))).map(p=>({...p,distance_m:Math.round(distanceMeters(lat,lng,Number(p.latitude),Number(p.longitude)))})).sort((a,b)=>a.distance_m-b.distance_m).slice(0,30);
   renderNearby();saveDraft();
   if(!state.nearbyPlaces.length&&status)status.textContent="No named public facilities were found within 5 km. Source: © OpenStreetMap contributors.";
   return;
  }
 }catch(e){console.warn("OpenStreetMap nearby cache could not be read",e);}
 const query=`[out:json][timeout:20];
(
 nwr(around:${radius},${lat},${lng})[railway=station];
 nwr(around:${radius},${lat},${lng})[public_transport=station];
 nwr(around:${radius},${lat},${lng})[amenity=bus_station];
 nwr(around:${radius},${lat},${lng})[highway=bus_stop];
 nwr(around:${radius},${lat},${lng})[amenity=hospital];
 nwr(around:${radius},${lat},${lng})[healthcare=hospital];
 nwr(around:${radius},${lat},${lng})[amenity=school];
 nwr(around:${radius},${lat},${lng})[amenity=college];
 nwr(around:${radius},${lat},${lng})[amenity=university];
 nwr(around:${radius},${lat},${lng})[amenity=marketplace];
 nwr(around:${radius},${lat},${lng})[shop=supermarket];
 nwr(around:${radius},${lat},${lng})[shop=mall];
 nwr(around:${radius},${lat},${lng})[leisure=park];
 nwr(around:${radius},${lat},${lng})[leisure=stadium];
);
out center tags;`;
 const controller=new AbortController();nearbyController=controller;
 const timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch("https://overpass-api.de/api/interpreter",{
   method:"POST",
   headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","Accept":"application/json"},
   body:"data="+encodeURIComponent(query),
   signal:controller.signal
  });
  if(!response.ok)throw new Error("OpenStreetMap nearby service returned HTTP "+response.status);
  const data=await response.json();
  if(run!==nearbyRun)return;
  const unique=new Map();
  (Array.isArray(data.elements)?data.elements:[]).forEach(element=>{
   const tags=element.tags||{};
   const name=String(tags.name||tags["name:en"]||"").trim();
   const point=element.type==="node"?element:{center:element.center};
   const placeLat=Number(point.lat??point.center?.lat);
   const placeLng=Number(point.lon??point.center?.lon);
   if(!name||!Number.isFinite(placeLat)||!Number.isFinite(placeLng))return;
   const distance=Math.round(distanceMeters(lat,lng,placeLat,placeLng));
   if(distance>radius)return;
   const key=element.type+":"+element.id;
   unique.set(key,{name,category:osmCategory(tags),distance_m:distance,latitude:placeLat,longitude:placeLng,osm_type:element.type,osm_id:element.id});
  });
  state.nearbyPlaces=Array.from(unique.values()).sort((a,b)=>a.distance_m-b.distance_m).slice(0,30);
  try{localStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),places:state.nearbyPlaces}));}catch(e){}
  renderNearby();saveDraft();
  if(!state.nearbyPlaces.length&&status)status.textContent="No named public facilities were found within 5 km. Source: © OpenStreetMap contributors.";
 }catch(e){
  if(run!==nearbyRun)return;
  console.warn("OpenStreetMap nearby discovery unavailable",e);
  if(status)status.textContent="Nearby facilities are temporarily unavailable from OpenStreetMap. Your confirmed location is saved; you can continue without this optional information.";
 }
 finally{
  clearTimeout(timeout);
  if(run===nearbyRun)nearbyController=null;
 }
}
function revokePreviews(){
 state.files.forEach(f=>{if(f.previewUrl)URL.revokeObjectURL(f.previewUrl);});
}
function renderPhotos(){
 const wrap=$("#gdrStudioPhotoPreview");if(!wrap)return;
 wrap.innerHTML="";
 const items=state.files.map((file,index)=>({kind:"file",url:file.previewUrl,name:file.name,index,globalIndex:index,cover:index===state.coverIndex,category:file.gdrCategory||"interior"}))
  .concat(state.uploadedPhotos.map((photo,index)=>({kind:"uploaded",url:photo.url,name:"Property photo "+(index+1),index,globalIndex:state.files.length+index,cover:state.files.length+index===state.coverIndex,category:photo.category==="exterior"?"exterior":"interior"})));
 if(!items.length){wrap.hidden=true;return;}
 wrap.hidden=false;
 ["exterior","interior"].forEach(category=>{
  const group=document.createElement("section");group.className="gdr-studio-photo-group gdr-studio-photo-group-"+category;
  const heading=document.createElement("h3");heading.textContent=(category==="exterior"?"Exterior photos":"Interior photos")+" · "+items.filter(item=>item.category===category).length;
  group.appendChild(heading);
  const grid=document.createElement("div");grid.className="gdr-studio-photo-grid";
  items.filter(item=>item.category===category).forEach(item=>{
   const card=document.createElement("article");card.className="gdr-studio-photo-card";
   const img=document.createElement("img");img.src=item.url;img.alt=(category==="exterior"?"Exterior":"Interior")+" property photo";
   const meta=document.createElement("div"),name=document.createElement("span");name.textContent=item.name;
   const label=document.createElement("small");label.textContent=category==="exterior"?"Exterior":"Interior";
   const btn=document.createElement("button");btn.type="button";btn.textContent=item.cover?"✓ Cover photo":"Set as cover";btn.disabled=item.cover;
   btn.addEventListener("click",()=>{state.coverIndex=item.globalIndex;saveDraft();renderPhotos();});
   const remove=document.createElement("button");remove.type="button";remove.textContent="Remove photo";remove.className="gdr-studio-photo-remove";
   remove.addEventListener("click",async()=>{
    if(item.kind==="file"){
     const removed=state.files.splice(item.index,1)[0];if(removed?.previewUrl){try{URL.revokeObjectURL(removed.previewUrl);}catch(e){}}
    }else{
     const removed=state.uploadedPhotos.splice(item.index,1)[0],path=state.uploadedPaths.splice(item.index,1)[0];
     if(path){try{await client().storage.from("property-images").remove([path]);}catch(e){console.warn("Could not remove property photo",e);}}
    }
    if(item.globalIndex<state.coverIndex)state.coverIndex--;
    else if(item.globalIndex===state.coverIndex)state.coverIndex=Math.max(0,Math.min(state.coverIndex,items.length-2));
    saveDraft();renderPhotos();
   });
   meta.append(name,label,btn,remove);card.append(img,meta);grid.appendChild(card);
  });
  group.appendChild(grid);wrap.appendChild(group);
 });
}
async function removeUploadedFiles(){
 const c=client();if(!c||!state.uploadedPaths.length)return;
 try{await c.storage.from("property-images").remove(state.uploadedPaths);}catch(e){console.warn("Could not clean up replaced studio photos",e);}
 state.uploadedPaths=[];state.uploadedPhotos=[];
}
async function acceptFiles(list,category){
 const incoming=Array.from(list||[]),photoCategory=category==="exterior"?"exterior":"interior";
 if(!incoming.length)return;
 const current=state.files.length+state.uploadedPhotos.length;
 if(current+incoming.length>8){message("Choose up to 8 photos in total across both categories.","error");return;}
 for(const f of incoming){
  if(!allowedTypes.includes(f.type)){message("Use JPG, PNG or WEBP photos only.","error");return;}
  if(f.size>5*1024*1024){message("Each photo must be 5 MB or smaller.","error");return;}
 }
 if(current===0)state.coverIndex=0;
 incoming.forEach(f=>{f.previewUrl=URL.createObjectURL(f);f.gdrCategory=photoCategory;state.files.push(f);});
 renderPhotos();saveDraft();message("Photos added to "+photoCategory+" gallery. Either category can stay empty.","success");
}
function uploadPhotos(){
 const c=client();
 const existing=state.uploadedPhotos.slice();
 const fileEntries=state.files.map((file,index)=>({kind:"file",file,fileIndex:index}));
 const ordered=[...fileEntries,...existing.map((photo,index)=>({kind:"uploaded",photo,photoIndex:index}))];
 if(!ordered.length)return Promise.resolve([]);
 if(state.coverIndex>0&&state.coverIndex<ordered.length)ordered.unshift(ordered.splice(state.coverIndex,1)[0]);
 return (async()=>{
  const filesToUpload=ordered.filter(item=>item.kind==="file");
  const uploadedFiles=new Array(filesToUpload.length),newPaths=[];
  let cursor=0,uploadError=null;
  const worker=async()=>{
   while(!uploadError){
    const index=cursor++;if(index>=filesToUpload.length)return;
    const item=filesToUpload[index],file=item.file,category=file.gdrCategory==="exterior"?"exterior":"interior";
    const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";
    const path=state.user.id+"/"+category+"/"+uuid()+"."+ext;
    try{
     const result=await c.storage.from("property-images").upload(path,file,{cacheControl:"3600",contentType:file.type,upsert:false});
     if(result.error)throw result.error;
     newPaths.push(result.data.path);
     const publicResult=c.storage.from("property-images").getPublicUrl(result.data.path),baseUrl=publicResult&&publicResult.data&&publicResult.data.publicUrl;
     if(!baseUrl)throw new Error("Could not create the uploaded photo URL.");
     uploadedFiles[index]={url:baseUrl+(baseUrl.includes("?")?"&":"?")+"gdr_category="+category,path:result.data.path,category};
    }catch(error){uploadError=error;}
   }
  };
  await Promise.all(Array.from({length:Math.min(3,filesToUpload.length)},()=>worker()));
  if(uploadError){
   if(newPaths.length){try{await c.storage.from("property-images").remove(newPaths);}catch(e){console.warn("Could not clean up partial photo uploads",e);}}
   state.uploadedPhotos=existing;state.uploadedPaths=existing.map(photo=>photo.path);
   saveDraft();throw uploadError;
  }
  const newPhotoByFileIndex=new Map(filesToUpload.map((item,index)=>[item.fileIndex,uploadedFiles[index]]));
  const finalPhotos=ordered.map(item=>item.kind==="uploaded"?item.photo:newPhotoByFileIndex.get(item.fileIndex)).filter(Boolean);
  state.files.forEach(file=>{if(file.previewUrl){try{URL.revokeObjectURL(file.previewUrl);}catch(e){}}});
  state.uploadedPhotos=finalPhotos;state.uploadedPaths=finalPhotos.map(photo=>photo.path);
  state.files=[];state.coverIndex=0;state.draftPhotosNeedReselect=false;renderPhotos();saveDraft();return finalPhotos;
 })();
}
function titleForListing(){
 const type=typeLabels[state.propertyType]||"Rental property";
 const config=state.configuration&&state.configuration!=="Other"?state.configuration+" ":"";
 const place=state.address.split(",").map(v=>v.trim()).filter(Boolean)[0]||"your area";
 return (config+type+" in "+place).slice(0,120);
}
function validateStep(step){
 if(step===0){
  if(!state.propertyType){message("Please choose your property type.","error");return false;}
  if(["apartment","independent_house","villa"].includes(state.propertyType)&&!state.configuration){message("Please select the BHK configuration.","error");return false;}
  if(state.propertyType==="pg"||state.propertyType==="hostel"){
   const room=$("#gdrStudioRoomType"),gender=$("#gdrStudioGender"),total=$("#gdrStudioTotalBeds"),available=$("#gdrStudioAvailableBeds");
   state.roomType=room&&room.value||"";state.gender=gender&&gender.value||"";
   state.totalBeds=total&&total.value||"";state.availableBeds=available&&available.value||"";
   state.foodIncluded=$("#gdrStudioFoodIncluded")?.value||"";
   if(!state.roomType||!state.gender||!state.totalBeds||!state.availableBeds||Number(state.availableBeds)>Number(state.totalBeds)){
    message("Please complete the room type, preference and bed details.","error");return false;
   }
  }
 }
 if(step===1){
  state.rent=$("#gdrStudioRent")?.value||state.rent;
  state.deposit=$("#gdrStudioDeposit")?.value||state.deposit;
 state.furnishing=$("#gdrStudioFurnishing")?.value||state.furnishing;
  if(!Number.isFinite(Number(state.rent))||Number(state.rent)<1||Number(state.rent)>10000000){message("Enter a valid monthly rent.","error");return false;}
  if(state.deposit!==""&&(!Number.isFinite(Number(state.deposit))||Number(state.deposit)<0||Number(state.deposit)>10000000)){message("Enter a valid security deposit or leave it blank.","error");return false;}
 }
 if(step===2){
  state.address=$("#gdrStudioLocation")?.value.trim()||state.address;
  state.pincode=$("#gdrStudioPincode")?.value.trim()||state.pincode;
  if(!state.address){message("Please search for the property address or enter its locality and city.","error");return false;}
  if(state.pincode&&!/^\d{6}$/.test(state.pincode)){message("PIN code must contain 6 digits.","error");return false;}
  if(!validIndiaPoint(Number(state.lat),Number(state.lng))){message("Locate the property in India, then open Select on Map and place the exact property pin before submitting.","error");return false;}
  if(!state.locationConfirmed){message("The PIN or address only identifies an approximate area. Open Select on Map, tap or drag the marker to the exact house entrance, and confirm the location before submitting.","error");return false;}
 }
 return true;
}
function renderPreview(){
 const title=titleForListing();
 const rent=$("#gdrStudioRent")?.value||state.rent;
 const deposit=$("#gdrStudioDeposit")?.value||state.deposit;
 const address=$("#gdrStudioLocation")?.value||state.address;
 const photos=state.files.map(f=>({url:f.previewUrl,category:f.gdrCategory||"interior"})).concat(state.uploadedPhotos.map(p=>({url:p.url,category:p.category||"interior"})));
 const cover=photos[state.coverIndex]?.url||photos[0]?.url||"/assets/gdr-property-placeholder.svg";
 const box=$("#gdrStudioPreview");if(!box)return;
 const config=state.propertyType==="other"?"Other":state.configuration;
 const details=[
  ["Property",typeLabels[state.propertyType]||"—"],
  ["Configuration",config||"—"],
  ["Monthly rent",formatINR(rent)],
  ["Security deposit",deposit?formatINR(deposit):"Not specified"],
  ["Furnishing",state.furnishing||"Not specified"],
  ["Location",address||"—"],
  ["Availability","Pending verification after submission"]
 ];
  const nearbyHtml=state.nearbyPlaces.length
   ?'<div class="gdr-studio-preview-nearby-list">'+state.nearbyPlaces.slice(0,8).map(place=>'<div><span><b>'+escapeHtml(place.name||"Nearby place")+'</b><small>'+escapeHtml(place.category||"Public place")+'</small></span><strong>'+escapeHtml(distanceLabel(place.distance_m))+'</strong></div>').join("")+'</div>'
   :'<p>Nearby facilities are sourced from OpenStreetMap when available.</p>';
  box.innerHTML=
   '<div class="gdr-studio-preview-card"><img src="'+escapeHtml(cover)+'" alt="Property cover photo"><div class="gdr-studio-preview-copy"><span class="gdr-studio-preview-kicker">RENTER VIEW PREVIEW</span><h3>'+escapeHtml(title)+'</h3><strong class="gdr-studio-preview-rent">'+escapeHtml(formatINR(rent))+' <small>/ month</small></strong><div class="gdr-studio-preview-meta">'+details.map(d=>'<div><small>'+escapeHtml(d[0])+'</small><b>'+escapeHtml(d[1])+'</b></div>').join("")+'</div><p>'+escapeHtml(state.description||"No additional description.")+'</p></div></div>'+
   (photos.length?'<div class="gdr-studio-preview-gallery">'+["exterior","interior"].map(category=>{const selected=photos.filter(photo=>photo.category===category);return selected.length?'<section><h4>'+(category==="exterior"?"Exterior photos":"Interior photos")+'</h4><div class="gdr-studio-preview-strip">'+selected.map(photo=>'<img src="'+escapeHtml(photo.url)+'" alt="'+(category==="exterior"?"Exterior":"Interior")+' property photo">').join("")+'</div></section>':"";}).join("")+'</div>':"")+
   '<div class="gdr-studio-preview-nearby"><strong>Nearby places</strong>'+nearbyHtml+'</div>';
}
function updateStep(){
 const root=studio();if(!root)return;
 renderLiveVoiceForm();
 $$("[data-gdr-studio-panel]",root).forEach(p=>{p.hidden=Number(p.dataset.gdrStudioPanel)!==state.step;});
 $$("[data-gdr-studio-step-indicator]",root).forEach(el=>{
  const n=Number(el.dataset.gdrStudioStepIndicator);
  el.classList.toggle("is-current",n===state.step);el.classList.toggle("is-complete",n<state.step);
 });
 const back=$("#gdrStudioBack"),formNext=$("#gdrStudioFormNext"),assistantNext=$("#gdrStudioNext"),publish=$("#gdrStudioPublish"),navStep=$("#gdrStudioNavStep");
 if(back)back.hidden=state.step===0;
 if(formNext)formNext.hidden=state.step===4;
 if(assistantNext)assistantNext.hidden=state.step===4;
 if(publish)publish.hidden=state.step!==4;
 if(navStep)navStep.textContent=String(state.step+1);
 if(state.step===4)renderPreview();
 const title=$("#gdrStudioStepTitle");
 if(title)title.textContent=["Property type","Rent details","Property location","Property photos","Review your listing"][state.step];
 const progress=$("#gdrStudioProgressFill");if(progress)progress.style.width=((state.step+1)/5*100)+"%";
}
function goToStep(n){
 if(n>state.step&&!validateStep(state.step))return;
 state.step=Math.min(4,Math.max(0,n));updateStep();saveDraft();
 const main=$("#gdrStudioMain");if(main)main.scrollIntoView({behavior:"smooth",block:"start"});
 message("");
}
async function getOwner(){
 const c=client();if(!c)throw new Error("Account service is not ready. Refresh the page and sign in again.");
 const auth=await c.auth.getUser();
 if(auth.error||!auth.data||!auth.data.user)throw new Error("Please sign in to your Owner account.");
 const user=auth.data.user;
 const profile=await c.from("owners").select("id,name").eq("user_id",user.id).maybeSingle();
 if(profile.error||!profile.data)throw new Error("This account does not have an Owner profile. Please sign in using your Owner account.");
 return {user:user,owner:profile.data};
}
async function open(voice){
 if(state.publishing)return;
 try{
  await readyPromise;
  const dash=$("#ownerDashboard");
  // The dashboard can be visibly open while legacy role CSS classes are still
  // settling. Visibility is the page-level gate; getOwner() below remains the
  // authoritative authenticated Owner-profile check.
  const dashboardVisible=!!dash&&!dash.hidden&&dash.getAttribute("aria-hidden")!=="true"&&window.getComputedStyle(dash).display!=="none";
  if(!dashboardVisible){
   throw new Error("Open the Owner Dashboard to start a property listing.");
  }
  const account=await getOwner();state.user=account.user;state.owner=account.owner;
  // Clear in-memory fields, then restore only this owner's saved draft.
  resetNewListing();
  const recovered=restoreDraft();
  const root=studio();if(!root)throw new Error("Property Studio could not be loaded. Refresh and try again.");
  root.hidden=false;document.body.classList.add("gdr-property-studio-open");
  const dashSection=$("#dashboardSection");if(dashSection){dashSection.style.display="none";dashSection.setAttribute("aria-hidden","true");}
  updateStep();if(!recovered)dismissDraftRecovery();root.scrollTop=0;root.scrollTo({top:0,behavior:"instant"});window.scrollTo({top:0,behavior:"instant"});
  wrapMapCallback();
  if(voice)startVoice();
 }catch(e){message(e.message||"Could not open Property Studio.","error");const m=$("#backendMessage");if(m){m.textContent=e.message||"Could not open Property Studio.";m.className="backend-message error";}}
}
async function returnToOwnerDashboard(scrollToProperties){
 stopVoice();restoreMapPanel();
 const root=studio(),success=$("#gdrStudioSuccessView");
 if(success)success.remove();
 const main=$("#gdrStudioMain");if(main){main.hidden=false;main.style.removeProperty("display");}
 const progress=$(".gdr-studio-progress-wrap",root);if(progress){progress.hidden=false;progress.style.removeProperty("display");}
 if(root)root.hidden=true;
 document.body.classList.remove("gdr-property-studio-open");
 const dashboard=$("#dashboardSection");
 if(dashboard){dashboard.style.display="block";dashboard.setAttribute("aria-hidden","false");}
 // Remove a stale #login hash without navigating or touching the Supabase session.
 if(String(window.location.hash||"").toLowerCase()==="#login"){
  try{window.history.replaceState(window.history.state,document.title,window.location.pathname+window.location.search);}catch(e){}
 }
 try{
  if(typeof window.renderActiveDashboard==="function")await window.renderActiveDashboard();
  else{const owner=$("#ownerDashboard");if(owner){owner.classList.add("active");owner.style.display="block";}}
 }catch(e){console.error("Owner dashboard refresh after listing failed",e);}
 state.published=false;state.publishing=false;resetNewListing();
 if(scrollToProperties)window.setTimeout(()=>$("#ownerPropertiesContainer")?.scrollIntoView({behavior:"smooth",block:"start"}),180);
 else window.scrollTo({top:0,behavior:"instant"});
}
function close(){
 if(state.publishing)return;
 if(state.published){returnToOwnerDashboard(false);return;}
 stopVoice();restoreMapPanel();
 const root=studio();if(root)root.hidden=true;
 document.body.classList.remove("gdr-property-studio-open");
 const dash=$("#dashboardSection");if(dash){dash.style.display="block";dash.setAttribute("aria-hidden","false");}
 if(String(window.location.hash||"").toLowerCase()==="#login"){
  try{window.history.replaceState(window.history.state,document.title,window.location.pathname+window.location.search);}catch(e){}
 }
 window.scrollTo({top:0,behavior:"instant"});saveDraft();
}
function selectedType(type){
 state.propertyType=type;if(state.voice.pending&&Object.prototype.hasOwnProperty.call(state.voice.pending,"propertyType"))state.voice.pending.propertyType=type;
 if(type==="other")state.configuration="Other";
 else if(type==="room")state.configuration="";
 else if(type==="pg"||type==="hostel")state.configuration="";
 else if(state.configuration==="Other")state.configuration="";
 updateTypeCards();updateConfigurationCards();updateConditionalFields();saveDraft();renderLiveVoiceForm();
}
function setConfiguration(value){state.configuration=value;if(state.voice.pending&&Object.prototype.hasOwnProperty.call(state.voice.pending,"configuration"))state.voice.pending.configuration=value;updateConfigurationCards();saveDraft();renderLiveVoiceForm();}
function setCover(i){state.coverIndex=i;renderPhotos();saveDraft();}
// Please review and correct every field before continuing; publishing remains a manual owner action.
function detectVoiceLanguage(text){
 const value=String(text||"");
 if(/[ऀ-ॿ]/.test(value))return "hi";
 const lower=value.toLowerCase();
 if(/\b(mera|meri|mujhe|chahiye|hai|mein|me|ka|ki|ke|kiraya|ghar|makaan|bhk|rent|flat|furnished|semi furnished)\b/.test(lower))return "hi";
 return "en";
}
function voiceText(hi,en){return state.voice.language==="en"?en:hi;}
function setVoiceState(label,recording){
 const stateEl=$("#gdrStudioVoiceState"),start=$("#gdrStudioVoiceStart");
 if(stateEl){stateEl.textContent=label;stateEl.dataset.status=label;}
 if(start){start.classList.toggle("is-recording",!!recording);start.textContent=recording?"● Listening…":"Start speaking";}
}
function setVoiceReply(text){
 const reply=$("#gdrStudioVoiceReply");if(reply)reply.textContent=text;
 state.voice.lastReply=text;
}
function speakVoice(text,after){
 state.voice.lastReply=text;
 const reply=$("#gdrStudioVoiceReply");if(reply)reply.textContent=text;
 if(state.voice.muted||!window.speechSynthesis||!window.SpeechSynthesisUtterance){state.voice.speaking=false;if(typeof after==="function")after();return;}
 try{
  window.speechSynthesis.cancel();state.voice.speaking=true;
  if(state.recognition){const oldRecognition=state.recognition;state.recognition=null;state.recording=false;state.voice.session++;try{oldRecognition.abort?oldRecognition.abort():oldRecognition.stop();}catch(e){}}
  const utterance=new SpeechSynthesisUtterance(text),language=state.voice.language==="en"?"en-IN":"hi-IN";
  utterance.lang=language;utterance.rate=.96;utterance.pitch=1;
  const voices=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
  const voice=voices.find(v=>String(v.lang||"").toLowerCase()===language.toLowerCase())||voices.find(v=>String(v.lang||"").toLowerCase().startsWith(state.voice.language==="en"?"en":"hi"));
  if(voice)utterance.voice=voice;
  utterance.onend=()=>{state.voice.speaking=false;if(typeof after==="function")after();};
  utterance.onerror=()=>{state.voice.speaking=false;if(typeof after==="function")after();};
  window.speechSynthesis.speak(utterance);
 }catch(error){state.voice.speaking=false;if(typeof after==="function")after();}
}
function amountFromText(text){
 const s=String(text||"").toLowerCase().replace(/,/g," ");
 let m=s.match(/\b(\d+(?:\.\d+)?)\s*(k|thousand|हज़ार|हजार)\b/);
 if(m)return Math.round(Number(m[1])*1000);
 m=s.match(/\b(\d{3,8})\b/);if(m)return Number(m[1]);
 const words={one:1,ek:1,two:2,do:2,three:3,teen:3,four:4,char:4,five:5,paanch:5,ten:10,das:10,fifteen:15,pandrah:15,twenty:20,bees:20,thirty:30,tees:30,fifty:50,pachaas:50};
 const wordMatch=s.match(/\b(one|ek|two|do|three|teen|four|char|five|paanch|ten|das|fifteen|pandrah|twenty|bees|thirty|tees|fifty|pachaas)\s+(?:thousand|hazaar|hazar)\b/);
 if(wordMatch&&words[wordMatch[1]])return words[wordMatch[1]]*1000;
 return null;
}
function extractVoiceDetails(text){
 const raw=String(text||"").trim(),t=raw.toLowerCase(),out={};
 if(/\b(pg|paying guest)\b/.test(t))out.propertyType="pg";
 else if(/\b(hostel)\b/.test(t))out.propertyType="hostel";
 else if(/\b(villa)\b/.test(t))out.propertyType="villa";
 else if(/\b(independent house|standalone house|separate house)\b/.test(t))out.propertyType="independent_house";
 else if(/\b(single\s+)?room\b/.test(t)||/कमरा|कमरे/.test(t))out.propertyType="room";
 else if(/\b(flat|apartment)\b/.test(t)||/फ्लैट|अपार्टमेंट/.test(t))out.propertyType="apartment";
 else if(/\b(other property|other type)\b/.test(t))out.propertyType="other";
 let config=t.match(/\b(5\+\s*bhk|[1-4]\s*bhk|1\s*rk)\b/i);
 if(config)out.configuration=config[1].replace(/\s+/g," ").toUpperCase();
 else{
  const wordConfig=t.match(/\b(ek|do|teen|char|paanch|panch|one|two|three|four|five)\s*(?:bhk|bedroom)\b/);
  const map={ek:"1",one:"1",do:"2",two:"2",teen:"3",three:"3",char:"4",four:"4",paanch:"5",panch:"5",five:"5"};
  if(wordConfig)out.configuration=map[wordConfig[1]]+" BHK";
  else if(/\bone\s*rk\b|\bek\s*rk\b|1\s*room\s*kitchen|एक\s*आरके/.test(t))out.configuration="1 RK";
  else{const hindiConfig=t.match(/(एक|दो|तीन|चार|पाँच|पांच)\s*(?:बीएचके|bhk|bedroom)/);const hindiMap={"एक":"1","दो":"2","तीन":"3","चार":"4","पाँच":"5","पांच":"5"};if(hindiConfig)out.configuration=hindiMap[hindiConfig[1]]+" BHK";}
 }
 if(out.configuration&&!out.propertyType)out.propertyType="apartment";
 const furnish=t.match(/\b(semi[\s-]?furnished|partly furnished|partially furnished|thoda furnished|fully furnished|furnished|unfurnished)\b/);
 if(furnish)out.furnishing=/semi|partly|partially|thoda/.test(furnish[1])?"Semi-Furnished":/unfurnished/.test(furnish[1])?"Unfurnished":"Furnished";
 const depIdx=t.search(/security deposit|deposit/),rentIdx=t.search(/rent|kiraya|किराया|monthly/);
 if(depIdx>=0){const n=amountFromText(raw.slice(depIdx,depIdx+90));if(n!==null)out.deposit=String(n);}
 if(rentIdx>=0){const n=amountFromText(raw.slice(rentIdx,Math.min(raw.length,rentIdx+100)));if(n!==null)out.rent=String(n);}
 else{
  const currency=raw.match(/(?:₹|rs\.?|rupees?|rupee|rupaye)\s*([\d,]+(?:\s*(?:k|thousand))?)/i);
  if(currency){const n=amountFromText(currency[0]);if(n!==null)out.rent=String(n);}
  else{const trailing=raw.match(/([\d,]+(?:\s*(?:k|thousand))?)\s*(?:rupees?|rupee|rupaye|रुपये|रुपए)/i);if(trailing){const n=amountFromText(trailing[1]);if(n!==null)out.rent=String(n);}}
 }
 if(!out.rent&&!out.deposit&&state.voice.lastField==="rent"){const n=amountFromText(raw);if(n!==null)out.rent=String(n);}
 if(!out.rent&&!out.deposit&&state.voice.lastField==="deposit"){const n=amountFromText(raw);if(n!==null)out.deposit=String(n);}
 const pin=raw.match(/\b([1-9][0-9]{5})\b/);if(pin)out.pincode=pin[1];
 const locationPatterns=[
  /(?:location|address|area)\s*(?:is|:)?\s+(.+?)(?=\s+(?:rent|kiraya|deposit|security|furnished|unfurnished|semi[\s-]?furnished|pin|pincode)\b|[.!?]|$)/i,
  /(?:in|at)\s+([a-z0-9][a-z0-9 ,'-]{2,75}?)(?=\s+(?:rent|kiraya|deposit|security|furnished|unfurnished|semi[\s-]?furnished|monthly|and rent)\b|[.!?]|$)/i,
  /([a-z][a-z0-9 ,'-]{2,65}?)\s+(?:mein|me)\b/i,
  /(?:में|मे)\s*([ऀ-ॿa-zA-Z0-9 ,'-]{3,70}?)(?=\s*(?:है|और|किराया|₹|$))/i
 ];
 for(const pattern of locationPatterns){const m=raw.match(pattern);if(m){const address=m[1].trim().replace(/\s+/g," ").replace(/^(mera|meri|my|property|flat|house|home)\s+/i,"").replace(/\s+(hai|is)$/i,"");if(address.length>=3&&!/^(a property|property|flat|apartment)$/i.test(address))out.address=address;break;}}
 if(!out.address&&state.voice.lastField==="address"){
  const cityPattern=/\b(bhopal|singrauli|indore|jabalpur|gwalior|ujjain|rewa|satna|delhi|mumbai|pune|jaipur|lucknow|hyderabad|chennai|kolkata|bengaluru|bangalore)\b|भोपाल|सिंगरौली|इंदौर|जबलपुर|ग्वालियर|उज्जैन|रीवा|सतना|दिल्ली|मुंबई|पुणे|जयपुर|लखनऊ/i;
  if(cityPattern.test(raw))out.address=raw.replace(/^(?:my|mera|meri|property|flat|apartment|house|home)\s+/i,"").replace(/\b(?:is|in|at|mein|me|hai|location|address)\b/gi," ").replace(/\s+/g," ").trim();
 }
 const room=t.match(/\b(single|double|triple|shared)\s*(?:sharing|room)?\b/);if(room)out.roomType=room[1][0].toUpperCase()+room[1].slice(1);
 const gender=t.match(/\b(male|female|anyone|both)\b/);if(gender)out.gender=gender[1]==="both"||gender[1]==="anyone"?"Any":gender[1][0].toUpperCase()+gender[1].slice(1);
 const total=t.match(/\btotal\s*beds?\s*(?:is|are|of)?\s*(\d{1,3})\b/);if(total)out.totalBeds=total[1];
 const available=t.match(/\bavailable\s*beds?\s*(?:is|are|of)?\s*(\d{1,3})\b/);if(available)out.availableBeds=available[1];
 if(/\b(meals included|food included)\b/.test(t))out.foodIncluded="yes";else if(/\b(no meals|food not included)\b/.test(t))out.foodIncluded="no";
 return out;
}
function voiceFieldLabel(key){return ({propertyType:"Property type",configuration:"Configuration",rent:"Monthly rent",deposit:"Security deposit",furnishing:"Furnishing",address:"Location",pincode:"PIN code",roomType:"Room type",gender:"Guest preference",totalBeds:"Total beds",availableBeds:"Available beds",foodIncluded:"Meals"})[key]||key;}
function voiceFieldValue(key,value){if(key==="propertyType")return typeLabels[value]||value;if(key==="rent"||key==="deposit")return formatINR(value);if(key==="foodIncluded")return value==="yes"?"Meals included":"No meals";return String(value);}

function renderLiveVoiceForm(){
 const box=$("#gdrStudioLiveFields");if(!box)return;
 const fields=[
  ["propertyType","Property type",typeLabels[state.propertyType]||"",0],
  ["configuration","BHK / configuration",state.configuration||"",0],
  ["rent","Monthly rent",state.rent?formatINR(state.rent):"",1],
  ["deposit","Security deposit",state.deposit?formatINR(state.deposit):"",1],
  ["address","Property location",state.address||"",2],
  ["pincode","PIN code",state.pincode||"",2],
  ["furnishing","Furnishing",state.furnishing||"",1],
  ["roomType","Room type",state.roomType||"",0],
  ["gender","Guest preference",state.gender||"",0],
  ["totalBeds","Total beds",state.totalBeds||"",0],
  ["availableBeds","Available beds",state.availableBeds||"",0],
  ["foodIncluded","Meals",state.foodIncluded==="yes"?"Meals included":state.foodIncluded==="no"?"No meals":"",0]
 ];
 const required=["propertyType","address","rent"];
 if(["apartment","independent_house","villa"].includes(state.propertyType))required.push("configuration");
 if(["pg","hostel"].includes(state.propertyType))required.push("roomType","gender","totalBeds","availableBeds");
 const completed=required.filter(key=>!!currentVoiceValue(key)).length;
 const percent=Math.round(completed/required.length*100);
 const count=$("#gdrStudioLiveProgressText");
 if(count)count.textContent=completed+" of "+required.length+" required details added";
 const bar=$("#gdrStudioLiveProgressFill");if(bar)bar.style.width=percent+"%";
 box.innerHTML=fields.map(([key,label,value,step])=>{
  const filled=!!value;
  return '<div class="gdr-studio-live-field'+(filled?' is-filled':'')+'">'+
   '<span class="gdr-studio-live-field-copy"><small>'+escapeHtml(label)+'</small><strong>'+(filled?escapeHtml(value):'Not added yet')+'</strong></span>'+
   '<button type="button" data-gdr-voice-edit="'+key+'" aria-label="Edit '+escapeHtml(label)+'">'+(filled?'✎ Edit':'＋ Add')+'</button>'+
   '</div>';
 }).join("");
}
function editVoiceField(key){
 const steps={propertyType:0,configuration:0,rent:1,deposit:1,furnishing:1,address:2,pincode:2,roomType:0,gender:0,totalBeds:0,availableBeds:0,foodIncluded:0};
 if(!Object.prototype.hasOwnProperty.call(steps,key))return;
 state.step=steps[key];updateStep();
 const ids={rent:"gdrStudioRent",deposit:"gdrStudioDeposit",furnishing:"gdrStudioFurnishing",address:"gdrStudioLocation",pincode:"gdrStudioPincode",roomType:"gdrStudioRoomType",gender:"gdrStudioGender",totalBeds:"gdrStudioTotalBeds",availableBeds:"gdrStudioAvailableBeds",foodIncluded:"gdrStudioFoodIncluded"};
 const target=ids[key]?$("#"+ids[key]):(key==="configuration"?$("#gdrStudioConfigurationOptions"):key==="propertyType"?$("[data-gdr-property-type]"):$("#gdrStudioMain"));
 target?.focus?.({preventScroll:true});target?.scrollIntoView?.({behavior:"smooth",block:"center"});
}

function renderVoicePending(){
 const box=$("#gdrStudioVoicePending"),actions=$("#gdrStudioVoiceConfirmActions");if(!box||!actions)return;
 const entries=Object.entries(state.voice.pending||{});if(!entries.length){box.hidden=true;actions.hidden=true;return;}
 box.hidden=false;actions.hidden=false;box.replaceChildren();
 const heading=document.createElement("strong");heading.textContent=voiceText("मैंने ये जानकारी समझी है:","I understood these details:");box.appendChild(heading);
 entries.forEach(([key,value])=>{const row=document.createElement("div"),label=document.createElement("span"),val=document.createElement("b");label.textContent=voiceFieldLabel(key);val.textContent=voiceFieldValue(key,value);row.append(label,val);box.appendChild(row);});
}
function currentVoiceValue(key){return ({propertyType:state.propertyType,configuration:state.configuration,rent:state.rent,deposit:state.deposit,furnishing:state.furnishing,address:state.address,pincode:state.pincode,roomType:state.roomType,gender:state.gender,totalBeds:state.totalBeds,availableBeds:state.availableBeds,foodIncluded:state.foodIncluded})[key]||"";}
function applyVoiceValues(pending){
 const values=pending||{};
 Object.entries(values).forEach(([key,value])=>{
  if(key==="propertyType")selectedType(value);
  else if(key==="configuration")setConfiguration(value);
  else if(key==="address"){
   state.address=value;state.lat=null;state.lng=null;
   const el=$("#gdrStudioLocation");if(el){el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));}
  }else if(key==="pincode"){
   state.pincode=value;const el=$("#gdrStudioPincode");if(el){el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));}
  }else if(["rent","deposit","furnishing","roomType","gender","totalBeds","availableBeds","foodIncluded"].includes(key)){
   state[key]=value;
   const ids={rent:"gdrStudioRent",deposit:"gdrStudioDeposit",furnishing:"gdrStudioFurnishing",roomType:"gdrStudioRoomType",gender:"gdrStudioGender",totalBeds:"gdrStudioTotalBeds",availableBeds:"gdrStudioAvailableBeds",foodIncluded:"gdrStudioFoodIncluded"};
   const el=$("#"+ids[key]);if(el){el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}
  }
 });
 syncFormFromState();saveDraft();
 const stepFor={propertyType:0,configuration:0,rent:1,deposit:1,furnishing:1,address:2,pincode:2};
 renderLiveVoiceForm();
 const firstKey=Object.keys(values).find(key=>Object.prototype.hasOwnProperty.call(stepFor,key));
 if(firstKey){
  state.step=stepFor[firstKey];updateStep();
  const focusIds={rent:"gdrStudioRent",deposit:"gdrStudioDeposit",furnishing:"gdrStudioFurnishing",address:"gdrStudioLocation",pincode:"gdrStudioPincode"};
  const focus=$("#"+(focusIds[firstKey]||"gdrStudioStepTitle"));
  setTimeout(()=>{focus?.focus?.({preventScroll:true});focus?.scrollIntoView?.({behavior:"smooth",block:"center"});},80);
 }
}
function applyVoicePending(){
 applyVoiceValues(state.voice.pending);
 state.voice.pending={};state.voice.awaitingConfirmation=false;renderVoicePending();
}
function nextVoiceQuestion(){
 const home=["apartment","independent_house","villa","other"].includes(state.propertyType);let field="",question="";
 if(!state.propertyType){field="propertyType";question=voiceText("आप किस तरह की property list करना चाहते हैं—room, flat, independent house, villa, PG या hostel?","What kind of property would you like to list: room, flat, independent house, villa, PG or hostel?");}
 else if(home&&!state.configuration&&state.propertyType!=="other"){field="configuration";question=voiceText("कितना configuration है—1 RK, 1 BHK, 2 BHK या कुछ और?","What is the configuration: 1 RK, 1 BHK, 2 BHK or something else?");}
 else if(!state.address){field="address";question=voiceText("Property किस area और city में है?","Which area and city is the property in?");}
 else if(!state.rent){field="rent";question=voiceText("Monthly rent कितना रखना चाहेंगे?","What monthly rent would you like to set?");}
 else if(!state.deposit&&!state.voice.skippedDeposit){field="deposit";question=voiceText("Security deposit कितना है? अगर अभी तय नहीं है तो skip बोल सकते हैं।","What is the security deposit? Say skip if you have not decided yet.");}
 else if(!state.furnishing){field="furnishing";question=voiceText("Property furnished, semi-furnished या unfurnished है?","Is the property furnished, semi-furnished or unfurnished?");}
 else if(["pg","hostel"].includes(state.propertyType)&&!state.roomType){field="roomType";question=voiceText("Room type क्या है—single, double sharing, triple sharing या shared?","What is the room type: single, double sharing, triple sharing or shared?");}
 else if(["pg","hostel"].includes(state.propertyType)&&!state.gender){field="gender";question=voiceText("यह PG किसके लिए है—male, female या anyone?","Who can stay: male, female or anyone?");}
 else if(["pg","hostel"].includes(state.propertyType)&&!state.totalBeds){field="totalBeds";question=voiceText("कुल कितने beds हैं?","How many beds are there in total?");}
 else if(["pg","hostel"].includes(state.propertyType)&&!state.availableBeds){field="availableBeds";question=voiceText("अभी कितने beds available हैं?","How many beds are currently available?");}
 else if(["pg","hostel"].includes(state.propertyType)&&!state.foodIncluded&&!state.voice.skippedFood){field="foodIncluded";question=voiceText("क्या meals included हैं? हाँ या नहीं बोलें, या skip कर सकते हैं।","Are meals included? Say yes or no, or say skip.");}
 else{field="complete";question=voiceText("बहुत बढ़िया! ज़रूरी details पूरी हो गई हैं। अब photos और बाकी details जोड़कर preview में सब check करें।","Great! The key details are complete. Add photos and the remaining details, then review the preview.");}
 state.voice.lastField=field;state.voice.lastQuestion=question;speakVoice(question);
}
function isVoiceYes(text){return /^(haan|han|ha|yes|yeah|correct|right|bilkul|sahi|correct hai|that's right|ठीक|हाँ|हां|जी|सही|बिल्कुल)(?:[\s,.!?]|$)/i.test(String(text||"").trim());}
function isVoiceNo(text){return /^(nahi|nahin|no|wrong|galat|नहीं|नही|गलत)(?:[\s,.!?]|$)/i.test(String(text||"").trim());}
function processVoiceTurn(text){
 const raw=String(text||"").trim();if(!raw)return;
 state.voice.finalText=(state.voice.finalText?state.voice.finalText+" ":"")+raw;
 state.voice.interimText="";updateVoiceTranscript();if(/[ऀ-ॿ]/.test(raw))state.voice.language="hi";const lower=raw.toLowerCase();
 if(/\b(start again|restart|dobara shuru)\b|फिर से शुरू/.test(lower)){state.voice.finalText="";state.voice.turnText="";state.voice.interimText="";state.voice.pending={};state.voice.awaitingConfirmation=false;updateVoiceTranscript();renderVoicePending();speakVoice(voiceText("ठीक है, नई शुरुआत करते हैं। अपनी property के बारे में बताइए।","Let's start again. Tell me about your property."));return;}
 if(/\b(go back|back one step|peeche jao)\b|पीछे जाओ/.test(lower)){state.step=Math.max(0,state.step-1);updateStep();speakVoice(voiceText("ठीक है, पिछले step पर आ गए हैं।","Okay, I've moved to the previous step."));return;}
 if(/\b(continue listing|next step|aage chalo)\b|आगे चलो/.test(lower)){state.step=Math.min(4,state.step+1);updateStep();speakVoice(voiceText("ठीक है, listing के अगले step पर चलते हैं।","Okay, moving to the next listing step."));return;}
 if(/\b(stop listening|stop microphone|band karo|mic band)\b|रोक दो|बंद करो/.test(lower)){stopVoice();setVoiceReply(voiceText("ठीक है, microphone रोक दिया है।","Okay, I stopped listening."));return;}
 if(/\b(repeat|say again|dobara bolo|phir se bolo|फिर से बोलो|दोहराओ)\b/.test(lower)){speakVoice(state.voice.lastQuestion||state.voice.lastReply);return;}
 if(/\b(show details|details dikhao|meri details|सब दिखाओ|जानकारी दिखाओ)\b/.test(lower)){const keys=["propertyType","configuration","address","rent","deposit","furnishing"];const summary=keys.map(k=>currentVoiceValue(k)?voiceFieldLabel(k)+": "+voiceFieldValue(k,currentVoiceValue(k)):"").filter(Boolean).join(". ");speakVoice(summary||voiceText("अभी कोई detail नहीं भरी गई है।","No details have been entered yet."));return;}
 if(/\b(submit|publish|list my property|property submit|publish my property)\b/.test(lower)||/सबमिट|पब्लिश/.test(lower)){speakVoice(voiceText("मैं आपकी property अपने आप publish नहीं करूँगा। Preview में details check करके Publish My Property दबाएँ।","I won't publish automatically. Review the preview and press Publish My Property yourself."));return;}
 if(state.voice.awaitingConfirmation&&isVoiceYes(raw)){
  state.voice.pending={};state.voice.awaitingConfirmation=false;renderVoicePending();
  speakVoice(voiceText("ठीक है, details form में update हैं। अब अगली जानकारी लेते हैं।","Confirmed. The details are already updated in your form. Let's collect the next item."),nextVoiceQuestion);return;
 }
 if(state.voice.awaitingConfirmation&&isVoiceNo(raw)){
  const correction=extractVoiceDetails(raw);
  if(Object.keys(correction).length){
   state.voice.pending={...correction};applyVoiceValues(correction);renderVoicePending();
   const summary=Object.entries(state.voice.pending).map(([key,value])=>voiceFieldLabel(key)+" "+voiceFieldValue(key,value)).join(", ");
   speakVoice(voiceText("ठीक है, मैंने form में correction कर दिया है: ","Okay, I updated the form with: ")+summary+voiceText(". आप इसे manually भी edit कर सकते हैं। Confirm details दबाएँ।",". You can also edit it manually. Press Confirm details when ready."));
   return;
  }
  state.voice.pending={};state.voice.awaitingConfirmation=false;renderVoicePending();
  speakVoice(voiceText("कोई बात नहीं। सही detail बताइए।","No problem. Tell me the correct detail."));return;
 }
 if(/\b(skip|chhodo)\b|छोड़ो|स्किप/.test(lower)){if(state.voice.lastField==="deposit"){state.voice.skippedDeposit=true;nextVoiceQuestion();return;}if(state.voice.lastField==="foodIncluded"){state.voice.skippedFood=true;nextVoiceQuestion();return;}speakVoice(voiceText("ठीक है, इस optional detail को बाद में भर सकते हैं।","Okay, you can fill this optional detail later."));return;}
 const extracted=extractVoiceDetails(raw);
 if(!Object.keys(extracted).length){speakVoice(voiceText("मैं आपकी बात पूरी तरह नहीं समझ पाया। कृपया property type, location या rent जैसी detail फिर से बताइए।","I couldn't identify a property detail. Please repeat the property type, location or rent."));return;}
 state.voice.pending={...state.voice.pending,...extracted};
 applyVoiceValues(extracted);
 state.voice.awaitingConfirmation=true;renderVoicePending();
 const summary=Object.entries(state.voice.pending).map(([key,value])=>voiceFieldLabel(key)+" "+voiceFieldValue(key,value)).join(", ");
 speakVoice(voiceText("मैंने details आपके actual form में update कर दी हैं: ","I updated these details in your actual form: ")+summary+voiceText(". आप अभी manually edit कर सकते हैं। Confirm details दबाकर आगे बढ़ें।",". You can edit them now. Press Confirm details to continue."));
}
function updateVoiceTranscript(){const area=$("#gdrStudioVoiceTranscript");if(area)area.value=[state.voice.finalText,state.voice.turnText,state.voice.interimText].filter(Boolean).join(" ").trim();}
function updateVoiceTranscript(){const area=$("#gdrStudioVoiceTranscript");if(area)area.value=[state.voice.finalText,state.voice.turnText,state.voice.interimText].filter(Boolean).join(" ").trim();}
function startVoiceRecognition(){
 if(!state.voice.active||state.voice.manualStop||state.voice.speaking||state.recognition)return;
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){
  state.voice.active=false;state.recording=false;setVoiceState("VOICE INPUT UNAVAILABLE",false);
  setVoiceReply(voiceText("इस browser में voice recognition उपलब्ध नहीं है। नीचे type करके भी details भर सकते हैं।","Voice recognition is unavailable in this browser. You can type details below."));
  return;
 }
 const rec=new Speech(),session=++state.voice.session;
 rec.lang=String($("#gdrStudioVoiceLanguage")?.value||"hi-IN").startsWith("en")?"en-IN":"hi-IN";
 rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;
 state.recognition=rec;state.voice.turnText="";state.voice.interimText="";
 rec.onstart=()=>{
  if(session!==state.voice.session)return;
  state.recording=true;setVoiceState("LISTENING · SPEAK NATURALLY",true);
  const status=$("#gdrStudioVoiceStatus");if(status)status.textContent=voiceText("मैं सुन रहा हूँ। अपनी एक instruction बोलें; फिर microphone अपने आप बंद हो जाएगा।","Listening for one instruction. The microphone will stop automatically after this turn.");
 };
 rec.onresult=e=>{
  if(session!==state.voice.session)return;
  let interim="";
  for(let i=e.resultIndex;i<e.results.length;i++){
   const result=e.results[i],spoken=result[0]&&result[0].transcript||"";
   if(result.isFinal&&spoken.trim())state.voice.turnText+=(state.voice.turnText?" ":"")+spoken.trim();
   else interim+=spoken;
  }
  state.voice.interimText=interim;updateVoiceTranscript();
 };
 rec.onerror=e=>{
  if(session!==state.voice.session)return;
  state.voice.session++;state.voice.active=false;state.recording=false;state.recognition=null;
  if(state.voice.turnTimer)clearTimeout(state.voice.turnTimer);
  setVoiceState("MICROPHONE NEEDS ATTENTION",false);
  const errors={
   "not-allowed":voiceText("Microphone permission blocked है। Chrome site settings में अनुमति दें।","Microphone permission is blocked. Allow it in Chrome site settings."),
   "service-not-allowed":voiceText("Browser speech recognition service blocked है। Network और browser settings check करें।","The browser speech recognition service is blocked. Check network and browser settings."),
   "audio-capture":voiceText("Microphone device नहीं मिल रहा। Windows input device check करें।","No microphone input device was found. Check your Windows input device."),
   "network":voiceText("Speech recognition service तक network connection नहीं पहुँच रहा। Internet check करें या text type करें।","The speech recognition service could not be reached. Check your internet connection or type instead."),
   "no-speech":voiceText("कोई आवाज़ detect नहीं हुई। फिर से Start speaking दबाएँ।","No speech was detected. Press Start speaking and try again."),
   "language-not-supported":voiceText("यह language browser में supported नहीं है। दूसरी language चुनें।","This language is not supported by the browser. Select another language.")
  };
  setVoiceReply(errors[e.error]||voiceText("Voice recognition error: "+String(e.error||"unknown"),"Voice recognition error: "+String(e.error||"unknown")));
 };
 rec.onend=()=>{
  if(session!==state.voice.session)return;
  const spoken=String(state.voice.turnText||"").trim();
  state.recognition=null;state.recording=false;state.voice.active=false;
  state.voice.interimText="";state.voice.turnText="";
  setVoiceState("READY · MICROPHONE OFF",false);
  if(spoken)processVoiceTurn(spoken);
  else{
   const status=$("#gdrStudioVoiceStatus");
   if(status)status.textContent=voiceText("Microphone बंद है। अगली बात कहने के लिए Start speaking दबाएँ।","Microphone is off. Press Start speaking for your next instruction.");
  }
 };
 try{rec.start();}
 catch(error){
  state.voice.active=false;state.recording=false;state.recognition=null;state.voice.session++;
  setVoiceState("READY · MICROPHONE OFF",false);
  setVoiceReply(voiceText("Microphone start नहीं हो पाया: "+(error&&error.message||"unknown error"),"Could not start microphone: "+(error&&error.message||"unknown error")));
 }
}
function startVoice(){
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){
  setVoiceState("VOICE INPUT UNAVAILABLE",false);
  setVoiceReply(voiceText("इस browser में voice input उपलब्ध नहीं है। नीचे manually type कर सकते हैं।","Voice input is unavailable in this browser. You can type manually below."));
  return;
 }
 if(state.voice.active||state.recording)return;
 state.voice.manualStop=false;state.voice.permissionBlocked=false;state.voice.active=true;
 if(window.speechSynthesis)window.speechSynthesis.cancel();
 state.voice.speaking=false;
 const status=$("#gdrStudioVoiceStatus");if(status)status.textContent=voiceText("Microphone शुरू हो रहा है…","Starting microphone…");
 setVoiceState("STARTING",true);startVoiceRecognition();
}
function stopVoice(){
 state.voice.active=false;state.voice.manualStop=true;state.recording=false;state.voice.session++;
 if(state.voice.restartTimer)clearTimeout(state.voice.restartTimer);state.voice.restartTimer=null;
 if(state.voice.turnTimer)clearTimeout(state.voice.turnTimer);state.voice.turnTimer=null;
 if(state.recognition){const rec=state.recognition;state.recognition=null;try{rec.abort?rec.abort():rec.stop();}catch(e){}}
 if(window.speechSynthesis)window.speechSynthesis.cancel();
 state.voice.speaking=false;state.voice.interimText="";state.voice.turnText="";
 setVoiceState("MICROPHONE OFF",false);
 const status=$("#gdrStudioVoiceStatus");if(status)status.textContent=voiceText("Microphone पूरी तरह बंद है। अगली बार बोलने के लिए Start speaking दबाएँ।","Microphone is off. Press Start speaking when you want to speak again.");
}
function toggleVoiceMute(){
 state.voice.muted=!state.voice.muted;const btn=$("#gdrStudioVoiceMute");
 if(btn){btn.textContent=state.voice.muted?"🔇 Voice muted":"🔊 Voice on";btn.setAttribute("aria-pressed",state.voice.muted?"true":"false");}
 if(state.voice.muted&&window.speechSynthesis){window.speechSynthesis.cancel();state.voice.speaking=false;}
}

function bindEvents(){
 const root=studio();if(!root||root.dataset.bound==="1")return;root.dataset.bound="1";
 renderLiveVoiceForm();
 // Disable browser-saved suggestions for all listing inputs.
 $$("input,select,textarea",root).forEach(el=>{
  el.setAttribute("autocomplete","off");
  el.setAttribute("autocorrect","off");
  el.setAttribute("autocapitalize","off");
  if(el.id&&!el.name)el.name="gdr_manual_"+el.id;
 });
 root.addEventListener("click",e=>{
  const type=e.target.closest("[data-gdr-property-type]");if(type){selectedType(type.dataset.gdrPropertyType);return;}
  const config=e.target.closest("[data-gdr-configuration]");if(config){setConfiguration(config.dataset.gdrConfiguration);return;}
  const edit=e.target.closest("[data-gdr-voice-edit]");if(edit){editVoiceField(edit.dataset.gdrVoiceEdit);return;}
  const step=e.target.closest("[data-gdr-studio-goto]");if(step){goToStep(Number(step.dataset.gdrStudioGoto));return;}
 });
 $("#gdrStudioBack")?.addEventListener("click",()=>goToStep(state.step-1));
 $("#gdrStudioFormNext")?.addEventListener("click",()=>goToStep(state.step+1));
 $("#gdrStudioNext")?.addEventListener("click",()=>goToStep(state.step+1));
 $("#gdrStudioClose")?.addEventListener("click",close);
 $("#gdrStudioLocation")?.addEventListener("input",e=>{
  state.address=e.target.value;state.pincode="";clearStudioCoordinateSelection();if(state.voice.pending&&Object.prototype.hasOwnProperty.call(state.voice.pending,"address"))state.voice.pending.address=state.address;const pin=$("#gdrStudioPincode");if(pin)pin.value="";state.nearbyPlaces=[];renderNearby();saveDraft();renderLiveVoiceForm();
  if(searchTimer)clearTimeout(searchTimer);
  const q=e.target.value.trim();if(q.length<3){$("#gdrStudioLocationSuggestions").hidden=true;updateLocationStatus();return;}
  searchTimer=setTimeout(()=>searchAddress(q),350);
 });
 $("#gdrStudioPincode")?.addEventListener("input",e=>{
  const nextPin=e.target.value.replace(/\D/g,"").slice(0,6);e.target.value=nextPin;
  if(nextPin!==state.pincode)invalidateStudioLocationForPinChange(nextPin);else state.pincode=nextPin;
  if(state.voice.pending&&Object.prototype.hasOwnProperty.call(state.voice.pending,"pincode"))state.voice.pending.pincode=state.pincode;
  if(pinResolveTimer){clearTimeout(pinResolveTimer);pinResolveTimer=null;}
  if(nextPin.length===6)pinResolveTimer=setTimeout(()=>resolveStudioPincode(nextPin),450);
  saveDraft();renderLiveVoiceForm();
 });
 $("#gdrStudioPincode")?.addEventListener("change",e=>{const pin=String(e.target.value||"").replace(/\D/g,"").slice(0,6);if(pin.length===6)resolveStudioPincode(pin);});
 $("#gdrStudioPincode")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();const pin=String(e.target.value||"").replace(/\D/g,"").slice(0,6);if(pin.length===6)resolveStudioPincode(pin);}});

 ["gdrStudioRent","gdrStudioDeposit","gdrStudioFurnishing","gdrStudioDescription","gdrStudioRoomType","gdrStudioGender","gdrStudioTotalBeds","gdrStudioAvailableBeds","gdrStudioFoodIncluded"].forEach(id=>{
  const el=document.getElementById(id);if(!el)return;
  el.addEventListener("input",()=>{const key={gdrStudioRent:"rent",gdrStudioDeposit:"deposit",gdrStudioFurnishing:"furnishing",gdrStudioDescription:"description",gdrStudioRoomType:"roomType",gdrStudioGender:"gender",gdrStudioTotalBeds:"totalBeds",gdrStudioAvailableBeds:"availableBeds",gdrStudioFoodIncluded:"foodIncluded"}[id];state[key]=el.value;if(state.voice.pending&&Object.prototype.hasOwnProperty.call(state.voice.pending,key))state.voice.pending[key]=el.value;saveDraft();renderLiveVoiceForm();});
  el.addEventListener("change",()=>{const key={gdrStudioRent:"rent",gdrStudioDeposit:"deposit",gdrStudioFurnishing:"furnishing",gdrStudioDescription:"description",gdrStudioRoomType:"roomType",gdrStudioGender:"gender",gdrStudioTotalBeds:"totalBeds",gdrStudioAvailableBeds:"availableBeds",gdrStudioFoodIncluded:"foodIncluded"}[id];state[key]=el.value;if(state.voice.pending&&Object.prototype.hasOwnProperty.call(state.voice.pending,key))state.voice.pending[key]=el.value;saveDraft();renderLiveVoiceForm();});
 });
 $("#gdrStudioUseGps")?.addEventListener("click",useGps);
 $("#gdrStudioOpenMap")?.addEventListener("click",openMap);
 const photoInput=$("#gdrStudioPhotoFiles"),cameraInput=$("#gdrStudioCameraFiles");
 photoInput?.addEventListener("change",e=>{acceptFiles(e.target.files,e.target.dataset.gdrCategory||"interior");e.target.value="";});
 cameraInput?.addEventListener("change",e=>{acceptFiles(e.target.files,e.target.dataset.gdrCategory||"interior");e.target.value="";});
 root.querySelectorAll("[data-gdr-studio-photo-upload]").forEach(button=>button.addEventListener("click",()=>{
  if(photoInput){photoInput.dataset.gdrCategory=button.dataset.gdrStudioPhotoUpload;photoInput.click();}
 }));
 root.querySelectorAll("[data-gdr-studio-photo-camera]").forEach(button=>button.addEventListener("click",()=>{
  if(cameraInput){cameraInput.dataset.gdrCategory=button.dataset.gdrStudioPhotoCamera;cameraInput.click();}
 }));
 $("#gdrStudioDraftResume")?.addEventListener("click",dismissDraftRecovery);
 $("#gdrStudioDraftStartFresh")?.addEventListener("click",async()=>{
  if(!confirm("Discard this saved property draft and start a blank listing?"))return;
  clearLegacyDraft();await removeUploadedFiles();resetNewListing();dismissDraftRecovery();message("A fresh blank listing is ready.","success");
 });
 $("#gdrStudioVoiceStart")?.addEventListener("click",startVoice);
 $("#gdrStudioVoiceStop")?.addEventListener("click",stopVoice);
 $("#gdrStudioVoiceMute")?.addEventListener("click",toggleVoiceMute);
 $("#gdrStudioVoiceConfirm")?.addEventListener("click",()=>{applyVoicePending();speakVoice(voiceText("ठीक है, details confirm कर दी हैं।","Details confirmed."),nextVoiceQuestion);});
 $("#gdrStudioVoiceEdit")?.addEventListener("click",()=>{const keys=Object.keys(state.voice.pending||{}),steps={propertyType:0,configuration:0,rent:1,deposit:1,furnishing:1,address:2,pincode:2};const key=keys.find(k=>Object.prototype.hasOwnProperty.call(steps,k));state.voice.pending={};state.voice.awaitingConfirmation=false;renderVoicePending();syncFormFromState();state.step=key?steps[key]:0;updateStep();$("#gdrStudioMain")?.scrollIntoView({behavior:"smooth",block:"start"});speakVoice(voiceText("Form खुल गया है। सभी भरी हुई details सुरक्षित हैं; आप उन्हें manually edit कर सकते हैं।","The original form is open. Your entered details are preserved and you can edit them manually."));});
 $("#gdrStudioVoiceLanguage")?.addEventListener("change",e=>{state.voice.language=String(e.target.value||"hi-IN").startsWith("en")?"en":"hi";});
 $("#gdrStudioVoiceTranscript")?.addEventListener("input",e=>{state.voice.finalText=e.target.value;});
 $("#gdrStudioPublish")?.addEventListener("click",publish);
 document.addEventListener("click",e=>{
  if(e.target.closest("#ownerAddPropertyBtn")){
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open(false);
  }
  if(e.target.closest("#gdrListPropertyStart")){
   e.preventDefault();open(false);
  }
  if(e.target.closest("#gdrListPropertySpeak")){
   e.preventDefault();open(true);
  }
  if(e.target.closest("#gdrCloseOwnerMapPickerBtn"))setTimeout(restoreMapPanel,120);
  if(e.target.closest("#gdrConfirmOwnerMapLocation"))setTimeout(restoreMapPanel,180);
 },true);
 document.addEventListener("click",e=>{
  const cover=e.target.closest("[data-gdr-studio-cover]");
  if(cover){setCover(Number(cover.dataset.gdrStudioCover));}
  const remove=e.target.closest("[data-gdr-studio-remove-photo]");
  if(remove){
   const index=Number(remove.dataset.gdrStudioRemovePhoto);
   if(state.files[index]){URL.revokeObjectURL(state.files[index].previewUrl);state.files.splice(index,1);}
   state.coverIndex=Math.max(0,Math.min(state.coverIndex,state.files.length-1));renderPhotos();saveDraft();
  }
 });
 const formInputs=$$("#gdrPropertyStudio input,#gdrPropertyStudio select,#gdrPropertyStudio textarea");
 formInputs.forEach(el=>el.addEventListener("change",saveDraft));
}
async function publish(){
 if(state.publishing)return;
 for(let i=0;i<4;i++){if(!validateStep(i)){goToStep(i);return;}}
 state.address=$("#gdrStudioLocation")?.value.trim()||state.address;
 state.rent=$("#gdrStudioRent")?.value||state.rent;
 state.deposit=$("#gdrStudioDeposit")?.value||state.deposit;
 state.description=$("#gdrStudioDescription")?.value||state.description;
 state.pincode=$("#gdrStudioPincode")?.value||state.pincode;
 try{
  const account=await getOwner();state.user=account.user;state.owner=account.owner;
  state.publishing=true;
  const btn=$("#gdrStudioPublish");if(btn){btn.disabled=true;btn.textContent="Publishing securely…";}
  message("Uploading your genuine property photos…","info");
  const uploaded=await uploadPhotos();
  const photoUrls=uploaded.map(p=>p.url);
  const coverUrl=photoUrls[0]||null;
  const propertyType=state.propertyType;
  const listingType=propertyType==="pg"?"pg":propertyType==="hostel"?"hostel":"home";
  const config=propertyType==="other"?"Other":(propertyType==="room"?null:state.configuration);
  const bhk=propertyType==="room"?null:(listingType==="home"?(config==="1 RK"||config==="1 BHK"?1:config==="2 BHK"?2:config==="3 BHK"?3:config==="4 BHK"?4:config==="5+ BHK"?5:1):null);
  const title=titleForListing();
  const params={
   p_submission_id:state.submissionId||uuid(),
   p_property_type:propertyType,
   p_configuration:config||null,
   p_security_deposit:state.deposit===""?null:Number(state.deposit),
   p_pincode:state.pincode||null,
   p_photo_urls:photoUrls,
   p_nearby_places:state.nearbyPlaces,
   p_listing_type:listingType,
   p_room_type:listingType==="home"?null:state.roomType,
   p_gender_preference:listingType==="home"?null:state.gender,
   p_food_included:listingType==="home"?null:(state.foodIncluded==="yes"?true:state.foodIncluded==="no"?false:null),
   p_total_beds:listingType==="home"?null:Number(state.totalBeds),
   p_available_beds:listingType==="home"?null:Number(state.availableBeds),
   p_name:title,
   p_title:title,
   p_location:state.address,
   p_area:state.address.split(",")[0].trim(),
   p_address:state.address,
   p_latitude:state.lat,
   p_longitude:state.lng,
   p_bhk:bhk,
   p_rent:Number(state.rent),
   p_furnishing:state.furnishing||null,
   p_description:state.description||null,
   p_image_url:coverUrl
  };
  const c=client();
  const {data,error}=await c.rpc("owner_publish_property_studio",params);
  if(error||!data)throw error||new Error("The property could not be saved. Please try again.");
  try{localStorage.removeItem(draftKey());}catch(e){}
  state.publishing=false;
  showSuccess(data);
 }catch(e){
  console.error("GharDekho Property Studio publish failed",e);
  message(e.message||"Your property could not be published. Your draft is saved; please try again.","error");
 }finally{
  state.publishing=false;
  const btn=$("#gdrStudioPublish");if(btn){btn.disabled=false;btn.textContent="Submit Your Property";}
 }
}
function showSuccess(property){
 const root=studio();if(!root)return;
 state.published=true;
 const main=$("#gdrStudioMain"),progress=$(".gdr-studio-progress-wrap",root);
 if(main){main.hidden=true;main.style.display="none";}
 if(progress){progress.hidden=true;progress.style.display="none";}
 let view=$("#gdrStudioSuccessView");
 if(!view){view=document.createElement("section");view.id="gdrStudioSuccessView";view.className="gdr-studio-success";root.appendChild(view);}
 view.hidden=false;
 view.innerHTML=
  '<div class="gdr-studio-success-mark">✓</div><span>GHARDEKHO PROPERTY STUDIO</span><h1>Your property is submitted.</h1><p>Your listing is saved in My Properties with <strong>Pending verification</strong> status. It is available in your existing Owner Dashboard.</p><div class="gdr-studio-success-id">Property reference <b>'+escapeHtml(property.id||"Saved")+'</b></div><button type="button" id="gdrStudioViewInventory">View My Properties</button><button type="button" class="gdr-studio-success-secondary" id="gdrStudioSuccessClose">Back to Dashboard</button>';
 $("#gdrStudioViewInventory")?.addEventListener("click",()=>returnToOwnerDashboard(true));
 $("#gdrStudioSuccessClose")?.addEventListener("click",()=>returnToOwnerDashboard(false));
}
async function init(){
 const mount=$("#gdrPropertyStudioMount");
 if(mount&&!studio()){
  const response=await fetch("/assets/gdr-property-studio.txt?v="+VERSION,{cache:"no-cache"});
  if(!response.ok)throw new Error("Property Studio layout could not be loaded.");
  mount.innerHTML=await response.text();
 }
 bindEvents();wrapMapCallback();
 const studioRoot=studio();
 if(studioRoot)studioRoot.hidden=true;
}
let readyPromise=Promise.resolve();
window.GDRPropertyStudio={open:()=>open(false),openByVoice:()=>open(true),close:close};
if(!window.__gdrListPropertyLauncherBound){
 document.addEventListener("click",function(event){
  const trigger=event.target&&event.target.closest?event.target.closest("#gdrListPropertyStart"):null;
  if(!trigger)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  window.GDRPropertyStudio.open();
 },true);
 window.__gdrListPropertyLauncherBound=true;
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{readyPromise=init();},{once:true});else readyPromise=init();
})();