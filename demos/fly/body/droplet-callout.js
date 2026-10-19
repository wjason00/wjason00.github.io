/* Screen-space annotations only; no changes to body or contact geometry. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlyDropletCallout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function layout(ndc,width,height){
  if(![ndc.x,ndc.y,ndc.z,width,height].every(Number.isFinite)||width<160||height<160)return null;
  if(Math.abs(ndc.x)>1||Math.abs(ndc.y)>1||Math.abs(ndc.z)>1)return null;
  const point={x:(ndc.x+1)*width/2,y:(1-ndc.y)*height/2};
  const labelWidth=Math.min(124,width-20),labelHeight=26;
  const right=point.x+24+labelWidth<=width-10;
  const x=Math.max(10,Math.min(width-10-labelWidth,right?point.x+24:point.x-labelWidth-24));
  const y=Math.max(44,Math.min(height-50-labelHeight,point.y-43));
  return {point,label:{x,y,width:labelWidth,height:labelHeight},anchor:{x:right?x:x+labelWidth,y:y+labelHeight/2}};
 }
 return {layout};
});
