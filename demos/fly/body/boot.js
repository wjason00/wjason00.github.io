/* Decode the original source mesh bytes; motor/contact rules are loaded unchanged. */
(async function () {
  'use strict';
  const status = document.getElementById('load-status');
  const error = document.getElementById('scene-error');
  document.documentElement.dataset.loading = 'true';
  const expected = '7082f88db83d93799aff4fc932366c0d4eebe3d7288f883ac743aeadaac094cb';
  try {
    if (!window.DecompressionStream) throw new Error('This browser does not support the compressed geometry. Open this page in a current Chrome, Edge, Firefox or Safari.');
    const [metaResponse, meshResponse] = await Promise.all([
      fetch('asset-metadata.json'), fetch('meshes.bin.gz')
    ]);
    if (!metaResponse.ok || !meshResponse.ok) throw new Error('A required local geometry file did not load.');
    const metadata = await metaResponse.json();
    const transfer = await meshResponse.arrayBuffer();
    const header = new Uint8Array(transfer, 0, Math.min(transfer.byteLength, 2));
    // Static hosts may transparently decompress a .gz response. Accept either
    // transport form; the exact decoded length and SHA-256 still gate loading.
    const buffer = header[0] === 0x1f && header[1] === 0x8b
      ? await new Response(new Response(transfer).body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      : transfer;
    if (buffer.byteLength !== 29435400) throw new Error('Geometry length check failed.');
    if (!crypto.subtle) throw new Error('Geometry verification requires HTTPS or a local development server.');
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const actual = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) throw new Error('Geometry integrity check failed.');
    window.NATIVE_FLYBODY_ASSET = { ...metadata, buffer };
    status.textContent = 'Building the body and saved replay…';
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'native-app.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('The local replay controller did not load.'));
      document.body.append(script);
    });
    // The shared geometry pool holds independent attributes after initialization.
    // Release the transport buffer; it is not needed for subsequent poses.
    window.NATIVE_FLYBODY_ASSET.buffer = null;
    if (!window.FLY_DEMO || !window.FLY_DEMO.getState().webgl) throw new Error('The 3D renderer did not initialize.');
    status.hidden = true;
    document.documentElement.dataset.loading = 'false';
    window.dispatchEvent(new Event('fly-body-ready'));
  } catch (cause) {
    status.textContent = 'Body replay unavailable.';
    error.hidden = false;
    error.textContent = cause.message;
    document.documentElement.dataset.loading = 'failed';
  }
})();
