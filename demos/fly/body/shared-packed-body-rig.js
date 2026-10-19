/* Shared source geometry, independent source pose hierarchies.
 * A pool owns decoded geometry/materials. Closing the pool prevents new rigs;
 * disposal of shared resources waits for the last rig to release them.
 * Source attributes and native transform maths remain in the unchanged loaders.
 */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(
  require('./native-body-rig.js'),
  require('./packed-mesh-loader.js'));
 else root.SharedPackedFlyBodyRig=factory(root.NativeFlyBodyRig,root.PackedFlyBodyMeshes);
})(typeof globalThis!=='undefined'?globalThis:this,function(nativeRig,loader){
 'use strict';
 function bytes(text){
  if(typeof text!=='string')throw new Error('Base64 source asset required');
  const binary=typeof atob==='function'?atob(text):Buffer.from(text,'base64').toString('binary');
  const array=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)array[i]=binary.charCodeAt(i);
  return array.buffer;
 }
 function createPool(THREE,asset){
  if(!asset||!asset.rig||asset.rig.length_unit!=='mm'||asset.rig.angle_unit!=='radian')
   throw new Error('Native mm/radian rig required');
  const model=asset.rig,manifest=asset.manifest,materials=Object.create(null);
  let encoded=asset.base64,packed=asset.buffer,geometries=null,active=0,closed=false,released=false;
  // No promise about GC or the original asset/global: this clears only the
  // pool's encoded-string reference after decoding or closing.
  asset=null;
  function material(name){
   if(materials[name])return materials[name];
   const source=model.materials[name];if(!source)throw new Error('Missing source material: '+name);
   const rgba=String(source.rgba||'1 1 1 1').split(/\s+/).map(Number);
   if(rgba.length!==4||!rgba.every(Number.isFinite))throw new Error('Invalid source color');
   return materials[name]=new THREE.MeshPhongMaterial({color:new THREE.Color(rgba[0],rgba[1],rgba[2]),
    opacity:rgba[3],transparent:rgba[3]<1,depthWrite:rgba[3]>=1,
    shininess:100*Number(source.shininess||0),side:name==='membrane'?THREE.DoubleSide:THREE.FrontSide});
  }
  function release(){
   if(!closed||active!==0||released)return;
   released=true;encoded=null;packed=null;
   if(geometries)for(const [key,geometry] of Object.entries(geometries)){
    geometry.dispose();delete geometries[key];
   }
   for(const [key,value] of Object.entries(materials)){value.dispose();delete materials[key];}
  }
  function create(){
   if(closed)throw new Error('Shared geometry pool is closed');
   if(!geometries){
    geometries=loader.decode(THREE,packed || bytes(encoded),manifest);
    encoded=null;packed=null;
   }
   const rig=nativeRig.createThreeRig(THREE,model,(name,geom)=>{
    if(!geometries[name])throw new Error('Missing source geometry: '+name);
    return new THREE.Mesh(geometries[name],material(geom.source_attributes.material||'body'));
   });
   active++;
   let disposed=false;
   return {...rig,geometries,materials,
    pose(angles={}){
     if(disposed)throw new Error('Shared fly rig is disposed');
     return rig.pose(angles);
    },
    dispose(){
     if(disposed)return;
     disposed=true;
     if(rig.root.parent)rig.root.parent.remove(rig.root);
     rig.root.clear();
     for(const key of Object.keys(rig.bodies))delete rig.bodies[key];
     for(const key of Object.keys(rig.geoms))delete rig.geoms[key];
     active--;
     release();
    }
   };
  }
  return {create,dispose(){closed=true;encoded=null;packed=null;release();}};
 }
 return {createPool};
});
