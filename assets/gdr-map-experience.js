
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = {
    renterMap:null, ownerMap:null, renterLayer:null, radiusCircle:null,
    ownerMarker:null, ownerSelection:null, inventory:[], boundsRows:[], visible:[],
    searchCenter:null, radiusKm:5, viewportRpc:null, loadedOnce:false,
    geolocationAttempted:false, searchTimer:null, searchController:null,
    ownerSearchTimer:null, ownerSearchController:null
  };
  const INDIA_CENTER=[22.9734,78.6569], TILE_URL="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const PHOTON="https://photon.komoot.io/api/";
  const asNumber=v=>Number.isFinite(Number(v))?Number(v):null;
  const validPoint=(lat,lng)=>asNumber(lat)!==null&&asNumber(lng)!==null&&asNumber(lat)>=-90&&asNumber(lat)<=90&&asNumber(lng)>=-180&&asNumber(lng)<=180;
  const money=v=>"₹"+new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Number(v||0));
  const distanceKm=(a,b)=>{
    const rad=n=>n*Math.PI/180,dLat=rad(b[0]-a[0]),dLng=rad(b[1]-a[1]);
    const x=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLng/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  };
  function node(tag,cls,value){const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined&&value!==null)n.textContent=String(value);return n;}
  function safeImage(value){try{const u=new URL(String(value||""),location.origin);return u.protocol==="https:"||u.origin===location.origin?u.href:"";}catch(_){return "";}}
  function statusOf(p){if(p.status==="pending"||p.verification_status==="pending")return "Pending verification";if(p.status==="occupied")return "Occupied";if(p.status==="soon_available")return "Available soon";return "Available";}
  function db(){return window.__gdrSupabaseClient||null;}
  function setStatus(message){const n=$("gdrMapStatus");if(n)n.textContent=message||"";}
  function photonLabel(p){p=p||{};return [p.name,p.street,p.locality,p.district,p.city,p.state,p.postcode,p.country].filter(Boolean).map(String).filter((v,i,a)=>a.indexOf(v)===i).join(", ");}
  function addTiles(map){window.L.tileLayer(TILE_URL,{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);}
  function makeLayer(map){return window.L.markerClusterGroup?window.L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:48}).addTo(map):window.L.layerGroup().addTo(map);}
  async function fetchInventory(){const client=db();if(!client)throw new Error("Property service is still loading.");const r=await client.rpc("get_public_properties");if(r.error)throw r.error;state.inventory=(Array.isArray(r.data)?r.data:[]).filter(p=>validPoint(p.latitude,p.longitude));state.loadedOnce=true;return state.inventory;}
  async function fetchBounds(bounds){
    const client=db();if(!client)throw new Error("Property service is not ready.");
    const sw=bounds.getSouthWest(),ne=bounds.getNorthEast();
    if(state.viewportRpc!==false){
      const r=await client.rpc("get_map_properties_in_bounds",{p_south:sw.lat,p_west:sw.lng,p_north:ne.lat,p_east:ne.lng,p_limit:200});
      if(!r.error){state.viewportRpc=true;return (Array.isArray(r.data)?r.data:[]).filter(p=>validPoint(p.latitude,p.longitude));}
      state.viewportRpc=false;console.info("Viewport RPC not installed yet; using existing public inventory as a compatibility fallback.");
    }
    if(!state.loadedOnce)await fetchInventory();
    return state.inventory.filter(p=>bounds.contains([Number(p.latitude),Number(p.longitude)]));
  }
  function applyRadius(rows,center){return rows.map(p=>Object.assign({},p,{gdrDistanceKm:distanceKm(center,[Number(p.latitude),Number(p.longitude)])})).filter(p=>p.gdrDistanceKm<=state.radiusKm);}
  function markerIcon(p){
    const rent=Number(p.rent||0),short=rent>=100000?"₹"+(rent/100000).toFixed(1)+"L":rent>=1000?"₹"+(rent/1000).toFixed(rent%1000?1:0)+"k":money(rent);
    const pending=p.status==="pending"||p.verification_status==="pending";
    return window.L.divIcon({className:"gdr-price-marker-wrap",html:'<span class="gdr-price-marker'+(pending?" gdr-marker-pending":"")+'">'+short+'</span>',iconSize:[72,34],iconAnchor:[36,17]});
  }
  function clearPreview(){const p=$("gdrMapPreview");if(p){p.hidden=true;p.replaceChildren();}}
  function showPreview(p){
    const preview=$("gdrMapPreview");if(!preview)return;preview.replaceChildren();
    const main=node("div","gdr-map-preview-main"),img=document.createElement("img");
    img.alt="Property photograph";img.loading="lazy";img.src=safeImage(p.image_url)||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240'%3E%3Crect width='100%25' height='100%25' fill='%23e9f1ee'/%3E%3C/svg%3E";
    const copy=node("div","");
    copy.append(node("h4","",p.title||p.name||"Rental property"),node("p","",[p.location,p.address].filter(Boolean).join(", ")||"Location details available"),node("p","gdr-map-rent",money(p.rent)+" / month"));
    const meta=[p.bhk?p.bhk+" BHK":"",p.furnishing||"",p.listing_type&&p.listing_type!=="home"?p.listing_type.toUpperCase():"Home",Number.isFinite(p.gdrDistanceKm)?p.gdrDistanceKm.toFixed(1)+" km away":""].filter(Boolean).join(" · ");
    copy.append(node("p","",meta),node("p","",statusOf(p)+" · Owner contact is shared only through the approved visit flow."));
    main.append(img,copy);
    const actions=node("div","gdr-map-preview-actions"),details=node("button","gdr-map-details-btn","View details"),close=node("button","gdr-map-dismiss-btn","Close");
    details.type="button";details.addEventListener("click",()=>{if(typeof window.openPropertyDetails==="function")window.openPropertyDetails(p.id);else setStatus("Open this property from the property results to see full details.");});
    close.type="button";close.addEventListener("click",clearPreview);actions.append(details,close);preview.append(main,actions);preview.hidden=false;
  }
  function renderList(rows){
    const panel=$("gdrMapListPanel");if(!panel)return;panel.replaceChildren();
    if(!rows.length){panel.append(node("div","gdr-map-empty","No properties found in this area. Move the map, change the radius or search another locality."));return;}
    rows.forEach(p=>{
      const b=node("button","gdr-map-list-card","");b.type="button";
      const img=document.createElement("img");img.loading="lazy";img.alt="Property";img.src=safeImage(p.image_url)||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23e9f1ee'/%3E%3C/svg%3E";
      const copy=node("span","");copy.append(node("strong","",p.title||p.name||"Rental property"),node("small","",[p.location,p.bhk?p.bhk+" BHK":"",p.furnishing||""].filter(Boolean).join(" · ")),node("b","",money(p.rent)+" / month"));
      b.append(img,copy);b.addEventListener("click",()=>{state.renterMap.flyTo([Number(p.latitude),Number(p.longitude)],16,{duration:.55});showPreview(p);});panel.append(b);
    });
  }
  function renderMarkers(rows,center){
    if(!state.renterMap||!state.renterLayer)return;state.renterLayer.clearLayers();
    if(state.radiusCircle)state.renterMap.removeLayer(state.radiusCircle);
    state.radiusCircle=window.L.circle(center,{radius:state.radiusKm*1000,color:"#176b63",weight:1.5,opacity:.65,fillColor:"#176b63",fillOpacity:.055,dashArray:"5 7"}).addTo(state.renterMap);
    rows.forEach(p=>{const marker=window.L.marker([Number(p.latitude),Number(p.longitude)],{icon:markerIcon(p)});marker.on("click",()=>showPreview(p));state.renterLayer.addLayer(marker);});
    state.visible=rows;renderList(rows);const count=$("gdrMapCount");if(count)count.textContent=rows.length+(rows.length===1?" home":" homes");if(!rows.length)clearPreview();
  }
  async function searchRenterArea(){
    if(!state.renterMap)return;const button=$("gdrMapSearchAreaBtn");if(button){button.disabled=true;button.textContent="Searching…";}
    setStatus("Searching properties in the visible map area…");
    try{const c=state.renterMap.getCenter();state.searchCenter=[c.lat,c.lng];state.boundsRows=await fetchBounds(state.renterMap.getBounds());const rows=applyRadius(state.boundsRows,state.searchCenter);renderMarkers(rows,state.searchCenter);setStatus(rows.length+" properties within "+state.radiusKm+" km of the map centre.");}
    catch(error){console.error("GDR map search failed:",error);setStatus("Properties could not be loaded. Please try again.");}
    finally{if(button){button.disabled=false;button.textContent="Search this area";}}
  }
  function locateRenter(){
    if(!navigator.geolocation){setStatus("This browser does not support location. Search for a city or locality instead.");searchRenterArea();return;}
    setStatus("Requesting your location permission…");
    navigator.geolocation.getCurrentPosition(async pos=>{state.searchCenter=[pos.coords.latitude,pos.coords.longitude];state.renterMap.setView(state.searchCenter,14,{animate:true});await searchRenterArea();},
      error=>{setStatus(error.code===1?"Location permission was denied. Search for any city or locality instead.":"Could not determine your location. Showing the selected map area.");searchRenterArea();},
      {enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  }
  function initRenterMap(){
    if(state.renterMap)return;const canvas=$("gdrExploreMapCanvas");if(!canvas)return;
    state.renterMap=window.L.map(canvas,{zoomControl:false,scrollWheelZoom:true,preferCanvas:true});addTiles(state.renterMap);window.L.control.zoom({position:"bottomright"}).addTo(state.renterMap);
    state.renterLayer=makeLayer(state.renterMap);state.renterMap.setView(INDIA_CENTER,5);
    state.renterMap.on("moveend",()=>{const s=$("gdrMapStatus");if(s&&state.visible.length)s.textContent="Map moved. Tap Search this area to refresh properties.";});
  }
  async function openRenterMap(){
    const dashboard=$("renterDashboard"),panel=$("gdrExploreMapPanel");if(!dashboard||!panel)return;
    dashboard.classList.add("gdr-map-mode");panel.hidden=false;
    try{if(!window.L)throw new Error("Map library is unavailable.");initRenterMap();requestAnimationFrame(()=>state.renterMap&&state.renterMap.invalidateSize());
      if(!state.loadedOnce){setStatus("Loading rental inventory…");await fetchInventory();const first=state.inventory[0];if(first)state.renterMap.setView([Number(first.latitude),Number(first.longitude)],12);}
      if(!state.geolocationAttempted){state.geolocationAttempted=true;locateRenter();}else await searchRenterArea();
    }catch(error){console.error("GDR map initialization failed:",error);setStatus("The interactive map could not load. Check your connection and try again.");}
  }
  function closeRenterMap(){const d=$("renterDashboard"),p=$("gdrExploreMapPanel");if(p)p.hidden=true;if(d)d.classList.remove("gdr-map-mode");clearPreview();}
  function setupPlaceSearch(inputId,panelId,onSelect,kind){
    const input=$(inputId),panel=$(panelId);if(!input||!panel)return;
    const timerKey=kind==="owner"?"ownerSearchTimer":"searchTimer",controllerKey=kind==="owner"?"ownerSearchController":"searchController";
    input.addEventListener("input",()=>{
      if(state[timerKey])clearTimeout(state[timerKey]);if(state[controllerKey])state[controllerKey].abort();
      const q=input.value.trim();panel.replaceChildren();panel.classList.remove("gdr-open");if(q.length<3)return;
      state[timerKey]=setTimeout(async()=>{
        const controller=new AbortController();state[controllerKey]=controller;
        try{const response=await fetch(PHOTON+"?limit=6&lang=en&q="+encodeURIComponent(q+", India"),{headers:{Accept:"application/json"},signal:controller.signal});if(!response.ok)throw new Error("Location suggestions unavailable");
          const payload=await response.json(),features=Array.isArray(payload.features)?payload.features:[];
          features.forEach(f=>{const c=f&&f.geometry&&f.geometry.coordinates;if(!Array.isArray(c)||!validPoint(c[1],c[0]))return;
            const label=photonLabel(f.properties)||q,b=node("button","gdr-map-suggestion",label);b.type="button";b.addEventListener("click",()=>{input.value=label;panel.classList.remove("gdr-open");onSelect({lat:Number(c[1]),lng:Number(c[0]),label,properties:f.properties||{}});});panel.append(b);
          });
          if(panel.childElementCount)panel.classList.add("gdr-open");
        }catch(error){if(error.name!=="AbortError")console.warn("GDR place search:",error);}
      },300);
    });
    input.addEventListener("keydown",e=>{if(e.key==="Escape")panel.classList.remove("gdr-open");if(e.key==="Enter"&&panel.firstElementChild){e.preventDefault();panel.firstElementChild.click();}});
    document.addEventListener("click",e=>{if(!panel.contains(e.target)&&e.target!==input)panel.classList.remove("gdr-open");});
  }
  function updateOwnerStatus(message){const n=$("gdrOwnerMapSelectionStatus");if(n)n.textContent=message||"";}
  function setOwnerPin(point,label){
    if(!state.ownerMap||!validPoint(point.lat,point.lng))return;
    state.ownerSelection={lat:Number(point.lat),lng:Number(point.lng),label:String(label||"")};
    if(state.ownerMarker)state.ownerMap.removeLayer(state.ownerMarker);
    state.ownerMarker=window.L.marker([point.lat,point.lng],{draggable:true}).addTo(state.ownerMap);
    state.ownerMarker.on("dragend",()=>{const p=state.ownerMarker.getLatLng();state.ownerSelection={lat:p.lat,lng:p.lng,label:""};updateOwnerStatus("Pin moved. Confirm to save these coordinates.");});
    updateOwnerStatus((label?label+" · ":"")+"Pin: "+point.lat.toFixed(5)+", "+point.lng.toFixed(5)+". Drag to adjust.");
  }
  function initOwnerMap(){
    if(state.ownerMap)return;const canvas=$("gdrOwnerMapCanvas");if(!canvas)return;
    state.ownerMap=window.L.map(canvas,{zoomControl:false,scrollWheelZoom:true});addTiles(state.ownerMap);window.L.control.zoom({position:"bottomright"}).addTo(state.ownerMap);
    state.ownerMap.setView([23.2599,77.4126],12);state.ownerMap.on("click",e=>setOwnerPin(e.latlng,""));
  }
  function openOwnerMapPicker(){
    const panel=$("gdrOwnerMapPicker");if(!panel)return;
    if(!window.L){updateOwnerStatus("Map library unavailable. Use address suggestions or current location.");return;}
    panel.hidden=false;initOwnerMap();requestAnimationFrame(()=>state.ownerMap&&state.ownerMap.invalidateSize());
    const input=$("propertyLocation"),lat=asNumber(input&&input.dataset.gdSelectedLat),lng=asNumber(input&&input.dataset.gdSelectedLng);
    if(lat!==null&&lng!==null){state.ownerMap.setView([lat,lng],16);setOwnerPin({lat,lng},input.dataset.gdSelectedDisplayName||input.value);}
    else if(!state.ownerSelection){const c=state.ownerMap.getCenter();setOwnerPin(c,"Choose the exact property location");}
  }
  function closeOwnerMapPicker(){const p=$("gdrOwnerMapPicker");if(p)p.hidden=true;}
  function confirmOwnerMapLocation(){
    if(!state.ownerSelection){updateOwnerStatus("Tap the map or search for a locality to place the property pin.");return;}
    const input=$("propertyLocation"),typed=String(input&&input.value||"").trim(),address=typed||state.ownerSelection.label;
    if(!address){updateOwnerStatus("Enter the full property address before confirming the pin.");if(input)input.focus();return;}
    if(typeof window.__gdrSetPropertyLocation!=="function"||!window.__gdrSetPropertyLocation(address,state.ownerSelection.lat,state.ownerSelection.lng)){updateOwnerStatus("Property form is still initializing. Try again.");return;}
    updateOwnerStatus("Location confirmed. Coordinates will be saved with this property.");closeOwnerMapPicker();
  }
  function bind(){
    $("renterExploreMapBtn")?.addEventListener("click",openRenterMap);$("gdrMapBackBtn")?.addEventListener("click",closeRenterMap);
    $("gdrMapSearchAreaBtn")?.addEventListener("click",searchRenterArea);$("gdrMapLocateBtn")?.addEventListener("click",locateRenter);
    $("gdrMapRadius")?.addEventListener("input",e=>{state.radiusKm=Math.max(1,Math.min(10,Number(e.target.value)||5));const label=$("gdrMapRadiusValue");if(label)label.textContent=state.radiusKm+" km";if(state.renterMap&&state.boundsRows.length){const c=state.renterMap.getCenter();state.searchCenter=[c.lat,c.lng];const rows=applyRadius(state.boundsRows,state.searchCenter);renderMarkers(rows,state.searchCenter);setStatus(rows.length+" properties within "+state.radiusKm+" km. Tap Search this area after moving the map.");}});
    $("gdrMapListToggle")?.addEventListener("click",()=>{const l=$("gdrMapLayout"),panel=$("gdrMapListPanel");if(!l)return;const on=!l.classList.contains("gdr-list-mode");l.classList.toggle("gdr-list-mode",on);if(panel)panel.hidden=!on;$("gdrMapListToggle").setAttribute("aria-pressed",String(on));$("gdrMapViewToggle").setAttribute("aria-pressed",String(!on));if(state.renterMap)requestAnimationFrame(()=>state.renterMap.invalidateSize());});
    $("gdrMapViewToggle")?.addEventListener("click",()=>{const l=$("gdrMapLayout"),panel=$("gdrMapListPanel");if(!l)return;l.classList.remove("gdr-list-mode");if(panel)panel.hidden=true;$("gdrMapListToggle").setAttribute("aria-pressed","false");$("gdrMapViewToggle").setAttribute("aria-pressed","true");if(state.renterMap)requestAnimationFrame(()=>state.renterMap.invalidateSize());});
    $("gdrOpenOwnerMapPickerBtn")?.addEventListener("click",openOwnerMapPicker);$("gdrCloseOwnerMapPickerBtn")?.addEventListener("click",closeOwnerMapPicker);$("gdrConfirmOwnerMapLocation")?.addEventListener("click",confirmOwnerMapLocation);
    setupPlaceSearch("gdrMapPlaceSearch","gdrMapPlaceSuggestions",r=>{state.searchCenter=[r.lat,r.lng];if(state.renterMap){state.renterMap.flyTo(state.searchCenter,14,{duration:.6});searchRenterArea();}},"renter");
    setupPlaceSearch("gdrOwnerMapSearch","gdrOwnerMapSuggestions",r=>{if(state.ownerMap){state.ownerMap.flyTo([r.lat,r.lng],16,{duration:.6});setOwnerPin({lat:r.lat,lng:r.lng},r.label);}},"owner");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
  window.GDRMapExperience={openRenterMap,closeRenterMap,openOwnerMapPicker,searchRenterArea};
})();
