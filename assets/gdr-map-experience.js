
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = {
    renterMap:null, ownerMap:null, renterLayer:null, radiusCircle:null,
    ownerMarker:null, ownerSelection:null, ownerPinManuallyConfirmed:false, pendingOwnerMapCenter:null, renterPin:null, inventory:[], boundsRows:[], visible:[],
    searchCenter:null, radiusKm:5, searchUsesRadius:false, viewportRpc:null, loadedOnce:false, resolvedQuery:"", mapSearchId:0, locationSearchId:0,
    geolocationAttempted:false, searchTimer:null, searchController:null,
    ownerSearchTimer:null, ownerSearchController:null, ownerLocationSearchId:0,
    currentPrefs:{}, selectedPropertyId:null, markerById:new Map(), lastSearchBounds:null,
    browseInventory:null, browseCenter:null, browseTimer:null
  };
  const INDIA_CENTER=[22.9734,78.6569];
  const PHOTON="https://photon.komoot.io/api/";
  const MAP_PIN_VERSION="20261115-renter-map-precision1";
  const asNumber=v=>v===null||v===undefined||String(v).trim()===""?null:(Number.isFinite(Number(v))?Number(v):null);
  const validPoint=(lat,lng)=>asNumber(lat)!==null&&asNumber(lng)!==null&&asNumber(lat)>=-90&&asNumber(lat)<=90&&asNumber(lng)>=-180&&asNumber(lng)<=180;
  const validIndiaPoint=(lat,lng)=>validPoint(lat,lng)&&Number(lat)>=5&&Number(lat)<=38.8&&Number(lng)>=67&&Number(lng)<=98.2;
  const money=v=>"₹"+new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Number(v||0));
  const distanceKm=(a,b)=>{
    const rad=n=>n*Math.PI/180,dLat=rad(b[0]-a[0]),dLng=rad(b[1]-a[1]);
    const x=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLng/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  };
  function node(tag,cls,value){const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined&&value!==null)n.textContent=String(value);return n;}
  function safeImage(value){if(!value)return "";try{const u=new URL(String(value),location.origin);return u.protocol==="https:"||u.origin===location.origin?u.href:"";}catch(_){return "";}}
  function statusOf(p){if(p.status==="pending"||p.verification_status==="pending")return "Pending verification";if(p.status==="occupied")return "Occupied";if(p.status==="soon_available")return "Available soon";return "Available";}
  function db(){return window.__gdrSupabaseClient||null;}
  function setStatus(message){const n=$("gdrMapStatus");if(n)n.textContent=message||"";}
  function photonLabel(p){p=p||{};return [p.name,p.street,p.locality,p.district,p.city,p.state,p.postcode,p.country].filter(Boolean).map(String).filter((v,i,a)=>a.indexOf(v)===i).join(", ");}
  function loadScript(url){
    return new Promise((resolve,reject)=>{
      const existing=[...document.querySelectorAll("script[data-gdr-map-lib]")].find(s=>s.dataset.gdrMapLib===url);
      if(existing){if(window.L)return resolve();existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",reject,{once:true});return;}
      const script=document.createElement("script");script.src=url;script.async=true;script.dataset.gdrMapLib=url;
      script.onload=resolve;script.onerror=()=>reject(new Error("Map library could not be loaded."));document.head.appendChild(script);
    });
  }
  async function ensureLeaflet(){
    loadStylesheet("/assets/gdr-map-experience.css?v="+MAP_PIN_VERSION,"data-gdr-map-geo-style");
    if(!window.L){
      try{await loadScript("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js");}
      catch(primaryError){
        console.warn("Primary Leaflet CDN unavailable; trying the fallback CDN.",primaryError);
        await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
      }
    }
    if(!window.L)throw new Error("Map library is unavailable. Check your connection and retry.");
    if(!window.L.markerClusterGroup){
      try{await loadScript("https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js");}
      catch(error){console.warn("Marker clustering unavailable; standard markers will be used.",error);}
    }
  }
  const OVERPASS_ENDPOINTS=["https://overpass.private.coffee/api/interpreter","https://maps.mail.ru/osm/tools/overpass/api/interpreter","https://overpass-api.de/api/interpreter"];
  const poiCache=new Map();
  const POI_FILTERS={
    all:{label:"All nearby places",selectors:[
      'nwr["amenity"~"school|college|university|hospital|clinic|doctors|pharmacy|bank|atm|fuel|bus_station|place_of_worship|marketplace|restaurant|cafe|fast_food|post_office"]',
      'nwr["leisure"~"park|playground|stadium|sports_centre"]',
      'nwr["shop"~"mall|supermarket|department_store"]',
      'nwr["tourism"~"attraction|museum|hotel|viewpoint"]',
      'nwr["railway"~"station|halt"]',
      'nwr["natural"~"water|wetland"]',
      'nwr["place"~"city|town|village|hamlet|suburb|neighbourhood|isolated_dwelling"]'
    ]},
    education:{label:"Schools & colleges",selectors:['nwr["amenity"~"school|college|university|kindergarten"]']},
    health:{label:"Hospitals & clinics",selectors:['nwr["amenity"~"hospital|clinic|doctors|pharmacy|dentist"]']},
    transport:{label:"Rail & bus",selectors:['nwr["railway"~"station|halt"]','nwr["amenity"~"bus_station|bus_stop"]','nwr["public_transport"~"station|platform|stop_position"]']},
    shopping:{label:"Markets & malls",selectors:['nwr["shop"~"mall|supermarket|department_store|convenience"]','nwr["amenity"="marketplace"]']},
    food:{label:"Restaurants & hotels",selectors:['nwr["amenity"~"restaurant|cafe|fast_food|food_court"]','nwr["tourism"="hotel"]']},
    parks:{label:"Parks & water",selectors:['nwr["leisure"~"park|playground|garden"]','nwr["natural"~"water|wetland"]','nwr["waterway"~"river|lake"]']},
    sports:{label:"Stadiums & sports",selectors:['nwr["leisure"~"stadium|sports_centre|pitch"]','nwr["sport"]']},
    worship:{label:"Temples & worship",selectors:['nwr["amenity"="place_of_worship"]']},
    finance:{label:"Banks & ATMs",selectors:['nwr["amenity"~"bank|atm"]']},
    fuel:{label:"Petrol pumps",selectors:['nwr["amenity"="fuel"]']},
    tourism:{label:"Tourist attractions",selectors:['nwr["tourism"~"attraction|museum|viewpoint|zoo"]']}
  };
  function loadStylesheet(url,attribute){
    const selector='link['+attribute+']';
    if(document.querySelector(selector))return;
    const link=document.createElement("link");link.rel="stylesheet";link.href=url;link.setAttribute(attribute,"true");document.head.appendChild(link);
  }
  function addTiles(map){
    // Use the standard OpenStreetMap raster tiles as the primary basemap.
    // This avoids the third-party vector renderer that was leaving blank tiles
    // in the property picker on some browsers and networks.
    const attribution='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
    const street=window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,
      maxNativeZoom:19,
      updateWhenIdle:true,
      updateWhenZooming:false,
      keepBuffer:3,
      crossOrigin:true,
      attribution
    }).addTo(map);
    map._gdrBaseLayers={street};
  }
  function poiKind(tags){
    tags=tags||{};
    const amenity=String(tags.amenity||"").toLowerCase(),leisure=String(tags.leisure||"").toLowerCase(),tourism=String(tags.tourism||"").toLowerCase();
    if(/school|college|university|kindergarten/.test(amenity))return "education";
    if(/hospital|clinic|doctors|pharmacy|dentist/.test(amenity))return "health";
    if(/bus_station|bus_stop/.test(amenity)||tags.railway||tags.public_transport)return "transport";
    if(/bank|atm/.test(amenity))return "finance";
    if(amenity==="fuel")return "fuel";
    if(amenity==="place_of_worship")return "worship";
    if(/restaurant|cafe|fast_food|food_court/.test(amenity)||tourism==="hotel")return "food";
    if(tags.shop||amenity==="marketplace")return "shopping";
    if(/park|playground|garden/.test(leisure)||tags.natural==="water"||tags.waterway)return "parks";
    if(/stadium|sports_centre|pitch/.test(leisure)||tags.sport)return "sports";
    if(tourism)return "tourism";
    if(tags.place)return "location";
    return "other";
  }
  const POI_ICONS={education:"🎓",health:"🏥",transport:"🚉",shopping:"🛍️",food:"🍽️",parks:"🌳",sports:"🏟️",worship:"🛕",finance:"🏦",fuel:"⛽",tourism:"📍",location:"🏘️",other:"📌"};
  function poiName(tags){
    tags=tags||{};
    return String(tags.name||tags["name:en"]||tags.official_name||tags.operator||tags.amenity||tags.shop||tags.leisure||tags.tourism||"Mapped place");
  }
  function poiQuery(category,bounds){
    const sw=bounds.getSouthWest(),ne=bounds.getNorthEast(),filter=POI_FILTERS[category]||POI_FILTERS.all;
    const clauses=filter.selectors.map(selector=>selector+"("+[sw.lat,sw.lng,ne.lat,ne.lng].map(v=>Number(v).toFixed(5)).join(",")+");").join("\n");
    return "[out:json][timeout:9];("+clauses+");out center tags 160;";
  }
  function poiSearchBounds(map,radiusKm=3){
    const center=map.getCenter(),latDelta=radiusKm/110.574;
    const lngDelta=radiusKm/(111.320*Math.max(.2,Math.cos(center.lat*Math.PI/180)));
    return window.L.latLngBounds([center.lat-latDelta,center.lng-lngDelta],[center.lat+latDelta,center.lng+lngDelta]);
  }
  function poiCacheKey(category,bounds){
    const sw=bounds.getSouthWest(),ne=bounds.getNorthEast();
    return category+":"+[sw.lat,sw.lng,ne.lat,ne.lng].map(v=>Number(v).toFixed(3)).join(",");
  }
  function renderNearbyPlaces(map,places){
    const geo=map&&map._gdrPoi;if(!geo)return;
    geo.layer.clearLayers();
    const center=map.getCenter();
    (Array.isArray(places)?places:[]).forEach(element=>{
      const tags=element&&element.tags||{},centerPoint=element&&element.center||{};
      const lat=asNumber(element&&element.lat!==undefined?element.lat:centerPoint.lat),lng=asNumber(element&&element.lon!==undefined?element.lon:centerPoint.lon);
      if(!validPoint(lat,lng))return;
      const kind=poiKind(tags),icon=POI_ICONS[kind]||POI_ICONS.other,title=poiName(tags);
      const marker=window.L.marker([lat,lng],{icon:window.L.divIcon({className:"gdr-poi-marker-wrap",html:'<span class="gdr-poi-marker" aria-hidden="true">'+icon+'</span>',iconSize:[34,38],iconAnchor:[17,34]}),title,keyboard:true});
      const popup=document.createElement("div");popup.className="gdr-poi-popup";
      const heading=document.createElement("strong");heading.textContent=title;
      const detail=document.createElement("span");detail.textContent=kind.charAt(0).toUpperCase()+kind.slice(1)+" · "+distanceKm([center.lat,center.lng],[lat,lng]).toFixed(2)+" km away";
      // Keep map interactions inside GharDekho; no external detail links or
      // street-imagery redirects are added to property location selection.
      popup.append(heading,detail);marker.bindPopup(popup);geo.layer.addLayer(marker);
    });
    if(geo.status){
      const count=geo.layer.getLayers().length;
      geo.status.textContent=count?count+" nearby places found within 3 km":"No mapped public places found within 3 km";
      geo.status.dataset.state=count?"loaded":"empty";
    }
  }
  async function loadNearbyPlaces(map,force){
    const geo=map&&map._gdrPoi;if(!geo)return false;
    const bounds=poiSearchBounds(map,3);
    if(map.getZoom()<12){
      if(geo.status)geo.status.textContent="Zoom in to a neighbourhood to show nearby places.";
      return false;
    }
    const category="all",key=poiCacheKey(category,bounds),cached=poiCache.get(key);
    if(!force&&cached&&Date.now()-cached.at<300000){renderNearbyPlaces(map,cached.places);return true;}
    if(!force){
      try{
        const stored=JSON.parse(localStorage.getItem("gdr:poi-nearby:v2:"+key)||"null");
        if(stored&&Date.now()-Number(stored.savedAt||0)<12*60*60*1000&&Array.isArray(stored.places)){
          poiCache.set(key,{at:Date.now(),places:stored.places});renderNearbyPlaces(map,stored.places);return true;
        }
      }catch(_){}
    }
    if(geo.request)geo.request.abort();
    const request=new AbortController();geo.request=request;const requestId=++geo.requestId;
    const overallTimer=setTimeout(()=>request.abort(),35000);
    if(geo.status)geo.status.textContent="Loading nearby places…";
    try{
      const query=poiQuery(category,bounds);
      let places=null,lastError=null,emptyResponses=0;
      for(const endpoint of OVERPASS_ENDPOINTS){
        const endpointController=new AbortController();
        const abortWithParent=()=>endpointController.abort();
        if(request.signal.aborted)break;
        request.signal.addEventListener("abort",abortWithParent,{once:true});
        const timer=setTimeout(()=>endpointController.abort(),11000);
        try{
          const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","Accept":"application/json"},body:"data="+encodeURIComponent(query),signal:endpointController.signal});
          if(!response.ok)throw new Error("Nearby-place data returned HTTP "+response.status+".");
          const payload=await response.json();
          if(payload&&payload.remark)throw new Error("Nearby-place service: "+String(payload.remark).slice(0,180));
          if(!payload||!Array.isArray(payload.elements))throw new Error("Nearby-place service returned an invalid response.");
          if(payload.elements.length){places=payload.elements;break;}
          emptyResponses++;
          lastError=new Error("No mapped places from this source. Trying the backup source…");
        }catch(error){
          lastError=error;
          if(request.signal.aborted)break;
        }finally{
          clearTimeout(timer);
          request.signal.removeEventListener("abort",abortWithParent);
        }
      }
      if(places===null&&emptyResponses===OVERPASS_ENDPOINTS.length&&!request.signal.aborted)places=[];
      if(!places)throw lastError||new Error("Nearby-place data is unavailable.");
      if(requestId!==geo.requestId)return false;
      if(poiCache.size>70)poiCache.clear();
      poiCache.set(key,{at:Date.now(),places});
      try{localStorage.setItem("gdr:poi-nearby:v2:"+key,JSON.stringify({savedAt:Date.now(),places}));}catch(_){}
      renderNearbyPlaces(map,places);
      return true;
    }catch(error){
      if(requestId===geo.requestId&&geo.status){geo.status.textContent="Nearby places could not load from the free map services. The map and property pin are ready; try moving the map once to retry.";geo.status.dataset.state="error";}
      return false;
    }finally{clearTimeout(overallTimer);if(requestId===geo.requestId)geo.request=null;}
  }
  function addAutomaticNearbyPlaces(map){
    if(!map||map._gdrPoi||!window.L.layerGroup)return;
    const geo={layer:window.L.layerGroup().addTo(map),category:"all",status:null,statusControl:null,active:true,request:null,requestId:0,timer:null,schedule:null};
    map._gdrPoi=geo;
    if(window.L.control&&window.L.DomUtil){
      const statusControl=window.L.control({position:"topleft"});
      statusControl.onAdd=function(){
        const el=window.L.DomUtil.create("div","gdr-poi-status");
        el.textContent="Finding nearby places…";el.setAttribute("role","status");el.setAttribute("aria-live","polite");
        if(window.L.DomEvent){window.L.DomEvent.disableClickPropagation(el);window.L.DomEvent.disableScrollPropagation(el);}
        geo.status=el;return el;
      };
      statusControl.addTo(map);geo.statusControl=statusControl;
    }
    const schedule=()=>{
      if(geo.timer)clearTimeout(geo.timer);
      geo.timer=setTimeout(()=>{geo.timer=null;loadNearbyPlaces(map,false);},650);
    };
    geo.schedule=schedule;
    map.on("moveend",schedule);
    // Start nearby discovery after the basemap has a real viewport. It is
    // silent and optional: a slow Overpass response never blocks the map.
    if(typeof map.whenReady==="function")map.whenReady(schedule);
    else if(typeof map.getZoom==="function"&&map.getZoom()>=12)schedule();
  }
  function makeLayer(map){
    if(!window.L.markerClusterGroup)return window.L.layerGroup().addTo(map);
    return window.L.markerClusterGroup({
      showCoverageOnHover:false,
      spiderfyOnMaxZoom:true,
      zoomToBoundsOnClick:true,
      // Keep nearby homes grouped only while zoomed out. The cluster badge
      // always exposes the exact number of listings represented by that house.
      // At street-level zoom, separate homes into their own markers.
      maxClusterRadius:function(zoom){
        if(zoom>=16)return 0;
        if(zoom>=13)return 18;
        return 34;
      },
      iconCreateFunction:function(cluster){
        const count=cluster&&typeof cluster.getChildCount==="function"?cluster.getChildCount():0;
        const html='<span class="gdr-home-3d-cluster"><span class="gdr-home-3d-cluster-back"></span><span class="gdr-home-3d-roof"></span><span class="gdr-home-3d-body"><i></i><b></b><em></em></span><span class="gdr-home-3d-base"></span><span class="gdr-home-3d-cluster-count" aria-hidden="true">'+count+'</span></span>';
        return window.L.divIcon({className:"gdr-home-3d-cluster-wrap",html,iconSize:[76,72],iconAnchor:[38,54],title:count+" rental homes in this area"});
      }
    }).addTo(map);
  }
  async function fetchInventory(){const client=db();if(!client)throw new Error("Property service is still loading.");const r=await client.rpc("get_public_properties");if(r.error)throw r.error;state.inventory=(Array.isArray(r.data)?r.data:[]).filter(p=>validPoint(p.latitude,p.longitude));state.loadedOnce=true;return state.inventory;}
  async function fetchBounds(bounds,center,prefs){
    const client=db();if(!client)throw new Error("Property service is not ready.");
    const sw=bounds.getSouthWest(),ne=bounds.getNorthEast(),p=prefs||{};
    const args={
      p_south:Number(sw.lat),p_west:Number(sw.lng),p_north:Number(ne.lat),p_east:Number(ne.lng),
      p_center_lat:Number(center[0]),p_center_lng:Number(center[1]),p_radius_km:Number(state.radiusKm),
      p_min_rent:p.minBudget?Number(p.minBudget):null,
      p_max_rent:p.maxBudget?Number(p.maxBudget):null,
      p_bhk:p.bhk?Number(p.bhk):null,
      p_listing_type:p.stayType||null,
      p_property_type:p.propertyType||null,
      p_furnishing:p.furnishing||null,
      p_limit:200
    };
    const result=await client.rpc("get_available_map_properties_in_bounds",args);
    if(result.error){console.error("Available map search RPC failed:",result.error);throw new Error("Live property search is temporarily unavailable. Please retry in a moment.");}
    const unique=new Map();
    (Array.isArray(result.data)?result.data:[]).forEach(p=>{
      if(!p||!p.id||!validPoint(p.latitude,p.longitude))return;
      if(p.released_at)return;
      const status=String(p.status||"").toLowerCase(),verification=String(p.verification_status||"").toLowerCase();
      if(["occupied","rejected","removed","deleted","unavailable"].includes(status))return;
      if(verification==="verified"&&p.owner_verified!==true)return;
      if(verification==="pending"&&status!=="pending")return;
      if(verification!=="verified"&&verification!=="pending")return;
      if((p.listing_type==="pg"||p.listing_type==="hostel")&&Number(p.available_beds||0)<=0)return;
      if(unique.has(String(p.id)))return;
      const distance=distanceKm(center,[Number(p.latitude),Number(p.longitude)]);
      if(!Number.isFinite(distance)||distance>state.radiusKm||!bounds.contains([Number(p.latitude),Number(p.longitude)]))return;
      unique.set(String(p.id),Object.assign({},p,{gdrDistanceKm:distance}));
    });
    return Array.from(unique.values()).sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm);
  }
  function applyRadius(rows,center){return rows.map(p=>Object.assign({},p,{gdrDistanceKm:distanceKm(center,[Number(p.latitude),Number(p.longitude)])})).filter(p=>p.gdrDistanceKm<=state.radiusKm).sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm);}
  async function reverseGeocodeRenter(lat,lng){
    try{
      const response=await fetch(PHOTON+"reverse?lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lng)+"&lang=en",{headers:{Accept:"application/json"}});
      if(!response.ok)return "";
      const payload=await response.json(),features=Array.isArray(payload&&payload.features)?payload.features:[];
      const feature=features.find(isIndiaPhotonFeature);
      return photonLabel(feature&&feature.properties)||"";
    }catch(error){console.info("Renter pin reverse geocoding unavailable; exact coordinates are retained.",error);return "";}
  }
  async function handleRenterPinDragEnd(event,marker){
    const target=event&&event.target||marker;
    if(!target||typeof target.getLatLng!=="function")return;
    const moved=target.getLatLng(),lat=Number(moved&&moved.lat),lng=Number(moved&&moved.lng);
    if(!validIndiaPoint(lat,lng)){
      if(state.renterPin&&state.searchCenter&&typeof state.renterPin.setLatLng==="function")state.renterPin.setLatLng(state.searchCenter);
      setStatus("The search pin must remain within India. Move it to an Indian location and try again.");
      return;
    }
    const requestId=++state.locationSearchId;
    state.mapSearchId++;
    state.searchCenter=[lat,lng];
    state.resolvedQuery="Selected map location";
    state.searchUsesRadius=true;
    state.boundsRows=[];state.visible=[];state.browseInventory=null;state.browseCenter=null;
    const input=$("gdrMapPlaceSearch");if(input)input.value="Selected map location";
    if(state.renterMap&&typeof state.renterMap.setView==="function"){
      const zoom=typeof state.renterMap.getZoom==="function"?Math.max(12,state.renterMap.getZoom()):13;
      state.renterMap.setView([lat,lng],zoom,{animate:false});
    }
    renderMarkers([],state.searchCenter,false,true);
    setStatus("Pin moved. Finding its locality and nearby homes…");
    const locality=await reverseGeocodeRenter(lat,lng);
    if(requestId!==state.locationSearchId||marker!==state.renterPin)return;
    if(locality){state.resolvedQuery=locality;if(input)input.value=locality;}
    await searchRenterArea(undefined,true);
  }
  function setRenterPin(point,label,options){
    if(!state.renterMap||!validIndiaPoint(point.lat,point.lng))return;
    const settings=options||{};
    state.searchCenter=[Number(point.lat),Number(point.lng)];
    state.resolvedQuery=String(label||"");
    if(state.renterPin){try{state.renterMap.removeLayer(state.renterPin);}catch(_){}state.renterPin=null;}
    const icon=window.L.divIcon({className:"gdr-renter-pin-wrap",html:"<span class='gdr-renter-pin'><i></i></span>",iconSize:[34,42],iconAnchor:[17,38]});
    const marker=window.L.marker(state.searchCenter,{icon,keyboard:true,draggable:true,title:"Selected search location",zIndexOffset:1000}).addTo(state.renterMap);
    state.renterPin=marker;
    if(typeof marker.on==="function")marker.on("dragend",event=>handleRenterPinDragEnd(event,marker));
    if(settings.recenter!==false&&typeof state.renterMap.setView==="function"){
      const zoom=typeof state.renterMap.getZoom==="function"?Math.max(12,state.renterMap.getZoom()):13;
      state.renterMap.setView(state.searchCenter,zoom,{animate:false});
    }
    if(settings.keepResults!==true){
      state.boundsRows=[];state.visible=[];state.browseInventory=null;state.browseCenter=null;
      clearPreview();
      renderMarkers([],state.searchCenter,false,true);
    }
    setStatus((state.resolvedQuery||"Selected map location")+" · Location selected. Tap Search this area to find homes nearby, or drag the pin to adjust the centre.");
  }
  function markerIcon(p,selected){
    const rent=Number(p.rent||0),short=money(rent);
    const pending=p.status==="pending"||p.verification_status==="pending";
    return window.L.divIcon({className:"gdr-home-3d-marker-wrap",html:'<span class="gdr-home-3d-marker'+(pending?" gdr-home-pending":"")+(selected?" gdr-home-selected":"")+'"><span class="gdr-home-3d-roof"></span><span class="gdr-home-3d-body"><i></i><b></b><em></em></span><span class="gdr-home-3d-base"></span><span class="gdr-home-3d-price">'+short+'</span></span>',iconSize:[76,82],iconAnchor:[38,72]});
  }
  function clearPreview(){const p=$("gdrMapPreview");if(p){p.hidden=true;p.replaceChildren();}}
  function showPreview(p){
    const preview=$("gdrMapPreview");if(!preview)return;preview.replaceChildren();
    const main=node("div","gdr-map-preview-main"),img=document.createElement("img");
    img.alt="Property photograph";img.loading="lazy";img.src=safeImage(p.image_url||(Array.isArray(p.photo_urls)?p.photo_urls[0]:""))||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240'%3E%3Crect width='100%25' height='100%25' fill='%23e9f1ee'/%3E%3C/svg%3E";
    const copy=node("div","");
    copy.append(node("h4","",p.title||p.name||"Rental property"),node("p","",[p.location,p.address].filter(Boolean).join(", ")||"Location details available"),node("p","gdr-map-rent",money(p.rent)+" / month"));
    const meta=[p.bhk?p.bhk+" BHK":"",p.furnishing||"",p.listing_type&&p.listing_type!=="home"?p.listing_type.toUpperCase():"Home",Number.isFinite(p.gdrDistanceKm)?p.gdrDistanceKm.toFixed(1)+" km away":""].filter(Boolean).join(" · ");
    copy.append(node("p","",meta));if(Number.isFinite(Number(p.gdrMatchScore)))copy.append(node("p","gdr-map-match-score",p.gdrMatchScore+"% preference match"));copy.append(node("p","",statusOf(p)+" · "+(p.owner_verified?"Verified owner":"Owner verification pending")+" · Owner contact is shared only through the approved visit flow."));
    main.append(img,copy);
    const actions=node("div","gdr-map-preview-actions"),details=node("button","gdr-map-details-btn","View details"),favorite=node("button","gdr-map-details-btn","♡ Save"),compare=node("button","gdr-map-compare-btn","＋ Compare"),close=node("button","gdr-map-dismiss-btn","Close");
    details.type="button";details.addEventListener("click",()=>{
      if(typeof window.openPropertyDetails==="function"){window.openPropertyDetails(p.id);return;}
      if(details.dataset.expanded==="1")return;
      details.dataset.expanded="1";details.textContent="Details shown";
      const description=String(p.description||"").trim();
      const extra=node("div","gdr-map-preview-extra");
      extra.append(node("p","",description||"No additional description has been provided for this listing."));
      extra.append(node("p","",[p.address,p.location].filter(Boolean).join(" · ")));
      extra.append(node("p","", "Property ID: "+p.id));
      copy.append(extra);
    });
    favorite.type="button";favorite.addEventListener("click",async()=>{
      const client=db();if(!client||!client.auth){setStatus("Please sign in as a renter to save this home.");return;}
      favorite.disabled=true;
      try{
        const auth=await client.auth.getUser(),user=auth&&auth.data&&auth.data.user;
        if(!user){setStatus("Please sign in as a renter to save this home.");return;}
        const result=await client.from("saved_properties").upsert({user_id:user.id,property_id:p.id},{onConflict:"user_id,property_id",ignoreDuplicates:true});
        if(result.error)throw result.error;
        favorite.textContent="✓ Saved";setStatus("Property saved to your account.");
      }catch(error){console.error("Could not save map property:",error);setStatus("Could not save this home. Please sign in and try again.");}
      finally{favorite.disabled=false;}
    });
    compare.type="button";compare.addEventListener("click",()=>{if(window.GDRRenterExperience&&typeof window.GDRRenterExperience.toggleCompare==="function")window.GDRRenterExperience.toggleCompare(p);else setStatus("Comparison tools are loading. Please try again.");});
    close.type="button";close.addEventListener("click",clearPreview);actions.append(details,favorite,compare,close);preview.append(main,actions);preview.hidden=false;
  }
  function selectProperty(p,pan){
    if(!p||!p.id)return;
    const previous=state.selectedPropertyId;
    state.selectedPropertyId=String(p.id);
    if(previous&&state.markerById.has(previous)){
      const old=state.visible.find(x=>String(x.id)===previous);
      if(old)state.markerById.get(previous).setIcon(markerIcon(old,false));
    }
    const marker=state.markerById.get(String(p.id));
    if(marker)marker.setIcon(markerIcon(p,true));
    const panel=$("gdrMapListPanel");
    if(panel){
      panel.querySelectorAll("[data-property-id]").forEach(card=>{
        card.classList.toggle("gdr-map-list-card-selected",card.dataset.propertyId===String(p.id));
      });
      const card=Array.from(panel.querySelectorAll("[data-property-id]")).find(x=>x.dataset.propertyId===String(p.id));
      if(card&&panel.offsetParent!==null)card.scrollIntoView({behavior:"smooth",block:"nearest"});
    }
    if(pan&&state.renterMap&&validPoint(p.latitude,p.longitude))state.renterMap.flyTo([Number(p.latitude),Number(p.longitude)],Math.max(16,state.renterMap.getZoom()),{duration:.55});
    showPreview(p);
  }
  function formatListDistance(p){
    if(Number.isFinite(p.gdrDistanceKm)&&p.gdrDistanceKm>=0){
      return "≈ "+(p.gdrDistanceKm<1?Math.round(p.gdrDistanceKm*1000)+" m":p.gdrDistanceKm.toFixed(2)+" km")+" away · straight-line";
    }
    return validPoint(p.latitude,p.longitude)?"Distance unavailable · search location not resolved":"Distance unavailable · no saved map coordinates";
  }
  function openMapResultDetails(p,requestContact){
    if(!p||!p.id)return;
    selectProperty(p,false);
    if(typeof window.openPropertyDetails==="function"){window.openPropertyDetails(p.id);return;}
    if(typeof window.openPropertyDetailsModal==="function"){window.openPropertyDetailsModal(p.id);return;}
    if(requestContact)setStatus("Owner contact is shared through the approved visit/request flow. Open View details to continue.");
  }
  function renderList(rows){
    const panel=$("gdrMapListPanel");if(!panel)return;panel.replaceChildren();
    if(!rows.length){
      const empty=node("div","gdr-map-empty","No rental homes found in this area. Try expanding your search radius.");
      const more=node("button","gdr-map-expand-radius","Expand search radius");
      more.type="button";more.addEventListener("click",()=>setRenterRadius(Math.min(10,Number(state.radiusKm)+1)));
      empty.append(more);panel.append(empty);return;
    }
    rows.forEach((p,index)=>{
      const item=node("article","gdr-map-list-item");item.dataset.propertyId=String(p.id);
      const b=node("button","gdr-map-list-card","");b.type="button";b.dataset.propertyId=String(p.id);
      b.setAttribute("aria-label","View "+(p.title||p.name||"rental property")+" details");
      if(String(p.id)===state.selectedPropertyId)b.classList.add("gdr-map-list-card-selected");
      const img=document.createElement("img");img.loading="lazy";img.alt="Property photograph";
      img.src=safeImage(p.image_url||(Array.isArray(p.photo_urls)?p.photo_urls[0]:""))||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23e9f1ee'/%3E%3C/svg%3E";
      const copy=node("span","gdr-map-list-copy");
      copy.append(
        node("strong","gdr-map-list-title",(index+1)+". "+(p.title||p.name||"Rental property")),
        node("small","",[(p.location||p.address),p.bhk?p.bhk+" BHK":"",p.furnishing||"",formatListDistance(p)].filter(Boolean).join(" · ")),
        node("b","",money(p.rent)+" / month"),
        node("small","",statusOf(p)+(p.owner_verified?" · Verified owner":" · Owner verification pending"))
      );
      b.append(img,copy);b.addEventListener("click",()=>selectProperty(p,true));
      const actions=node("div","gdr-map-list-actions");
      const details=node("button","gdr-map-list-action gdr-map-list-action-primary","View details");
      details.type="button";details.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openMapResultDetails(p,false);});
      const contact=node("button","gdr-map-list-action","Contact / request visit");
      contact.type="button";contact.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openMapResultDetails(p,true);});
      actions.append(details,contact);item.append(b,actions);panel.append(item);
    });
  }
  function renderMarkers(rows,center,showRadius,preservePin,listRowsOverride){
    if(!state.renterMap||!state.renterLayer)return;
    state.renterLayer.clearLayers();state.markerById.clear();
    if(state.radiusCircle){state.renterMap.removeLayer(state.radiusCircle);state.radiusCircle=null;}
    if(showRadius!==false)state.radiusCircle=window.L.circle(center,{radius:state.radiusKm*1000,color:"#c8a96b",weight:2,opacity:.9,fillColor:"#c8a96b",fillOpacity:.07,dashArray:"6 6"}).addTo(state.renterMap);
    if(state.renterPin&&preservePin===false){state.renterMap.removeLayer(state.renterPin);state.renterPin=null;}
    rows.forEach(p=>{
      if(!p||!validPoint(p.latitude,p.longitude))return;
      const marker=window.L.marker([Number(p.latitude),Number(p.longitude)],{
        icon:markerIcon(p,String(p.id)===state.selectedPropertyId),keyboard:true,
        title:(p.title||p.name||"GharDekho home")+" · "+money(p.rent)+"/month"
      });
      marker.on("click",()=>selectProperty(p,true));state.renterLayer.addLayer(marker);state.markerById.set(String(p.id),marker);
    });
    const listRows=Array.isArray(listRowsOverride)?listRowsOverride:rows;
    state.visible=listRows;renderList(listRows);
    const mappedCount=rows.filter(p=>p&&validPoint(p.latitude,p.longitude)).length;
    const count=$("gdrMapCount");if(count)count.textContent=Array.isArray(listRowsOverride)?mappedCount+" map pins · "+listRows.length+" results":listRows.length+" "+(listRows.length===1?"home":"homes")+" found";
    if(!rows.length){
      if(listRows.length){
        setStatus(listRows.length+" matching homes remain available in the list. No properties are pinned in the current map view.");
        const expand=$("gdrMapExpandRadius");if(expand)expand.hidden=true;return;
      }
      clearPreview();setStatus("No rental homes found in this area. Try expanding your search radius.");
      const expand=$("gdrMapExpandRadius");if(expand)expand.hidden=false;return;
    }
    setStatus(mappedCount+" homes pinned near "+(state.resolvedQuery||"the map center")+". "+listRows.length+" matching results remain in the list.");
    const expand=$("gdrMapExpandRadius");if(expand)expand.hidden=true;
  }
  function filterBrowseInventoryToBounds(rows,bounds,center,prefs){
    const p=prefs||{},origin=[Number(center[0]),Number(center[1])];
    return (Array.isArray(rows)?rows:[]).filter(row=>{
      if(!row||!row.id||!validPoint(row.latitude,row.longitude))return false;
      const point=[Number(row.latitude),Number(row.longitude)];
      if(!bounds.contains(point))return false;
      const status=String(row.status||"").toLowerCase(),verification=String(row.verification_status||"").toLowerCase();
      if(["occupied","rejected","removed","deleted","unavailable","released"].includes(status)||row.released_at)return false;
      if(verification==="verified"&&row.owner_verified!==true)return false;
      if(verification==="pending"&&status!=="pending")return false;
      if(verification!=="verified"&&verification!=="pending")return false;
      if((row.listing_type==="pg"||row.listing_type==="hostel")&&Number(row.available_beds||0)<=0)return false;
      if(p.minBudget&&Number(row.rent)<Number(p.minBudget))return false;
      if(p.maxBudget&&Number(row.rent)>Number(p.maxBudget))return false;
      if(p.bhk&&Number(row.bhk)!==Number(p.bhk))return false;
      if(p.furnishing&&String(row.furnishing||"").toLowerCase()!==String(p.furnishing).toLowerCase())return false;
      if(p.stayType&&String(row.listing_type||"home").toLowerCase()!==String(p.stayType).toLowerCase())return false;
      if(p.propertyType&&String(row.property_type||"").toLowerCase()!==String(p.propertyType).toLowerCase())return false;
      return true;
    }).map(row=>Object.assign({},row,{gdrDistanceKm:distanceKm(origin,[Number(row.latitude),Number(row.longitude)])}))
      .sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm);
  }
  function sortBrowseInventoryForList(rows,center){
    const origin=Array.isArray(center)&&validPoint(center[0],center[1])?center:null,seen=new Set(),entries=[];
    (Array.isArray(rows)?rows:[]).forEach((row,index)=>{
      if(!row||!row.id||seen.has(String(row.id)))return;
      seen.add(String(row.id));
      let distance=null;
      if(origin&&validPoint(row.latitude,row.longitude))distance=distanceKm(origin,[Number(row.latitude),Number(row.longitude)]);
      else if(!origin){const stored=asNumber(row.distance_km);if(stored!==null&&stored>=0)distance=stored;}
      entries.push({row:Object.assign({},row,{gdrDistanceKm:Number.isFinite(distance)?distance:null}),index});
    });
    entries.sort((a,b)=>{
      const ad=Number.isFinite(a.row.gdrDistanceKm),bd=Number.isFinite(b.row.gdrDistanceKm);
      if(ad&&bd)return (a.row.gdrDistanceKm-b.row.gdrDistanceKm)||(a.index-b.index);
      if(ad!==bd)return ad?-1:1;
      return a.index-b.index;
    });
    return entries.map(entry=>entry.row);
  }
  function renderBrowseViewport(){
    if(!state.renterMap||!Array.isArray(state.browseInventory))return false;
    const bounds=state.renterMap.getBounds(),center=state.renterMap.getCenter();
    if(!bounds||typeof bounds.contains!=="function"||!validPoint(center.lat,center.lng))return false;
    const origin=[Number(center.lat),Number(center.lng)];
    const rows=filterBrowseInventoryToBounds(state.browseInventory,bounds,origin,state.currentPrefs);
    const listRows=sortBrowseInventoryForList(state.browseInventory,state.browseCenter);
    renderMarkers(rows,origin,false,true,listRows);
    const total=state.browseInventory.filter(p=>p&&validPoint(p.latitude,p.longitude)).length;
    if(rows.length){
      setStatus("Showing "+rows.length+" of "+total+" mapped homes in the current map view. All "+listRows.length+" matching results remain in the distance-sorted list.");
    }else{
      setStatus("No mapped homes in this view. All "+listRows.length+" matching results remain available in the list below.");
    }
    const count=$("gdrMapCount");if(count)count.textContent=rows.length+" visible map pins · "+listRows.length+" list results";
    return rows;
  }
  function showVoiceSearchResults(rows,point,label){
    if(!state.renterMap)return {total:0,mapped:0,unmapped:0};
    const items=Array.isArray(rows)?rows.filter(p=>p&&p.id):[];
    state.boundsRows=items.slice();
    state.browseInventory=items.slice();
    const hasPoint=point&&validPoint(point.lat,point.lng);
    const coordinates=items.filter(p=>validPoint(p.latitude,p.longitude)).map(p=>[Number(p.latitude),Number(p.longitude)]);
    let center;
    if(hasPoint){
      center=[Number(point.lat),Number(point.lng)];
      state.searchCenter=center;
      state.browseCenter=center.slice();
      state.resolvedQuery=String(label||point.label||"Voice search");
    }else{
      const current=state.renterMap.getCenter();
      center=[Number(current.lat),Number(current.lng)];
      state.searchCenter=center;
      state.browseCenter=null;
      state.resolvedQuery=String(label||"Voice search");
    }
    if(typeof state.renterMap.invalidateSize==="function")state.renterMap.invalidateSize({pan:false});
    if(coordinates.length>1&&typeof state.renterMap.fitBounds==="function"){
      state.renterMap.fitBounds(coordinates,{padding:[48,48],maxZoom:15,animate:false});
    }else if(coordinates.length===1){
      state.renterMap.setView(coordinates[0],16,{animate:false});
      center=coordinates[0];
      state.searchCenter=center;
    }else if(hasPoint){
      const kind=String(point.properties&&(point.properties.type||point.properties.osm_value)||"").toLowerCase();
      const cityLike=["city","town","administrative"].includes(kind);
      state.renterMap.setView(center,cityLike?11:14,{animate:false});
    }
    const listRows=sortBrowseInventoryForList(items,state.browseCenter);
    const mappedItems=items.filter(p=>p&&validPoint(p.latitude,p.longitude));
    renderMarkers(mappedItems,center,false,false,listRows);
    if(hasPoint)setRenterPin(point,label||point.label||"Voice search",{keepResults:true,recenter:false});
    const mapped=coordinates.length,unmapped=Math.max(0,items.length-mapped);
    const count=$("gdrMapCount");
    if(count)count.textContent=mapped+" map pins · "+items.length+" results";
    setStatus(items.length+" matching homes found for "+(label||"your voice search")+". "+mapped+" displayed as price markers on the map"+(unmapped?"; "+unmapped+" listings without saved map coordinates remain in the list.":"")+" Results are sorted by approximate straight-line distance.");
    const expand=$("gdrMapExpandRadius");if(expand)expand.hidden=true;
    return {total:items.length,mapped,unmapped};
  }
  function applyRenterFilters(prefs){
    prefs=prefs||state.currentPrefs||{};
    state.currentPrefs=Object.assign({},prefs);
    if(!state.searchCenter||!Array.isArray(state.boundsRows))return [];
    let rows=applyRadius(state.boundsRows,state.searchCenter);
    if(prefs.minBudget)rows=rows.filter(p=>Number(p.rent)>=Number(prefs.minBudget));
    if(prefs.maxBudget)rows=rows.filter(p=>Number(p.rent)<=Number(prefs.maxBudget));
    if(prefs.bhk)rows=rows.filter(p=>Number(p.bhk)===Number(prefs.bhk));
    if(prefs.furnishing)rows=rows.filter(p=>String(p.furnishing||"").toLowerCase()===String(prefs.furnishing).toLowerCase());
    if(prefs.stayType)rows=rows.filter(p=>String(p.listing_type||"home").toLowerCase()===String(prefs.stayType).toLowerCase());
    if(prefs.propertyType)rows=rows.filter(p=>String(p.property_type||"").toLowerCase()===String(prefs.propertyType).toLowerCase());
    rows=rows.map(p=>Object.assign({},p,{gdrMatchScore:100}));
    renderMarkers(rows,state.searchCenter);return rows;
  }
  function radiusBounds(center){
    const lat=Number(center[0]),lng=Number(center[1]),latDelta=state.radiusKm/111.32;
    const cos=Math.max(.15,Math.cos(lat*Math.PI/180)),lngDelta=state.radiusKm/(111.32*cos);
    const south=Math.max(-90,lat-latDelta),north=Math.min(90,lat+latDelta);
    const west=Math.max(-180,lng-lngDelta),east=Math.min(180,lng+lngDelta);
    return {
      getSouthWest:()=>({lat:south,lng:west}),
      getNorthEast:()=>({lat:north,lng:east}),
      contains:point=>point[0]>=south&&point[0]<=north&&point[1]>=west&&point[1]<=east
    };
  }
  async function photonGeocode(query){
    const url=PHOTON+"?limit=8&lang=en&q="+encodeURIComponent(query);
    const response=await fetch(url,{headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error("Location search service is unavailable.");
    const payload=await response.json(),features=Array.isArray(payload.features)?payload.features:[];
    return features.filter(isIndiaPhotonFeature);
  }
  function normalizedText(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
  function isIndiaPhotonFeature(feature){
    const props=feature&&feature.properties||{},coords=feature&&feature.geometry&&feature.geometry.coordinates||[];
    if(!Array.isArray(coords)||coords.length<2)return false;
    const lat=Number(coords[1]),lng=Number(coords[0]);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<5||lat>38.8||lng<67||lng>98.2)return false;
    const country=normalizedText(props.country),countryCode=String(props.countrycode||"").toLowerCase();
    if(countryCode&&countryCode!=="in")return false;
    if(country&&!country.includes("india"))return false;
    return true;
  }
  function rankPhotonFeatures(features,query){
    const q=normalizedText(query),tokens=q.split(" ").filter(t=>t.length>1&&t!=="india");
    return (Array.isArray(features)?features:[]).filter(isIndiaPhotonFeature).map((feature,index)=>{
      const p=feature&&feature.properties||{};
      const fields=[p.name,p.street,p.locality,p.district,p.county,p.city,p.state,p.postcode].map(normalizedText).filter(Boolean);
      let score=100+index;
      if(fields.includes(q))score=0;
      else if(normalizedText(p.name)===q)score=1;
      else if(normalizedText(p.city)===q||normalizedText(p.locality)===q)score=2;
      else if(normalizedText(p.district)===q||normalizedText(p.county)===q)score=3;
      else if(tokens.length&&tokens.every(t=>fields.some(field=>field.includes(t))))score=10;
      else if(fields.some(field=>field.includes(q)))score=20;
      return {feature,score,index};
    }).sort((a,b)=>a.score-b.score||a.index-b.index).map(item=>item.feature);
  }

  const POSTAL_COORD_CACHE_TTL=30*24*60*60*1000;
  function postalOfficeNameKey(value){
    const clean=String(value||"")
      .replace(/\b(?:branch\s+office|sub\s+office|head\s+office)\b/gi," ")
      .replace(/\b(?:B|S|H)\s*\.?\s*O\.?\b/gi," ");
    return normalizedText(clean);
  }
  async function lookupPostalApiCoordinates(pin,officeRecords,stateName,districtName){
    const officeNames=(Array.isArray(officeRecords)?officeRecords:[officeRecords])
      .map(item=>typeof item==="string"?item:(item&&(item.Name||item.office_name||item.officeName||item.name))||"")
      .map(value=>String(value||"").trim()).filter(Boolean);
    const officeKeys=Array.from(new Set(officeNames.map(postalOfficeNameKey).filter(value=>value.length>=3)));
    if(!/^\d{6}$/.test(String(pin||"")))return null;
    const cacheKey="gdr:postal-office-coordinate:v2:"+pin;
    const validCached=value=>value&&value.pincode===String(pin)&&Date.now()-Number(value.cachedAt||0)<POSTAL_COORD_CACHE_TTL&&validIndiaPoint(Number(value.lat),Number(value.lng));
    try{const saved=JSON.parse(localStorage.getItem(cacheKey)||"null");if(validCached(saved))return saved;}catch(_){}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
    try{
      const response=await fetch("https://api.pincodeapi.in/api/v1/pincode/"+encodeURIComponent(pin),{headers:{Accept:"application/json"},signal:controller.signal});
      if(!response.ok)return null;
      const payload=await response.json(),rows=payload&&payload.success===true&&payload.data&&Array.isArray(payload.data.post_offices)?payload.data.post_offices:[];
      const expectedState=normalizedText(stateName),expectedDistrict=normalizedText(districtName);
      const matches=rows.map(row=>{
        // This API request is scoped to /pincode/{pin}; tolerate a missing
        // per-row PIN field instead of discarding all returned office records.
        const rowPin=String(row&&(row.pincode||row.pin_code||row.postal_code)||pin);
        const rowName=postalOfficeNameKey(row&&(row.office_name||row.officeName||row.name)||"");
        const rowState=normalizedText(row&&(row.state||row.state_name||row.stateName)||"");
        const rowDistrict=normalizedText(row&&(row.district||row.district_name||row.districtName)||"");
        const lat=Number(row&&row.latitude),lng=Number(row&&row.longitude);
        const nameScore=officeKeys.reduce((best,key,index)=>{
          if(!rowName||!key)return best;
          const preferredOfficeBonus=Math.max(0,200-index*20);
          if(rowName===key)return Math.max(best,preferredOfficeBonus+30);
          if(rowName.includes(key)||key.includes(rowName))return Math.max(best,preferredOfficeBonus+20);
          const parts=key.split(" ").filter(part=>part.length>=4);
          const overlap=parts.filter(part=>rowName.includes(part)).length;
          return Math.max(best,parts.length?preferredOfficeBonus+Math.round(overlap/parts.length*10):0);
        },0);
        const stateMatch=!expectedState||!rowState||rowState===expectedState||rowState.includes(expectedState)||expectedState.includes(rowState);
        const districtMatch=!expectedDistrict||!rowDistrict||rowDistrict===expectedDistrict||rowDistrict.includes(expectedDistrict)||expectedDistrict.includes(rowDistrict);
        const type=String(row&&(row.office_type||row.officeType||row.type)||"").toUpperCase();
        const delivery=normalizedText(row&&(row.delivery_status||row.deliveryStatus)||"")==="delivery";
        const score=nameScore+(stateMatch?20:0)+(districtMatch?10:0)+(type==="SO"?8:type==="HO"?6:type==="BO"?2:0)+(delivery?3:0);
        return {row,rowPin,lat,lng,stateMatch,districtMatch,score};
      }).filter(item=>item.rowPin===String(pin)&&item.stateMatch&&item.districtMatch&&validIndiaPoint(item.lat,item.lng)).sort((a,b)=>b.score-a.score);
      if(!matches.length)return null;
      const best=matches[0],result={pincode:String(pin),officeName:String(best.row.office_name||best.row.officeName||best.row.name||officeNames[0]||""),district:String(best.row.district||best.row.district_name||districtName||""),state:String(best.row.state||best.row.state_name||stateName||""),lat:best.lat,lng:best.lng,cachedAt:Date.now()};
      try{localStorage.setItem(cacheKey,JSON.stringify(result));}catch(_){}
      return result;
    }catch(error){if(error&&error.name!=="AbortError")console.warn("Postal coordinate fallback unavailable:",error);return null;}
    finally{clearTimeout(timer);}
  }
  function preferredPinOffice(offices){
    const rows=Array.isArray(offices)?offices.filter(item=>item&&item.Name):[];
    return rows.find(item=>/sub office/i.test(String(item.BranchType||item.OfficeType||"")))
      ||rows.find(item=>/branch office/i.test(String(item.BranchType||item.OfficeType||""))&&/delivery/i.test(String(item.DeliveryStatus||"")))
      ||rows.find(item=>/delivery/i.test(String(item.DeliveryStatus||"")))
      ||rows.find(item=>/branch office/i.test(String(item.BranchType||item.OfficeType||"")))
      ||rows.find(item=>/head office/i.test(String(item.BranchType||item.OfficeType||"")))
      ||rows[0];
  }
  async function resolveMapQuery(query){
    const q=String(query||"").trim();
    if(!q)throw new Error("Enter a city, locality or six-digit PIN code first.");
    let features=[],expectedDistrict="",expectedState="",pin=q,preferredLabel=q,usedPostalCoordinateFallback=false,usedDistrictFallback=false;
    if(/^\d{6}$/.test(q)){
      setStatus("Verifying PIN "+pin+" with India Post…");
      const response=await fetch("https://api.postalpincode.in/pincode/"+encodeURIComponent(pin),{headers:{Accept:"application/json"}});
      if(!response.ok)throw new Error("India Post PIN lookup is unavailable. Try the locality or city name.");
      const data=await response.json(),record=Array.isArray(data)?data[0]:null;
      const offices=record&&record.Status==="Success"&&Array.isArray(record.PostOffice)?record.PostOffice.filter(x=>x&&x.Name):[];
      if(!offices.length)throw new Error("PIN "+pin+" was not found. Check the six digits and try again.");
      const office=preferredPinOffice(offices);
      expectedDistrict=String(office.District||office.Block||"").trim();
      expectedState=String(office.State||"").trim();
      const locality=String(office.Name||expectedDistrict).trim();
      preferredLabel=[locality,expectedDistrict,expectedState,"India"].filter(Boolean).join(", ");
      setStatus("PIN "+pin+" belongs to "+[locality,expectedDistrict,expectedState].filter(Boolean).join(", ")+". Finding its map coordinates…");
      const district=normalizedText(expectedDistrict),stateName=normalizedText(expectedState);
      const officeNames=offices.map(item=>String(item&&item.Name||"").trim()).filter(Boolean);
      const postalMatches=(rows,allowDistrictFallback)=> (Array.isArray(rows)?rows:[]).map(feature=>{
        const p=feature&&feature.properties||{},coords=feature&&feature.geometry&&feature.geometry.coordinates||[];
        const postcode=normalizedText(p.postcode),country=normalizedText(p.country),countryCode=String(p.countrycode||"").toLowerCase();
        const stateFields=[p.state,p.state_name,p.region].map(normalizedText).filter(Boolean);
        const localityFields=[p.name,p.locality,p.suburb,p.village,p.town,p.city,p.district,p.county].map(normalizedText).filter(Boolean);
        const preferredOfficeKey=normalizedText(office.Name||"");
        const preferredOfficeMatch=!!preferredOfficeKey&&localityFields.some(value=>value===preferredOfficeKey||value.includes(preferredOfficeKey)||preferredOfficeKey.includes(value));
        const officeMatch=officeNames.some(name=>{const key=normalizedText(name);return key&&localityFields.some(value=>value===key||value.includes(key)||key.includes(value));});
        const postcodeMatch=postcode===normalizedText(pin);
        const stateMatch=!!stateName&&(!stateFields.length||stateFields.some(value=>value.includes(stateName)||stateName.includes(value)));
        const countryMatch=countryCode==="in"||country==="india"||(!countryCode&&!country&&stateMatch);
        const districtFields=[p.district,p.county,p.city,p.locality,p.name,p.state_district].map(normalizedText).filter(Boolean);
        const districtMatch=!!district&&districtFields.some(value=>value.includes(district)||district.includes(value));
        const score=(preferredOfficeMatch?1400:0)+(officeMatch?600:0)+(postcodeMatch?300:0)+(stateMatch?25:0)+(districtMatch?10:0);
        return {feature,officeMatch,postcodeMatch,stateMatch,countryMatch,districtMatch,score,coords};
      }).filter(item=>{
        if(!item.countryMatch||!item.stateMatch)return false;
        if(!Array.isArray(item.coords)||!validIndiaPoint(item.coords[1],item.coords[0]))return false;
        return item.officeMatch||item.postcodeMatch||(allowDistrictFallback&&item.districtMatch);
      }).sort((a,b)=>b.score-a.score).map(item=>item.feature);
      const queries=Array.from(new Set([
        [locality,expectedDistrict,expectedState,"India"],
        [locality,expectedState,"India"],
        [pin,locality,expectedDistrict,expectedState,"India"],
        ...officeNames.slice(0,3).map(name=>[name,expectedDistrict,expectedState,"India"]),
        [pin,expectedDistrict,expectedState,"India"]
      ].map(parts=>parts.filter(Boolean).join(", "))));
      for(const candidate of queries){
        try{
          const matches=postalMatches(await photonGeocode(candidate),false);
          if(matches.length){features=matches;break;}
        }catch(error){console.warn("PIN geocoding attempt failed:",error);}
      }
      if(!features.length){
        const prioritizedOffices=[office,...offices.filter(item=>item!==office)];
        const postalPoint=await lookupPostalApiCoordinates(pin,prioritizedOffices,expectedState,expectedDistrict);
        if(postalPoint){
          features=[{geometry:{coordinates:[postalPoint.lng,postalPoint.lat]},properties:{name:postalPoint.officeName||locality,locality:locality,city:expectedDistrict,district:expectedDistrict,state:postalPoint.state||expectedState,postcode:pin,country:"India",countrycode:"in"}}];
          usedPostalCoordinateFallback=true;
        }
      }
      if(!features.length&&expectedDistrict){
        try{
          const districtFeatures=await photonGeocode([expectedDistrict,expectedState,"India"].filter(Boolean).join(", "));
          features=postalMatches(districtFeatures,true);
          usedDistrictFallback=features.length>0;
        }catch(error){console.warn("PIN district-centre fallback unavailable:",error);}
      }
      if(!features.length)throw new Error("PIN "+pin+" was verified for "+locality+", "+expectedDistrict+", "+expectedState+", but map coordinates are not available. The PIN is valid; try Select on Map and search the locality.");
    }else{
      features=await photonGeocode(q+", India");
      if(!features.length)throw new Error("We could not locate “"+q+"”. Try a nearby locality, city or PIN code.");
    }
    const rankingQuery=/^\d{6}$/.test(q)?preferredLabel:q;
    const ranked=rankPhotonFeatures(features,rankingQuery),feature=ranked[0];
    if(!feature)throw new Error("We could not verify the requested location. Try adding the district or PIN code.");
    const coords=feature.geometry.coordinates,props=feature.properties||{};
    const label=/^\d{6}$/.test(q)?preferredLabel:(photonLabel(props)||preferredLabel);
    if(usedDistrictFallback)setStatus("PIN "+pin+" verified · "+preferredLabel+". The map is centred on the verified district as an approximate starting point; adjust the pin to the exact property entrance.");
    else if(usedPostalCoordinateFallback)setStatus("PIN "+pin+" verified · "+preferredLabel+". The map is centred using the PIN-specific postal coordinate record; adjust the pin to the exact property entrance.");
    return {lat:Number(coords[1]),lng:Number(coords[0]),label,query:q,properties:props,coordinateSource:usedDistrictFallback?"district-centre":usedPostalCoordinateFallback?"postal-coordinate":"map-feature"};
  }
  async function searchTypedMapLocation(){
    const input=$("gdrMapPlaceSearch"),query=String(input&&input.value||"").trim();
    if(!query)return searchRenterArea();
    const locationSearchId=++state.locationSearchId,button=$("gdrMapSearchAreaBtn");
    if(button){button.disabled=true;button.textContent="Locating…";}
    state.boundsRows=[];state.visible=[];state.browseInventory=null;state.browseCenter=null;
    state.resolvedQuery="";
    if(state.renterMap){
      if(state.renterPin){try{state.renterMap.removeLayer(state.renterPin);}catch(_){}state.renterPin=null;}
      if(state.radiusCircle){try{state.renterMap.removeLayer(state.radiusCircle);}catch(_){}state.radiusCircle=null;}
      state.searchCenter=INDIA_CENTER.slice();
      state.renterMap.setView(INDIA_CENTER,5,{animate:false});
      renderMarkers([],INDIA_CENTER);
    }
    setStatus("Finding "+query+" on the map…");
    try{
      const point=await resolveMapQuery(query);
      if(locationSearchId!==state.locationSearchId)return false;
      setRenterPin(point,point.label||query);
      const kind=String(point.properties&&(point.properties.type||point.properties.osm_value)||"").toLowerCase();
      const cityLike=["city","town","administrative"].includes(kind);
      const targetZoom=point.coordinateSource==="district-centre"?10:(cityLike?11:14);
      state.renterMap.setView(state.searchCenter,targetZoom,{animate:false});
      state.resolvedQuery=point.label||query;
      const results=await searchRenterArea(undefined,true);
      if(locationSearchId!==state.locationSearchId)return false;
      const mapped=(Array.isArray(results)?results:[]).filter(row=>row&&validPoint(row.latitude,row.longitude))
        .map(row=>[Number(row.latitude),Number(row.longitude)]);
      if(mapped.length>1&&typeof state.renterMap.fitBounds==="function"){
        state.renterMap.fitBounds(mapped,{padding:[56,56],maxZoom:13,animate:false});
      }else if(mapped.length===1){
        state.renterMap.setView(mapped[0],Math.min(15,Math.max(12,state.renterMap.getZoom())),{animate:false});
      }
      return results;
    }catch(error){
      if(locationSearchId!==state.locationSearchId)return false;
      console.warn("GDR map location search failed:",error);
      state.boundsRows=[];state.visible=[];renderMarkers([],state.searchCenter||INDIA_CENTER);
      setStatus(error.message||"This location could not be found. Try another city, locality or PIN code.");
      return false;
    }finally{if(locationSearchId===state.locationSearchId&&button){button.disabled=false;button.textContent="Search this area";}}
  }
  async function searchRenterArea(prefs,useRadiusBounds){
    if(!state.renterMap)return false;
    state.browseInventory=null;state.browseCenter=null;
    if(state.browseTimer){clearTimeout(state.browseTimer);state.browseTimer=null;}
    if(prefs)state.currentPrefs=Object.assign({},prefs);
    const requestId=++state.mapSearchId,button=$("gdrMapSearchAreaBtn");
    if(button){button.disabled=true;button.textContent="Searching…";}
    setStatus("Searching available homes within "+state.radiusKm+" km…");
    try{
      const mapCenter=state.renterMap.getCenter();
      if(!validPoint(mapCenter.lat,mapCenter.lng))throw new Error("The map center is not a valid location.");
      state.searchUsesRadius=useRadiusBounds===undefined?state.searchUsesRadius:!!useRadiusBounds;
      const center=state.searchUsesRadius&&Array.isArray(state.searchCenter)&&validIndiaPoint(state.searchCenter[0],state.searchCenter[1])
        ?state.searchCenter.slice()
        :[Number(mapCenter.lat),Number(mapCenter.lng)];
      const pinLocation=state.renterPin&&typeof state.renterPin.getLatLng==="function"?state.renterPin.getLatLng():null;
      const pinIsAligned=pinLocation&&distanceKm(center,[Number(pinLocation.lat),Number(pinLocation.lng)])<=.025;
      if(!pinIsAligned)setRenterPin({lat:center[0],lng:center[1]},"Selected map area",{keepResults:true,recenter:false});
      state.searchCenter=center;
      const bounds=state.searchUsesRadius?radiusBounds(state.searchCenter):state.renterMap.getBounds();
      if(!bounds||!bounds.getSouthWest||!bounds.getNorthEast)throw new Error("Map boundaries are unavailable. Move or zoom the map and retry.");
      state.lastSearchBounds=bounds;
      const rows=await fetchBounds(bounds,state.searchCenter,state.currentPrefs);
      if(requestId!==state.mapSearchId)return false;
      state.boundsRows=rows;
      const visible=applyRenterFilters(state.currentPrefs);
      if(!visible.length)setStatus("No rental homes found within "+state.radiusKm+" km. Try increasing the radius or moving the map.");
      return visible;
    }catch(error){
      if(requestId!==state.mapSearchId)return false;
      console.error("GDR map search failed:",error);
      state.boundsRows=[];state.visible=[];
      renderMarkers([],state.searchCenter||INDIA_CENTER);
      setStatus(error&&error.message?error.message:"Properties could not be loaded. Please try again.");
      return false;
    }finally{if(requestId===state.mapSearchId&&button){button.disabled=false;button.textContent="Search this area";}}
  }
  function setRenterSearchPreferences(prefs){state.currentPrefs=Object.assign({},prefs||{});return state.currentPrefs;}
  function setRenterRadius(value,skipSearch){
    const next=Number(value);
    if(!Number.isFinite(next)){throw new Error("Choose a valid search radius.");}
    state.radiusKm=Math.max(.5,Math.min(10,next));
    const input=$("gdrMapRadius"),label=$("gdrMapRadiusValue");
    if(input)input.value=String(state.radiusKm);
    if(label)label.textContent=state.radiusKm<1?Math.round(state.radiusKm*1000)+" m":state.radiusKm+" km";
    if(!skipSearch&&state.renterMap&&state.searchCenter)return searchRenterArea(undefined,state.searchUsesRadius);
    return Promise.resolve(state.visible.slice());
  }
  async function searchAtCoordinates(lat,lng,label){
    if(!validPoint(lat,lng)||!state.renterMap)throw new Error("A valid map location is required.");
    setRenterPin({lat:Number(lat),lng:Number(lng)},label||"Selected location");
    const target=window.L.latLng(Number(lat),Number(lng)),current=state.renterMap.getCenter();
    if(current.distanceTo(target)>25){
      await new Promise(resolve=>{state.renterMap.once("moveend",resolve);state.renterMap.flyTo(target,15,{duration:.65});});
    }else state.renterMap.setView(target,Math.max(15,state.renterMap.getZoom()),{animate:false});
    return searchRenterArea(undefined,true);
  }
  function locateRenter(){
    if(!navigator.geolocation){setStatus("This browser does not support location. Search for a city or locality instead.");return;}
    setStatus("Requesting your location permission…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude),accuracy=Number(pos.coords.accuracy);
      if(!validPoint(lat,lng)){setStatus("Your device returned an invalid GPS location. Search for a locality instead.");return;}
      setRenterPin({lat,lng},"My location");
      state.renterMap.setView(state.searchCenter,13,{animate:true});
      setStatus("GPS location found"+(Number.isFinite(accuracy)?" (±"+Math.round(accuracy)+" m)":"")+". Searching all available homes within "+state.radiusKm+" km…");
      await searchRenterArea(undefined,true);
    },error=>{
      const message=error.code===1?"Location permission is blocked. Click the location icon beside the website address, allow Location, then try My Location again.":error.code===3?"GPS timed out. Turn on device Location Services and try again.":"Your current location could not be determined. Check device location services and retry.";
      setStatus(message);
    },{enableHighAccuracy:true,timeout:20000,maximumAge:30000});
  }
  function initRenterMap(){
    if(state.renterMap)return;
    const canvas=$("gdrExploreMapCanvas");if(!canvas)return;
    state.renterMap=window.L.map(canvas,{zoomControl:false,scrollWheelZoom:true,preferCanvas:true,touchZoom:true,dragging:true,tap:true,keyboard:true});
    addTiles(state.renterMap);
    window.L.control.zoom({position:"bottomright"}).addTo(state.renterMap);
    state.renterLayer=makeLayer(state.renterMap);
    addAutomaticNearbyPlaces(state.renterMap);
    state.renterMap.setView(INDIA_CENTER,5);
    state.renterMap.on("click",e=>{
      state.searchUsesRadius=true;
      setRenterPin(e.latlng,"Selected map location");
    });
    state.renterMap.on("moveend",()=>{
      if(Array.isArray(state.browseInventory)){
        if(state.browseTimer)clearTimeout(state.browseTimer);
        state.browseTimer=setTimeout(()=>{state.browseTimer=null;renderBrowseViewport();},120);
        return;
      }
      const status=$("gdrMapStatus");
      if(status&&state.visible.length)status.textContent="Map area changed. Tap Search this area to refresh homes for the visible boundaries.";
    });
  }
  function ensureMapVoiceAssistant(){
    return new Promise((resolve,reject)=>{
      if(!document.querySelector('link[data-gdr-map-voice-style]')){
        const style=document.createElement("link");style.rel="stylesheet";style.href="/assets/gdr-map-voice.css?v=20261107-map-ux4";style.dataset.gdrMapVoiceStyle="true";document.head.appendChild(style);
      }
      if(window.GDRMapVoiceAssistant)return resolve(window.GDRMapVoiceAssistant);
      const existing=document.querySelector('script[data-gdr-map-voice]');
      if(existing){existing.addEventListener("load",()=>window.GDRMapVoiceAssistant?resolve(window.GDRMapVoiceAssistant):reject(new Error("GDR voice assistant did not initialize.")),{once:true});existing.addEventListener("error",()=>reject(new Error("GDR voice assistant could not load.")),{once:true});return;}
      const script=document.createElement("script");script.src="/assets/gdr-map-voice.js?v=20261107-map-voice7";script.defer=true;script.dataset.gdrMapVoice="true";
      script.onload=()=>window.GDRMapVoiceAssistant?resolve(window.GDRMapVoiceAssistant):reject(new Error("GDR voice assistant did not initialize."));
      script.onerror=()=>reject(new Error("GDR voice assistant could not load."));document.head.appendChild(script);
    });
  }
  async function openRenterMap(){
    const dashboard=$("renterDashboard"),panel=$("gdrExploreMapPanel");if(!dashboard||!panel)return;
    const trigger=$("renterExploreMapBtn");if(trigger){trigger.setAttribute("aria-controls","gdrExploreMapPanel");trigger.setAttribute("aria-expanded","true");}
    dashboard.classList.add("gdr-map-mode");panel.hidden=false;
    try{
      await ensureLeaflet();initRenterMap();await ensureMapVoiceAssistant();window.GDRMapVoiceAssistant.mount(panel);requestAnimationFrame(()=>state.renterMap&&state.renterMap.invalidateSize());
      if(!state.renterMap._gdrInitialView){state.renterMap.setView(INDIA_CENTER,5);state.renterMap._gdrInitialView=true;}
      const input=$("gdrMapPlaceSearch"),query=String(input&&input.value||"").trim();
      if(query)await searchTypedMapLocation();
      else setStatus("Tap anywhere on the map to place your starting location, then tap Search this area. You can also search a city, locality or PIN code.");
    }catch(error){console.error("GDR map initialization failed:",error);setStatus("The interactive map could not load. Check your connection and try again.");}
  }
  function closeRenterMap(){
    const dashboard=$("renterDashboard"),panel=$("gdrExploreMapPanel"),trigger=$("renterExploreMapBtn");
    if(window.GDRMapVoiceAssistant)window.GDRMapVoiceAssistant.destroy();
    if(panel)panel.hidden=true;
    if(dashboard)dashboard.classList.remove("gdr-map-mode");
    if(trigger){trigger.setAttribute("aria-expanded","false");try{trigger.focus({preventScroll:true});}catch(_){trigger.focus();}}
    clearPreview();
  }
  function setupPlaceSearch(inputId,panelId,onSelect,kind){
    const input=$(inputId),panel=$(panelId);if(!input||!panel)return;
    const timerKey=kind==="owner"?"ownerSearchTimer":"searchTimer",controllerKey=kind==="owner"?"ownerSearchController":"searchController";
    input.addEventListener("input",()=>{
      if(state[timerKey])clearTimeout(state[timerKey]);if(state[controllerKey])state[controllerKey].abort();
      if(kind==="owner")state.ownerLocationSearchId++;
      const q=input.value.trim(),searchId=kind==="owner"?state.ownerLocationSearchId:state.mapSearchId;
      panel.replaceChildren();panel.classList.remove("gdr-open");if(q.length<3)return;
      if(/^\d{6}$/.test(q)&&kind==="renter"){
        state[timerKey]=setTimeout(()=>searchTypedMapLocation(),450);
        return;
      }
      if(/^\d{6}$/.test(q)&&kind==="owner"){
        state[timerKey]=setTimeout(async()=>{
          try{
            const point=await resolveMapQuery(q);
            if(searchId!==state.ownerLocationSearchId||!state.ownerMap||input.value.trim()!==q)return;
            state.ownerMap.setView([point.lat,point.lng],13,{animate:false});
            setOwnerPin({lat:point.lat,lng:point.lng},point.label,false);
            requestAnimationFrame(()=>state.ownerMap&&state.ownerMap.invalidateSize());
            updateOwnerStatus("PIN "+q+" verified · "+point.label+". Map centered at this locality. Drag the pin to the exact property entrance.");
          }catch(error){
            if(searchId===state.ownerLocationSearchId&&input.value.trim()===q)updateOwnerStatus(error.message||"This PIN could not be verified. Check the six digits and retry.");
          }
        },350);
        return;
      }
      state[timerKey]=setTimeout(async()=>{
        const controller=new AbortController();state[controllerKey]=controller;
        try{
          const response=await fetch(PHOTON+"?limit=8&lang=en&q="+encodeURIComponent(q+", India"),{headers:{Accept:"application/json"},signal:controller.signal});
          if(kind==="owner"&&(searchId!==state.ownerLocationSearchId||input.value.trim()!==q))return;
          if(!response.ok)throw new Error("Location suggestions unavailable");
          const payload=await response.json();
          if(kind==="owner"&&(searchId!==state.ownerLocationSearchId||input.value.trim()!==q))return;
          const features=rankPhotonFeatures(Array.isArray(payload.features)?payload.features:[],q);
          features.forEach(f=>{const c=f&&f.geometry&&f.geometry.coordinates;if(!Array.isArray(c)||!validIndiaPoint(c[1],c[0]))return;
            const label=photonLabel(f.properties)||q,b=node("button","gdr-map-suggestion",label);b.type="button";b.addEventListener("click",()=>{input.value=label;panel.classList.remove("gdr-open");onSelect({lat:Number(c[1]),lng:Number(c[0]),label,properties:f.properties||{}});});panel.append(b);
          });
          if(panel.childElementCount)panel.classList.add("gdr-open");
        }catch(error){if(error.name!=="AbortError")console.warn("GDR place search:",error);}
      },300);
    });
    input.addEventListener("keydown",e=>{if(e.key==="Escape")panel.classList.remove("gdr-open");if(e.key==="Enter"){e.preventDefault();if(panel.firstElementChild)panel.firstElementChild.click();else if(kind==="renter")searchTypedMapLocation();}});
    document.addEventListener("click",e=>{if(!panel.contains(e.target)&&e.target!==input)panel.classList.remove("gdr-open");});
  }
  function updateOwnerStatus(message){const n=$("gdrOwnerMapSelectionStatus");if(n)n.textContent=message||"";}
  function setOwnerPin(point,label,manualConfirmation){
    if(!state.ownerMap||!validPoint(point.lat,point.lng))return;
    state.ownerSelection={lat:Number(point.lat),lng:Number(point.lng),label:String(label||"")};
    state.ownerPinManuallyConfirmed=manualConfirmation===true;
    if(state.ownerMarker)state.ownerMap.removeLayer(state.ownerMarker);
    state.ownerMarker=window.L.marker([point.lat,point.lng],{draggable:true}).addTo(state.ownerMap);
    state.ownerMarker.on("dragend",()=>{const p=state.ownerMarker.getLatLng();state.ownerSelection={lat:p.lat,lng:p.lng,label:""};state.ownerPinManuallyConfirmed=true;updateOwnerStatus("Exact pin position manually adjusted. Confirm to save these coordinates.");});
    updateOwnerStatus((label?label+" · ":"")+"Pin: "+point.lat.toFixed(5)+", "+point.lng.toFixed(5)+". Drag to adjust.");
  }
  function initOwnerMap(){
    if(state.ownerMap)return;const canvas=$("gdrOwnerMapCanvas");if(!canvas)return;
    state.ownerMap=window.L.map(canvas,{zoomControl:false,scrollWheelZoom:true});addTiles(state.ownerMap);addAutomaticNearbyPlaces(state.ownerMap);window.L.control.zoom({position:"bottomright"}).addTo(state.ownerMap);
    state.ownerMap.setView([22.5937,78.9629],5);
    if(state.pendingOwnerMapCenter){
      const pending=state.pendingOwnerMapCenter;state.pendingOwnerMapCenter=null;
      state.ownerMap.setView([pending.lat,pending.lng],13,{animate:false});
      setOwnerPin(pending,pending.label,false);
    }
    state.ownerMap.on("click",e=>setOwnerPin(e.latlng,"",true));
  }
  async function openOwnerMapPicker(){
    const panel=$("gdrOwnerMapPicker");if(!panel)return;
    try{
      await ensureLeaflet();panel.hidden=false;initOwnerMap();
      const toolbar=panel.querySelector(".gdr-owner-map-toolbar");
      if(toolbar&&!$("gdrOwnerPreciseLocationBtn")){
        const locate=node("button","gdr-map-toggle-btn","◎ Use my precise location");
        locate.type="button";locate.id="gdrOwnerPreciseLocationBtn";
        locate.addEventListener("click",usePreciseOwnerLocation);
        toolbar.insertBefore(locate,toolbar.lastElementChild||null);
      }
      requestAnimationFrame(()=>state.ownerMap&&state.ownerMap.invalidateSize());
      const input=$("propertyLocation"),lat=asNumber(input&&input.dataset.gdSelectedLat),lng=asNumber(input&&input.dataset.gdSelectedLng);
      if(lat!==null&&lng!==null){state.ownerMap.setView([lat,lng],13);setOwnerPin({lat,lng},input.dataset.gdSelectedDisplayName||input.value);}
      else if(!state.ownerSelection){const c=state.ownerMap.getCenter();setOwnerPin(c,"Choose the exact property location");}
    }catch(error){console.error("Owner map picker failed:",error);updateOwnerStatus("The map could not load. Use address suggestions or current location instead.");}
  }
  function centerOwnerMapPicker(lat,lng,label){
    const point={lat:Number(lat),lng:Number(lng),label:String(label||"PIN code location")};
    if(!validPoint(point.lat,point.lng))return false;
    // Keep the visible map search label in sync with the newly verified PIN.
    // The map may still be uninitialized here, so update the input before queueing the centre.
    const searchInput=$("gdrOwnerMapSearch");
    if(searchInput)searchInput.value=point.label;
    state.pendingOwnerMapCenter=point;
    if(!state.ownerMap)return true;
    state.ownerMap.setView([point.lat,point.lng],13,{animate:false});
    setOwnerPin(point,point.label,false);
    state.pendingOwnerMapCenter=null;
    requestAnimationFrame(()=>state.ownerMap&&state.ownerMap.invalidateSize());
    return true;
  }
  function clearOwnerMapSelectionForPinChange(){
 const searchInput=$("gdrOwnerMapSearch");
 if(searchInput)searchInput.value="";
 state.pendingOwnerMapCenter=null;state.ownerSelection=null;state.ownerPinManuallyConfirmed=false;
 if(state.ownerMarker&&state.ownerMap){try{state.ownerMap.removeLayer(state.ownerMarker);}catch(e){}}
 state.ownerMarker=null;
 if(state.ownerAccuracyCircle&&state.ownerMap){try{state.ownerMap.removeLayer(state.ownerAccuracyCircle);}catch(e){}}
 state.ownerAccuracyCircle=null;
 if(state.ownerMap){state.ownerMap.setView([22.5937,78.9629],5,{animate:false});requestAnimationFrame(()=>state.ownerMap&&state.ownerMap.invalidateSize());}
 updateOwnerStatus("Previous property pin cleared. Search or verify the new PIN, then select the exact property entrance.");
 return true;
}
function closeOwnerMapPicker(){const p=$("gdrOwnerMapPicker");if(p)p.hidden=true;}
  function confirmOwnerMapLocation(){
    if(!state.ownerSelection){updateOwnerStatus("Tap the map or use GPS to place the property pin.");return;}
    if(!state.ownerPinManuallyConfirmed){updateOwnerStatus("This is only an approximate locality-search pin, not a verified property location. Zoom in and tap the exact building/entrance or drag the marker, or use high-accuracy GPS, before confirming.");return;}
    const input=$("propertyLocation"),typed=String(input&&input.value||"").trim(),address=typed||state.ownerSelection.label;
    if(!address){updateOwnerStatus("Enter the full property address before confirming the pin.");if(input)input.focus();return;}
    if(typeof window.__gdrSetPropertyLocation!=="function"||!window.__gdrSetPropertyLocation(address,state.ownerSelection.lat,state.ownerSelection.lng)){updateOwnerStatus("Property form is still initializing. Try again.");return;}
    updateOwnerStatus("Location confirmed. Coordinates will be saved with this property.");closeOwnerMapPicker();
  }
  async function usePreciseOwnerLocation(){
    if(!state.ownerMap){updateOwnerStatus("Open the map first, then request your precise location.");return;}
    if(!navigator.geolocation){updateOwnerStatus("This device/browser does not support GPS location. Search the address or place the pin manually.");return;}
    updateOwnerStatus("Requesting high-accuracy GPS location. Keep location services enabled…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude),accuracy=Number(pos.coords.accuracy);
      if(!validPoint(lat,lng)){updateOwnerStatus("The device returned an invalid location. Search or place the pin manually.");return;}
      state.ownerMap.setView([lat,lng],18,{animate:true});
      setOwnerPin({lat,lng},"Device GPS",true);
      if(state.ownerAccuracyCircle)state.ownerMap.removeLayer(state.ownerAccuracyCircle);
      state.ownerAccuracyCircle=window.L.circle([lat,lng],{radius:Math.max(accuracy||0,1),color:"#0f766e",weight:1,fillColor:"#14b8a6",fillOpacity:.12}).addTo(state.ownerMap);
      const accuracyText=Number.isFinite(accuracy)?"±"+Math.round(accuracy)+" m":"accuracy unavailable";
      updateOwnerStatus("GPS fix received ("+accuracyText+"). Review the pin at street level and drag it to the property entrance if needed.");
      try{
        const response=await fetch("https://photon.komoot.io/reverse?lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lng)+"&lang=en",{headers:{Accept:"application/json"}});
        if(response.ok){
          const payload=await response.json(),feature=payload&&payload.features&&payload.features[0];
          const label=photonLabel(feature&&feature.properties);
          if(label){const input=$("gdrOwnerMapSearch");if(input)input.value=label;state.ownerSelection.label=label;}
        }
      }catch(error){console.info("Reverse geocoding unavailable; exact GPS coordinates are retained.",error);}
    },error=>{
      const message=error.code===1?"Location permission denied. Allow location access in browser settings, or search/place the pin manually.":error.code===3?"GPS request timed out. Move outdoors or near a window and try again.":"Unable to get a GPS fix. Check device location services and try again.";
      updateOwnerStatus(message);
    },{enableHighAccuracy:true,timeout:25000,maximumAge:0});
  }

  // Dedicated owner Nearby Properties map. This is intentionally independent
  // from the renter's Find Homes/Explore map and never requests browser GPS.
  const ownerNearby={map:null,layer:null,circle:null,ownerMarker:null,tileLayer:null,tileFallback:false,hiddenSiblings:[],overlay:null,owner:null,properties:[],inventory:[],selected:null,radius:5,visible:[],loading:false,searchCenter:null,searchLabel:"",pinTimer:null};
  const OWNER_NEARBY_FIELDS="id,owner_id,title,name,location,address,latitude,longitude,rent,status,verification_status,bhk,furnishing,image_url,listing_type,available_beds,total_beds";
  function ownerNearbyAvailable(p){
    const type=String(p.listing_type||"home").toLowerCase();
    if(type==="pg"||type==="hostel")return Number(p.available_beds||0)>0;
    return String(p.status||"").toLowerCase()!=="occupied"&&String(p.status||"").toLowerCase()!=="rejected";
  }
  function ownerNearbyOverlay(){
    if(ownerNearby.overlay)return ownerNearby.overlay;
    const el=document.createElement("section");el.id="gdrOwnerNearbyExperience";el.className="gdr-owner-nearby";el.hidden=true;
    el.innerHTML='<div class="gdr-on-shell"><header class="gdr-on-header"><div class="gdr-on-heading"><div class="gdr-on-brand" aria-hidden="true"><img src="/assets/gdr-mark.svg" alt=""><span>GharDekho</span><small>OWNER SPACE</small></div><span class="gdr-on-kicker">NEARBY HOMES · SOCIETY VIEW</span><h1>Homes around your property</h1><p id="gdrOnSubheading">See your property and nearby rental homes in one place.</p></div><button type="button" class="gdr-on-back" id="gdrOnBack">← Owner Dashboard</button></header><div class="gdr-on-toolbar"><label class="gdr-on-select-wrap"><span>MY PROPERTY</span><select id="gdrOnPropertySelect" aria-label="Select your property"></select></label><div class="gdr-on-count"><strong id="gdrOnCount">—</strong><span>nearby homes</span></div><label class="gdr-on-radius"><span>SEARCH RADIUS</span><select id="gdrOnRadius"><option value="1">1 KM</option><option value="2">2 KM</option><option value="3">3 KM</option><option value="5" selected>5 KM</option><option value="10">10 KM</option></select></label><button type="button" class="gdr-on-control" id="gdrOnRecenter">⌂ My Property</button><button type="button" class="gdr-on-control gdr-on-refresh" id="gdrOnRefresh">↻ Refresh</button></div><form class="gdr-on-area-search" id="gdrOnAreaSearchForm"><label for="gdrOnAreaSearch">SEARCH ANY AREA IN BHOPAL / INDIA</label><div><input id="gdrOnAreaSearch" type="search" placeholder="Try Patel Nagar, Bhopal or PIN code" autocomplete="off"><button type="submit" id="gdrOnAreaSearchBtn">Search area →</button></div><small id="gdrOnAreaSearchHint">Search an area to find all nearby GharDekho homes, even when it is not your own property location.</small></form><section class="gdr-on-society-panel"><div class="gdr-on-society-top"><div><span class="gdr-on-kicker">3D NEIGHBOURHOOD</span><h2>Your home & nearby society</h2><p>Real GharDekho listings placed around your selected property.</p></div><span class="gdr-on-radius-chip" id="gdrOnMapChip">WITHIN 5 KM</span></div><div class="gdr-on-map-loading" id="gdrOnLoading"><span class="gdr-on-spinner"></span><b>Finding nearby homes…</b><small>Checking real property locations</small></div><div class="gdr-on-society-scene" id="gdrOnSocietyScene" aria-live="polite"></div><div class="gdr-on-empty" id="gdrOnEmpty" hidden></div><article class="gdr-on-preview" id="gdrOnPreview" hidden></article></section><p class="gdr-on-footnote" id="gdrOnStatus" aria-live="polite">Loading your property locations…</p></div>';
    document.body.appendChild(el);ownerNearby.overlay=el;
    $("gdrOnBack").addEventListener("click",closeOwnerNearbyMap);
    $("gdrOnPropertySelect").addEventListener("change",()=>{const p=ownerNearby.properties.find(x=>String(x.id)===$("gdrOnPropertySelect").value);if(p){ownerNearby.selected=p;ownerNearby.searchCenter=null;ownerNearby.searchLabel="";const input=$("gdrOnAreaSearch");if(input)input.value="";focusOwnerNearbyProperty();loadOwnerNearbyHomes();}});
    $("gdrOnAreaSearchForm").addEventListener("submit",async e=>{e.preventDefault();await searchOwnerNearbyArea();});
    const ownerAreaInput=$("gdrOnAreaSearch");
    ownerAreaInput.addEventListener("input",()=>{
      if(ownerNearby.pinTimer)clearTimeout(ownerNearby.pinTimer);
      const value=String(ownerAreaInput.value||"").replace(/\D/g,"").slice(0,6);
      if(/^\d{6}$/.test(value)){
        ownerNearby.pinTimer=setTimeout(()=>{
          if(String(ownerAreaInput.value||"").replace(/\D/g,"").slice(0,6)===value)searchOwnerNearbyArea();
        },450);
      }
    });
    $("gdrOnRadius").addEventListener("change",()=>{ownerNearby.radius=Math.max(1,Math.min(10,Number($("gdrOnRadius").value)||5));$("gdrOnMapChip").textContent=ownerNearby.radius+" KM radius";loadOwnerNearbyHomes();});
    $("gdrOnRecenter").addEventListener("click",focusOwnerNearbyProperty);
    $("gdrOnRefresh").addEventListener("click",loadOwnerNearbyHomes);
    return el;
  }
  function ownerNearbyStatus(message){const n=$("gdrOnStatus");if(n)n.textContent=message||"";}
  function ownerNearbyLoading(on){const n=$("gdrOnLoading");if(n)n.hidden=!on;}
  function hideOwnerNearbyBackground(){
    if(ownerNearby.hiddenSiblings.length)return;
    ownerNearby.hiddenSiblings=Array.from(document.body.children).filter(el=>el!==ownerNearby.overlay).map(el=>({
      el,display:el.style.getPropertyValue("display"),priority:el.style.getPropertyPriority("display")
    }));
    ownerNearby.hiddenSiblings.forEach(item=>item.el.style.setProperty("display","none","important"));
  }
  function restoreOwnerNearbyBackground(){
    ownerNearby.hiddenSiblings.forEach(item=>{
      if(item.display)item.el.style.setProperty("display",item.display,item.priority);
      else item.el.style.removeProperty("display");
    });
    ownerNearby.hiddenSiblings=[];
  }
  function closeOwnerNearbyMap(){
    if(ownerNearby.overlay)ownerNearby.overlay.hidden=true;
    document.body.classList.remove("gdr-owner-nearby-open");
    restoreOwnerNearbyBackground();
  }
  function ownerNearbyHouseIcon(p){
    const rent=Number(p.rent||0),short=rent>=100000?"₹"+(rent/100000).toFixed(1)+"L":rent>=1000?"₹"+(rent/1000).toFixed(rent%1000?1:0)+"k":money(rent);
    return window.L.divIcon({className:"gdr-on-house-wrap",html:'<span class="gdr-on-house-marker"><i>⌂</i><b>'+short+'</b></span>',iconSize:[86,48],iconAnchor:[43,42]});
  }
  function ownerNearbyPreview(p){
    const n=$("gdrOnPreview");if(!n)return;n.replaceChildren();
    const image=document.createElement("img");image.className="gdr-on-preview-image";image.alt="Property photograph";image.loading="lazy";image.src=safeImage(p.image_url)||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='220'%3E%3Crect width='100%25' height='100%25' fill='%23eaf3ef'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' fill='%23758b82' font-size='44'%3E%E2%8C%82%3C/text%3E%3C/svg%3E";
    const body=node("div","gdr-on-preview-body"),top=node("div","gdr-on-preview-top"),title=node("h3","",p.title||p.name||"Rental home"),close=node("button","gdr-on-preview-close","×");close.type="button";close.setAttribute("aria-label","Close property preview");close.onclick=()=>{n.hidden=true;n.replaceChildren();};top.append(title,close);
    body.append(top,node("strong","gdr-on-preview-rent",money(p.rent)+" / month"),node("p","gdr-on-preview-address",[p.location,p.address].filter(Boolean).join(" · ")||"Address not available"),node("p","gdr-on-preview-meta",[p.bhk?p.bhk+" BHK":"",p.furnishing||"",String(p.listing_type||"Home").toUpperCase(),p.gdrIsOwnerProperty?"Your property":Number.isFinite(p.gdrDistanceKm)?(p.gdrDistanceKm<1?Math.round(p.gdrDistanceKm*1000)+" m away":p.gdrDistanceKm.toFixed(2)+" km away"):""].filter(Boolean).join(" · ")),node("span",p.gdrIsOwnerProperty?"gdr-on-preview-status gdr-on-preview-own-status":"gdr-on-preview-status",p.gdrIsOwnerProperty?"MY PROPERTY":String(p.status||"Available").replaceAll("_"," ")));
    const action=node("button","gdr-on-details","View Details →");action.type="button";action.onclick=()=>{if(typeof window.openPropertyDetails==="function")window.openPropertyDetails(p.id);else if(typeof window.openPropertyDetailsModal==="function")window.openPropertyDetailsModal(p.id);else ownerNearbyStatus("Property details action is not available on this page.");};
    body.append(action);n.append(image,body);n.hidden=false;
  }
  function ownerNearbyBuilding(){
    const art=node("span","gdr-on-building","");art.setAttribute("aria-hidden","true");
    art.append(node("span","gdr-on-building-roof",""),node("span","gdr-on-building-wall",""),node("span","gdr-on-building-door",""),node("span","gdr-on-building-window gdr-on-window-one",""),node("span","gdr-on-building-window gdr-on-window-two",""),node("span","gdr-on-building-window gdr-on-window-three",""));
    return art;
  }
  function ownerNearbyHomeCard(p,isOwn){
    const card=node("button",isOwn?"gdr-on-home-card gdr-on-home-card-own":"gdr-on-home-card");
    card.type="button";card.setAttribute("aria-label",(p.title||p.name||"Property")+" · "+(isOwn?"Your property":(Number(p.gdrDistanceKm)||0).toFixed(2)+" kilometres away"));
    const art=node("span","gdr-on-home-art");art.append(ownerNearbyBuilding(),node("span","gdr-on-home-garden",""));const pricePin=node("span","gdr-on-home-map-pin",money(p.rent));pricePin.setAttribute("aria-label","Monthly rent "+money(p.rent));art.append(pricePin);
    const top=node("span","gdr-on-home-top"),kind=node("span","gdr-on-home-kind",isOwn?"MY HOME":String(p.listing_type||"HOME").replaceAll("_"," ").toUpperCase());
    const distance=node("span","gdr-on-home-distance",isOwn?"OWNER PROPERTY":(p.gdrDistanceKm<1?Math.round(p.gdrDistanceKm*1000)+" m away":p.gdrDistanceKm.toFixed(2)+" km away"));
    top.append(kind,distance);
    const title=node("strong","gdr-on-home-title",p.title||p.name||"Rental home");
    const rent=node("span","gdr-on-home-rent",money(p.rent)+" / month");
    const address=node("span","gdr-on-home-address",[p.location,p.address].filter(Boolean).join(" · ")||"Address not available");
    const meta=node("span","gdr-on-home-meta",[p.bhk?p.bhk+" BHK":"",p.furnishing||"",String(p.status||"Available").replaceAll("_"," ")].filter(Boolean).join(" · "));
    card.append(art,top,title,rent,address,meta);
    card.addEventListener("click",()=>ownerNearbyPreview(isOwn?{...p,gdrDistanceKm:0,gdrIsOwnerProperty:true}:p));
    return card;
  }
  function renderOwnerNearbyHomes(rows,center){
    const scene=$("gdrOnSocietyScene");if(!scene)return;
    scene.replaceChildren();
    const own=ownerNearby.selected;
    if(own&&validPoint(own.latitude,own.longitude)&&distanceKm(center,[Number(own.latitude),Number(own.longitude)])<=ownerNearby.radius)scene.append(ownerNearbyHomeCard(own,true));
    rows.forEach(p=>scene.append(ownerNearbyHomeCard(p,false)));
    ownerNearby.visible=rows;
    const count=$("gdrOnCount");if(count)count.textContent=String(rows.length);
    const empty=$("gdrOnEmpty");
    if(empty){
      empty.hidden=rows.length>0;
      empty.textContent=rows.length?"":"No other GharDekho listings with saved coordinates were found within "+ownerNearby.radius+" KM. Your property is shown above. Increase the radius to check a wider area.";
    }
    if(!rows.length){const preview=$("gdrOnPreview");if(preview)preview.hidden=true;}
    ownerNearbyStatus(rows.length+" nearby listings found within "+ownerNearby.radius+" KM. Showing your property and "+rows.length+" nearby homes.");
  }
  function focusOwnerNearbyProperty(){
    const p=ownerNearby.selected;if(!p)return;
    ownerNearby.searchCenter=null;ownerNearby.searchLabel="";
    const input=$("gdrOnAreaSearch");if(input)input.value="";
    const hint=$("gdrOnAreaSearchHint");if(hint)hint.textContent="Search an area to find all nearby GharDekho homes, even when it is not your own property location.";
    const sub=$("gdrOnSubheading");if(sub)sub.textContent=(p.location||p.address||p.title||"Your property")+" · Search within "+ownerNearby.radius+" KM";
    const card=$("gdrOnSocietyScene")?.querySelector(".gdr-on-home-card-own");
    card?.scrollIntoView({behavior:"smooth",block:"center",inline:"center"});
    ownerNearbyPreview({...p,gdrDistanceKm:0,gdrIsOwnerProperty:true});
    ownerNearbyStatus("Your property is highlighted in the society view.");
    loadOwnerNearbyHomes();
  }
  async function searchOwnerNearbyArea(){
    const input=$("gdrOnAreaSearch"),query=String(input&&input.value||"").trim(),button=$("gdrOnAreaSearchBtn");
    if(ownerNearby.pinTimer){clearTimeout(ownerNearby.pinTimer);ownerNearby.pinTimer=null;}
    if(!query){ownerNearbyStatus("Enter a locality, city or six-digit PIN code, for example Patel Nagar, Bhopal.");return;}
    if(button){button.disabled=true;button.textContent="Locating…";}
    try{
      ownerNearbyStatus("Finding "+query+" on the map…");
      const point=await resolveMapQuery(query);
      ownerNearby.searchCenter=[point.lat,point.lng];ownerNearby.searchLabel=point.label||query;
      const hint=$("gdrOnAreaSearchHint");if(hint)hint.textContent="Showing homes around "+ownerNearby.searchLabel+". Choose My Property to return to your saved property location.";
      const sub=$("gdrOnSubheading");if(sub)sub.textContent="Homes around "+ownerNearby.searchLabel;
      await loadOwnerNearbyHomes();
    }catch(error){console.warn("Owner Nearby area search failed:",error);ownerNearbyStatus(error.message||"This area could not be located. Try a nearby locality or PIN code.");}
    finally{if(button){button.disabled=false;button.textContent="Search area →";}}
  }
  async function loadOwnerNearbyHomes(){
    if(ownerNearby.loading||!ownerNearby.selected)return;
    const fallbackCenter=[asNumber(ownerNearby.selected.latitude),asNumber(ownerNearby.selected.longitude)];
    const center=ownerNearby.searchCenter||fallbackCenter;
    if(center.some(v=>v===null)){ownerNearbyStatus("This property is missing exact latitude/longitude. Please update its location pin first.");ownerNearbyLoading(false);return;}
    ownerNearby.loading=true;ownerNearbyLoading(true);ownerNearbyStatus("Searching real listings within "+ownerNearby.radius+" KM of "+(ownerNearby.searchLabel||"your selected property")+"…");
    try{
      const client=db();if(!client)throw new Error("Account service is not ready. Refresh and sign in again.");
      const bounds=radiusBounds(center),sw=bounds.getSouthWest(),ne=bounds.getNorthEast();
      let inventory=[],source="viewport";
      const viewport=await client.rpc("get_map_properties_in_bounds",{p_south:sw.lat,p_west:sw.lng,p_north:ne.lat,p_east:ne.lng,p_limit:200});
      if(!viewport.error){
        inventory=(Array.isArray(viewport.data)?viewport.data:[]);
      }else{
        console.warn("Owner Nearby viewport lookup unavailable; using public inventory fallback:",viewport.error);
        source="public inventory";
        const fallback=await client.rpc("get_public_properties");
        if(fallback.error)throw fallback.error;
        inventory=Array.isArray(fallback.data)?fallback.data:[];
      }
      const selectedId=String(ownerNearby.selected.id);
      const rows=inventory.map(p=>({...p,name:p.name||p.title,address:p.address||p.location}))
        .filter(p=>String(p.id)!==selectedId&&validPoint(p.latitude,p.longitude))
        .map(p=>({...p,gdrDistanceKm:distanceKm(center,[Number(p.latitude),Number(p.longitude)])}))
        .filter(p=>Number.isFinite(p.gdrDistanceKm)&&p.gdrDistanceKm<=ownerNearby.radius)
        .sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm);
      renderOwnerNearbyHomes(rows,center);
      const sub=$("gdrOnSubheading");if(sub)sub.textContent="Homes around "+(ownerNearby.searchLabel||ownerNearby.selected.location||ownerNearby.selected.address||"your property");
      if(source==="public inventory")ownerNearbyStatus(rows.length+" nearby listings found. Viewport search was unavailable; results use the existing public inventory.");
    }catch(error){console.error("Owner Nearby Properties query failed:",error);ownerNearbyStatus(error.message||"Nearby properties could not be loaded. Check your connection and permissions.");const empty=$("gdrOnEmpty");if(empty){empty.hidden=false;empty.textContent="Could not load nearby homes. Please refresh and try again.";}}
    finally{ownerNearby.loading=false;ownerNearbyLoading(false);}
  }
  async function openOwnerNearbyMap(){
    const overlay=ownerNearbyOverlay();overlay.hidden=false;document.body.classList.add("gdr-owner-nearby-open");hideOwnerNearbyBackground();overlay.scrollTop=0;window.scrollTo(0,0);
    ownerNearby.radius=5;$("gdrOnRadius").value="5";$("gdrOnMapChip").textContent="5 KM radius";$("gdrOnCount").textContent="…";ownerNearbyLoading(true);
    try{
      const client=db();if(!client)throw new Error("Account service is not ready. Refresh and sign in again.");
      const auth=await client.auth.getUser();if(auth.error||!auth.data?.user)throw new Error("Please sign in again to open your owner workspace.");
      const profile=await client.from("owners").select("id,name").eq("user_id",auth.data.user.id).maybeSingle();if(profile.error||!profile.data)throw new Error("Your owner profile could not be loaded.");
      ownerNearby.owner=profile.data;
      const own=await client.from("properties").select(OWNER_NEARBY_FIELDS).eq("owner_id",profile.data.id).order("created_at",{ascending:false});if(own.error)throw own.error;
      ownerNearby.properties=(Array.isArray(own.data)?own.data:[]).filter(p=>validPoint(p.latitude,p.longitude));
      if(!ownerNearby.properties.length)throw new Error("No property with saved map coordinates was found. Edit your property and save its exact location pin first.");
      const selector=$("gdrOnPropertySelect");selector.replaceChildren();
      ownerNearby.properties.forEach(p=>{const opt=document.createElement("option");opt.value=p.id;opt.textContent=(p.title||p.name||"My property")+" · "+(p.location||p.address||"Location");selector.append(opt);});
      ownerNearby.selected=ownerNearby.properties[0];selector.value=ownerNearby.selected.id;
      const sub=$("gdrOnSubheading");if(sub)sub.textContent=(ownerNearby.selected.location||ownerNearby.selected.address||ownerNearby.selected.title||"Your property")+" · Search within 5 KM";
      await loadOwnerNearbyHomes();
    }catch(error){console.error("Owner Nearby map failed:",error);ownerNearbyLoading(false);ownerNearbyStatus(error.message||"Nearby map could not be opened.");const empty=$("gdrOnEmpty");if(empty){empty.hidden=false;empty.textContent=error.message||"Nearby map could not be opened.";}}
  }

  function bind(){
    $("renterExploreMapBtn")?.addEventListener("click",openRenterMap);$("gdrMapBackBtn")?.addEventListener("click",closeRenterMap);
    $("gdrMapSearchAreaBtn")?.addEventListener("click",()=>searchRenterArea(undefined,false));$("gdrMapLocateBtn")?.addEventListener("click",locateRenter);
    const radiusInput=$("gdrMapRadius");if(radiusInput){radiusInput.min="0.5";radiusInput.max="10";radiusInput.step="0.5";radiusInput.addEventListener("input",e=>{state.radiusKm=Math.max(.5,Math.min(10,Number(e.target.value)||5));const label=$("gdrMapRadiusValue");if(label)label.textContent=state.radiusKm<1?Math.round(state.radiusKm*1000)+" m":state.radiusKm+" km";});}
    $("gdrMapRadius")?.addEventListener("change",()=>{if(state.renterMap&&state.searchCenter)searchRenterArea(undefined,state.searchUsesRadius);});
    $("gdrMapListToggle")?.addEventListener("click",()=>{const l=$("gdrMapLayout"),panel=$("gdrMapListPanel");if(!l)return;const on=!l.classList.contains("gdr-list-mode");l.classList.toggle("gdr-list-mode",on);if(panel)panel.hidden=!on;$("gdrMapListToggle").setAttribute("aria-pressed",String(on));$("gdrMapViewToggle").setAttribute("aria-pressed",String(!on));if(state.renterMap)requestAnimationFrame(()=>state.renterMap.invalidateSize());});
    $("gdrMapViewToggle")?.addEventListener("click",()=>{const l=$("gdrMapLayout"),panel=$("gdrMapListPanel");if(!l)return;l.classList.remove("gdr-list-mode");if(panel)panel.hidden=true;$("gdrMapListToggle").setAttribute("aria-pressed","false");$("gdrMapViewToggle").setAttribute("aria-pressed","true");if(state.renterMap)requestAnimationFrame(()=>state.renterMap.invalidateSize());});
    $("gdrOpenOwnerMapPickerBtn")?.addEventListener("click",openOwnerMapPicker);$("gdrCloseOwnerMapPickerBtn")?.addEventListener("click",closeOwnerMapPicker);$("gdrConfirmOwnerMapLocation")?.addEventListener("click",confirmOwnerMapLocation);
    setupPlaceSearch("gdrMapPlaceSearch","gdrMapPlaceSuggestions",r=>{if(state.renterMap){state.searchUsesRadius=true;setRenterPin(r,r.label);state.renterMap.setView(state.searchCenter,14,{animate:false});searchRenterArea(undefined,true);}},"renter");
    $("gdrMapPlaceSearch")?.addEventListener("change",()=>{state.resolvedQuery="";});
    setupPlaceSearch("gdrOwnerMapSearch","gdrOwnerMapSuggestions",r=>{if(state.ownerMap){state.ownerMap.flyTo([r.lat,r.lng],16,{duration:.6});setOwnerPin({lat:r.lat,lng:r.lng},r.label,false);updateOwnerStatus("Approximate locality found. Zoom in and tap the exact building/entrance or drag the pin; search results are not exact property coordinates.");}},"owner");
  }
  function loadOwnerRenterEditor(){
    if(!document.querySelector("script[data-gdr-owner-renter-editor]")){
      const script=document.createElement("script");
      script.src="/assets/gdr-owner-renter-editor.js";
      script.defer=true;
      script.dataset.gdrOwnerRenterEditor="true";
      script.onerror=()=>console.warn("Owner renter editor could not be loaded.");
      document.head.appendChild(script);
    }
    if(!document.querySelector("script[data-gdr-owner-renter-page]")){
      const pageScript=document.createElement("script");
      pageScript.src="/assets/gdr-owner-renter-page.js";
      pageScript.defer=true;
      pageScript.dataset.gdrOwnerRenterPage="true";
      pageScript.onerror=()=>console.warn("Dedicated renter profile page could not be loaded.");
      document.head.appendChild(pageScript);
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{bind();loadOwnerRenterEditor();},{once:true});
  else {bind();loadOwnerRenterEditor();}
  window.GDRMapExperience={openRenterMap,closeRenterMap,openOwnerMapPicker,centerOwnerMapPicker,clearOwnerMapSelectionForPinChange,searchRenterArea,searchTypedMapLocation,resolveMapQuery,setRenterPin,searchAtCoordinates,showVoiceSearchResults,usePreciseOwnerLocation,openOwnerNearbyMap,closeOwnerNearbyMap,applyRenterFilters,setRenterSearchPreferences,setRenterRadius,getRenterVisibleProperties:()=>state.visible.slice(),renderBrowseViewport,getRenterSearchPreferences:()=>Object.assign({},state.currentPrefs),filterVisibleByLocation:function(query){const term=normalizedText(query);if(!term)return state.visible.slice();const rows=state.visible.filter(p=>normalizedText([p.location,p.address].filter(Boolean).join(" ")).includes(term));state.boundsRows=rows;renderMarkers(rows,state.searchCenter);return rows;}};
})();
