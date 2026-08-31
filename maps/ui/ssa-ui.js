
(function(global){
'use strict';
const VERSION='7.0.2';
global.SSA_MAP_BUILD=VERSION;

function load(src){return new Promise((ok,bad)=>{if(document.querySelector(`script[data-ssa="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.dataset.ssa=src;s.onload=ok;s.onerror=bad;document.head.appendChild(s)})}
async function deps(){if(!global.turf)await load('https://cdn.jsdelivr.net/npm/@turf/turf@7.2.0/turf.min.js');if(!global.toGeoJSON)await load('https://cdn.jsdelivr.net/npm/@tmcw/togeojson@6.0.1/dist/togeojson.umd.js');if(!global.JSZip)await load('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js')}
function dl(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800)}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
const INFO={
 ndvi:{title:'NDVI',sub:'Vegetation vigour index',text:'NDVI highlights relative vegetation vigour and biomass. Higher values generally indicate denser or more actively growing vegetation.',fixed:true},
 gndvi:{title:'GNDVI',sub:'Green chlorophyll / canopy response',text:'GNDVI is more sensitive to green reflectance and is commonly used as a chlorophyll and canopy-response indicator.',fixed:true},
 ndre:{title:'NDRE',sub:'Red-edge vegetation response',text:'NDRE is useful for chlorophyll and crop-stress assessment where canopy is relatively dense.',fixed:false},
 osavi:{title:'OSAVI',sub:'Soil-adjusted vegetation response',text:'OSAVI reduces visible-soil influence when assessing vegetation condition.',fixed:false},
 lci:{title:'LCI',sub:'Leaf chlorophyll indicator',text:'LCI is a relative indicator of leaf chlorophyll response.',fixed:false}
};

class SSAUI{
 constructor(o){
  this.maps=o.maps||(o.map?[o.map]:[]);this.master=o.masterMap||this.maps[0];this.container=o.container||this.master.getContainer();
  this.layers=o.layers||[];this.current=o.currentLayer||(()=>null);this.setLayer=o.setLayer||(()=>{});this.setBase=o.setBase||(()=>{});this.fit=o.fit||(()=>{});this.back=o.back||(()=>history.back());this.swipe=o.swipe||null;this.fileNameBase=o.fileNameBase||'map-layer';
  this.features=[];this.coords=[];this.mode=null;this.shaded=true;this.source='ssa-v7-draw';this.init();
 }
 async init(){
  await deps();this.build();
  this.maps.forEach(m=>m.loaded()?this.install(m):m.on('load',()=>this.install(m)));
  this.master.doubleClickZoom.disable();
  this.master.on('click',e=>this.click(e));this.master.on('dblclick',e=>{if(this.mode){e.preventDefault();this.finish()}});this.master.on('mousemove',e=>this.move(e));this.master.on('styledata',()=>this.maps.forEach(m=>this.raise(m)));
  this.refreshQuick();
 }
 install(m){
  if(!m.getSource(this.source))m.addSource(this.source,{type:'geojson',data:this.fc()});
  if(!m.getLayer('ssa-v7-halo'))m.addLayer({id:'ssa-v7-halo',type:'line',source:this.source,paint:{'line-color':'#000','line-width':8,'line-opacity':.65}});
  if(!m.getLayer('ssa-v7-fill'))m.addLayer({id:'ssa-v7-fill',type:'fill',source:this.source,filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#00eaff','fill-opacity':.22}});
  if(!m.getLayer('ssa-v7-line'))m.addLayer({id:'ssa-v7-line',type:'line',source:this.source,paint:{'line-color':'#00eaff','line-width':4}});
  if(!m.getLayer('ssa-v7-point'))m.addLayer({id:'ssa-v7-point',type:'circle',source:this.source,filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':6,'circle-color':'#00eaff','circle-stroke-color':'#000','circle-stroke-width':2}});
  this.raise(m);
 }
 raise(m){['ssa-v7-halo','ssa-v7-fill','ssa-v7-line','ssa-v7-point'].forEach(id=>{try{if(m.getLayer(id))m.moveLayer(id)}catch(e){}})}
 build(){
  const build=document.createElement('div');build.className='ssa-build';build.textContent='Map UI '+VERSION;this.container.appendChild(build);
  const back=document.createElement('button');back.className='ssa-back';back.innerHTML='<span>←</span>Back';back.onclick=()=>this.back();this.container.appendChild(back);
  const rail=document.createElement('div');rail.className='ssa-rail';rail.innerHTML='<button data-r="layers"><span class="ico">▱</span>Layers</button><button data-r="tools"><span class="ico">⌁</span>Use<br>Tools</button>';this.container.appendChild(rail);this.rail=rail;
  const panel=document.createElement('div');panel.className='ssa-panel hidden';panel.innerHTML='<div class="ssa-head"><span id="ssaTitle"></span><button class="ssa-close">×</button></div><div id="ssaBody"></div>';this.container.appendChild(panel);this.panel=panel;panel.querySelector('.ssa-close').onclick=()=>this.close();
  rail.querySelector('[data-r=layers]').onclick=()=>this.openLayers();rail.querySelector('[data-r=tools]').onclick=()=>this.openTools();
  if(this.layers.length){const q=document.createElement('div');q.className='ssa-quick';q.innerHTML='<b>Imagery</b><select></select>';this.container.appendChild(q);this.quick=q;q.querySelector('select').onchange=e=>{this.setLayer(e.target.value);setTimeout(()=>{this.maps.forEach(m=>this.raise(m));this.legendFor(e.target.value,true)},50)}}
  this.legend=document.createElement('div');this.legend.className='ssa-legend hidden';this.container.appendChild(this.legend);
  this.info=document.createElement('div');this.info.className='ssa-info hidden';this.container.appendChild(this.info);
 }
 active(name){this.rail.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.r===name))}
 close(){this.panel.classList.add('hidden');this.active(null)}
 panelSet(title,html){this.panel.classList.remove('hidden');this.panel.querySelector('#ssaTitle').textContent=title;this.panel.querySelector('#ssaBody').innerHTML=html}
 refreshQuick(){if(!this.quick)return;const s=this.quick.querySelector('select'),cur=this.current();s.innerHTML='';this.layers.forEach(L=>{const o=document.createElement('option');o.value=L.id;o.textContent=L.label;s.appendChild(o)});if(this.layers.some(L=>L.id===cur))s.value=cur;this.legendFor(cur,false)}
 openLayers(){this.active('layers');this.panelSet('Layers & view','<div class="ssa-pane active"><div class="ssa-section">Basemap</div><div class="ssa-actions"><button id="bm">Map</button><button class="green" id="bs">Satellite</button></div><div class="ssa-section" style="margin-top:15px">Imagery</div><select id="ls" class="ssa-select"></select><div class="ssa-actions"><button id="fit">Fit survey</button></div></div>');this.panel.querySelector('#bm').onclick=()=>this.setBase(false);this.panel.querySelector('#bs').onclick=()=>this.setBase(true);this.panel.querySelector('#fit').onclick=()=>this.fit();const s=this.panel.querySelector('#ls');this.layers.forEach(L=>{const o=document.createElement('option');o.value=L.id;o.textContent=L.label;s.appendChild(o)});s.value=this.current();s.onchange=e=>{this.setLayer(e.target.value);if(this.quick)this.quick.querySelector('select').value=e.target.value;setTimeout(()=>{this.maps.forEach(m=>this.raise(m));this.legendFor(e.target.value,true)},50)}}
 openIdentify(){this.active('identify');this.identifyOnce=true;this.panelSet('Identify','<div class="ssa-pane active"><div class="ssa-readout">Click the map to read coordinates.</div></div>')}
 openData(){this.active('data');this.panelSet('Data','<div class="ssa-pane active"><div class="ssa-actions"><label>Import KML / KMZ / GeoJSON<input id="imp" type="file" accept=".kml,.kmz,.geojson,.json"></label><button id="ek">Export KML</button><button id="eg">Export GeoJSON</button></div><div class="ssa-readout">Imported and drawn geometry is held in this browser session.</div></div>');this.panel.querySelector('#imp').onchange=e=>this.importFile(e.target.files[0]);this.panel.querySelector('#ek').onclick=()=>this.exportKML();this.panel.querySelector('#eg').onclick=()=>this.exportJSON()}
 grid(items){return '<div class="ssa-grid">'+items.map(i=>`<button class="ssa-tool" data-tool="${i[0]}" ${i[3]?'disabled':''}><span class="box">${i[1]}</span>${i[2]}</button>`).join('')+'</div>'}
 actions(){return `<div class="ssa-actions"><button class="green" data-act="shade">Shading: ${this.shaded?'On':'Off'}</button><button data-act="finish">Finish</button><button data-act="undo">Undo</button><button class="danger" data-act="clear">Clear</button></div>`}
 openTools(){
  this.active('tools');
  this.panelSet('Measure',`<div class="ssa-pane active">
    ${this.grid([['length','↔','Length'],['area','▱','Area'],['radius','◉','Radius']])}
    ${this.actions()}
    <div class="ssa-readout">Choose a measurement tool.</div>
  </div>`);
  this.panel.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{
    this.mode=b.dataset.tool;this.coords=[];
    this.panel.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));
    this.sync();
  });
  this.panel.querySelectorAll('[data-act=finish]').forEach(b=>b.onclick=()=>this.finish());
  this.panel.querySelectorAll('[data-act=undo]').forEach(b=>b.onclick=()=>this.undo());
  this.panel.querySelectorAll('[data-act=clear]').forEach(b=>b.onclick=()=>this.clear());
  this.panel.querySelectorAll('[data-act=shade]').forEach(b=>b.onclick=()=>{
    this.shaded=!this.shaded;
    this.maps.forEach(m=>{if(m.getLayer('ssa-v7-fill'))m.setPaintProperty('ssa-v7-fill','fill-opacity',this.shaded?.22:0)});
    this.panel.querySelectorAll('[data-act=shade]').forEach(x=>x.textContent='Shading: '+(this.shaded?'On':'Off'));
  });
 }
 readout(){return this.panel.querySelector('.ssa-pane.active .ssa-readout')}
 click(e){if(this.identifyOnce){this.identifyOnce=false;const r=this.panel.querySelector('.ssa-readout');if(r)r.innerHTML=`<b>${e.lngLat.lng.toFixed(6)}, ${e.lngLat.lat.toFixed(6)}</b>`;return}if(!this.mode)return;const c=[e.lngLat.lng,e.lngLat.lat];if(this.mode==='label'){const t=prompt('Label text:','');if(t)this.features.push(turf.point(c,{name:t}));this.mode=null;this.sync();return}if(this.mode==='pin'){this.features.push(turf.point(c,{name:'Pin'}));this.mode=null;this.sync();return}this.coords.push(c);if(this.mode==='rectangle'&&this.coords.length===2){this.finish();return}if((this.mode==='radius'||this.mode==='circle')&&this.coords.length===2){this.finish();return}this.sync();this.update(this.coords)}
 move(e){if(!this.mode||!this.coords.length)return;this.update([...this.coords,[e.lngLat.lng,e.lngLat.lat]])}
 undo(){if(this.coords.length){this.coords.pop();this.sync();this.update(this.coords)}}
 finish(){let f=null;if((this.mode==='length'||this.mode==='line')&&this.coords.length>=2)f=turf.lineString(this.coords);if((this.mode==='area'||this.mode==='polygon')&&this.coords.length>=3)f=turf.polygon([[...this.coords,this.coords[0]]]);if(this.mode==='rectangle'&&this.coords.length===2){const a=this.coords[0],b=this.coords[1];f=turf.polygon([[[a[0],a[1]],[b[0],a[1]],[b[0],b[1]],[a[0],b[1]],[a[0],a[1]]]])}if((this.mode==='radius'||this.mode==='circle')&&this.coords.length===2){const km=turf.distance(turf.point(this.coords[0]),turf.point(this.coords[1]),{units:'kilometers'});f=turf.circle(this.coords[0],km,{steps:64,units:'kilometers'})}if(!f)return;this.features.push(f);this.coords=[];this.mode=null;this.sync();const r=this.readout();if(r)r.innerHTML=this.describe(f)}
 fc(){const fs=[...this.features];if(this.coords.length>=2&&['length','line','area','polygon'].includes(this.mode))fs.push(turf.lineString(this.coords,{preview:true}));this.coords.forEach(c=>fs.push(turf.point(c,{preview:true})));return turf.featureCollection(fs)}
 sync(){const d=this.fc();this.maps.forEach(m=>{const s=m.getSource(this.source);if(s)s.setData(d);this.raise(m)})}
 update(c){const r=this.readout();if(!r)return;if(['length','line'].includes(this.mode)&&c.length>=2)r.innerHTML=this.distance(c);if(['area','polygon'].includes(this.mode)&&c.length>=3)r.innerHTML=this.area(c);if(['radius','circle'].includes(this.mode)&&c.length>=2){const km=turf.distance(turf.point(c[0]),turf.point(c[1]),{units:'kilometers'});r.innerHTML=`<b>Radius ${km<1?(km*1000).toFixed(1)+' m':km.toFixed(3)+' km'}</b><br>Area ${(Math.PI*km*km*100).toFixed(3)} ha`}}
 distance(c){const km=turf.length(turf.lineString(c),{units:'kilometers'});return `<b>${km<1?(km*1000).toFixed(1)+' m':km.toFixed(3)+' km'}</b>`}
 area(c){const p=turf.polygon([[...c,c[0]]]),sqm=turf.area(p),ha=sqm/10000,per=turf.length(turf.polygonToLine(p),{units:'kilometers'});return `<b>${ha.toFixed(3)} ha</b><br>${sqm.toFixed(0)} m² · perimeter ${per<1?(per*1000).toFixed(0)+' m':per.toFixed(2)+' km'}`}
 describe(f){if(f.geometry.type==='Polygon')return this.area(f.geometry.coordinates[0].slice(0,-1));if(f.geometry.type==='LineString')return this.distance(f.geometry.coordinates);return f.geometry.type}
 clear(){this.features=[];this.coords=[];this.mode=null;this.sync();const r=this.readout();if(r)r.textContent='Cleared.'}
 legendFor(id,flash){if(!id||id==='rgb'){this.legend.classList.add('hidden');return}const x=INFO[id.toLowerCase()]||{title:id.toUpperCase(),sub:'Vegetation index',text:'Relative vegetation index. Interpret higher and lower values in context.',fixed:false};this.legend.classList.remove('hidden');this.legend.innerHTML=`<div class="ssa-legend-head"><span>${x.title}<br><small>${x.sub}</small></span><button>i</button></div><div class="ssa-gradient"></div><div class="ssa-ticks">${x.fixed?'<span>-1</span><span>0</span><span>0.4</span><span>0.7</span><span>1</span>':'<span>Lower</span><span>Higher</span>'}</div>`;this.legend.querySelector('button').onclick=()=>this.popup(x);if(flash)this.popup(x,true)}
 popup(x,auto){this.info.classList.remove('hidden');this.info.innerHTML=`<b>${x.title}</b><br>${x.text}`;if(auto)setTimeout(()=>this.info.classList.add('hidden'),5000)}
 async importFile(file){if(!file)return;try{let g;const n=file.name.toLowerCase();if(n.endsWith('.json')||n.endsWith('.geojson'))g=JSON.parse(await file.text());else if(n.endsWith('.kml'))g=toGeoJSON.kml(new DOMParser().parseFromString(await file.text(),'text/xml'));else if(n.endsWith('.kmz')){const z=await JSZip.loadAsync(await file.arrayBuffer());const k=Object.keys(z.files).find(x=>x.toLowerCase().endsWith('.kml'));if(!k)throw new Error('KMZ contains no KML');g=toGeoJSON.kml(new DOMParser().parseFromString(await z.files[k].async('text'),'text/xml'))}const fs=g.type==='FeatureCollection'?g.features:[g];this.features.push(...fs.filter(x=>x&&x.geometry));this.sync()}catch(e){alert('Import failed: '+e.message)}}
 exportJSON(){if(this.features.length)dl(new Blob([JSON.stringify(turf.featureCollection(this.features),null,2)],{type:'application/geo+json'}),this.fileNameBase+'.geojson')}
 exportKML(){if(!this.features.length)return;const pm=this.features.map((f,i)=>{const n=esc(f.properties?.name||`Feature ${i+1}`);if(f.geometry.type==='LineString')return `<Placemark><name>${n}</name><LineString><coordinates>${f.geometry.coordinates.map(c=>`${c[0]},${c[1]},0`).join(' ')}</coordinates></LineString></Placemark>`;if(f.geometry.type==='Polygon')return `<Placemark><name>${n}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${f.geometry.coordinates[0].map(c=>`${c[0]},${c[1]},0`).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;return''}).join('');dl(new Blob([`<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${pm}</Document></kml>`],{type:'application/vnd.google-earth.kml+xml'}),this.fileNameBase+'.kml')}
}
global.SSAUI=SSAUI;
})(window);
