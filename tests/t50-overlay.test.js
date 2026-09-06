'use strict';

const assert=require('node:assert/strict');
global.window=global;
require('../maps/t50/t50-overlay.js');

class FakeMap{
 constructor(){this.layers=new Map();this.sources=new Map();this.order=[]}
 isStyleLoaded(){return true}
 getLayer(id){return this.layers.get(id)}
 getSource(id){return this.sources.get(id)}
 addSource(id,spec){this.sources.set(id,spec)}
 removeSource(id){this.sources.delete(id)}
 addLayer(layer){this.layers.set(layer.id,layer);this.order.push(layer.id)}
 removeLayer(id){this.layers.delete(id);this.order=this.order.filter(item=>item!==id)}
 moveLayer(id){this.order=this.order.filter(item=>item!==id);this.order.push(id)}
 setPaintProperty(id,key,value){this.layers.get(id).paint[key]=value}
}

(async()=>{
 const left=new FakeMap(),right=new FakeMap();
 const targets=[{map:left,propertyId:'property-a',paddockId:'paddock-a'},{map:right,propertyId:'property-a',paddockId:'paddock-a'}];
 const overlay=new SSAT50Overlay({getNormalContext:()=>targets[0],getTargets:()=>targets});
 overlay.plan={id:'plan-a',propertyId:'property-a',paddockId:'paddock-a',prescription:{tiles:'/tiles/{z}/{x}/{y}.png',scheme:'tms',bounds:[[152,-31],[153,-30]],minzoom:14,maxzoom:20}};
 overlay.data={type:'FeatureCollection',features:[]};
 await overlay.refreshTargets();
 assert(left.getLayer('ssa-t50-spray'),'single/left map receives spray layer');
 assert(right.getLayer('ssa-t50-spray'),'compare/right map mirrors spray layer');
 assert.equal(left.getSource('ssa-t50-prescription-source').scheme,'tms');
 left.addLayer({id:'survey',type:'raster'});overlay.raise();
 assert.equal(left.order.at(-1),'ssa-t50-spray','overlay remains above changed survey product');
 targets[1].paddockId='unrelated';await overlay.refreshTargets();
 assert(left.getLayer('ssa-t50-route'),'matching context retains plan');
 assert.equal(right.getLayer('ssa-t50-route'),undefined,'unrelated context clears plan');
 overlay.state.visible=false;await overlay.refreshTargets();
 assert.equal(left.getLayer('ssa-t50-route'),undefined,'master visibility clears overlay');
 console.log('T50 viewer lifecycle checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
