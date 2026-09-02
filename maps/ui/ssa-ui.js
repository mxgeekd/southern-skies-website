
(function(global){
'use strict';
const VERSION='7.0.7';
global.SSA_MAP_BUILD=VERSION;
const INDEX_INFO=Object.freeze({
 ndvi:{name:'NDVI',subtitle:'Vegetation vigour index',description:'Highlights relative vegetation vigour and biomass. Higher values generally indicate denser or more actively growing vegetation.',signed:true},
 gndvi:{name:'GNDVI',subtitle:'Green chlorophyll / canopy response',description:'More sensitive to green reflectance and commonly used as a chlorophyll and canopy-response indicator.',signed:true},
 ndre:{name:'NDRE',subtitle:'Red-edge vegetation response',description:'Uses the red-edge band and is useful for looking at chlorophyll and crop stress in denser canopy.',signed:false},
 osavi:{name:'OSAVI',subtitle:'Soil-adjusted vegetation response',description:'Reduces visible-soil background influence when assessing vegetation condition.',signed:false},
 lci:{name:'LCI',subtitle:'Leaf chlorophyll indicator',description:'Used as a relative indicator of leaf chlorophyll response.',signed:false},
 hillshade:{name:'Hillshade',subtitle:'Terrain shaded relief',description:'Shaded relief derived from the survey ground-elevation model. Use it to interpret ridges, hollows and drainage patterns.',gradient:false}
});

function load(src){return new Promise((ok,bad)=>{if(document.querySelector(`script[data-ssa="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.dataset.ssa=src;s.onload=ok;s.onerror=bad;document.head.appendChild(s)})}
async function deps(){if(!global.turf)await load('https://cdn.jsdelivr.net/npm/@turf/turf@7.2.0/turf.min.js')}

class SSAUI{
 constructor(o){
  this.maps=o.maps||(o.map?[o.map]:[]);
  this.master=o.masterMap||this.maps[0];
  this.container=o.container||this.master.getContainer();
  this.layers=o.layers||[];this.layersDisabled=o.showLayers===false;
  this.current=o.currentLayer||(()=>null);
  this.setLayer=o.setLayer||(()=>{});
  this.setBase=o.setBase||(()=>{});
  this.fit=o.fit||(()=>{});
  this.back=o.back||(()=>history.back());
  this.fileNameBase=o.fileNameBase||'map-layer';
  this.features=[];this.coords=[];this.mode=null;this.shaded=true;
  this.init();
 }
 async init(){
  await deps();
  this.build();
  this.legendFor(this.current(),false);
  this.master.doubleClickZoom.disable();
  this.master.on('click',e=>this.click(e));
  this.master.on('dblclick',e=>{if(this.mode==='pathpoly'){e.preventDefault();this.finishPath()}});
  this.master.on('mousemove',e=>this.move(e));
  ['move','zoom','resize','rotate','pitch','render'].forEach(ev=>this.master.on(ev,()=>this.renderOverlay()));
 }
 build(){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('ssa-measure-overlay');
  this.container.appendChild(svg);this.svg=svg;

  const build=document.createElement('div');build.className='ssa-build';build.textContent='Map UI '+VERSION;this.container.appendChild(build);

  const back=document.createElement('button');back.className='ssa-back';back.innerHTML='<span>←</span>Back';back.onclick=()=>this.back();this.container.appendChild(back);

  const rail=document.createElement('div');rail.className='ssa-rail';rail.innerHTML=(this.layersDisabled?'':'<button data-r="layers"><span class="ico">▱</span>Layers</button>')+'<button data-r="tools"><span class="ico">⌁</span>Use<br>Tools</button>';this.container.appendChild(rail);this.rail=rail;

  const panel=document.createElement('div');panel.className='ssa-panel hidden';panel.innerHTML='<div class="ssa-head"><span id="ssaTitle"></span><button class="ssa-close">×</button></div><div id="ssaBody"></div>';this.container.appendChild(panel);this.panel=panel;
  panel.querySelector('.ssa-close').onclick=()=>this.close();
  rail.querySelector('[data-r=layers]')?.addEventListener('click',()=>this.openLayers());
  rail.querySelector('[data-r=tools]').onclick=()=>this.openTools();

  const legend=document.createElement('div');legend.className='ssa-legend hidden';legend.setAttribute('aria-live','polite');this.container.appendChild(legend);this.legend=legend;
 }
 active(name){this.rail.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.r===name))}
 close(){this.panel.classList.add('hidden');this.active(null)}
 panelSet(title,html){this.panel.classList.remove('hidden');this.panel.querySelector('#ssaTitle').textContent=title;this.panel.querySelector('#ssaBody').innerHTML=html}
 openLayers(){
  this.active('layers');
  this.panelSet('Layers & view',`<div class="ssa-pane"><div class="ssa-section">Basemap</div><div class="ssa-actions"><button id="bm">Map</button><button class="green" id="bs">Satellite</button></div><div class="ssa-actions"><button id="fit">Fit survey</button></div></div>`);
  this.panel.querySelector('#bm').onclick=()=>this.setBase(false);
  this.panel.querySelector('#bs').onclick=()=>this.setBase(true);
  this.panel.querySelector('#fit').onclick=()=>this.fit();
 }
 legendFor(id,flash=false){
  if(!this.legend)return null;
  const key=typeof id==='string'?id.trim().toLowerCase():'';
  if(!key||['rgb','map','satellite','__satellite__'].includes(key)){
   this.legend.replaceChildren();this.legend.classList.add('hidden');return null;
  }
  const x=INDEX_INFO[key]||{name:String(id).toUpperCase(),subtitle:'Vegetation index',description:'Relative vegetation-index layer. Interpret lower and higher values in the context of the specific index and field conditions.',signed:false};
  const head=document.createElement('div');head.className='ssa-legend-head';
  const title=document.createElement('span');title.textContent=x.name;
  const sub=document.createElement('small');sub.textContent=x.subtitle;title.appendChild(document.createElement('br'));title.appendChild(sub);head.appendChild(title);
  const desc=document.createElement('div');desc.className='ssa-legend-desc';desc.textContent=x.description;
  const parts=[head,desc];
  if(x.gradient!==false){
   const gradient=document.createElement('div');gradient.className='ssa-gradient';
   const ticks=document.createElement('div');ticks.className='ssa-ticks';
   (x.signed?['-1','0','0.4','0.7','1']:['Lower','Higher']).forEach(v=>{const span=document.createElement('span');span.textContent=v;ticks.appendChild(span)});
   parts.push(gradient,ticks);
  }
  this.legend.replaceChildren(...parts);this.legend.classList.remove('hidden');
  void flash;
  return x;
 }
 openTools(){
  this.active('tools');
  this.panelSet('Measure',`<div class="ssa-pane">
   <div class="ssa-grid">
    <button class="ssa-tool" data-tool="pathpoly"><span class="box">⌁</span>Path / Polygon</button>
    <button class="ssa-tool" data-tool="radius"><span class="box">◉</span>Radius</button>
   </div>
   <div class="ssa-actions">
    <button data-act="finish">Finish path</button>
    <button data-act="closepoly">Close polygon</button>
    <button class="green" data-act="shade">Shading: ${this.shaded?'On':'Off'}</button>
    <button data-act="undo">Undo</button>
    <button class="danger" data-act="clear">Clear</button>
   </div>
   <div class="ssa-readout">Choose a measurement tool.</div>
  </div>`);
  this.panel.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{
   this.mode=b.dataset.tool;this.coords=[];
   this.panel.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));
   this.renderOverlay();
   const r=this.readout();if(r)r.textContent=this.mode==='radius'?'Click the centre, then the edge.':'Click points to draw a path. Close polygon when you want an area.';
  });
  this.panel.querySelector('[data-act=finish]').onclick=()=>this.finishPath();
  this.panel.querySelector('[data-act=closepoly]').onclick=()=>this.closePolygon();
  this.panel.querySelector('[data-act=undo]').onclick=()=>this.undo();
  this.panel.querySelector('[data-act=clear]').onclick=()=>this.clear();
  this.panel.querySelector('[data-act=shade]').onclick=e=>{this.shaded=!this.shaded;e.currentTarget.textContent='Shading: '+(this.shaded?'On':'Off');this.renderOverlay()};
 }
 readout(){return this.panel.querySelector('.ssa-readout')}
 click(e){
  if(!this.mode)return;
  this.coords.push([e.lngLat.lng,e.lngLat.lat]);
  if(this.mode==='radius'&&this.coords.length===2){this.finishRadius();return}
  this.renderOverlay();this.updateReadout(this.coords);
 }
 move(e){
  if(!this.mode||!this.coords.length)return;
  const temp=[...this.coords,[e.lngLat.lng,e.lngLat.lat]];
  this.renderOverlay(temp);this.updateReadout(temp);
 }
 undo(){if(this.coords.length){this.coords.pop();this.renderOverlay();this.updateReadout(this.coords)}}
 finishPath(){
  if(this.mode!=='pathpoly'||this.coords.length<2)return;
  this.features.push({type:'line',coords:[...this.coords]});
  const c=[...this.coords];this.coords=[];this.mode=null;this.renderOverlay();
  const r=this.readout();if(r)r.innerHTML=this.pathText(c);
 }
 closePolygon(){
  if(this.mode!=='pathpoly'||this.coords.length<3)return;
  this.features.push({type:'polygon',coords:[...this.coords]});
  const c=[...this.coords];this.coords=[];this.mode=null;this.renderOverlay();
  const r=this.readout();if(r)r.innerHTML=this.areaText(c);
 }
 finishRadius(){
  if(this.mode!=='radius'||this.coords.length!==2)return;
  const km=turf.distance(turf.point(this.coords[0]),turf.point(this.coords[1]),{units:'kilometers'});
  this.features.push({type:'radius',center:this.coords[0],edge:this.coords[1],radiusKm:km});
  this.coords=[];this.mode=null;this.renderOverlay();
  const r=this.readout();if(r)r.innerHTML=`<b>Radius ${km<1?(km*1000).toFixed(1)+' m':km.toFixed(3)+' km'}</b><br>Area ${(Math.PI*km*km*100).toFixed(3)} ha`;
 }
 clear(){this.features=[];this.coords=[];this.mode=null;this.renderOverlay();const r=this.readout();if(r)r.textContent='Cleared.'}
 updateReadout(c){
  const r=this.readout();if(!r)return;
  if(this.mode==='pathpoly'&&c.length>=2)r.innerHTML=this.pathText(c);
  if(this.mode==='radius'&&c.length>=2){
   const km=turf.distance(turf.point(c[0]),turf.point(c[1]),{units:'kilometers'});
   r.innerHTML=`<b>Radius ${km<1?(km*1000).toFixed(1)+' m':km.toFixed(3)+' km'}</b>`;
  }
 }
 pathText(c){
  const km=turf.length(turf.lineString(c),{units:'kilometers'});
  let heading='';
  if(c.length>=2){const b=turf.bearing(turf.point(c[c.length-2]),turf.point(c[c.length-1]));heading=`<br>Heading ${((b+360)%360).toFixed(0)} deg`;}
  return `<b>Length ${km<1?(km*1000).toFixed(1)+' m':km.toFixed(3)+' km'}</b>${heading}<br>${c.length} points`;
 }
 areaText(c){
  const poly=turf.polygon([[...c,c[0]]]),sqm=turf.area(poly),ha=sqm/10000,per=turf.length(turf.polygonToLine(poly),{units:'kilometers'});
  return `<b>${ha.toFixed(3)} ha</b><br>${sqm.toFixed(0)} m² · perimeter ${per<1?(per*1000).toFixed(0)+' m':per.toFixed(2)+' km'}`;
 }
 project(c){const p=this.master.project({lng:c[0],lat:c[1]});return [p.x,p.y]}
 pathD(coords,closed=false){
  if(!coords.length)return'';
  const pts=coords.map(c=>this.project(c));
  return pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')+(closed?' Z':'');
 }
 addSvg(tag,cls,attrs={}){
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);el.setAttribute('class',cls);
  Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));this.svg.appendChild(el);return el;
 }
 renderOverlay(temp=null){
  if(!this.svg)return;
  this.svg.innerHTML='';
  const drawPath=(coords,closed,fill)=>{
   const d=this.pathD(coords,closed);
   if(fill&&this.shaded)this.addSvg('path','fill',{d});
   this.addSvg('path','halo',{d});
   this.addSvg('path','line',{d});
  };
  this.features.forEach(f=>{
   if(f.type==='line')drawPath(f.coords,false,false);
   if(f.type==='polygon')drawPath(f.coords,true,true);
   if(f.type==='radius'){
    const c=this.project(f.center),e=this.project(f.edge),r=Math.hypot(e[0]-c[0],e[1]-c[1]);
    if(this.shaded)this.addSvg('circle','fill',{cx:c[0],cy:c[1],r});
    this.addSvg('circle','halo',{cx:c[0],cy:c[1],r});
    this.addSvg('circle','line',{cx:c[0],cy:c[1],r});
   }
  });
  const coords=temp||this.coords;
  if(this.mode==='pathpoly'&&coords.length)drawPath(coords,false,false);
  if(this.mode==='radius'&&coords.length===2){
   const c=this.project(coords[0]),e=this.project(coords[1]),r=Math.hypot(e[0]-c[0],e[1]-c[1]);
   this.addSvg('circle','halo',{cx:c[0],cy:c[1],r});this.addSvg('circle','line',{cx:c[0],cy:c[1],r});
  }
  coords.forEach(c=>{const p=this.project(c);this.addSvg('circle','vertex',{cx:p[0],cy:p[1],r:6})});
 }
}
global.SSAUI=SSAUI;
})(window);
