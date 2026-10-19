/* Rigid source-mesh contact. Volume loss is an assumed display proxy, not ingestion. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.NativeGeometricContact=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 const clamp=x=>Math.max(0,Math.min(1,x));
 const sq=x=>dot(x,x);
 function segment(p,a,b){const d=sub(b,a),n=sq(d),t=n?clamp(dot(sub(p,a),d)/n):0;return sq(sub(p,a.map((x,i)=>x+t*d[i])));}
 function triangleDistanceSquared(p,a,b,c){
  const ab=sub(b,a),ac=sub(c,a),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  if(sq(cross)<=1e-28)return Math.min(segment(p,a,b),segment(p,b,c),segment(p,c,a));
  const ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return sq(ap);
  const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);
  if(d3>=0&&d4<=d3)return sq(bp);
  const vc=d1*d4-d3*d2;
  if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return sq(sub(p,a.map((x,i)=>x+v*ab[i])));}
  const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
  if(d6>=0&&d5<=d6)return sq(cp);
  const vb=d5*d2-d1*d6;
  if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return sq(sub(p,a.map((x,i)=>x+w*ac[i])));}
  const va=d3*d6-d5*d4;
  if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return sq(sub(p,b.map((x,i)=>x+w*(c[i]-x))));}
  const den=1/(va+vb+vc),v=vb*den,w=vc*den;
  return sq(sub(p,a.map((x,i)=>x+ab[i]*v+ac[i]*w)));
 }
 function buildTree(geometry){
  const a=geometry.attributes.position.array,indices=geometry.index.array;
  const triangles=[];
  for(let i=0;i<indices.length;i+=3){const v=[0,1,2].map(k=>Array.from(a.slice(indices[i+k]*3,indices[i+k]*3+3)));triangles.push(v);}
  function split(items){
   const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
   for(const t of items)for(const v of t)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k]);}
   if(items.length<=12)return {lo,hi,items};
   const extent=hi.map((x,i)=>x-lo[i]),axis=extent.indexOf(Math.max(...extent));
   items.sort((a,b)=>a.reduce((s,v)=>s+v[axis],0)-b.reduce((s,v)=>s+v[axis],0));
   const middle=items.length>>1;return {lo,hi,left:split(items.slice(0,middle)),right:split(items.slice(middle))};
  }
  const root=split(triangles);
  function lower(p,n){let sum=0;for(let k=0;k<3;k++){const d=Math.max(n.lo[k]-p[k],0,p[k]-n.hi[k]);sum+=d*d;}return sum;}
  function distance(p){
   let best=Infinity;
   function visit(n){if(lower(p,n)>best)return;if(n.items){for(const tri of n.items)best=Math.min(best,triangleDistanceSquared(p,...tri));return;}
    const l=lower(p,n.left),r=lower(p,n.right);if(l<r){visit(n.left);visit(n.right);}else{visit(n.right);visit(n.left);}}
   visit(root);return best;
  }
  return {distance};
 }
 function inverse(t,p){const q=t.q;return {p:[0,0,0],q:[q[0],-q[1],-q[2],-q[3]],v:sub(p,t.p)};}
 function create(rig,model,geometries,policy,options={}){
  const names=['labrum_left_lower','labrum_right_lower'];
  const trees=Object.fromEntries(names.map(n=>{if(!geometries[n])throw Error('Missing distal mesh: '+n);return [n,buildTree(geometries[n])];}));
  const food=policy.food,rule=policy.contact,radius=food.radius_mm;
  if(!(Number.isFinite(radius)&&radius>0&&rule.volume_step_seconds>0&&rule.loss_rate_per_second>=0&&rule.distance_tolerance_mm>=0))throw Error('Invalid contact policy');
  const referenceAngles=Object.fromEntries(Object.entries(policy.angle_amplitudes_radian).map(([n,v])=>[n,v*(n.startsWith('labrum_')?food.reference_distal_extension:food.reference_midline_extension)]));
  const reference=rig.forward(model,referenceAngles),geometry=geometries[names[0]],a=geometry.attributes.position.array;
  let tip=[-Infinity,0,0];
  for(let i=0;i<a.length;i+=3){const w=rig.point(reference.geoms[names[0]],Array.from(a.slice(i,i+3)));if(w[0]>tip[0])tip=w;}
  const target=options.target?options.target.slice():[tip[0]+.9*radius,tip[1],tip[2]];
  if(target.length!==3||!target.every(Number.isFinite))throw Error('Invalid fixed food target');
  function center(t){
   const ease=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
   const approach=1-ease((t-food.approach_seconds[0])/(food.approach_seconds[1]-food.approach_seconds[0]));
   const withdraw=ease((t-food.withdraw_seconds[0])/(food.withdraw_seconds[1]-food.withdraw_seconds[0]));
   return [target[0]+.8*(approach+withdraw),target[1],target[2]+.15*(approach+withdraw)];
  }
  function distanceSquared(p,angles){
   const transforms=rig.forward(model,angles);let best=Infinity;
   for(const name of names){const inv=inverse(transforms.geoms[name],p),local=rig.point(inv,inv.v);best=Math.min(best,trees[name].distance(local));}
   return best;
  }
  function simulate(motor){
   const dt=rule.volume_step_seconds,end=motor.durationSeconds,steps=Math.round(end/dt);
   if(Math.abs(steps*dt-end)>1e-10)throw Error('Contact grid must end on a full step');
   let volume=1,contactTime=0,recordedContactTime=0;const frames=[];
   function record(t){const p=motor.sample(t),c=center(t),r=radius*Math.cbrt(volume),distance=Math.sqrt(distanceSquared(c,p.angles)),contact=distance<=r+rule.distance_tolerance_mm;
    return {t,remainingVolume:volume,radiusMm:r,center:c,contact,distanceMm:distance,contactTime,recordedContactTime,tailContactTime:contactTime-recordedContactTime};}
   frames.push(record(0));
   for(let k=1;k<=steps;k++){
    const prev=frames[k-1],p=motor.sample(prev.t),activity=clamp((p.activity.mn6_left+p.activity.mn6_right)/2);
    if(prev.contact){contactTime+=dt;if(prev.t<policy.neural_duration_seconds)recordedContactTime+=dt;volume=Math.max(0,volume-rule.loss_rate_per_second*activity*dt);}
    frames.push(record(k*dt));
   }
   return {frames,dtSeconds:dt,durationSeconds:end,sample(t){
    if(!Number.isFinite(t))throw Error('Finite sample time required');
    if(t<0)return {...frames[0],t,remainingVolume:1,radiusMm:radius,center:center(t),contact:false,contactTime:0,recordedContactTime:0,tailContactTime:0};
    const at=Math.min(t,end),f=frames[Math.min(steps,Math.floor(at/dt+1e-10))],c=center(at),distance=Math.sqrt(distanceSquared(c,motor.sample(at).angles));
    return {...f,t:at,center:c,distanceMm:distance,contact:distance<=f.radiusMm+rule.distance_tolerance_mm};
   }};
  }
  return {names,target,referenceAngles,center,distanceSquared,simulate};
 }
 return {triangleDistanceSquared,create};
});
