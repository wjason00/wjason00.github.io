import { selectPair, countThrough } from './model.js';
const data = window.FEEDING_DATA, $ = id => document.getElementById(id);
let cut = true, time = 1, playing = false, frame = 0, last = 0;
const ns='http://www.w3.org/2000/svg', colors={intact:'#156b9a',cut:'#984176'};
const mobile=window.matchMedia('(max-width:620px)');
let layout;
const x=t=>layout.left+t*(layout.right-layout.left), y=n=>layout.bottom-n/100*(layout.bottom-layout.top);
function element(tag,attrs,text){const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
function axes(){
 layout=mobile.matches?{width:350,height:280,left:41,right:328,top:38,bottom:220,ticks:245,label:272}:{width:920,height:320,left:68,right:850,top:45,bottom:256,ticks:280,label:310};
 $('chart').setAttribute('viewBox',`0 0 ${layout.width} ${layout.height}`);
 $('grid').replaceChildren();
 for(let n=0;n<=100;n+=25)$('grid').append(element('line',{x1:layout.left,x2:layout.right,y1:y(n),y2:y(n),class:'grid-line'}),element('text',{x:layout.left-10,y:y(n)+5,'text-anchor':'end',class:'tick'},n));
 for(let ms=0;ms<=1000;ms+=250)$('grid').append(element('text',{x:x(ms/1000),y:layout.ticks,'text-anchor':'middle',class:'tick'},ms));
 $('chart-label').setAttribute('x',layout.left);
 $('time-axis-label').setAttribute('x',(layout.left+layout.right)/2);$('time-axis-label').setAttribute('y',layout.label);
 $('cursor').setAttribute('y1',layout.top);$('cursor').setAttribute('y2',layout.bottom);
}
function render(){
 const pair=selectPair(data.trials,$('gain').value,$('seed').value), selected=cut?'cut':'intact';
 $('kept').setAttribute('aria-pressed',String(!cut));$('cut').setAttribute('aria-pressed',String(cut));
 $('output-edge').classList.toggle('is-cut',cut);$('output-edge').style.stroke=cut?colors.cut:colors.intact;
 $('cut-mark').style.display=cut?'':'none';$('figure').querySelector('.motor').style.stroke=colors[selected];
 $('mobile-output-edge').classList.toggle('is-cut',cut);$('mobile-output-edge').style.stroke=colors[selected];
 $('mobile-cut-mark').style.display=cut?'':'none';$('mobile-circuit').querySelector('.motor').style.stroke=colors[selected];
 const description=`Circuit schematic: Roundup outgoing connections ${cut?'cut':'kept'}, incoming connections retained. Paired cumulative MN9 spikes at gain ${$('gain').value}, seed ${$('seed').value}; positions are illustrative.`;
 for(const id of ['figure-description','mobile-description'])if($(id).textContent!==description)$(id).textContent=description;
 $('curves').replaceChildren();$('dots').replaceChildren();
 for(const condition of ['intact','cut']){
  let path=`M${x(0)} ${y(0)}`,count=0;
  for(const spike of pair[condition].spikes){if(spike>time+1e-12)break;path+=`H${x(spike)}V${y(++count)}`;}
  path+=`H${x(time)}`;
  $('curves').append(element('path',{d:path,stroke:colors[condition],class:`curve${condition===selected?'':' reference'}`}));
  $('dots').append(element('circle',{cx:x(time),cy:y(countThrough(pair[condition].spikes,time)),r:4,fill:colors[condition]}));
 }
 $('cursor').setAttribute('x1',x(time));$('cursor').setAttribute('x2',x(time));
 $('time').value=Math.round(time*1000);$('time-label').value=`${Math.round(time*1000)} ms`;
 const a=countThrough(pair.intact.spikes,time),b=countThrough(pair.cut.spikes,time);
 $('result').setAttribute('aria-live',playing?'off':'polite');
 $('result').textContent=`${cut?'Cut':'Kept'} selected · ${cut?b:a} MN9 spikes at ${Math.round(time*1000)} ms. Full saved trial: ${pair.intact.count} kept, ${pair.cut.count} cut (${pair.intact.count-pair.cut.count} fewer after the cut).`;
 $('play').textContent=playing?'Pause':time>=1?'Replay':'Play';
}
function pause(){playing=false;cancelAnimationFrame(frame);render();}
function tick(now){if(!playing)return;time=Math.min(1,time+(now-last)/5000);last=now;if(time>=1)playing=false;render();if(playing)frame=requestAnimationFrame(tick);}
$('play').addEventListener('click',()=>{if(playing){pause();return;}if(time>=1)time=0;playing=true;last=performance.now();render();frame=requestAnimationFrame(tick);});
$('time').addEventListener('input',()=>{playing=false;cancelAnimationFrame(frame);time=Number($('time').value)/1000;render();});
for(const id of ['gain','seed'])$(id).addEventListener('change',()=>{pause();time=1;render();});
$('kept').addEventListener('click',()=>{cut=false;render();});$('cut').addEventListener('click',()=>{cut=true;render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause();});
mobile.addEventListener('change',()=>{axes();render();});
axes();
render();
