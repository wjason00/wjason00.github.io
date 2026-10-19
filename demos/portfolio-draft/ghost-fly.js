/* Decorative FlyBody specimen, using the existing lossless source package and
 * native neutral-pose hierarchy. Only camera, lighting and materials change.
 * This view contains no neural activity, motor mapping or simulation.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('ghost-fly');
  const visual = canvas?.closest('.project-visual[data-visual="fly"]');
  const scriptURL = document.currentScript?.src || document.baseURI;
  const sourceURL = name => new URL('../fly/body/' + name, scriptURL).href;
  const expectedSHA = '7082f88db83d93799aff4fc932366c0d4eebe3d7288f883ac743aeadaac094cb';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  let active = false, destroyed = false, failed = false, progress = 0;
  let pending, renderer, scene, camera, specimen, rig, pool, observer, frame = 0;
  let radius = 1, fittedWidth = 0, fittedHeight = 0;

  function showFallback() {
    visual?.classList.remove('has-model');
    canvas?.classList.remove('has-model');
  }

  function release() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (rig) { rig.dispose(); rig = null; }
    if (pool) { pool.dispose(); pool = null; }
    renderer?.dispose();
    renderer = scene = camera = specimen = null;
  }

  function fail() {
    if (destroyed) return;
    failed = true;
    showFallback();
    release();
  }

  function requestDraw() {
    if (!active || destroyed || failed || !renderer || !specimen || frame) return;
    frame = requestAnimationFrame(draw);
  }

  function fit(width, height) {
    const aspect = width / height;
    const THREE = window.THREE;
    specimen.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const projected = new THREE.Box3();
    const point = new THREE.Vector3();
    // Fit the transformed bounds of every original mesh in camera space, rather
    // than its much looser 3D sphere. No source vertices or joint angles change.
    for (const mesh of Object.values(rig.geoms)) {
      const geometry = mesh.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            point.set(x, y, z).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
            projected.expandByPoint(point);
          }
    }
    const center = projected.getCenter(new THREE.Vector3());
    const size = projected.getSize(new THREE.Vector3());
    const padding = radius * 0.045;
    const halfHeight = Math.max(size.y / 2 + padding, (size.x / 2 + padding) / aspect) * 1.08;
    camera.left = center.x - halfHeight * aspect;
    camera.right = center.x + halfHeight * aspect;
    camera.top = center.y + halfHeight;
    camera.bottom = center.y - halfHeight;
    camera.updateProjectionMatrix();
  }

  function draw() {
    frame = 0;
    if (!active || destroyed || failed || !renderer) return;
    const width = Math.round(canvas.clientWidth), height = Math.round(canvas.clientHeight);
    if (width < 2 || height < 2) return;
    try {
      const turn = motion.matches ? 0 : progress - 0.5;
      specimen.rotation.set(turn * 0.08, turn * 0.13, turn * 0.16);
      if (width !== fittedWidth || height !== fittedHeight) {
        fittedWidth = width; fittedHeight = height;
        renderer.setSize(width, height, false);
        fit(width, height);
      }
      renderer.render(scene, camera);
      visual?.classList.add('has-model');
      canvas.classList.add('has-model');
    } catch {
      fail();
    }
  }

  async function load() {
    const THREE = window.THREE;
    if (!THREE || !window.SharedPackedFlyBodyRig || !window.DecompressionStream || !window.crypto?.subtle)
      throw new Error('Decorative source model is unavailable in this browser.');

    // Check WebGL before downloading the 8 MB source package. Keep the fallback
    // visible throughout download, verification and the first successful frame.
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    const responses = await Promise.all([
      fetch(sourceURL('asset-metadata.json'), { signal: controller.signal }),
      fetch(sourceURL('meshes.bin.gz'), { signal: controller.signal })
    ]);
    if (responses.some(response => !response.ok)) throw new Error('Source geometry did not load.');
    const [metadata, transfer] = await Promise.all([responses[0].json(), responses[1].arrayBuffer()]);
    const header = new Uint8Array(transfer, 0, Math.min(2, transfer.byteLength));
    const buffer = header[0] === 0x1f && header[1] === 0x8b
      ? await new Response(new Response(transfer).body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      : transfer;
    if (buffer.byteLength !== 29435400) throw new Error('Source geometry length differs.');
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const actual = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    if (actual !== expectedSHA) throw new Error('Source geometry integrity differs.');
    if (destroyed || failed) return;

    pool = SharedPackedFlyBodyRig.createPool(THREE, { ...metadata, buffer });
    rig = pool.create();
    // Retain the source's distinct body/membrane materials and all geometry.
    // Their presentation becomes pale silver rather than the replay's colours.
    for (const [name, material] of Object.entries(rig.materials)) {
      const membrane = name === 'membrane';
      const accent = ['black', 'ocelli', 'bristle-brown', 'brown'].includes(name);
      material.color.set(membrane ? '#b7c9cf' : accent ? '#8c9fa7' : '#b3c2c8');
      material.specular.set('#ffffff');
      material.shininess = membrane ? 140 : 115;
      material.transparent = true;
      material.opacity = membrane ? 0.27 : accent ? 0.68 : 0.72;
      material.depthWrite = false;
      material.needsUpdate = true;
    }
    const bounds = new THREE.Box3().setFromObject(rig.root);
    const center = bounds.getCenter(new THREE.Vector3());
    radius = bounds.getSize(new THREE.Vector3()).length() / 2;
    const centered = new THREE.Group();
    centered.position.copy(center).multiplyScalar(-1);
    centered.add(rig.root);
    specimen = new THREE.Group();
    specimen.add(centered);
    scene = new THREE.Scene();
    scene.add(specimen);

    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
    camera.position.set(3, -6, 9).multiplyScalar(radius / 3);
    camera.up.set(0.75, 0.55, 0.35).normalize();
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7e98a6, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(1, -4, 8);
    const rim = new THREE.DirectionalLight(0xcce8f4, 2.5);
    rim.position.set(-5, 4, 2);
    const fill = new THREE.DirectionalLight(0xffffff, 0.9);
    fill.position.set(4, 3, -1);
    scene.add(key, rim, fill);
    requestDraw();
  }

  function setActive(value) {
    if (destroyed || failed || !canvas || !visual) return;
    const next = Boolean(value);
    if (active === next) return;
    active = next;
    if (!active) {
      cancelAnimationFrame(frame);
      frame = 0;
      return;
    }
    if (!pending) pending = load().catch(fail);
    // Source loading may be in progress; its completion schedules the frame.
    if (specimen) requestDraw();
  }

  function setProgress(value) {
    if (!Number.isFinite(value) || destroyed) return;
    const next = Math.max(0, Math.min(1, value));
    if (next === progress) return;
    progress = next;
    if (!motion.matches) requestDraw();
  }

  function onMotionChange() { requestDraw(); }
  function onContextLost(event) { event.preventDefault(); fail(); }
  function destroy() {
    if (destroyed) return;
    destroyed = true; active = false;
    controller.abort();
    observer?.disconnect();
    motion.removeEventListener('change', onMotionChange);
    canvas?.removeEventListener('webglcontextlost', onContextLost);
    showFallback();
    release();
  }

  window.PortfolioGhost = { setActive, setProgress, destroy };
  if (!canvas || !visual) return;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.addEventListener('webglcontextlost', onContextLost);
  motion.addEventListener('change', onMotionChange);
  observer = new ResizeObserver(requestDraw);
  observer.observe(canvas);
})();
