import {frames,metadata} from './surface-data.js';

// Display-only rotation of three unaltered saved triangle meshes.
export function mountSurfaceViewer(canvas,options={}) {
  let gl,program,positionBuffer,normalBuffer,indexBuffer,edgeBuffer;
  let current=frames.has(Number(options.frame))?Number(options.frame):15;
  let yaw=0,pitch=0,wireframe=false,drag=null,dead=false,scheduled=0,observer;
  const cleanups=[],buffers=[];
  const win=canvas.ownerDocument.defaultView;
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const hex=String(options.color||'#b8d5c4').replace('#','');
  const color=/^[0-9a-f]{6}$/i.test(hex)?[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255):[.72,.84,.77];
  function on(target,name,handler,config){target.addEventListener(name,handler,config);cleanups.push(()=>target.removeEventListener(name,handler,config));}
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  function makeBuffer(target,data){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;}
  function rotation(){const c=Math.cos(yaw),s=Math.sin(yaw),a=Math.cos(pitch),b=Math.sin(pitch);return new Float32Array([c,b*s,-a*s,0,a,b,s,-b*c,a*c]);}
  function upload(){
    const f=frames.get(current);if(!f)return;
    if(positionBuffer)for(const b of [positionBuffer,normalBuffer,indexBuffer,edgeBuffer])gl.deleteBuffer(b);
    positionBuffer=makeBuffer(gl.ARRAY_BUFFER,f.positions);normalBuffer=makeBuffer(gl.ARRAY_BUFFER,f.normals);
    // The largest saved frame has46,456vertices: Uint16 is lossless here.
    indexBuffer=makeBuffer(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(f.indices));
    const edges=new Uint16Array(f.indices.length*2);
    for(let i=0;i<f.indices.length;i+=3){const a=f.indices[i],b=f.indices[i+1],c=f.indices[i+2];edges.set([a,b,b,c,c,a],i*2);}
    edgeBuffer=makeBuffer(gl.ELEMENT_ARRAY_BUFFER,edges);
    canvas.dataset.surfaceFrame=String(current);
    canvas.dataset.surfaceVertices=String(f.positions.length/3);
    canvas.dataset.surfaceTriangles=String(f.indices.length/3);
  }
  function render(){
    scheduled=0;if(dead||!gl)return;
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,win.devicePixelRatio||1);
    const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
    const f=frames.get(current),min=Math.min(w,h);
    gl.uniformMatrix3fv(gl.getUniformLocation(program,'uRotation'),false,rotation());
    gl.uniform2f(gl.getUniformLocation(program,'uScale'),.84*min/w,.84*min/h);
    gl.uniform3fv(gl.getUniformLocation(program,'uColor'),color);
    for(const [name,buffer]of [['aPosition',positionBuffer],['aNormal',normalBuffer]]){
      const loc=gl.getAttribLocation(program,name);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(loc);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,wireframe?edgeBuffer:indexBuffer);
    gl.drawElements(wireframe?gl.LINES:gl.TRIANGLES,wireframe?f.indices.length*2:f.indices.length,gl.UNSIGNED_SHORT,0);
    canvas.dataset.surfaceRenderCount=String(Number(canvas.dataset.surfaceRenderCount||0)+1);
    canvas.dataset.surfaceYaw=String(yaw);canvas.dataset.surfacePitch=String(pitch);
  }
  function request(){if(!dead&&!scheduled)scheduled=win.requestAnimationFrame(render);}
  const api={ready,metadata,
    setFrame(value){const n=Number(value);if(!frames.has(n))throw new RangeError('Only actual saved frames0,15,29 are available.');if(n===current)return;current=n;if(gl)upload();request();options.onChange?.({frame:current,t:current/29});},
    resetView(){yaw=0;pitch=0;request();},
    setWireframe(value){wireframe=Boolean(value);request();},
    destroy(){dead=true;if(scheduled)win.cancelAnimationFrame(scheduled);observer?.disconnect();for(const fn of cleanups)fn();if(gl){for(const b of buffers)gl.deleteBuffer(b);if(program)gl.deleteProgram(program);}canvas.dataset.surfaceReady='false';}
  };
  try {
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
    if(!gl)throw new Error('WebGL is unavailable; use the original recording.');
    const vertex=shader(gl.VERTEX_SHADER,`attribute vec3 aPosition;attribute vec3 aNormal;uniform mat3 uRotation;uniform vec2 uScale;varying vec3 vNormal;varying vec3 vPosition;void main(){vec3 p=uRotation*aPosition;vPosition=p;vNormal=uRotation*aNormal;gl_Position=vec4(p.xy*uScale,-p.z*.35,1.);}`);
    const fragment=shader(gl.FRAGMENT_SHADER,`precision mediump float;uniform vec3 uColor;varying vec3 vNormal;varying vec3 vPosition;void main(){vec3 n=normalize(vNormal);vec3 light=normalize(vec3(-.38,.62,1.));float diffuse=max(0.,dot(n,light));float fill=max(0.,dot(n,normalize(vec3(.7,-.1,.4))));float rim=pow(1.-abs(n.z),3.);float spec=pow(max(0.,dot(reflect(-light,n),vec3(0.,0.,1.))),34.);vec3 shaded=uColor*(.13+.74*diffuse+.16*fill)+vec3(.21,.25,.23)*rim+vec3(.32)*spec;gl_FragColor=vec4(pow(clamp(shaded,0.,1.),vec3(.86)),1.);}`);
    program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.deleteShader(vertex);gl.deleteShader(fragment);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);gl.disable(gl.CULL_FACE);
    upload();canvas.tabIndex=0;canvas.style.touchAction='none';canvas.dataset.surfaceReady='true';
    if(!canvas.hasAttribute('aria-label'))canvas.setAttribute('aria-label','Drag to rotate this saved geometric surface. Arrow keys rotate; Home resets the view.');
    on(canvas,'pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);canvas.focus({preventScroll:true});});
    on(canvas,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;yaw+=(e.clientX-drag.x)*.009;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-drag.y)*.009));drag.x=e.clientX;drag.y=e.clientY;request();});
    const release=e=>{if(!drag||e.pointerId!==drag.id)return;drag=null;canvas.releasePointerCapture?.(e.pointerId);};
    on(canvas,'pointerup',release);on(canvas,'pointercancel',release);
    on(canvas,'keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home'){yaw=0;pitch=0;}else if(e.key==='ArrowLeft')yaw-=.12;else if(e.key==='ArrowRight')yaw+=.12;else pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.key==='ArrowUp'?-.12:.12)));request();});
    on(canvas,'webglcontextlost',e=>{e.preventDefault();canvas.dataset.surfaceReady='false';options.onError?.(new Error('The graphics context was lost; use the original recording.'));});
    if(win.ResizeObserver){observer=new win.ResizeObserver(request);observer.observe(canvas);}else on(win,'resize',request);
    render();resolveReady(api);queueMicrotask(()=>options.onReady?.(api));
  } catch(error){canvas.dataset.surfaceReady='false';rejectReady(error);ready.catch(()=>{});queueMicrotask(()=>options.onError?.(error));}
  return api;
}
