/* Native FlyBody raw-mesh transforms. Geometry only; no inferred motor physiology. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NativeFlyBodyRig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const add=(a,b)=>a.map((x,i)=>x+b[i]);
  const sub=(a,b)=>a.map((x,i)=>x-b[i]);
  function norm(a) {
    if (!a.every(Number.isFinite)) throw new Error('Nonfinite vector');
    const n=Math.hypot(...a); if(!n) throw new Error('Zero vector');
    return a.map(x=>x/n);
  }
  function multiply(a,b) {
    const [w,x,y,z]=a,[v,i,j,k]=b;
    return norm([w*v-x*i-y*j-z*k,w*i+x*v+y*k-z*j,
      w*j-x*k+y*v+z*i,w*k+x*j-y*i+z*v]);
  }
  function rotate(q,v) {
    const [w,x,y,z]=q,[a,b,c]=v;
    return [a*(1-2*y*y-2*z*z)+b*(2*x*y-2*w*z)+c*(2*x*z+2*w*y),
      a*(2*x*y+2*w*z)+b*(1-2*x*x-2*z*z)+c*(2*y*z-2*w*x),
      a*(2*x*z-2*w*y)+b*(2*y*z+2*w*x)+c*(1-2*x*x-2*y*y)];
  }
  function vector(text,fallback) {
    const a=text===undefined?fallback.slice():String(text).trim().split(/\s+/).map(Number);
    if(a.length!==fallback.length || !a.every(Number.isFinite)) throw new Error('Invalid source vector');
    return a;
  }
  const identity=()=>({p:[0,0,0],q:[1,0,0,0]});
  const point=(t,v)=>add(t.p,rotate(t.q,v));
  const compose=(a,b)=>({p:point(a,b.p),q:multiply(a.q,b.q)});
  function localBody(body,angles) {
    let p=body.pos_mm.slice(),q=norm(body.quaternion_wxyz_raw);
    const joints=Object.create(null);
    for(const j of body.source_joints) {
      const reference=Number(j.ref || 0), angle=angles[j.name]===undefined?reference:angles[j.name];
      if(!Number.isFinite(angle) || !Number.isFinite(reference)) throw new Error('Nonfinite joint angle');
      const delta=angle-reference;
      if(j.type && j.type!=='hinge') throw new Error('Unsupported source joint type');
      if(j.axis===undefined) {
        if(delta!==0) throw new Error('Nonzero inherited-axis joint requires an explicit axis: '+j.name);
        continue;
      }
      const a=vector(j.pos,[0,0,0]).map(x=>10*x),axis=norm(vector(j.axis,[0,0,1]));
      const anchor=add(p,rotate(q,a));
      joints[j.name]={anchor,axis:rotate(q,axis)};
      const s=Math.sin(delta/2),dq=[Math.cos(delta/2),...axis.map(x=>x*s)];
      q=multiply(q,dq);p=sub(anchor,rotate(q,a));
    }
    return {p,q,joints};
  }
  function forward(model,angles={}) {
    const known=new Set(Object.values(model.bodies).flatMap(b=>b.source_joints.map(j=>j.name)));
    for(const [k,v] of Object.entries(angles)) {
      if(!known.has(k)) throw new Error('Unknown joint: '+k);
      if(!Number.isFinite(v)) throw new Error('Nonfinite angle: '+k);
    }
    const bodies=Object.create(null),localBodies=Object.create(null),geoms=Object.create(null),joints=Object.create(null),visiting=new Set();
    function visit(name) {
      if(bodies[name]) return bodies[name];
      if(visiting.has(name)) throw new Error('Cyclic hierarchy');
      const body=model.bodies[name];if(!body)throw new Error('Missing body: '+name);
      visiting.add(name);
      const parent=body.parent===null?identity():visit(body.parent), local=localBody(body,angles);
      localBodies[name]={p:local.p,q:local.q};
      const world=compose(parent,local);bodies[name]=world;
      for(const [key,j] of Object.entries(local.joints)) joints[key]={anchor:point(parent,j.anchor),axis:rotate(parent.q,j.axis)};
      for(const g of body.mesh_geoms) {
        const key=g.source_attributes.name;
        if(geoms[key]) throw new Error('Duplicate source geometry: '+key);
        geoms[key]=compose(world,{p:g.pos_mm,q:norm(g.quaternion_wxyz_raw)});
      }
      visiting.delete(name);return world;
    }
    for(const name of Object.keys(model.bodies))visit(name);
    return {bodies,localBodies,geoms,joints};
  }
  function setMatrix(THREE,object,t) {
    object.matrixAutoUpdate=false;
    object.matrix.compose(new THREE.Vector3(...t.p),new THREE.Quaternion(t.q[1],t.q[2],t.q[3],t.q[0]),new THREE.Vector3(1,1,1));
    object.matrixWorldNeedsUpdate=true;
  }
  function createThreeRig(THREE,model,meshFactory) {
    if(typeof meshFactory!=='function')throw new Error('Raw source mesh factory required');
    const root=new THREE.Group(),bodies=Object.create(null),geoms=Object.create(null);
    for(const name of Object.keys(model.bodies)){bodies[name]=new THREE.Group();bodies[name].name=name;}
    for(const [name,b] of Object.entries(model.bodies)) {
      (b.parent===null?root:bodies[b.parent]).add(bodies[name]);
      for(const g of b.mesh_geoms) {
        const object=meshFactory(g.mesh,g);
        if(!object || !object.isObject3D) throw new Error('Mesh factory must return a THREE.Object3D');
        object.name=g.source_attributes.name;
        setMatrix(THREE,object,{p:g.pos_mm,q:norm(g.quaternion_wxyz_raw)});
        bodies[name].add(object);geoms[object.name]=object;
      }
    }
    function pose(angles={}) {
      const f=forward(model,angles);
      for(const [name,t] of Object.entries(f.localBodies))setMatrix(THREE,bodies[name],t);
      root.updateMatrixWorld(true);return f;
    }
    pose();return {root,bodies,geoms,pose};
  }
  return {forward,point,createThreeRig};
});
