/* Raw source mesh attributes only. No recentering, rescaling or inferred anatomy. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PackedFlyBodyMeshes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const integer = (x,min=0) => Number.isSafeInteger(x) && x >= min;
  function decode(THREE, buffer, manifest) {
    if (!THREE || typeof THREE.BufferGeometry !== 'function' || typeof THREE.BufferAttribute !== 'function')
      throw new Error('THREE BufferGeometry and BufferAttribute are required');
    if (!(buffer instanceof ArrayBuffer)) throw new Error('ArrayBuffer required');
    if (!record(manifest) || manifest.format !== 'flybody-packed-v1' ||
        !integer(manifest.byteLength) || manifest.byteLength !== buffer.byteLength || !record(manifest.meshes))
      throw new Error('Invalid packed mesh manifest');
    const entries = Object.entries(manifest.meshes);
    if (!entries.length) throw new Error('No source meshes');
    const view = new DataView(buffer), geometries = Object.create(null);
    function descriptor(d, itemSize, count, label) {
      if (!record(d) || !integer(d.byteOffset) || d.byteOffset % 4 ||
          !integer(d.count,1) || d.count !== count || d.itemSize !== itemSize)
        throw new Error('Invalid descriptor: '+label);
      const scalars = d.count * itemSize;
      if (!Number.isSafeInteger(scalars) || d.byteOffset > buffer.byteLength ||
          scalars > Math.floor((buffer.byteLength-d.byteOffset)/4))
        throw new Error('Descriptor outside buffer: '+label);
      return scalars;
    }
    try {
      for (const [name,m] of entries) {
        if (!name || !record(m) || !record(m.attributes) || !integer(m.vertexCount,1) ||
            !integer(m.triangleCount,1) || !/^[a-fA-F0-9]{64}$/.test(m.sourceSha256 || ''))
          throw new Error('Invalid source mesh metadata: '+name);
        const attributes = Object.create(null);
        for (const [key,size] of [['position',3],['normal',3],['uv',2]]) {
          const d=m.attributes[key], scalars=descriptor(d,size,m.vertexCount,name+'.'+key);
          const array=new Float32Array(scalars);
          for(let i=0;i<scalars;i++) {
            const value=view.getFloat32(d.byteOffset+i*4,true);
            if(!Number.isFinite(value)) throw new Error('Nonfinite attribute: '+name+'.'+key);
            array[i]=value;
          }
          attributes[key]=new THREE.BufferAttribute(array,size);
        }
        const count=m.triangleCount*3;
        if(!Number.isSafeInteger(count)) throw new Error('Invalid triangle count: '+name);
        descriptor(m.index,1,count,name+'.index');
        const indices=new Uint32Array(count);
        for(let i=0;i<count;i++) {
          const value=view.getUint32(m.index.byteOffset+i*4,true);
          if(value>=m.vertexCount) throw new Error('Index outside vertices: '+name);
          indices[i]=value;
        }
        const geometry=new THREE.BufferGeometry();
        for(const [key,attribute] of Object.entries(attributes)) geometry.setAttribute(key,attribute);
        geometry.setIndex(new THREE.BufferAttribute(indices,1));
        geometries[name]=geometry;
      }
      return geometries;
    } catch(error) {
      for(const geometry of Object.values(geometries)) geometry.dispose();
      throw error;
    }
  }
  return {decode};
});
