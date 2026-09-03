(function(global){
'use strict';

const LAYER_ORDER=['rgb','ndvi','gndvi','hillshade'];
const LAYER_INFO={
 satellite:{label:'Satellite',description:'Satellite basemap'},
 map:{label:'Map',description:'Street and feature map'},
 rgb:{label:'RGB',description:'True-colour survey imagery'},
 ndvi:{label:'NDVI',description:'Vegetation vigour and biomass',gradient:'vegetation'},
 gndvi:{label:'GNDVI',description:'Green chlorophyll and canopy response',gradient:'vegetation'},
 hillshade:{label:'Relief map',description:'Relative surface elevation',gradient:'elevation'}
};

class SSACompareMode{
 constructor(options){
  Object.assign(this,options);
  this.active=false;this.rightMap=null;this.rightReady=null;this.rightLoaded=false;this.divider=.5;this.dragging=false;
  this.map.on('move',()=>this.sync());
  global.addEventListener('resize',()=>this.layout());
  this.handle.addEventListener('pointerdown',event=>{if(!this.active)return;this.dragging=true;this.handle.setPointerCapture?.(event.pointerId);event.preventDefault()});
  global.addEventListener('pointermove',event=>{if(!this.dragging)return;const rect=this.map.getContainer().getBoundingClientRect();this.divider=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));this.layout()});
  global.addEventListener('pointerup',()=>this.dragging=false);
 }
 toggle(){return this.active?this.disable():this.enable()}
 cloneStyle(){return JSON.parse(JSON.stringify(this.style))}
 async ensureRightMap(){
  if(this.rightLoaded)return;
  if(this.rightReady)return this.rightReady;
  this.layout();
  this.rightMap=new maplibregl.Map({container:this.rightContainer,style:this.cloneStyle(),center:this.map.getCenter(),zoom:this.map.getZoom(),bearing:this.map.getBearing(),pitch:this.map.getPitch(),interactive:false,attributionControl:false,maxPitch:85});
  this.rightReady=new Promise(resolve=>this.rightMap.on('load',resolve));await this.rightReady;
  this.rightLoaded=true;this.addTerrainSource(this.rightMap);this.applyTerrain(this.terrainMode());this.sync();
 }
 addTerrainSource(target){
  const config=this.terrainConfig;if(!config||target.getSource('ssa-regional-terrain'))return;
  target.addSource('ssa-regional-terrain',{type:'raster-dem',tiles:[config.tiles],scheme:config.scheme||'xyz',encoding:config.encoding||'mapbox',tileSize:config.tileSize||256,minzoom:config.minzoom,maxzoom:config.maxzoom,bounds:config.bounds,attribution:config.attribution});
 }
 applyTerrain(mode){
  const is3d=mode==='3d'&&this.terrainConfig;
  [this.map,this.rightMap].filter(Boolean).forEach(target=>{this.addTerrainSource(target);target.setTerrain(is3d?{source:'ssa-regional-terrain',exaggeration:this.terrainConfig.exaggeration??1}:null);target.setSky(is3d?this.skyConfig:undefined)});
 }
 async enable(){
  if(this.active)return;
  const normal=this.currentState(),ordered=[...normal.paddock.surveys].sort((a,b)=>a.date.localeCompare(b.date)),index=ordered.findIndex(item=>item.date===normal.survey.date),single=ordered.length===1;
  const leftSurvey=normal.survey,rightSurvey=single?leftSurvey:ordered[index>0?index-1:Math.min(1,ordered.length-1)];
  const leftChoice=single?this.resolveLayer(leftSurvey,'rgb'):this.resolveLayer(leftSurvey,normal.layer||normal.baseMode);
  const rightChoice=single?this.resolveLayer(rightSurvey,'hillshade',true):this.resolveLayer(rightSurvey,leftChoice.layer,leftChoice.layer==='hillshade');
  this.left=this.makeSide('left',normal.propertyId,normal.propertyData,normal.paddock,leftSurvey,{...leftChoice,requestedLayer:single?'rgb':(normal.layer||normal.baseMode)});
  this.right=this.makeSide('right',normal.propertyId,normal.propertyData,normal.paddock,rightSurvey,{...rightChoice,requestedLayer:single?'hillshade':leftChoice.layer});
  this.active=true;this.onActiveChange(true);this.clip.hidden=false;this.handle.hidden=false;this.dock.hidden=false;this.layerStrips.hidden=false;this.renderDock();this.layout();
  await this.ensureRightMap();
  if(!this.active)return;
  this.clearNormal();this.renderSide(this.left);this.renderSide(this.right);this.renderDock();this.layout();this.fitBoth();
 }
 disable(){
  if(!this.active)return;
  this.active=false;this.clearSide(this.map,'compare-left');if(this.rightMap)this.clearSide(this.rightMap,'compare-right');this.clip.hidden=true;this.handle.hidden=true;this.dock.hidden=true;this.layerStrips.hidden=true;this.onActiveChange(false);this.restoreNormal();
 }
 makeSide(id,propertyId,propertyData,paddock,survey,choice){return{id,propertyId,propertyData,paddockId:paddock.id,paddock,surveyDate:survey.date,survey,layer:choice.layer,requestedLayer:choice.requestedLayer||choice.layer,note:choice.note||''}}
 resolveLayer(survey,preferred,preferRelief=false){
  if(preferRelief){
   if(survey.layers.hillshade)return{layer:'hillshade'};
   const analytical=['ndvi','gndvi'].find(id=>survey.layers[id]);
   if(analytical)return{layer:analytical,note:`Surface relief unavailable — using ${LAYER_INFO[analytical].label}.`};
   return{layer:'map',note:'Surface relief and analytical layers unavailable — using Map.'};
  }
  if(preferred==='map'||preferred==='satellite'||survey.layers[preferred])return{layer:preferred};
  const fallback=['rgb','hillshade','ndvi','gndvi'].find(id=>survey.layers[id])||'satellite';
  return{layer:fallback,note:`${LAYER_INFO[preferred]?.label||'Selected layer'} unavailable — using ${LAYER_INFO[fallback].label}.`};
 }
 setBase(target,mode){
  if(target.getLayer('ssa-osm'))target.setLayoutProperty('ssa-osm','visibility',mode==='map'?'visible':'none');
  this.esriLayerIds.forEach(id=>{if(target.getLayer(id))target.setLayoutProperty(id,'visibility',mode==='satellite'?'visible':'none')});
 }
 rasterSpec(layer,survey){return{type:'raster',tiles:[layer.tiles],tileSize:256,minzoom:layer.minzoom||14,maxzoom:layer.maxzoom||20,scheme:layer.scheme||'tms',bounds:[survey.bounds[0][0],survey.bounds[0][1],survey.bounds[1][0],survey.bounds[1][1]]}}
 clearSide(target,prefix){
  [`${prefix}-overlay`,`${prefix}-rgb`].forEach(id=>{if(target.getLayer(id))target.removeLayer(id)});
  [`${prefix}-overlay-source`,`${prefix}-rgb-source`].forEach(id=>{if(target.getSource(id))target.removeSource(id)});
 }
 addRaster(target,sourceId,layerId,layer,survey,opacity){target.addSource(sourceId,this.rasterSpec(layer,survey));target.addLayer({id:layerId,type:'raster',source:sourceId,paint:{'raster-opacity':opacity}})}
 renderSide(side){
  const target=side.id==='left'?this.map:this.rightMap,prefix=`compare-${side.id}`;if(!target||!target.isStyleLoaded())return;
  this.clearSide(target,prefix);
  if(side.layer==='map'||side.layer==='satellite'){this.setBase(target,side.layer);return}
  this.setBase(target,'satellite');
  const layer=side.survey.layers[side.layer];if(!layer)return;
  if(side.layer==='hillshade'&&side.survey.layers.rgb)this.addRaster(target,`${prefix}-rgb-source`,`${prefix}-rgb`,side.survey.layers.rgb,side.survey,1);
  this.addRaster(target,`${prefix}-overlay-source`,`${prefix}-overlay`,layer,side.survey,layer.opacity??1);
 }
 choices(side){return['satellite','map',...LAYER_ORDER.filter(id=>side.survey.layers[id])].map(id=>({id,label:LAYER_INFO[id].label}))}
 optionSelect(label,values,value,onchange){
  const wrap=document.createElement('label');wrap.className='compare-field';const title=document.createElement('span');title.textContent=label;const select=document.createElement('select');
  values.forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.label;option.disabled=item.disabled;select.appendChild(option)});select.value=value;select.onchange=()=>onchange(select.value);wrap.append(title,select);return wrap;
 }
 legend(side){
  const info=LAYER_INFO[side.layer],legend=document.createElement('div');legend.className='compare-side-legend';
  const text=document.createElement('span');text.innerHTML=`<b>${info.label}</b><small>${info.description}</small>`;legend.appendChild(text);
  if(info.gradient){const gradient=document.createElement('i');gradient.className=`compare-mini-gradient ${info.gradient}`;legend.appendChild(gradient)}
  return legend;
 }
 renderLayerStrips(){
  this.layerStrips.replaceChildren();
  [this.left,this.right].forEach(side=>{
   const half=document.createElement('div');half.className=`compare-layer-half compare-layer-${side.id}`;
   const strip=document.createElement('div');strip.className='compare-layer-options';strip.setAttribute('aria-label',`${side.id==='left'?'Left':'Right'} comparison layer`);
   this.choices(side).forEach(choice=>{const button=document.createElement('button');button.type='button';button.textContent=choice.label;button.className=side.layer===choice.id?'active':'';button.setAttribute('aria-pressed',String(side.layer===choice.id));button.onclick=()=>this.changeLayer(side,choice.id);strip.appendChild(button)});
   half.appendChild(strip);this.layerStrips.appendChild(half);
  });
 }
 renderDock(){
  this.dock.replaceChildren();
  [this.left,this.right].forEach(side=>{
   const card=document.createElement('section');card.className=`compare-side compare-side-${side.id}`;const heading=document.createElement('div');heading.className='compare-side-heading';heading.textContent=side.id==='left'?'LEFT SIDE':'RIGHT SIDE';
   const fields=document.createElement('div');fields.className='compare-fields';
   fields.append(
    this.optionSelect('Property',this.catalog.properties.map(item=>({id:item.id,label:item.name})),side.propertyId,value=>this.changeProperty(side,value)),
    this.optionSelect('Paddock',side.propertyData.paddocks.map(item=>({id:item.id,label:item.name,disabled:!item.surveys?.length})),side.paddockId,value=>this.changePaddock(side,value)),
    this.optionSelect('Survey date',[...side.paddock.surveys].sort((a,b)=>a.date.localeCompare(b.date)).map(item=>({id:item.date,label:item.dateLabel})),side.surveyDate,value=>this.changeSurvey(side,value))
   );
   const status=document.createElement('div');status.className='compare-side-status';status.appendChild(this.legend(side));
   if(side.note){const note=document.createElement('em');note.textContent=side.note;status.appendChild(note)}
   card.append(heading,fields,status);this.dock.appendChild(card);
  });
  this.renderLayerStrips();
  this.layout();
 }
 async changeProperty(side,propertyId){
  try{const data=await this.loadProperty(propertyId);if(!this.active)return;const paddock=data.paddocks.find(item=>item.surveys?.length);if(!paddock)throw Error('No surveyed paddocks are available.');
   const surveys=[...paddock.surveys].sort((a,b)=>a.date.localeCompare(b.date)),survey=surveys[surveys.length-1],choice=this.resolveLayer(survey,side.requestedLayer,side.requestedLayer==='hillshade');
   Object.assign(side,{propertyId,propertyData:data,paddockId:paddock.id,paddock,surveyDate:survey.date,survey,layer:choice.layer,note:choice.note||''});this.renderSide(side);this.renderDock();this.fitBoth();
  }catch(error){side.note=`Property could not be loaded — ${error.message}`;this.renderDock()}
 }
 changePaddock(side,paddockId){
  const paddock=side.propertyData.paddocks.find(item=>item.id===paddockId&&item.surveys?.length);if(!paddock)return;
  const surveys=[...paddock.surveys].sort((a,b)=>a.date.localeCompare(b.date)),survey=surveys[surveys.length-1],choice=this.resolveLayer(survey,side.requestedLayer,side.requestedLayer==='hillshade');
  Object.assign(side,{paddockId,paddock,surveyDate:survey.date,survey,layer:choice.layer,note:choice.note||''});this.renderSide(side);this.renderDock();this.fitBoth();
 }
 changeSurvey(side,date){
  const survey=side.paddock.surveys.find(item=>item.date===date);if(!survey)return;const choice=this.resolveLayer(survey,side.requestedLayer,side.requestedLayer==='hillshade');
  Object.assign(side,{surveyDate:survey.date,survey,layer:choice.layer,note:choice.note||''});this.renderSide(side);this.renderDock();this.fitBoth();
 }
 changeLayer(side,layer){side.layer=layer;side.requestedLayer=layer;side.note='';this.renderSide(side);this.renderDock()}
 fitBoth(){
  const surveys=[this.left.survey,this.right.survey],west=Math.min(...surveys.map(item=>item.bounds[0][0])),south=Math.min(...surveys.map(item=>item.bounds[0][1])),east=Math.max(...surveys.map(item=>item.bounds[1][0])),north=Math.max(...surveys.map(item=>item.bounds[1][1]));
  const height=this.map.getContainer().getBoundingClientRect().height,bottom=Math.min(this.dock.offsetHeight+25,Math.max(80,height/2));this.map.fitBounds([[west,south],[east,north]],{padding:{top:70,bottom,left:35,right:35},maxZoom:19,bearing:this.map.getBearing(),pitch:this.map.getPitch()});
 }
 sync(){if(!this.active||!this.rightLoaded)return;const center=this.map.getCenter();this.rightMap.jumpTo({center:[center.lng,center.lat],zoom:this.map.getZoom(),bearing:this.map.getBearing(),pitch:this.map.getPitch()})}
 layout(){
  if(!this.active)return;const rect=this.map.getContainer().getBoundingClientRect(),x=Math.round(rect.width*this.divider);
  this.clip.style.left=`${rect.left+x}px`;this.clip.style.width=`${Math.max(0,rect.width-x)}px`;this.rightContainer.style.left=`${-x}px`;this.rightContainer.style.width=`${rect.width}px`;this.rightContainer.style.height=`${rect.height}px`;
  this.handle.style.left=`${rect.left+x-1.5}px`;this.handle.style.bottom=`${this.dock.offsetHeight}px`;this.layerStrips.style.bottom=`${this.dock.offsetHeight+10}px`;this.rightMap?.resize();this.sync();
 }
}

global.SSACompareMode=SSACompareMode;
})(window);
