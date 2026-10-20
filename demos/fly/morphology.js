// Real FlyWire materialization-630 skeletons; display only, no neural dynamics.
export function positionsInMicrometres(neuron, commonOrigin) {
  const points = new Float32Array(neuron.positions.length);
  for (let i = 0; i < points.length; i++) points[i] = (neuron.positions[i] - commonOrigin[i % 3]) / 1000;
  return points;
}

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function mountMorphology(container, {onSelect = () => {}} = {}) {
  if (!container) throw new Error('A morphology viewer container is required');
  container.innerHTML = `<div class="morphology-toolbar"><label>3D neuron<select class="morphology-picker" aria-label="Select a reconstructed neuron"><option>Loading source anatomy…</option></select></label><div class="morphology-actions"><button type="button" data-action="reset">Reset view</button><button type="button" data-action="focus">Fit selected</button><button type="button" data-advanced-only data-action="zoom-in" aria-label="Zoom in on anatomy">+</button><button type="button" data-advanced-only data-action="zoom-out" aria-label="Zoom out of anatomy">−</button></div></div><div class="morphology-stage" tabindex="0" role="group" aria-label="Interactive 3D neuron skeletons. Drag to rotate; arrow keys rotate; plus and minus zoom; Home resets."><p class="morphology-loading">Loading reconstructed FlyWire neurons…</p></div><div class="morphology-bottom"><label><input class="morphology-isolate" type="checkbox"> Show selected neuron only</label><span class="morphology-scale"></span></div><p class="morphology-selection" aria-live="polite"></p><p class="morphology-boundary">Static reconstructed skeletons. Source axes in µm are not verified anatomical directions.</p><p class="morphology-note" data-advanced-only>Real reconstructed skeletons in a shared source coordinate frame. Drag to rotate; scroll to zoom; click a branch to inspect its neuron. Arrow keys rotate, + / − zoom, Home resets. X / Y / Z are source axes in µm, not verified anatomical direction labels.</p><p class="morphology-note" data-advanced-only>Branches simplified at 0.5 µm tolerance, with coordinates rounded to 1 nm. Line width and colour are display styling. These are static structures, not simulated activity or membrane surfaces. <a href="morphology-provenance.json">Anatomy sources &amp; processing</a>.</p>`;
  const stage = container.querySelector('.morphology-stage');
  const picker = container.querySelector('.morphology-picker');
  const isolate = container.querySelector('.morphology-isolate');
  const selection = container.querySelector('.morphology-selection');
  const scale = container.querySelector('.morphology-scale');
  const THREE = globalThis.THREE;
  let pendingId, disposed = false, renderer, observer, unavailableReason = 'The 3D canvas is unavailable.';
  const fallback = message => {
    unavailableReason = message;
    stage.innerHTML = `<p class="morphology-fallback">${escapeHTML(message)} <a href="morphology-data.json">Download the source skeleton data</a>.</p>`;
  };
  const inertAPI = {selectNeuron(id) { pendingId = String(id); selection.textContent = `Selected neuron ${pendingId}. ${unavailableReason} The connection graph and explanations remain usable.`; }, resize() {}, destroy() { disposed = true; }};
  if (!THREE) {
    fallback('The 3D library did not load.');
    return inertAPI;
  }
  try { renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: 'low-power'}); }
  catch {
    fallback('This browser could not start WebGL for the anatomy view.');
    return inertAPI;
  }
  let data;
  try {
    const response = await fetch(new URL('./morphology-data.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    renderer.dispose();
    fallback('The reconstructed neuron data could not be loaded.');
    // Reject so the selection bridge clears its pending load and can retry.
    throw new Error('The reconstructed neuron data could not be loaded.', {cause: error});
  }
  if (data.materialization !== 630 || data.units !== 'nm') {
    renderer.dispose();
    fallback('The anatomy data do not match the expected materialization and units.');
    return inertAPI;
  }
  const neurons = data.neurons;
  const minimum = [Infinity,Infinity,Infinity], maximum = [-Infinity,-Infinity,-Infinity];
  for (const neuron of neurons) for (let i = 0; i < neuron.positions.length; i++) {
    const axis = i % 3;
    minimum[axis] = Math.min(minimum[axis], neuron.positions[i]);
    maximum[axis] = Math.max(maximum[axis], neuron.positions[i]);
  }
  // One translation for every neuron. No per-neuron centering or deformation.
  const origin = minimum.map((value, axis) => (value + maximum[axis]) / 2);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101c27');
  const camera = new THREE.PerspectiveCamera(38,1,.1,10000);
  const target = new THREE.Vector3();
  const fullBounds = new THREE.Box3(
    new THREE.Vector3(...minimum.map((v,i) => (v-origin[i])/1000)),
    new THREE.Vector3(...maximum.map((v,i) => (v-origin[i])/1000))
  );
  const meshes = new Map();
  const materials = [];
  const geometries = [];
  const roundup = '720575940623211725', mn9 = '720575940660219265';
  const nodeLabel = neuron => neuron.id === roundup ? 'Roundup' : neuron.id === mn9 ? 'MN9' : neuron.label;
  for (const neuron of neurons) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positionsInMicrometres(neuron,origin),3));
    geometry.setIndex(neuron.edges);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    const material = new THREE.LineBasicMaterial({color: neuron.id === roundup ? '#efb968' : neuron.id === mn9 ? '#78ddd0' : '#7d98ad', transparent: true, opacity: .19, depthWrite: false});
    const mesh = new THREE.LineSegments(geometry,material);
    mesh.userData.id = neuron.id;
    scene.add(mesh);
    meshes.set(neuron.id,mesh);
    materials.push(material);
    geometries.push(geometry);
  }
  // Source-coordinate axes near the lower corner. Each shaft is 25 µm.
  const axesOrigin = fullBounds.min.clone().addScalar(8);
  const axes = new THREE.Group();
  const labels = [];
  for (const [index,colour,label] of [[0,'#f1b181','X'],[1,'#a6d6b0','Y'],[2,'#a8c2f4','Z']]) {
    const direction = new THREE.Vector3(); direction.setComponent(index,1);
    const arrow = new THREE.ArrowHelper(direction,axesOrigin,25,colour,4,2);
    axes.add(arrow);
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d');
    context.font = 'bold 36px sans-serif'; context.fillStyle = colour; context.textAlign = 'center'; context.fillText(label,32,44);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});
    const sprite = new THREE.Sprite(material); sprite.scale.set(8,8,1);
    sprite.position.copy(axesOrigin).add(direction.multiplyScalar(31));
    axes.add(sprite); labels.push({texture,material});
  }
  scene.add(axes);
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1,2));
  renderer.domElement.setAttribute('aria-hidden','true');
  stage.replaceChildren(renderer.domElement);
  let yaw = .12, pitch = -.06, radius = 500, selectedId = roundup, hasFittedLayout = false;
  const radiusForBounds = bounds => {
    const size = bounds.getSize(new THREE.Vector3());
    const vertical = Math.max(size.y,size.z,size.x / Math.max(camera.aspect,.25));
    return Math.max(30,vertical / (2*Math.tan(camera.fov*Math.PI/360))*1.25);
  };
  const render = () => {
    if (disposed || !hasFittedLayout) return;
    camera.position.set(
      target.x + radius*Math.cos(pitch)*Math.sin(yaw),
      target.y + radius*Math.sin(pitch),
      target.z + radius*Math.cos(pitch)*Math.cos(yaw)
    );
    camera.lookAt(target);
    renderer.render(scene,camera);
    scale.textContent = '25 µm source-axis arrows';
  };
  function resize() {
    const width = stage.clientWidth, height = stage.clientHeight;
    // A hidden tab has no viewport; keep its last camera and canvas dimensions.
    if (width <= 0 || height <= 0) return;
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    if (!hasFittedLayout) {
      target.copy(fullBounds.getCenter(new THREE.Vector3()));
      radius = radiusForBounds(fullBounds);
      hasFittedLayout = true;
    }
    render();
  }
  const reset = () => {
    yaw = .12; pitch = -.06; target.copy(fullBounds.getCenter(new THREE.Vector3()));
    radius = radiusForBounds(fullBounds); render();
  };
  function selectNeuron(id) {
    selectedId = String(id);
    const neuron = neurons.find(n => n.id === selectedId);
    if (!neuron) {
      picker.value = '';
      selection.textContent = `No materialization-630 skeleton is included for neuron ${selectedId}. Its graph connections can still be inspected.`;
    } else {
      picker.value = selectedId;
      selection.innerHTML = `${escapeHTML(nodeLabel(neuron))} highlighted${isolate.checked ? ' · selected neuron only' : ' · neighbours retain source positions'}.<span data-advanced-only> Source ID ${escapeHTML(selectedId)} · ${(neuron.positions.length/3).toLocaleString('en-GB')} displayed skeleton points.</span>`;
    }
    for (const [otherId,mesh] of meshes) {
      mesh.visible = !isolate.checked || otherId === selectedId;
      mesh.material.opacity = otherId === selectedId ? 1 : otherId === roundup || otherId === mn9 ? .48 : .12;
      mesh.material.color.set(otherId === selectedId ? '#ffe2a5' : otherId === roundup ? '#efb968' : otherId === mn9 ? '#78ddd0' : '#7d98ad');
      mesh.renderOrder = otherId === selectedId ? 2 : 0;
    }
    render();
  }
  picker.innerHTML = [...neurons].sort((a,b) => nodeLabel(a).localeCompare(nodeLabel(b))).map(n => `<option value="${escapeHTML(n.id)}">${escapeHTML(nodeLabel(n))} · …${n.id.slice(-6)}</option>`).join('');
  picker.addEventListener('change',() => { selectNeuron(picker.value); onSelect(picker.value); });
  isolate.addEventListener('change',() => selectNeuron(selectedId));
  container.querySelector('[data-action="reset"]').addEventListener('click',reset);
  container.querySelector('[data-action="focus"]').addEventListener('click',() => {
    const bounds = meshes.get(selectedId)?.geometry.boundingBox;
    if (bounds) { target.copy(bounds.getCenter(new THREE.Vector3())); radius = radiusForBounds(bounds); render(); }
  });
  const zoom = factor => { radius = Math.min(4000,Math.max(8,radius*factor)); render(); };
  container.querySelector('[data-action="zoom-in"]').addEventListener('click',() => zoom(.8));
  container.querySelector('[data-action="zoom-out"]').addEventListener('click',() => zoom(1.25));
  stage.addEventListener('wheel',event => { event.preventDefault(); zoom(Math.exp(Math.max(-.4,Math.min(.4,event.deltaY*.001)))); },{passive:false});
  let pointer;
  stage.addEventListener('pointerdown',event => {
    if (event.button !== 0) return;
    stage.focus({preventScroll:true});
    pointer = {x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove',event => {
    if (!pointer) return;
    yaw -= (event.clientX-pointer.x)*.006;
    pitch = Math.min(1.45,Math.max(-1.45,pitch+(event.clientY-pointer.y)*.006));
    pointer.x = event.clientX; pointer.y = event.clientY; render();
  });
  const raycaster = new THREE.Raycaster();
  stage.addEventListener('pointerup',event => {
    if (!pointer) return;
    if (Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY) < 5) {
      const bounds = stage.getBoundingClientRect();
      raycaster.params.Line.threshold = radius*.0025;
      raycaster.setFromCamera(new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1),camera);
      const hit = raycaster.intersectObjects([...meshes.values()].filter(mesh => mesh.visible))[0];
      if (hit) { selectNeuron(hit.object.userData.id); onSelect(hit.object.userData.id); }
    }
    pointer = null;
  });
  stage.addEventListener('pointercancel',() => { pointer = null; });
  stage.addEventListener('keydown',event => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowLeft') yaw -= .12;
    else if (event.key === 'ArrowRight') yaw += .12;
    else if (event.key === 'ArrowUp') pitch = Math.min(1.45,pitch+.12);
    else if (event.key === 'ArrowDown') pitch = Math.max(-1.45,pitch-.12);
    else if (event.key === '+' || event.key === '=') { zoom(.8); return; }
    else if (event.key === '-') { zoom(1.25); return; }
    else if (event.key === 'Home') { reset(); return; }
    else return;
    render();
  });
  renderer.domElement.addEventListener('webglcontextlost',event => {
    event.preventDefault(); selection.textContent = 'The 3D graphics context was lost. Reload to restore it; graph explanations remain available.';
  });
  if (globalThis.ResizeObserver) { observer = new ResizeObserver(resize); observer.observe(stage); }
  else globalThis.addEventListener('resize',resize);
  resize(); reset(); selectNeuron(pendingId || roundup);
  return {
    selectNeuron, resize,
    destroy() {
      disposed = true; observer?.disconnect(); globalThis.removeEventListener('resize',resize);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const label of labels) { label.texture.dispose(); label.material.dispose(); }
      renderer.dispose(); container.replaceChildren();
    }
  };
}
