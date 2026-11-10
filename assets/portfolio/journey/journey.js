// Journey: an optional layer over the published homepage.
// Each project opens as a full-screen stage driven by scrolling through its real
// artefact. Without JavaScript, with reduced motion, or if a library fails to load,
// this file does nothing and the published page stands unchanged.
import { positions } from '../brain-surface-data.js';

const root = document.querySelector('.portal');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)').matches;
const narrow = matchMedia('(max-width: 800px)').matches;
const here = new URL('./', import.meta.url).href;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (t, a, b) => clamp((t - a) / (b - a));
const ease = t => 1 - Math.pow(1 - t, 3);

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
// A stage's visual sits in a slot. On wide screens the slot has no box of its own; on phones it is
// the row between the words and the controls, so the visual can never cover the text.
function slot(media) {
  const box = el('div', 'jr-slot');
  box.append(media);
  return box;
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.append(s);
  });
}
function gsapReady() {
  return new Promise(resolve => {
    if (root.dataset.motionLibrary) return resolve(root.dataset.motionLibrary);
    new MutationObserver((_, o) => {
      if (root.dataset.motionLibrary) { o.disconnect(); resolve(root.dataset.motionLibrary); }
    }).observe(root, { attributes: true, attributeFilter: ['data-motion-library'] });
  });
}

// A real film as an image sequence. Scrolling picks the frame; nothing is interpolated.
class Film {
  constructor(canvas, { dir, count, fit, anchor = .5, shift = 0, alpha = false, zoom = 1, extend = false }) {
    Object.assign(this, { canvas, dir, count, fit, anchor, shift, alpha, zoom, extend });
    this.ctx = canvas.getContext('2d', { alpha });
    this.frames = new Array(count).fill(null);
    this.last = -1;
    this.started = false;
  }
  url(i) { return `${here}${this.dir}/f${String(i + 1).padStart(3, '0')}.webp`; }
  async fetch(i) {
    if (this.frames[i]) return;
    const img = new Image();
    img.src = this.url(i);
    try { await img.decode(); this.frames[i] = img; if (i === 0) this.onFirst?.(img); }
    catch { /* A missing frame falls back to its nearest neighbour. */ }
  }
  // Evenly spaced frames first, so a fast scroll always has something to show.
  async load() {
    if (this.started) return; this.started = true;
    await this.fetch(0); this.draw(this.progress || 0);
    for (const step of [16, 8, 4, 2, 1]) {
      const batch = [];
      for (let i = 0; i < this.count; i += step) if (!this.frames[i]) batch.push(i);
      for (let k = 0; k < batch.length; k += 6) await Promise.all(batch.slice(k, k + 6).map(i => this.fetch(i)));
      this.last = -1; this.draw(this.progress || 0);
    }
  }
  nearest(i) {
    for (let d = 0; d < this.count; d++) {
      if (this.frames[i - d]) return this.frames[i - d];
      if (this.frames[i + d]) return this.frames[i + d];
    }
    return null;
  }
  size() {
    const r = this.canvas.getBoundingClientRect(), dpr = Math.min(1.5, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.last = -1; }
  }
  draw(p) {
    this.progress = p;
    const i = Math.round(clamp(p) * (this.count - 1));
    if (i === this.last) return;
    this.size();
    const img = this.nearest(i);
    if (!img) return;
    this.last = this.frames[i] ? i : -1;
    const { width: W, height: H } = this.canvas, s = (this.fit === 'cover' ? Math.max : Math.min)(W / img.naturalWidth, H / img.naturalHeight) * this.zoom;
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    if (this.alpha) this.ctx.clearRect(0, 0, W, H);
    else if (this.bg) { this.ctx.fillStyle = this.bg; this.ctx.fillRect(0, 0, W, H); }
    // On a tall phone the film's own top and bottom rows extend to fill the screen.
    if (this.extend && H > h) {
      const y = (H - h) / 2, n = img.naturalHeight;
      this.ctx.filter = 'blur(24px)';
      this.ctx.drawImage(img, 0, 0, img.naturalWidth, 2, -40, -40, W + 80, y + 60);
      this.ctx.drawImage(img, 0, n - 2, img.naturalWidth, 2, -40, y + h - 20, W + 80, y + 60);
      this.ctx.filter = 'none';
    }
    this.ctx.drawImage(img, (W - w) * this.anchor + this.shift * W, (H - h) / 2, w, h);
  }
}

// The hero's own 4,096 points, entered by the camera. Interface artwork, as in the hero.
// On phones the hero is not full-screen, so the points start partly visible: otherwise the opening
// scrolls in as an empty screen.
function diveLayer(canvas, floor = 0) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl) return null;
  const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, `
    attribute vec3 aP; uniform float uZ,uYaw,uPitch,uScale,uAspect,uPix,uAlpha,uMax; varying float vFade;
    void main(){
      float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);
      vec3 a=vec3(cy*aP.x+sy*aP.z,aP.y,-sy*aP.x+cy*aP.z);
      vec3 r=vec3(a.x,cp*a.y-sp*a.z,sp*a.y+cp*a.z);
      float d=uZ-r.z;
      float k=d>.02?1./d:0.;
      gl_Position=d>.02?vec4(r.x*k*uScale/uAspect,r.y*k*uScale,0.,1.):vec4(3.,3.,0.,1.);
      gl_PointSize=clamp(uPix*k*k,1.,uMax);
      vFade=smoothstep(.06,.55,d)*uAlpha;
    }`));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
    precision mediump float; uniform vec3 uColor; varying float vFade;
    void main(){
      float d=length(gl_PointCoord-.5);
      float a=smoothstep(.5,.46,d)*vFade;
      gl_FragColor=vec4(uColor*a,a);
    }`));
  gl.linkProgram(program); gl.useProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'aP');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const u = n => gl.getUniformLocation(program, n);
  const count = positions.length / 3;
  return p => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(1.5, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const t = ease(p), light = span(p, .3, .5);
    gl.uniform1f(u('uZ'), 3.2 - 3.12 * Math.pow(span(p, 0, .66), 1.35));
    gl.uniform1f(u('uAlpha'), (floor + (1 - floor) * span(p, 0, .1)) * (1 - span(p, .54, .66)));
    gl.uniform1f(u('uYaw'), -.45 + 1.1 * t);
    gl.uniform1f(u('uPitch'), -.16 + .28 * t);
    gl.uniform1f(u('uScale'), 4 * Math.min(w, h) * .4 / (h / 2));
    gl.uniform1f(u('uAspect'), w / h);
    gl.uniform1f(u('uPix'), 22 * dpr);
    gl.uniform1f(u('uMax'), Math.max(70, Math.min(w, h) * .19));
    gl.uniform3f(u('uColor'), .063 + light * .78, .216 + light * .68, .184 + light * .72);
    gl.drawArrays(gl.POINTS, 0, count);
  };
}

// Same-origin SVG: split the two neurons by colour so each can approach the other.
async function splitNeurons(src) {
  const img = new Image(); img.src = src; await img.decode();
  const W = 1140, H = 960, base = document.createElement('canvas');
  base.width = W; base.height = H;
  const ctx = base.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H), a = new ImageData(W, H), b = new ImageData(W, H);
  for (let i = 0; i < data.data.length; i += 4) {
    if (!data.data[i + 3]) continue;
    const violet = data.data[i + 2] - data.data[i + 1] > 40, target = violet ? a : b;
    for (let k = 0; k < 4; k++) target.data[i + k] = data.data[i + k];
  }
  return [a, b].map(image => {
    const c = el('canvas', 'jr-neuron'); c.width = W; c.height = H;
    c.getContext('2d').putImageData(image, 0, 0); return c;
  });
}

function buildStage(article, { key, head, label, limit }) {
  const stage = el('div', `jr-stage jr-${key}`), pin = el('div', 'jr-pin'), copy = el('div', 'jr-copy');
  head.forEach(node => node && copy.append(node));
  const sheet = el('div', 'jr-sheet', { id: `sheet-${key}`, tabindex: '-1' });
  while (article.firstChild) sheet.append(article.firstChild);
  const skip = el('a', 'jr-skip', { href: `#sheet-${key}` });
  skip.textContent = label || 'Skip to the details';
  const clock = el('p', 'jr-clock', { 'aria-hidden': 'true' });
  pin.append(copy, clock, skip); stage.append(pin); article.append(stage, sheet);
  // A limit belongs beside its claim, so the stage shows it as well as the sheet.
  if (limit) { const copyOf = sheet.querySelector(limit)?.cloneNode(true); if (copyOf) { copyOf.classList.add('jr-limit'); copy.append(copyOf); } }
  return { key, stage, pin, copy, sheet, skip, clock, t: 0, cur: 0, active: false };
}

async function boot() {
  if ((await gsapReady()) !== 'gsap') return;
  await loadScript(`${here}vendor/ScrollTrigger.min.js`);
  if (finePointer) await loadScript(`${here}vendor/lenis.min.js`);
  const { gsap, ScrollTrigger, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('has-journey');

  // Lenis only smooths wheel input for the scrubbed stages; touch and keyboard stay native.
  let lenis = null;
  if (Lenis) {
    lenis = new Lenis({ lerp: .11, smoothWheel: true, allowNestedScroll: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const opening = root.querySelector('.portal-opening');
  const nav = root.querySelector('.portal-wayfinder');
  const scenes = {
    morpher: root.querySelector('#work-model-morpher'),
    morphliner: root.querySelector('#work-morphliner'),
    eeg: root.querySelector('#work-g27'),
    fly: root.querySelector('#work-fly'),
    brain: root.querySelector('#work-morphbrain')
  };

  // The wayfinder floats over the stages instead of reserving a strip of the page.
  const way = el('div', 'jr-way'); root.prepend(way); way.append(nav);

  // Height of the small viewport (100svh) in pixels. On phones a pin is the large viewport, so
  // measuring the sheet's overlap with the pin's height would cut each stage's scroll short.
  const probe = el('div', 'jr-probe', { 'aria-hidden': 'true' }); root.append(probe);
  const small = () => probe.offsetHeight || innerHeight;

  const stages = [];

  // Opening: enter the hero's point surface.
  const dive = { key: 'dive', stage: opening, pin: el('div', 'jr-pin'), copy: el('div', 'jr-copy'), t: 0, cur: 0, active: false };
  opening.classList.add('jr-stage', 'jr-dive');
  [...opening.children].forEach(node => dive.copy.append(node));
  const diveCanvas = el('canvas', 'jr-gl', { 'aria-hidden': 'true' });
  dive.pin.append(diveCanvas, dive.copy); opening.append(dive.pin);
  const drawDive = diveLayer(diveCanvas, narrow ? .6 : 0);
  dive.render = p => {
    drawDive?.(p);
    const dark = span(p, .34, .54);
    dive.pin.style.setProperty('--dark', dark.toFixed(3));
    dive.copy.style.opacity = span(p, .62, .76).toFixed(3);
    dive.copy.style.transform = `translate3d(0,${((1 - ease(span(p, .62, .8))) * 28).toFixed(1)}px,0)`;
    // Faded out, the copy stays readable by screen readers and reachable by keyboard; only pointers skip it.
    dive.copy.style.pointerEvents = p > .6 ? 'auto' : 'none';
  };
  stages.push(dive);

  // Model Morpher: the 5.5 s recording, dentate gyrus to whole brain.
  {
    const s = buildStage(scenes.morpher, { key: 'morpher', limit: '.portal-limit', head: [scenes.morpher.querySelector('.portal-morpher-head')] });
    const canvas = el('canvas', 'jr-film', { 'aria-hidden': 'true' }); s.pin.prepend(slot(canvas));
    const wide = innerWidth > 800;
    const film = new Film(canvas, { dir: 'morpher', count: 66, fit: 'contain', alpha: true, anchor: wide ? 1 : .5, shift: wide ? .12 : 0 });
    s.load = () => film.load();
    s.render = p => {
      film.draw(p);
      s.clock.textContent = `${(p * 5.5).toFixed(1)} / 5.5 s of the recording`;
    };
    stages.push(s);
  }

  // Morphliner: the camera move from the exported film, under the visitor's control.
  {
    const s = buildStage(scenes.morphliner, { key: 'morphliner', head: [scenes.morphliner.querySelector('.morphliner-head')] });
    const canvas = el('canvas', 'jr-film', { 'aria-hidden': 'true' }); s.pin.prepend(canvas);
    const tall = innerHeight > innerWidth;
    const film = new Film(canvas, tall
      ? { dir: 'morphliner', count: 49, fit: 'contain', zoom: 1.3, extend: true }
      : { dir: 'morphliner', count: 49, fit: 'cover' });
    film.bg = '#b4a998';
    s.load = () => film.load();
    s.render = p => {
      film.draw(p);
      s.clock.textContent = `${(p * 6.5).toFixed(1)} / 6.5 s of the exported film`;
      s.copy.style.opacity = (1 - span(p, .72, .86)).toFixed(3);
    };
    stages.push(s);
  }

  // EEG: the team's figure, unchanged, uncovered along its own time axis.
  {
    const s = buildStage(scenes.eeg, { key: 'eeg', limit: '.portal-limit', head: [scenes.eeg.querySelector('header')] });
    const figure = s.sheet.querySelector('.portal-eeg-figure'), img = figure.querySelector('img');
    const wrap = el('div', 'jr-reveal'), edge = el('i', 'jr-edge');
    img.loading = 'eager';
    img.before(wrap); wrap.append(img, edge); s.pin.prepend(slot(figure));
    s.render = p => {
      const x = 8 + 92 * clamp(p / .92);
      img.style.clipPath = `inset(0 ${(100 - x).toFixed(2)}% 0 0)`;
      edge.style.left = `${x.toFixed(2)}%`;
      edge.style.opacity = (1 - span(p, .86, .94)).toFixed(3);
    };
    stages.push(s);
  }

  // Fly: two reconstructed neurons approach their saved positions.
  {
    const s = buildStage(scenes.fly, { key: 'fly', head: [scenes.fly.querySelector('.fly-head')] });
    const wrap = el('div', 'jr-neurons'); s.pin.prepend(slot(wrap));
    let parts = null;
    s.load = async () => {
      if (parts) return;
      parts = await splitNeurons('/assets/portfolio/spatial/fly-media/neuron-portrait-web.svg');
      wrap.append(...parts); s.render(s.cur);
    };
    s.render = p => {
      s.clock.textContent = 'The approach is illustrative. The final frame shows the saved positions.';
      if (!parts) return;
      const t = ease(span(p, 0, .86)), far = (1 - t) * Math.min(38, innerWidth / 26);
      parts[0].style.transform = `translate3d(${-far * .22}%,${(1 - t) * 5}%,0)`;
      parts[1].style.transform = `translate3d(${far * 1.1}%,${(t - 1) * 5}%,0)`;
    };
    stages.push(s);
  }

  // MorphBrain: the saved field gives way to the identities computed from it.
  {
    const s = buildStage(scenes.brain, { key: 'brain', limit: '.portal-limit', head: [scenes.brain.querySelector('header')] });
    const wrap = el('div', 'jr-fields');
    const field = el('img', 'is-field', { src: '/assets/portfolio/morphbrain-field.png', alt: '', decoding: 'async' });
    const regions = el('img', 'is-regions', { src: '/assets/portfolio/morphbrain-regions.png', alt: '', decoding: 'async' });
    const edge = el('i', 'jr-edge'); wrap.append(field, regions, edge); s.pin.prepend(slot(wrap));
    s.render = p => {
      const y = 100 * clamp((p - .1) / .74);
      regions.style.clipPath = `inset(${(100 - y).toFixed(2)}% 0 0 0)`;
      edge.style.top = `${(100 - y).toFixed(2)}%`;
      edge.style.opacity = y > 1 && y < 99 ? 1 : 0;
      s.clock.textContent = y < 50 ? 'Signal field' : 'Regional identities';
    };
    stages.push(s);
  }

  ScrollTrigger.create({
    trigger: scenes.morpher, start: 'top 20%', endTrigger: scenes.brain, end: 'bottom 40%',
    toggleClass: { targets: way, className: 'is-shown' }
  });

  // Scroll drives each stage; a small lerp keeps touch scrubbing from stepping.
  const nearby = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) stages.find(s => s.stage === entry.target)?.load?.(); });
  }, { rootMargin: '150% 0px' });

  stages.forEach(s => {
    nearby.observe(s.stage);
    s.st = ScrollTrigger.create({
      trigger: s.stage, start: 'top top',
      // The scrub ends where the next sheet, which overlaps the stage by 100svh, starts to rise.
      end: () => `+=${Math.max(1, s.stage.offsetHeight - s.pin.offsetHeight - small())}`,
      onUpdate: self => { s.t = self.progress; },
      onToggle: self => { s.active = self.isActive; },
      onRefresh: self => { s.t = self.progress; }
    });
    // The stage settles back as its sheet rises over it.
    if (s.sheet) gsap.to(s.pin, {
      scale: .94, ease: 'none',
      scrollTrigger: { trigger: s.sheet, start: 'top bottom', end: 'top top', scrub: true }
    });
    s.render(0);
    s.skip?.addEventListener('click', event => {
      event.preventDefault();
      const top = s.sheet.getBoundingClientRect().top + scrollY;
      if (lenis) lenis.scrollTo(top, { duration: 1 }); else scrollTo({ top, behavior: 'smooth' });
      s.sheet.focus({ preventScroll: true });
      history.pushState(null, '', `#${s.sheet.id}`);
    });
  });

  gsap.ticker.add(() => {
    for (const s of stages) {
      if (Math.abs(s.t - s.cur) < .0004) continue;
      s.cur += (s.t - s.cur) * (lenis ? .5 : .22);
      s.render(s.cur);
    }
  });

  // On narrow screens the wayfinder scrolls, so keep the current project in view.
  const links = [...nav.querySelectorAll('a')];
  new MutationObserver(() => {
    const current = links.find(link => link.hasAttribute('aria-current'));
    if (current) nav.scrollTo({ left: current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2, behavior: 'smooth' });
  }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });

  // The project index sits at the end of the opening. Links to #projects, and keyboard focus moving
  // into the index, go to the point where it is fully shown instead of the dark start of the dive.
  const showIndex = smooth => {
    if (!dive.st) return;
    const top = dive.st.start + (dive.st.end - dive.st.start) * .82;
    if (lenis) lenis.scrollTo(top, smooth ? { duration: 1 } : { immediate: true });
    else scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  };
  dive.copy.addEventListener('focusin', event => {
    if (event.target.matches(':focus-visible') && (dive.t < .62 || dive.t > .95)) showIndex(false);
  });
  document.querySelectorAll('a[href="#projects"]').forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showIndex(event.detail !== 0);
    history.pushState(null, '', '#projects');
    if (event.detail === 0) {
      const heading = dive.copy.querySelector('h2');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }));

  addEventListener('load', () => ScrollTrigger.refresh());
  ScrollTrigger.refresh();
  // The layout has grown, so a link into the page must land where it was aimed.
  if (location.hash === '#projects') showIndex(false);
  else if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'auto' });
  document.documentElement.dataset.journey = 'ready';
}

if (root && !reduce.matches) boot().catch(error => {
  document.documentElement.classList.remove('has-journey');
  document.documentElement.dataset.journey = 'failed';
  console.warn('Journey layer did not start; the published page remains.', error);
});
reduce.addEventListener('change', () => location.reload());
