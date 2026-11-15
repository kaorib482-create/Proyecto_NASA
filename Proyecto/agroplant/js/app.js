(() => {
'use strict';
const $=id=>document.getElementById(id);
const initial=window.AGROPLANT_CATALOGO || {states:[],crops:[]};
let states=[...initial.states], crops=[...initial.crops], cropByKey={};
let currentCrop='maiz', chosenState='17', chosenMunicipality='', selectedLat=18.92, selectedLon=-99.24;
let mariaDB=false, backend=false, map=null, geoStates=null, geoMunicipalities=null, stateShapes=[], cityShapes=[], regionLabels=[],
 stateWeather={}, currentLayer='temp', radarLayer=null, nasaLayer=null, selectedMarker=null,
 geoMunicipalityState='',municipalityLoading=false, locationSeq=0, photoMemo={}, outlineLayer=null, outlineMarkers=[], fallbackView={x:0,y:0,w:1180,h:680};
const fmt1=n=>Number.isFinite(Number(n))?Number(n).toFixed(1):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const stateFor=code=>states.find(s=>s.code===String(code).padStart(2,'0'));
const cropFor=key=>cropByKey[key];
const localDate=()=>{let d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`};
const icons={0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'⛈️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
const weatherIcon=code=>icons[Number(code)]||'🌤️';
const weatherWord=code=>({0:'Cielo despejado',1:'Mayormente soleado',2:'Parcialmente nublado',3:'Nublado',45:'Con neblina',61:'Lluvia ligera',63:'Lluvia',65:'Lluvia intensa',80:'Chubascos',95:'Tormenta'})[Number(code)]||'Clima de la zona';
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast._timer);toast._timer=setTimeout(()=>el.classList.remove('visible'),4700)}
async function api(action,query='',options={}) {
 const endpoint='api/index.php?a='+encodeURIComponent(action)+(query?'&'+query:'');
 const res=await fetch(endpoint,{cache:'no-store',...options});
 const type=res.headers.get('content-type')||'';
 if(!type.includes('application/json'))throw new Error('Servidor PHP no disponible. Abre el HTML desde http://localhost/agroplant/');
 const data=await res.json();
 if(!res.ok||data.error)throw new Error(data.detail?`${data.error} ${data.detail}`:(data.error||'No se pudo consultar el servidor'));
 return data;
}
async function externalMeteo(lat,lon){
 const u=new URL('https://api.open-meteo.com/v1/forecast');
 Object.entries({latitude:lat,longitude:lon,timezone:'auto',current:'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',daily:'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code',forecast_days:5}).forEach(([k,v])=>u.searchParams.set(k,v));
 let r=await fetch(u);if(!r.ok)throw new Error('No se pudo obtener el clima');
 return {weather:await r.json(),source:'Open-Meteo'};
}
function loadCatalog(){
 cropByKey=Object.fromEntries(crops.map(c=>[c.slug,c]));
 $('stateSelect').innerHTML=states.map(s=>`<option value="${esc(s.code)}">${esc(s.name)}</option>`).join('');
 $('stateSelect').value=chosenState;window.AgroPlantPickers?.sync();
 $('previousCrop').innerHTML='<option value="ninguno">No sé / primera siembra</option>'+crops.map(c=>`<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('');
 $('cropSearch').value=cropFor(currentCrop)?.name||'Maíz';
 showCrop();
}
function cropMatches(query){
 const clean=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const q=clean(query.trim());return crops.filter(c=>clean(c.name).includes(q)).slice(0,25);
}
function updateCropResults() {
 const matches=cropMatches($('cropSearch').value);
 $('cropResults').innerHTML=matches.length?matches.map(c=>`<button type="button" class="crop-option" role="option" data-crop="${esc(c.slug)}"><span>${esc(c.emoji||'🌱')} ${esc(c.name)}</span><span>›</span></button>`).join(''):'<div style="padding:12px">No aparece en la lista. Puedes agregarlo.</div>';
 $('cropResults').classList.remove('hidden');
}
function cropSelected(key){if(!cropByKey[key])return;currentCrop=key;$('cropSearch').value=cropByKey[key].name;$('cropResults').classList.add('hidden');showCrop();resetResult();}
function photoTag(crop,wrap,alt){if(!wrap)return;
 wrap.dataset.crop=crop.slug;wrap.textContent=crop.emoji||'🌱';
 if(photoMemo[crop.slug]){const im=document.createElement('img');im.loading='lazy';im.alt=alt||crop.name;im.src=photoMemo[crop.slug];im.onerror=()=>{wrap.textContent=crop.emoji||'🌱'};wrap.replaceChildren(im);return;}
 const addImg=url=>{if(!url||!url.startsWith('https://'))return;photoMemo[crop.slug]=url;const im=document.createElement('img');im.src=url;im.alt=`Fotografía de ${crop.name}`;im.loading='lazy';im.onerror=()=>{wrap.textContent=crop.emoji||'🌱';delete photoMemo[crop.slug]};wrap.replaceChildren(im);};
 if(crop.photo_url){addImg(crop.photo_url);return;}
 if(!crop.wikipedia_title)return;
 (async()=>{try{
  let url=null;
  if(backend){const data=await api('photo','crop='+encodeURIComponent(crop.slug));url=data.url;}
  else{const u='https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=540&titles='+encodeURIComponent(crop.wikipedia_title);const r=await fetch(u);const j=await r.json();url=Object.values(j.query?.pages||{})[0]?.thumbnail?.source;}
  if(url&&wrap.isConnected&&wrap.dataset.crop===crop.slug)addImg(url);
 }catch(err){/* No se reemplaza el cultivo por una fotografía sin licencia o inventada. */}})();
}
function showCrop(){const c=cropFor(currentCrop);if(!c)return;
 $('cropTitle').textContent=c.name;
 $('cropDescription').textContent=c.description || 'Infórmate antes de sembrar.';
 $('googlePhotos').href=c.google_images_url || 'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(c.name+' cultivo');
 photoTag(c,$('cropPhoto'));
}
function resetResult(){ $('scoreValue').textContent='—';$('donut').style.background='conic-gradient(#94ad80 0 0%,#e0e6d7 0 100%)';$('resultTitle').textContent='¿Es buen momento para sembrar?';$('resultDescription').textContent='Pulsa «Revisar mi siembra» para ver el resultado.';$('resultWarning').textContent='';$('resultReasons').classList.add('hidden');$('alternativeCards').innerHTML='<div class="empty">Aquí aparecerán otras opciones para tu tierra.</div>';$('rotationCards').innerHTML='<div class="empty">Aquí aparecerán tres formas de alternar cultivos.</div>';}
function chooseState(code,{zoom=true,loadMun=true}={}){
 chosenState=String(code).padStart(2,'0');const s=stateFor(chosenState);if(!s)return;
 $('stateSelect').value=chosenState;chosenMunicipality='';selectedLat=Number(s.lat);selectedLon=Number(s.lon);window.AgroPlantPickers?.sync();
 $('weatherLocation').textContent=s.name+', México';$('locationHint').textContent='Elige un municipio o toca el punto de tu terreno.';
 $('municipalitySelect').innerHTML='<option value="">Elige tu municipio</option>';window.AgroPlantPickers?.sync();
 geoMunicipalities=null;geoMunicipalityState='';clearMunicipalityLayers();
 if(zoom&&map){const shape=stateShapes.find(x=>x.code===chosenState)?.layer; if(shape)map.flyToBounds(shape.getBounds(),{padding:[40,40],maxZoom:8,duration:.48,easeLinearity:.38});else map.flyTo([selectedLat,selectedLon],7,{duration:.48});}else if(zoom)zoomFallback(2.4,selectedLat,selectedLon);
 if(loadMun)fetchMunicipalities(chosenState);markPoint(selectedLat,selectedLon);
 updateWeather();resetResult();
}
function chooseMunicipality(code){
 chosenMunicipality=code;const city=cityShapes.find(x=>x.code===code);const state=stateFor(chosenState);
 if(city)$('weatherLocation').textContent=city.name+', '+(state?.name||'México');
 const row=cityShapes.find(x=>x.code===code);
 if(row?.layer&&map){const bounds=row.layer.getBounds();map.flyToBounds(bounds,{padding:[42,42],maxZoom:11,duration:.48}); const p=bounds.getCenter();setPoint(p.lat,p.lng,true);}
 else{ $('locationHint').textContent='Selecciona tu parcela sobre el municipio en el mapa.';}
 resetResult();
}
function setPoint(lat,lon,update=true){selectedLat=+lat;selectedLon=+lon;
 markPoint(lat,lon);$('locationHint').textContent='📍 Punto elegido en el mapa. Puedes moverlo tocando otro lugar.';
 if(update){updateWeather();resetResult();}
}
function markPoint(lat,lon){if(!map){const pin=$('mapSelectedPlot');if(pin){const [x,y]=svgXY(lon,lat);pin.setAttribute('cx',x);pin.setAttribute('cy',y)}return;}if(selectedMarker)map.removeLayer(selectedMarker);
 selectedMarker=L.circleMarker([lat,lon],{radius:8,color:'#ffffff',weight:3,fillColor:'#bd9f34',fillOpacity:1}).addTo(map).bindTooltip('Aquí quieres sembrar',{direction:'top'});
}
function isMexico(lat,lon){return lat>14&&lat<33&&lon>-119&&lon< -86;}
function weatherColor(value,layer){if(value==null||!Number.isFinite(Number(value)))return '#b5c59e';
 const n=Number(value);if(layer==='temp')return n<11?'#75a9ce':n<17?'#84bca7':n<23?'#b5cb75':n<29?'#e0c25a':n<35?'#d69b51':'#d57658';
 if(layer==='rain')return n<0.1?'#b0b189':n<1?'#94bfa2':n<3?'#5b9ab1':'#3674a8';
 if(layer==='humidity')return n<35?'#b9b87c':n<60?'#98bb85':n<80?'#69aeaa':'#4b8fc8';return '#839869';
}
function fcode(f){const p=f.properties||{};let id=String(p.CVE_ENT??p.cve_ent??p.cve_agee??p.CVEGEO??p.cvegeo??p.codigo??p.id??'');
 const v=id.match(/\d{1,2}/);return (v?String(parseInt(v[0],10)).padStart(2,'0'):'');}
function mcode(f){const p=f.properties||{};let id=String(p.CVEGEO??p.cvegeo??p.CVE_GEO??p.id??'');if(!/^\d{5}$/.test(id)&&p.CVE_ENT!=null&&p.CVE_MUN!=null)id=String(p.CVE_ENT).padStart(2,'0')+String(p.CVE_MUN).padStart(3,'0');return /^\d{5}$/.test(id)?id:'';}
function mname(f){let p=f.properties||{};return p.NOMGEO||p.nomgeo||p.nom_agem||p.nom_mun||p.NOM_MUN||p.name||p.NOMBRE||'Municipio';}
function mapPopup(code){const s=stateFor(code);if(!s)return 'México';const w=stateWeather[code];
 const val=w?.temp!=null&&Number.isFinite(Number(w.temp))?fmt1(w.temp)+' °C':'Sin dato reciente';
 return `<div style="min-width:160px"><b style="font-size:15px">${esc(s.name)}</b><div style="font-weight:400;font-size:11px;margin-top:4px">${esc(s.phrase||'')}</div><div style="margin-top:7px;font-size:12px">🌡️ ${val}<br><small>Dato de un punto del estado</small></div></div>`;
}
function stateStyle(code){return {color:code===chosenState?'#fdf3bd':'#fff8e7',weight:code===chosenState?3.4:1.25,fillColor:weatherColor(stateWeather[code]?.[currentLayer==='rain'?'rain':currentLayer==='humidity'?'humidity':'temp'],currentLayer==='rain'?'rain':currentLayer==='humidity'?'humidity':'temp'),fillOpacity:.9,opacity:1};}
function updateMapStyles(){stateShapes.forEach(x=>x.layer?.setStyle(stateStyle(x.code)));
 $('mapLegend').innerHTML=currentLayer==='rain'?'<span>Seco</span><i style="background:linear-gradient(90deg,#d4d0a1,#90bea8,#5d9fbc,#3165a3)"></i><span>Lluvia</span>':currentLayer==='humidity'?'<span>Seco</span><i style="background:linear-gradient(90deg,#cdb979,#8fc29f,#5fada9,#478fb7)"></i><span>Húmedo</span>':'<span>Frío</span><i></i><span>Calor</span>';
}
function drawStateGeo(data){if(data?.approximate||!data?.features?.length){drawOutlineLayers();return;}geoStates=data; if(!map){drawFallback();return;}
 if(outlineLayer){map.removeLayer(outlineLayer);outlineLayer=null;}outlineMarkers.forEach(x=>map.removeLayer(x));outlineMarkers=[];
 stateShapes.forEach(x=>map.removeLayer(x.layer));stateShapes=[];regionLabels.forEach(x=>map.removeLayer(x));regionLabels=[];
 const features=data.features||[];
 for(const f of features){const code=fcode(f); if(!stateFor(code))continue;
  const polygon=L.geoJSON(f,{style:()=>stateStyle(code)}).addTo(map);
  polygon.bindTooltip(mapPopup(code),{sticky:true,opacity:.98});
  polygon.on('mouseover',ev=>{ev.target.setStyle({weight:2.1,fillOpacity:.99,color:'#fffaf0'});ev.target.bringToFront()});
  polygon.on('mouseout',()=>polygon.setStyle(stateStyle(code)));
  polygon.on('click',ev=>{L.DomEvent.stop(ev);chooseState(code,{zoom:true,loadMun:true})});
  stateShapes.push({code,layer:polygon});
  const center=polygon.getBounds().getCenter();const s=stateFor(code);
  regionLabels.push(L.marker(center,{interactive:false,icon:L.divIcon({className:'',html:`<b style="font-size:10px;color:#17301e;text-shadow:0 0 2px #f5f2d0">${esc(s.abbr)}</b>`,iconSize:[43,20],iconAnchor:[19,10]})}).addTo(map));
 }
 const n=features.length;
 $('mapPrecision').textContent=`${stateShapes.length} estados · límites INEGI · Acércate para ver municipios`;
 syncLabels();
}
function clearMunicipalityLayers(){cityShapes.forEach(x=>map&&map.removeLayer(x.layer));cityShapes=[];}
function drawMunicipalities(data,state){if(chosenState!==state)return;
 clearMunicipalityLayers();const options=['<option value="">Elige tu municipio</option>'];
 for(const f of data.features||[]){const code=mcode(f),name=mname(f);if(!code||!code.startsWith(state))continue;
  const layer=map?L.geoJSON(f,{style:{color:'#d7e4bb',weight:.7,fillColor:'#c2cf8e',fillOpacity:.12}}):null;
  if(layer){layer.bindTooltip(esc(name),{sticky:true});
   layer.on('mouseover',ev=>{ev.target.setStyle({fillOpacity:.49,weight:2.5,color:'#f0d985'});ev.target.bringToFront()});
   layer.on('mouseout',()=>layer.setStyle({fillOpacity:.12,weight:.7,color:'#d7e4bb'}));
   layer.on('click',ev=>{L.DomEvent.stop(ev);$('municipalitySelect').value=code;chosenMunicipality=code;window.AgroPlantPickers?.sync();
     $('weatherLocation').textContent=name+', '+(stateFor(state)?.name||'México');
     setPoint(ev.latlng.lat,ev.latlng.lng,true);toast(`Municipio: ${name}`);});
  }
  cityShapes.push({code,name,layer});options.push(`<option value="${code}">${esc(name)}</option>`);
 }
 options.sort((a,b)=>a.localeCompare(b,'es')); // Orden alfabético por municipio
 const starter='<option value="">Elige tu municipio</option>';
 $('municipalitySelect').innerHTML=starter+options.filter(x=>x!==starter).join('');
 if(chosenMunicipality)$('municipalitySelect').value=chosenMunicipality;window.AgroPlantPickers?.sync();
 syncLabels();
}
function syncLabels(){if(!map)return;const z=map.getZoom();regionLabels.forEach(x=>{const v=x.getElement();if(v)v.style.display=z>=7?'none':'';});cityShapes.forEach(x=>{if(!x.layer)return;if(z>=7&&!map.hasLayer(x.layer))x.layer.addTo(map);if(z<7&&map.hasLayer(x.layer))map.removeLayer(x.layer);});}
async function fetchMunicipalities(code){if(municipalityLoading&&geoMunicipalityState===code)return;
 municipalityLoading=true;geoMunicipalityState=code;$('municipalitySelect').innerHTML='<option>Cargando municipios…</option>';
 try{
  let data;if(backend)data=await api('geo-municipalities','state='+encodeURIComponent(code));
  else{const r=await fetch('https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/'+code);data=await r.json();}
  if(code!==chosenState)return;
  if(!data?.features?.length)throw new Error('No se recibieron municipios');
  geoMunicipalities=data;drawMunicipalities(data,code);$('mapPrecision').textContent='Municipios: INEGI · Toca el municipio para seleccionar tu terreno.';
 }catch(err){if(code!==chosenState)return;
  $('municipalitySelect').innerHTML='<option value="">Municipios no disponibles</option>';window.AgroPlantPickers?.sync();
  $('mapPrecision').textContent='Elige tu terreno tocando el mapa. Municipios no disponibles en este momento.';
  console.warn('INEGI municipios',err.message);
 }finally{municipalityLoading=false;}
}
function outlineGeo(){return {type:'Feature',properties:{name:'México'},geometry:window.AGROPLANT_CONTORNO};}
function drawOutlineLayers(){
 if(!map){drawFallback();return;}
 if(outlineLayer){map.removeLayer(outlineLayer);outlineLayer=null;}outlineMarkers.forEach(x=>map.removeLayer(x));outlineMarkers=[];
 outlineLayer=L.geoJSON(outlineGeo(),{style:{color:'#fffdf3',weight:2.2,fillColor:'#b9d1ad',fillOpacity:.93}}).addTo(map);
 for(const s of states){const pin=L.circleMarker([Number(s.lat),Number(s.lon)],{radius:5.3,weight:1.7,color:'#fffdf8',fillColor:s.code===chosenState?'#c4a02e':'#5a855f',fillOpacity:1}).addTo(map);
  pin.bindTooltip(`<b>${esc(s.name)}</b><br><small>${esc(s.phrase||'Selecciona para ver más')}</small>`,{direction:'top',opacity:1});
  pin.on('click',()=>chooseState(s.code));outlineMarkers.push(pin);
 }
 $('mapPrecision').textContent='Contorno de México · Acércate a un estado para seleccionarlo';
 $('mapNote').textContent='Los límites oficiales se muestran cuando INEGI responde.';
}
function svgXY(lon,lat){return [(lon+119)*32,(33.5-lat)*32]}
function zoomFallback(mult=1,lat=null,lon=null){const svg=$('mexicoMap').querySelector('svg');if(!svg)return;
 let v=fallbackView;const nextW=Math.min(1180,Math.max(145,v.w/mult)),nextH=Math.min(680,Math.max(84,v.h/mult));
 let cx=v.x+v.w/2,cy=v.y+v.h/2;if(lat!=null&&lon!=null){[cx,cy]=svgXY(lon,lat)}
 fallbackView={w:nextW,h:nextH,x:Math.max(-70,Math.min(1180-nextW+70,cx-nextW/2)),y:Math.max(-70,Math.min(680-nextH+70,cy-nextH/2))};
 svg.setAttribute('viewBox',`${fallbackView.x} ${fallbackView.y} ${fallbackView.w} ${fallbackView.h}`);
}
function drawFallback(){const area=$('mexicoMap');if(!window.AGROPLANT_CONTORNO)return;area.querySelector('.map-loading')?.remove();
 const coords=window.AGROPLANT_CONTORNO.coordinates[0];const path=coords.map(([lon,lat],i)=>{let [x,y]=svgXY(lon,lat);return (i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)}).join(' ')+' Z';
 const labels=new Set(['02','03','05','08','10','14','15','17','19','20','21','25','26','28','30','31']);
 const pins=states.map(s=>{const [x,y]=svgXY(Number(s.lon),Number(s.lat));return `<g tabindex="0" role="button" aria-label="${esc(s.name)}" class="state-pin" data-code="${esc(s.code)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/><text x="${(x+10).toFixed(1)}" y="${(y-9).toFixed(1)}">${labels.has(s.code)?esc(s.abbr):''}</text></g>`}).join('');
 const [plotX,plotY]=svgXY(selectedLon,selectedLat);
 area.innerHTML=`<svg viewBox="0 0 1180 680" class="state-fallback-svg" role="img" aria-label="Mapa de México con puntos de sus 32 estados" xmlns="http://www.w3.org/2000/svg"><path d="${path}" class="country-outline"/><g>${pins}</g><circle id="mapSelectedPlot" class="plot-pin" cx="${plotX}" cy="${plotY}" r="8" style="pointer-events:none"/></svg><div class="map-floating-info" id="mapFloatingInfo" hidden></div>`;
 fallbackView={x:0,y:0,w:1180,h:680};
 const svg=area.querySelector('svg'),info=$('mapFloatingInfo');
 svg.querySelectorAll('.state-pin').forEach(el=>{const code=el.dataset.code,s=stateFor(code);
  const show=()=>{info.hidden=false;info.innerHTML=`<b>${esc(s.name)}</b><span>${esc(s.phrase||'Selecciona para ver el clima')}</span>`};
  el.addEventListener('pointerenter',show);el.addEventListener('focus',show);el.addEventListener('pointerleave',()=>info.hidden=true);el.addEventListener('blur',()=>info.hidden=true);
  el.addEventListener('click',()=>chooseState(code));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseState(code)}});
 });
 svg.addEventListener('wheel',e=>{e.preventDefault();zoomFallback(e.deltaY<0?1.22:1/1.22)},{passive:false});
 svg.querySelector('.country-outline')?.addEventListener('click',e=>{const r=svg.getBoundingClientRect();const x=fallbackView.x+(e.clientX-r.left)*fallbackView.w/r.width;const y=fallbackView.y+(e.clientY-r.top)*fallbackView.h/r.height;const lon=x/32-119,lat=33.5-y/32;if(isMexico(lat,lon))setPoint(lat,lon,true)});
 let down=null;svg.addEventListener('pointerdown',e=>{if(e.target.closest('.state-pin'))return;down={x:e.clientX,y:e.clientY,box:{...fallbackView}};svg.classList.add('grabbing');svg.setPointerCapture(e.pointerId)});
 svg.addEventListener('pointermove',e=>{if(!down)return;const r=svg.getBoundingClientRect();fallbackView.x=down.box.x-(e.clientX-down.x)*down.box.w/r.width;fallbackView.y=down.box.y-(e.clientY-down.y)*down.box.h/r.height;svg.setAttribute('viewBox',`${fallbackView.x} ${fallbackView.y} ${fallbackView.w} ${fallbackView.h}`)});
 svg.addEventListener('pointerup',()=>{down=null;svg.classList.remove('grabbing')});svg.addEventListener('pointercancel',()=>{down=null;svg.classList.remove('grabbing')});
 $('mapPrecision').textContent='México · toca un punto verde para elegir estado';
 $('mapNote').textContent='Al conectar INEGI se mostrarán las divisiones de estados y municipios.';
}
function initMap(){
 if(!window.L){drawFallback();return;}
 map=L.map('mexicoMap',{zoomControl:false,preferCanvas:false,minZoom:3,maxZoom:13,worldCopyJump:false,zoomSnap:.25,zoomAnimation:true,fadeAnimation:true});
 map.attributionControl.setPrefix(false);map.fitBounds([[14.3,-118.7],[32.9,-86.4]],{padding:[30,30],maxZoom:5.4});
 map.on('zoomend',()=>{syncLabels();if(map.getZoom()>=7&&!geoMunicipalities&&!municipalityLoading)fetchMunicipalities(chosenState)});
 map.on('click',ev=>{if(isMexico(ev.latlng.lat,ev.latlng.lng))setPoint(ev.latlng.lat,ev.latlng.lng,true)});
 $('mapLoading').classList.add('hidden');drawOutlineLayers();markPoint(selectedLat,selectedLon);
}
async function fetchStateGeo(){
 try{const data=backend?await api('geo-states'):await (await fetch('https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgee/')).json();
  if(!data?.features?.length||data.approximate)throw new Error('Divisiones oficiales no disponibles');drawStateGeo(data);
 }catch(err){drawOutlineLayers();$('mapPrecision').textContent='Mapa nacional · 32 estados seleccionables';}
}
async function fetchStateWeather(){try{
  let results;
  if(backend)results=(await api('weather-states')).states;
  else{
   const u=new URL('https://api.open-meteo.com/v1/forecast');u.searchParams.set('latitude',states.map(s=>s.lat).join(','));u.searchParams.set('longitude',states.map(s=>s.lon).join(','));u.searchParams.set('current','temperature_2m,relative_humidity_2m,precipitation');
   const r=await fetch(u);const a=await r.json();results=a.map((w,i)=>({code:states[i].code,temp:w.current?.temperature_2m,rain:w.current?.precipitation,humidity:w.current?.relative_humidity_2m}));
  }
  stateWeather=Object.fromEntries(results.map(x=>[String(x.code).padStart(2,'0'),x]));updateMapStyles();
 }catch(err){$('mapNote').textContent='Sin datos regionales por ahora. Selecciona un lugar para consultar su clima.';}
}
function processWeather(data){const w=data.weather||data;const c=w.current||{}, d=w.daily||{};
 $('nowTemp').textContent=c.temperature_2m!=null?fmt1(c.temperature_2m)+'°':'—°';
 $('nowRain').textContent=c.precipitation!=null?fmt1(c.precipitation)+' mm':'— mm';
 $('nowHumidity').textContent=c.relative_humidity_2m!=null?Math.round(c.relative_humidity_2m)+' %':'— %';
 $('nowWind').textContent=c.wind_speed_10m!=null?Math.round(c.wind_speed_10m)+' km/h':'— km/h';
 $('weatherIcon').textContent=weatherIcon(c.weather_code);$('weatherSummary').textContent=weatherWord(c.weather_code);
 $('freshBadge').textContent='● Actualizado';$('weatherUpdated').textContent='Observación/modelo: '+(c.time?new Date(c.time).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}):'dato reciente')+' · Open-Meteo';
 $('forecastUpdated').textContent='Fuente: Open-Meteo';
 const days=d.time||[];$('forecastDays').innerHTML=days.slice(0,5).map((dt,i)=>{
  const day=new Date(dt+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'numeric'});
  const high=d.temperature_2m_max?.[i],low=d.temperature_2m_min?.[i],pr=d.precipitation_probability_max?.[i];
  return `<div class="forecast-day"><small>${esc(day)}</small><span class="day-icon">${weatherIcon(d.weather_code?.[i])}</span><strong>${high==null?'—':Math.round(high)}° / ${low==null?'—':Math.round(low)}°</strong><em>🌧️ ${pr==null?'—':pr}% de lluvia</em></div>`;
 }).join('')||'<div class="empty">No hay pronóstico disponible.</div>';
}
async function updateWeather(){const seq=++locationSeq;
 $('freshBadge').textContent='● Consultando';
 try{const data=backend?await api('weather',`lat=${selectedLat.toFixed(4)}&lon=${selectedLon.toFixed(4)}`):await externalMeteo(selectedLat,selectedLon);
  if(seq!==locationSeq)return;processWeather(data);
 }catch(err){if(seq!==locationSeq)return;
  $('freshBadge').textContent='● Sin conexión';$('nowTemp').textContent='—°';$('weatherSummary').textContent='No se pudo actualizar el clima';$('weatherUpdated').textContent='Vuelve a intentar cuando tengas internet.';$('forecastDays').innerHTML='<div class="empty">El pronóstico no está disponible por ahora.</div>';
 }
}
async function layerChanged(key){currentLayer=key;
 $('mapSwitch').querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b.dataset.layer===key));
 if(radarLayer&&map){map.removeLayer(radarLayer);radarLayer=null;}
 if(nasaLayer&&map){map.removeLayer(nasaLayer);nasaLayer=null;}
 updateMapStyles();
 if(key==='radar'){
  $('mapLegend').innerHTML='<span>Radar de lluvia reciente</span>';
  $('mapNote').textContent='Radar de lluvia observado recientemente · RainViewer. Puede haber zonas sin cobertura.';
  if(!map){toast('Necesitas internet para ver el radar.');return;}
  try{const j=await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();const frame=j.radar?.past?.at(-1);
   if(!frame)throw new Error('Sin imágenes radar');
   radarLayer=L.tileLayer(`${j.host}${frame.path}/256/{z}/{x}/{y}/2/1_0.png`,{opacity:.64,maxNativeZoom:7,attribution:'Radar © RainViewer'}).on('tileerror',()=>{if(radarLayer){map.removeLayer(radarLayer);radarLayer=null;toast('La imagen de radar no está disponible. Sigue visible el mapa de estados.');}}).addTo(map);
   $('mapPrecision').textContent=`Radar de lluvia: ${new Date(frame.time*1000).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}`;
  }catch(err){toast('No se pudo mostrar el radar de lluvia.');}
 } else if(key==='nasa') {
  $('mapLegend').innerHTML='<span>Precipitación satelital NASA GPM</span>';
  $('mapNote').textContent='NASA GPM/IMERG: estimaciones satelitales de lluvia con retraso de publicación, no lluvia instantánea.';
  if(!map){toast('Necesitas internet para ver la capa NASA.');return;}
  try{const t=new Date(Date.now()-3*86400e3).toISOString().slice(0,10);
   nasaLayer=L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',{
    layers:'IMERG_Precipitation_Rate',format:'image/png',transparent:true,opacity:.72,version:'1.3.0',time:t,attribution:'Imagen NASA GIBS/GPM'}).on('tileerror',()=>{if(nasaLayer){map.removeLayer(nasaLayer);nasaLayer=null;toast('No hay imagen satelital disponible para esta fecha.');}}).addTo(map);
   $('mapPrecision').textContent='Capa de NASA: '+t+' · Puede tardar en estar disponible.';
  }catch(err){toast('La capa de NASA no está disponible por ahora.');}
 } else {
  $('mapNote').textContent='Los colores muestran el clima de referencia de cada estado; pueden variar dentro de tu terreno.';
  $('mapPrecision').textContent='Acércate para ver municipios, toca para ubicar tu terreno.';
 }
}
function statusColor(score){return score>=75?'#91bf75':score>=50?'#d7be63':'#d18a74'}
function renderResult(result){const c=result.selected;
 $('resultReasons').classList.remove('hidden');
 if(c.score==null){$('scoreValue').textContent='—';$('donut').style.background='conic-gradient(#94ad80 0%,#e0e6d7 100%)';
  $('resultTitle').textContent='Falta información sobre este cultivo';$('resultDescription').textContent='Podemos mostrarte el cultivo, pero todavía no hay datos suficientes para evaluarlo.';
 }else{const color=statusColor(c.score);$('scoreValue').textContent=c.score+'%';$('donut').style.background=`conic-gradient(${color} 0 ${c.score}%,#e0e6d7 ${c.score}% 100%)`;
  $('resultTitle').textContent=c.classification==='Positiva'?'Buenas condiciones para considerar':c.classification==='Intermedia'?'Se puede considerar con cuidados':'Hay condiciones poco favorables';
  $('resultDescription').textContent=`${c.name}: ${c.score} de 100 puntos de compatibilidad para las condiciones habituales de esta temporada.`;}
 $('resultWarning').textContent=result.score_note || 'Puntuación de demostración con requisitos agrícolas sin validar; no es probabilidad de cosecha.';
 $('resultReasons').innerHTML=`<div><strong>✅ A favor</strong><ul>${(c.pros?.length?c.pros:['Aún no hay datos suficientes.']).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><strong>⚠️ Ten en cuenta</strong><ul>${(c.risks||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
 $('alternativeCards').innerHTML=(result.alternatives||[]).map(o=>{
  const cc=cropFor(o.key)||{};return `<article class="alt-card"><div class="alt-top"><div class="alt-photo" id="photo_${esc(o.key)}">${esc(o.emoji)}</div><div class="alt-main"><h3>${esc(o.name)}</h3><span class="pill ${o.score<50?'bad':o.score<75?'warn':''}">${esc(o.classification)}</span></div><strong class="alt-score">${o.score==null?'—':o.score+'%'}</strong></div><p>${esc(o.why)}</p><a target="_blank" rel="noopener noreferrer" href="${esc(cc.google_images_url||'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(o.name))}">Ver fotografías ↗</a></article>`;
 }).join('')||'<div class="empty">No hay alternativas evaluadas para mostrar.</div>';
 result.alternatives?.forEach(o=>photoTag(cropFor(o.key)||o,$('photo_'+o.key)));
 $('rotationCards').innerHTML=(result.rotations||[]).map(r=>`<article class="rotation-card"><h3>${esc(r.title)}</h3><div class="rotation-sequence">${r.cycles.map((s,i)=>`${i?'→':''}<b>${esc(cropFor(s)?.name||s)}</b>`).join('')}</div><p>${esc(r.reason)}</p></article>`).join('');
 $('resultPanel').scrollIntoView({behavior:'smooth',block:'center'});
}
async function analyze(){const b=$('analyzeBtn'),old=b.textContent;b.disabled=true;b.textContent='Consultando datos de NASA…';
 const request={latitude:selectedLat,longitude:selectedLon,date:$('plantDate').value,crop:currentCrop,previous:$('previousCrop').value,soil:$('soilSelect').value,water:$('waterSelect').value,priority:$('priorities').querySelector('.selected')?.dataset.priority||'agua',save:backend&&mariaDB};
 try{
  if(!backend)throw new Error('Para analizar con NASA POWER, abre AgroPlant mediante XAMPP: http://localhost/agroplant/');
  const j=await api('analyze','',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  renderResult(j);
  if(!mariaDB)toast('Análisis listo. Conecta MariaDB para guardarlo.');
 }catch(err){toast(err.message);$('resultTitle').textContent='No se pudo realizar el análisis';$('resultDescription').textContent=err.message;}
 finally{b.disabled=false;b.textContent=old;}
}
function setupEvents(){
 $('cropSearch').addEventListener('focus',updateCropResults);
 $('cropSearch').addEventListener('input',updateCropResults);
 $('cropResults').addEventListener('click',e=>{const opt=e.target.closest('[data-crop]');if(opt)cropSelected(opt.dataset.crop)});
 $('clearCrop').addEventListener('click',()=>{$('cropSearch').value='';$('cropSearch').focus();updateCropResults()});
 document.addEventListener('click',e=>{if(!e.target.closest('.search-field')&&!e.target.closest('.crop-results'))$('cropResults').classList.add('hidden')});
 $('stateSelect').addEventListener('change',e=>chooseState(e.target.value));
 $('municipalitySelect').addEventListener('change',e=>chooseMunicipality(e.target.value));
 $('mapSwitch').addEventListener('click',e=>{const b=e.target.closest('[data-layer]');if(b)layerChanged(b.dataset.layer)});
 $('zoomIn').addEventListener('click',()=>map?map.zoomIn():zoomFallback(1.35));
 $('zoomOut').addEventListener('click',()=>map?map.zoomOut():zoomFallback(1/1.35));
 $('resetMap').addEventListener('click',()=>{if(map)map.fitBounds([[14.3,-118.7],[32.9,-86.4]],{padding:[26,26],maxZoom:5.5});else{fallbackView={x:0,y:0,w:1180,h:680};$('mexicoMap').querySelector('svg')?.setAttribute('viewBox','0 0 1180 680')}});
 $('priorities').addEventListener('click',e=>{const b=e.target.closest('button[data-priority]');if(b){$('priorities').querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));resetResult()}});
 $('analyzeBtn').addEventListener('click',analyze);
 for(let id of ['plantDate','previousCrop','soilSelect','waterSelect'])$(id).addEventListener('change',resetResult);
 $('missingCrop').addEventListener('click',()=>$('addCropDialog').showModal());
 $('closeDialog').addEventListener('click',()=>$('addCropDialog').close());
 $('addCropForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('newCropName').value.trim();if(!name)return;
  try{const j=await api('add-crop','',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
   const rc=await api('crops');crops=rc.crops;loadCatalog();cropSelected(j.slug);$('addCropDialog').close();toast(j.message);
  }catch(err){toast(err.message);}});
}
async function boot(){
 if(location.protocol==='file:')$('launchNotice').hidden=false;
 $('todayLabel').textContent=new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
 $('plantDate').value=localDate();loadCatalog();window.AgroPlantPickers?.init();setupEvents();initMap();
 try{const j=await api('status');backend=j.ok;mariaDB=j.mariadb;
  $('dbStatus').textContent=mariaDB?'✓ Cultivos conectados con MariaDB':'Página lista · conecta MariaDB para guardar';
  const [cr,st]=await Promise.all([api('crops'),api('states')]);if(cr.crops?.length)crops=cr.crops;if(st.states?.length)states=st.states;
  loadCatalog();window.AgroPlantPickers?.sync();
 }catch(err){backend=false;mariaDB=false;$('dbStatus').textContent=location.protocol==='file:'?'Para analizar, abre la página desde localhost':'Consulta sin conexión a la base';}
 fetchStateGeo();fetchStateWeather();updateWeather();
 if(backend){fetchMunicipalities(chosenState)}
}
boot();
})();
