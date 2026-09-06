(function(global){
'use strict';

const STATUS='PLANNED — EXECUTION UNVERIFIED';
const IDS={source:'ssa-t50-plan',prescriptionSource:'ssa-t50-prescription-source',prescription:'ssa-t50-prescription',obstacleFill:'ssa-t50-obstacle-fill',obstacleLine:'ssa-t50-obstacle-line',boundary:'ssa-t50-boundary',transit:'ssa-t50-transit',route:'ssa-t50-route',spray:'ssa-t50-spray'};
const LAYERS=[IDS.prescription,IDS.obstacleFill,IDS.obstacleLine,IDS.boundary,IDS.transit,IDS.route,IDS.spray];

class SSAT50Overlay{
 constructor(options){
  Object.assign(this,options);this.manifest=null;this.plan=null;this.data=null;
  this.state={visible:true,route:true,spray:true,prescription:true,boundary:true,obstacles:true,opacity:.5};
 }
 async init(){
  try{const response=await fetch(this.manifestUrl||'/maps/t50/manifest.json');if(!response.ok)throw Error('No local T50 manifest.');this.manifest=await response.json()}
  catch(error){this.manifest={plans:[]};this.error=error.message}
  this.selectRelevantPlan();this.renderControl();await this.loadSelected();return this;
 }
 normalContext(){return this.getNormalContext()}
 relevantPlans(){const context=this.normalContext();return(this.manifest?.plans||[]).filter(plan=>plan.propertyId===context.propertyId&&plan.paddockId===context.paddockId)}
 selectRelevantPlan(){const plans=this.relevantPlans();if(!plans.some(plan=>plan.id===this.plan?.id))this.plan=plans[0]||null}
 renderControl(){
  this.mount.replaceChildren();this.mount.className='t50-control';this.mount.hidden=false;
  const head=document.createElement('div');head.className='t50-control__head';const title=document.createElement('strong');title.textContent='T50 PLANNING';const master=document.createElement('label');master.className='t50-master';const masterInput=document.createElement('input');masterInput.type='checkbox';masterInput.checked=this.state.visible;masterInput.setAttribute('aria-label','Show T50 planning overlay');master.append(masterInput,document.createTextNode('Show'));head.append(title,master);
  const status=document.createElement('div');status.className='t50-status';status.textContent=STATUS;this.mount.append(head,status);
  const plans=this.relevantPlans();if(!plans.length){const empty=document.createElement('p');empty.className='t50-empty';empty.textContent=this.error||'No T50 plan is associated with this property and paddock.';this.mount.appendChild(empty);masterInput.disabled=true;return}
  const selector=document.createElement('select');selector.setAttribute('aria-label','T50 plan');plans.forEach(plan=>{const option=document.createElement('option');option.value=plan.id;option.textContent=plan.name;selector.appendChild(option)});selector.value=this.plan.id;this.mount.appendChild(selector);
  const options=document.createElement('div');options.className='t50-options';const toggles=[['route','Route'],['spray','Planned spray'],['prescription','Prescription'],['boundary','Boundary'],['obstacles','Obstacles']];
  toggles.forEach(([key,label])=>{const wrap=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=this.state[key];input.disabled=!this.plan.available?.[key==='spray'?'spraySections':key];input.onchange=()=>{this.state[key]=input.checked;this.refreshTargets()};wrap.append(input,document.createTextNode(label));options.appendChild(wrap)});
  const opacity=document.createElement('label');opacity.className='t50-opacity';const range=document.createElement('input');range.type='range';range.min='0';range.max='0.8';range.step='0.05';range.value=String(this.state.opacity);range.disabled=!this.plan.prescription;opacity.append(document.createTextNode('Prescription opacity'),range);options.appendChild(opacity);this.mount.appendChild(options);
  const info=document.createElement('p');info.className='t50-info';this.mount.appendChild(info);this.renderInfo(info);
  masterInput.onchange=()=>{this.state.visible=masterInput.checked;this.refreshTargets()};selector.onchange=async()=>{this.plan=plans.find(plan=>plan.id===selector.value);this.data=null;this.renderControl();await this.loadSelected()};range.oninput=()=>{this.state.opacity=Number(range.value);this.targets().forEach(target=>{if(target.map.getLayer(IDS.prescription))target.map.setPaintProperty(IDS.prescription,'raster-opacity',this.state.opacity)})};
 }
 renderInfo(node){if(!this.plan)return;const speed=this.plan.plannedSpeedMps,height=this.plan.plannedHeightM,fmt=value=>value?.minimum===value?.maximum?String(value.minimum):`${value?.minimum}–${value?.maximum}`;node.replaceChildren();const name=document.createElement('b');name.textContent=this.plan.name;node.append(name,document.createElement('br'),document.createTextNode(`${this.plan.planDate} · ${this.plan.operationType||'unknown'} plan`),document.createElement('br'),document.createTextNode(`Planned speed ${fmt(speed)} m/s · Planned height ${fmt(height)} m`),document.createElement('br'),document.createTextNode(this.plan.prescription?.meaning&&this.plan.prescription?.units?`${this.plan.prescription.meaning} · ${this.plan.prescription.units}`:'Prescription meaning and units not supplied.'))}
 async loadSelected(){if(!this.plan){this.clearAll();return}try{const response=await fetch(this.plan.geojson);if(!response.ok)throw Error('Plan geometry could not be loaded.');this.data=await response.json();await this.refreshTargets()}catch(error){this.error=error.message;this.state.visible=false;this.clearAll();this.renderControl()}}
 targets(){return(this.getTargets?.()||[]).filter(target=>target?.map)}
 contextMatches(target){return this.plan&&target.propertyId===this.plan.propertyId&&target.paddockId===this.plan.paddockId}
 clearTarget(map){if(!map?.isStyleLoaded())return;[...LAYERS].reverse().forEach(id=>{if(map.getLayer(id))map.removeLayer(id)});[IDS.source,IDS.prescriptionSource].forEach(id=>{if(map.getSource(id))map.removeSource(id)})}
 clearAll(){this.targets().forEach(target=>this.clearTarget(target.map))}
 async refreshTargets(){for(const target of this.targets()){const map=target.map;if(!map.isStyleLoaded())continue;this.clearTarget(map);if(!this.state.visible||!this.data||!this.contextMatches(target))continue;this.install(map)} }
 install(map){
  if(this.state.prescription&&this.plan.prescription){const rx=this.plan.prescription;map.addSource(IDS.prescriptionSource,{type:'raster',tiles:[rx.tiles],scheme:rx.scheme||'tms',tileSize:rx.tileSize||256,minzoom:rx.minzoom,maxzoom:rx.maxzoom,bounds:[rx.bounds[0][0],rx.bounds[0][1],rx.bounds[1][0],rx.bounds[1][1]],attribution:'Southern Skies Agritech · T50 prescription (planned data)'});map.addLayer({id:IDS.prescription,type:'raster',source:IDS.prescriptionSource,paint:{'raster-opacity':this.state.opacity,'raster-fade-duration':0}})}
  map.addSource(IDS.source,{type:'geojson',data:this.data});
  if(this.state.obstacles){map.addLayer({id:IDS.obstacleFill,type:'fill',source:IDS.source,filter:['==',['get','kind'],'obstacle'],paint:{'fill-color':'#e89b15','fill-opacity':.24}});map.addLayer({id:IDS.obstacleLine,type:'line',source:IDS.source,filter:['==',['get','kind'],'obstacle'],paint:{'line-color':'#ffad24','line-width':2}})}
  if(this.state.boundary)map.addLayer({id:IDS.boundary,type:'line',source:IDS.source,filter:['==',['get','kind'],'field-boundary'],paint:{'line-color':'#f4dc69','line-width':1.5,'line-dasharray':[3,2]}});
  if(this.state.route){map.addLayer({id:IDS.transit,type:'line',source:IDS.source,filter:['==',['get','kind'],'transit-no-spray'],paint:{'line-color':'#81908a','line-width':3,'line-opacity':.82}});map.addLayer({id:IDS.route,type:'line',source:IDS.source,filter:['==',['get','kind'],'planned-route'],paint:{'line-color':'#18251d','line-width':5,'line-opacity':.9}})}
  if(this.state.spray)map.addLayer({id:IDS.spray,type:'line',source:IDS.source,filter:['==',['get','kind'],'planned-spray-section'],paint:{'line-color':'#00e477','line-width':4}});
 }
 raise(){this.targets().forEach(({map})=>{if(!map?.isStyleLoaded())return;LAYERS.forEach(id=>{if(map.getLayer(id))map.moveLayer(id)})})}
}

global.SSAT50Overlay=SSAT50Overlay;
})(window);
