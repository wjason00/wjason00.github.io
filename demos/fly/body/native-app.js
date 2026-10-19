/* Native FlyBody replay. Saved neural signals drive an explicitly assumed body model. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),D=window.NATIVE_FEEDING_EVENTS,A=window.NATIVE_FLYBODY_ASSET,P=window.NATIVE_FEEDING_POLICY;
 const START=P.food.approach_seconds[0],END=P.replay_duration_seconds,colors=['#2866a5','#9a4c76'];
 let time=START,playing=false,last=null,compare=false,dirty=true,yaw=0,pitch=0,paths=[],selected=[],motorEventTimes={};
 let renderer,scene,camera,engine,wholeBox,mouthBox,bodyPool;const bodies=[];
 const labels=['MN9_l','MN9_r','MN6_l','MN6_r'];
 function name(c){return c.lesion==='intact'?'Intact':c.case_id.includes('623211725')?'Roundup …623211725 output off':'Roundup …607272649 output off';}
 // Case labels follow retained archive metadata; no pairing is inferred from trial numbers.
 function cases(){return D.cases.filter(c=>c.stimulus===$('stimulus').value);}
 function fillCases(){const list=cases();$('circuit').replaceChildren(...list.map((c,i)=>new Option(name(c),String(i))));$('comparison').replaceChildren(...list.slice(1).map((c,i)=>new Option(name(c),String(i+1))));}
 function currentTrial(c){return c.trials.find(t=>t.trial===+$('trial').value);}
 function choose(){const list=cases();selected=compare?[list[0],list[+$('comparison').value]]:[list[+$('circuit').value]];
  if(selected.some(c=>!c))throw Error('Missing archive case');
  ensureBodies(selected.length);
  paths=selected.map(c=>{const trial=currentTrial(c);if(!trial)throw Error('Missing source trial');const motor=NativeMotorReplay.build(trial,P,{blockMN9:$('block-mn9').checked,blockMN6:$('block-mn6').checked});return {trial,motor,food:engine.simulate(motor)};});
  motorEventTimes=Object.fromEntries(['all','MN9','MN6'].map(group=>[group,FlyMotorNavigation.events(paths.map(p=>p.trial),group)]));
 }
 function state(){return {time,playing,compare,cases:selected.map(c=>c.case_id),trial:+$('trial').value,
  sourceKind:D.source_kind,withinTrialCoupling:D.within_trial_coupling,betweenConditionPairing:D.between_condition_pairing,
  poses:paths.map(p=>({motor:p.motor.sample(Math.max(0,time)),food:p.food.sample(time)})),webgl:!!renderer};}
 function reset(){playing=false;time=START;last=null;update();}
 function phase(q,i){if(time<0)return 'Presenting droplet';if(q.food.contact)return 'Mesh contact';
  const a=q.motor.extension.midline,b=paths[i].motor.sample(Math.max(0,time-.03)).extension.midline;
  return time>1.35?'Withdrawing droplet':a<.015?'At rest':a>b+.001?'Reaching':a<b-.001?'Retracting':'Driven mouth pose';}
 function update(){dirty=true;const q=state();$('scene').dataset.compare=String(compare);$('compare-mode').setAttribute('aria-pressed',String(compare));$('watch-mode').setAttribute('aria-pressed',String(!compare));
  $('single-control').hidden=compare;$('compare-control').hidden=!compare;$('pairing-note').hidden=!compare;
  $('play').textContent=playing?'Pause':time>=END?'Replay':time>START?'Continue':'Present droplet';$('clip-time').textContent=(time*1000).toFixed(1)+' ms';$('scrub').value=Math.round((time-START)*10000)/10;
  $('scrub').setAttribute('aria-valuetext',(time*1000).toFixed(1)+' milliseconds from saved input onset');
  $('trial-description').textContent='Saved trial '+(+$('trial').value+1)+' of 30';
  $('neural-time').textContent=time<0?'Before input':time<=1?'Saved neural activity · 0–1 s':'Assumed relaxation · no further spikes';
  $('result').textContent='Full replay outcome: '+paths.map((p,i)=>{const final=p.food.frames.at(-1);return name(selected[i])+': '+(final.contactTime>0?Math.round(final.contactTime*1000)+' ms geometric contact; '+(100*final.remainingVolume).toFixed(1)+'% illustrative volume remains.':'no geometric contact; the droplet stays full.');}).join(' ');
  for(let i=0;i<2;i++){$('condition-'+i).hidden=i>=selected.length;$('condition-'+i).textContent=i<selected.length?name(selected[i])+' · '+phase(q.poses[i],i):'';$('volume-'+i).hidden=i>=selected.length;
   if(i<selected.length){const p=q.poses[i];$('volume-'+i).textContent=(100*p.food.remainingVolume).toFixed(1)+'% volume · '+(p.food.contact?'mesh contact':'no contact');
    const body=bodies[i];body.rig.pose(p.motor.angles);body.sphere.position.set(...p.food.center);body.sphere.scale.setScalar(p.food.radiusMm);body.pipette.position.set(p.food.center[0]+.36,p.food.center[1],p.food.center[2]);}}
  $('contact-timing').textContent=paths.map((p,i)=>{const s=p.food.sample(Math.max(0,time));return name(selected[i])+': '+Math.round(s.recordedContactTime*1000)+' ms in saved interval, '+Math.round(s.tailContactTime*1000)+' ms in assumed tail.';}).join(' ');
  updateSensoryCues(q);
  const group=$('motor-event-group').value,eventTimes=motorEventTimes[group];
  $('previous-motor-event').disabled=FlyMotorNavigation.adjacent(eventTimes,time,-1)===null;
  $('next-motor-event').disabled=FlyMotorNavigation.adjacent(eventTimes,time,1)===null;
  $('motor-step-note').textContent=eventTimes.length+' distinct '+(group==='all'?'MN9/MN6':group)+' spike times across '+selected.length+' displayed run'+(selected.length>1?'s':'')+'. Stepping pauses playback.';
  drawSignals();
 }
 function updateSensoryCues(q){
  const active=time>=0&&time<1,stimulus=selected[0].stimulus==='sugar'?'Sugar':'Water';
  $('input-label').textContent=stimulus+' sensory drive';$('input-cue').dataset.active=String(active);
  $('input-status').textContent=time<0?'Not yet applied':active?selected[0].input_hz+' Hz prescribed input · on':'Input ended · no further events';
  for(let i=0;i<2;i++){
   $('motor-cue-'+i).hidden=i>=selected.length;
   if(i>=selected.length)continue;
   const c=FlySensoryCues.sample(selected[i],paths[i].trial,time,q.poses[i].food.contact),body=bodies[i];
   $('motor-label-'+i).textContent=compare?(i?'B · disconnected':'A · intact'):name(selected[i]);
   for(const kind of ['mn9','mn6']){const el=$(kind+'-cue-'+i);el.dataset.active=String(c[kind+'Recent']>0);el.textContent=kind.toUpperCase()+' · '+c[kind+'Count'];el.title='Saved cumulative spikes; bright for 40 ms after each event';}
   for(const id of ['touch-cue-','drop-contact-']){const el=$(id+i);el.dataset.contact=String(c.contact);el.textContent=c.contact?'Mesh contact':'No mesh contact';}
   $('drop-contact-'+i).dataset.stimulus=selected[i].stimulus;
   body.sphere.material.color.set(selected[i].stimulus==='sugar'?0xe7a331:0x7bb7d1);
   body.sphere.material.emissive.set(c.contact?0x27877b:0x000000);body.sphere.material.emissiveIntensity=c.contact?.16:0;
  }
 }
 function bounds(names,includeTransport=true){const box=new THREE.Box3();
  for(const mid of [0,.25,.5,.75,1])for(const left of [0,.5,1])for(const right of [0,.5,1]){const angles=Object.fromEntries(Object.entries(P.angle_amplitudes_radian).map(([n,v])=>[n,v*(n==='labrum_left'?left:n==='labrum_right'?right:mid)])),f=NativeFlyBodyRig.forward(A.rig,angles);
   for(const name of names){const mesh=bodies[0].rig.geoms[name],g=mesh.geometry;if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox;
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])box.expandByPoint(new THREE.Vector3(...NativeFlyBodyRig.point(f.geoms[name],[x,y,z])));}}
  for(const c of (includeTransport?[engine.target,engine.center(START),engine.center(END)]:[engine.target]))for(const d of [-1,1])box.expandByPoint(new THREE.Vector3(c[0]+d*P.food.radius_mm,c[1]+d*P.food.radius_mm,c[2]+d*P.food.radius_mm));return box;
 }
 function createBody(){const group=new THREE.Group(),rig=bodyPool.create();group.add(rig.root);scene.add(group);
   const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,40,28),new THREE.MeshPhysicalMaterial({color:0xe7a331,roughness:.12,metalness:0,clearcoat:1,clearcoatRoughness:.06,ior:1.333,transparent:true,opacity:.91}));group.add(sphere);
   // Surface reflections only: collision and volume still use the unchanged mathematical sphere.
   const sheen=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:0xfffbec,transparent:true,opacity:.68,depthWrite:false}));sheen.position.set(-.28,.88,.32);sheen.scale.set(.19,.045,.09);sphere.add(sheen);
   const glint=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,depthWrite:false}));glint.position.set(.2,.96,.13);glint.scale.set(.04,.025,.04);sphere.add(glint);
   const pipette=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.65,20),new THREE.MeshPhysicalMaterial({color:0xc2d4df,roughness:.18,clearcoat:.8,transparent:true,opacity:.68}));pipette.rotation.z=Math.PI/2;group.add(pipette);return {group,rig,sphere,pipette};}
 function ensureBodies(count){
  while(bodies.length<count)bodies.push(createBody());
  while(bodies.length>count){const body=bodies.pop();body.rig.dispose();scene.remove(body.group);
   for(const mesh of [body.sphere,body.pipette])mesh.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});body.group.clear();}
 }

 function init(){if(!window.THREE)throw Error('The local Three.js vendor file is missing.');scene=new THREE.Scene();scene.background=new THREE.Color('#edf0f3');camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,40);camera.up.set(0,0,1);
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;$('scene').prepend(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff,0x77716a,2));const key=new THREE.DirectionalLight(0xffffff,2.8);key.position.set(1,4,6);scene.add(key);const rim=new THREE.DirectionalLight(0xd6e7f4,1.5);rim.position.set(-3,-4,2);scene.add(rim);
  bodyPool=SharedPackedFlyBodyRig.createPool(THREE,A);ensureBodies(1);
  engine=NativeGeometricContact.create(NativeFlyBodyRig,A.rig,bodies[0].rig.geometries,P);
  wholeBox=bounds(Object.keys(bodies[0].rig.geoms));mouthBox=bounds(['head','head_red','head_black','rostrum','haustellum','labrum_left_lower','labrum_right_lower'],false);
  new ResizeObserver(()=>{renderer.setSize($('scene').clientWidth,$('scene').clientHeight,false);dirty=true;drawSignals();}).observe($('scene'));
  let drag=null;$('scene').addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,yaw,pitch};$('scene').setPointerCapture(e.pointerId);});$('scene').addEventListener('pointermove',e=>{if(drag){yaw=Math.max(-.5,Math.min(.5,drag.yaw-(e.clientX-drag.x)*.003));pitch=Math.max(-.15,Math.min(.25,drag.pitch+(e.clientY-drag.y)*.003));dirty=true;}});for(const e of ['pointerup','pointercancel'])$('scene').addEventListener(e,()=>drag=null);
  $('scene').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')yaw=pitch=0;else if(e.key==='ArrowLeft')yaw=Math.max(-.5,yaw-.05);else if(e.key==='ArrowRight')yaw=Math.min(.5,yaw+.05);else if(e.key==='ArrowUp')pitch=Math.min(.25,pitch+.05);else pitch=Math.max(-.15,pitch-.05);dirty=true;});
 }
 function drawSignals(){if(!paths.length)return;const el=$('raster'),width=el.clientWidth;if(!width)return;const h=compare?244:148,dpr=Math.min(devicePixelRatio||1,2);const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(h*dpr);if(el.width!==pixelWidth||el.height!==pixelHeight){el.width=pixelWidth;el.height=pixelHeight;}el.style.height=h+'px';const c=el.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,h);
  const left=width<480?86:130,right=16,X=t=>left+(t-START)/(END-START)*(width-left-right);c.font='11px Segoe UI';c.fillStyle='#e6edf4';c.fillRect(X(0),3,X(1)-X(0),h-27);
  for(const t of [0,.5,1,1.5,2]){c.strokeStyle='#d6dde3';c.beginPath();c.moveTo(X(t),3);c.lineTo(X(t),h-26);c.stroke();c.fillStyle='#63717e';c.textAlign='center';c.fillText(t.toFixed(1)+' s',X(t),h-7);}
  for(let j=0;j<paths.length;j++)for(let k=0;k<labels.length;k++){const label=labels[k],y=17+(j*4+k)*25;c.textAlign='right';c.fillStyle=label.startsWith('MN9')?colors[j]:'#95652a';c.fillText((compare?(j?'B · ':'A · '):'')+label.replace('_l',' left').replace('_r',' right'),left-10,y+4);for(const s of paths[j].trial.channels[label].spikes){c.globalAlpha=FlyEventTime.atOrBefore(s,time)?1:.28;c.fillRect(X(s),y-7,1.4,14);}c.globalAlpha=1;}
  c.strokeStyle='#283642';c.beginPath();c.moveTo(X(time),2);c.lineTo(X(time),h-25);c.stroke();
 }
 function view(rect,box,detail){const center=box.getCenter(new THREE.Vector3()),a=detail?0:yaw,b=detail?-.07:.13+pitch;
  camera.position.copy(center).add(new THREE.Vector3(8*Math.sin(a),8*Math.cos(a),8*b));camera.lookAt(center);camera.updateMatrixWorld();
  let x=0,y=0;for(const vx of [box.min.x,box.max.x])for(const vy of [box.min.y,box.max.y])for(const vz of [box.min.z,box.max.z]){const v=new THREE.Vector3(vx,vy,vz).applyMatrix4(camera.matrixWorldInverse);x=Math.max(x,Math.abs(v.x));y=Math.max(y,Math.abs(v.y));}
  const aspect=rect.w/rect.h,half=1.08*Math.max(x,y*aspect);camera.left=-half;camera.right=half;camera.top=half/aspect;camera.bottom=-camera.top;camera.updateProjectionMatrix();
  renderer.setViewport(rect.x,rect.y,rect.w,rect.h);renderer.setScissor(rect.x,rect.y,rect.w,rect.h);renderer.setClearColor(detail?0xf9fafb:0xedf0f3,1);renderer.clear();renderer.render(scene,camera);
 }
 function updateDropletCallout(i,rect){
  const leader=$('drop-leader-'+i),label=$('drop-label-'+i),body=bodies[i];
  const projected=body.sphere.getWorldPosition(new THREE.Vector3()).project(camera);
  const q=$('show-droplet-labels').checked?FlyDropletCallout.layout(projected,rect.w,rect.h):null;
  leader.hidden=label.hidden=!q;if(!q)return;
  const contact=paths[i].food.sample(time).contact,stimulus=selected[i].stimulus;
  leader.dataset.contact=label.dataset.contact=String(contact);leader.dataset.stimulus=label.dataset.stimulus=stimulus;
  leader.setAttribute('viewBox','0 0 '+rect.w+' '+rect.h);
  $('drop-line-'+i).setAttribute('d','M '+q.anchor.x+' '+q.anchor.y+' L '+q.point.x+' '+q.point.y);
  $('drop-point-'+i).setAttribute('cx',q.point.x);$('drop-point-'+i).setAttribute('cy',q.point.y);
  Object.assign(label.style,{left:q.label.x+'px',top:q.label.y+'px',width:q.label.width+'px',height:q.label.height+'px'});
  label.textContent=(stimulus==='sugar'?'Sugar solution':'Water')+(contact?' · contact':'');
 }
 function render(){if(!renderer||!dirty)return;dirty=false;const w=$('scene').clientWidth,h=$('scene').clientHeight,stack=compare&&w<900,n=compare?2:1,cw=stack?w:w/n,ch=stack?h/n:h;
  $('scene').dataset.stacked=String(stack);renderer.setScissorTest(false);renderer.setClearColor(0xedf0f3,1);renderer.clear();renderer.setScissorTest(true);
  for(let i=0;i<n;i++){const x=stack?0:i*cw,y=stack?(n-1-i)*ch:0,vertical=compare||cw<700;const whole=vertical?{x:x+8,y:y+ch*.52,w:cw-16,h:ch*.40}:{x:x+8,y:y+28,w:cw*.46-16,h:ch-90};const mouth=vertical?{x:x+12,y:y+24,w:cw-24,h:ch*.43}:{x:x+cw*.46,y:y+28,w:cw*.54-12,h:ch-90};
   bodies.forEach((b,j)=>b.group.visible=j===i);view(whole,wholeBox,false);view(mouth,mouthBox,true);
   for(const [kind,r] of [['whole',whole],['mouth',mouth]]){const el=$(kind+'-'+i);el.hidden=false;Object.assign(el.style,{left:r.x+'px',top:(h-r.y-r.h)+'px',width:r.w+'px',height:r.h+'px'});}
   updateDropletCallout(i,mouth);}
  for(let i=n;i<2;i++)for(const kind of ['whole','mouth'])$(kind+'-'+i).hidden=true;renderer.setScissorTest(false);
 }
 $('play').onclick=()=>{playing=!playing;if(playing&&time>=END)time=START;last=null;update();};$('reset').onclick=reset;
 $('scrub').oninput=()=>{playing=false;time=START+ +$('scrub').value/1000;update();};
 $('stimulus').onchange=()=>{fillCases();choose();reset();};for(const id of ['trial','circuit','comparison','block-mn9','block-mn6'])$(id).onchange=()=>{choose();reset();};
 $('watch-mode').onclick=()=>{compare=false;choose();reset();};$('compare-mode').onclick=()=>{compare=true;choose();reset();};$('body-view').onclick=()=>{yaw=pitch=0;dirty=true;};
 $('show-droplet-labels').onchange=()=>{dirty=true;};
 function stepMotorEvent(direction){const target=FlyMotorNavigation.adjacent(motorEventTimes[$('motor-event-group').value],time,direction);playing=false;last=null;if(target!==null)time=target;update();}
 $('previous-motor-event').onclick=()=>stepMotorEvent(-1);$('next-motor-event').onclick=()=>stepMotorEvent(1);$('motor-event-group').onchange=update;
 function frame(stamp){const dt=last===null?0:Math.min(.1,(stamp-last)/1000);last=stamp;if(playing){time=Math.min(END,time+dt*+$('speed').value);if(time>=END){if($('repeat').checked){$('trial').value=String((+$('trial').value+1)%30);choose();time=START;}else playing=false;}update();}render();requestAnimationFrame(frame);}
 try{$('trial').replaceChildren(...Array.from({length:30},(_,i)=>new Option('Trial '+(i+1)+' of 30',String(i))));fillCases();init();choose();update();new ResizeObserver(drawSignals).observe($('raster'));requestAnimationFrame(frame);}
 catch(e){playing=false;
  // A failed initialization must not keep its partial scene and shared buffers.
  // Preserve the original error even if a cleanup operation itself fails.
  for(const release of [()=>ensureBodies(0),()=>bodyPool&&bodyPool.dispose(),()=>renderer&&renderer.dispose()]){
   try{release();}catch(cleanupError){console.error('Fly replay cleanup failed',cleanupError);}
  }
  $('scene-error').hidden=false;$('scene-error').textContent='Replay unavailable: '+e.message;throw e;}
 window.FLY_DEMO={getState:state,setTime(t){time=Math.max(START,Math.min(END,t));playing=false;update();},getAnatomy(){return bodies;},getCamera(){return camera;}};
})();
