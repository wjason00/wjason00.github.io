/* Display-only cues. Prescribed drive is not a sensory spike or detected contact. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./event-time.js'):root.FlyEventTime);if(typeof module==='object'&&module.exports)module.exports=api;else root.FlySensoryCues=api;})(typeof globalThis!=='undefined'?globalThis:this,function(T){
 'use strict';
 function sample(c,trial,time,contact){
  const events=prefix=>Object.entries(trial.channels).filter(([k])=>k.startsWith(prefix)).flatMap(([,v])=>v.spikes);
  const recent=spikes=>spikes.filter(t=>T.atOrBefore(t,time)&&!T.atOrBefore(t,time-.04)&&time>=0&&time<1.04).length;
  const count=spikes=>spikes.filter(t=>T.atOrBefore(t,time)).length;
  const mn9=events('MN9'),mn6=events('MN6');
  return {inputActive:time>=0&&time<1,inputHz:c.input_hz,stimulus:c.stimulus,contact:!!contact,
   mn9Recent:recent(mn9),mn6Recent:recent(mn6),mn9Count:count(mn9),mn6Count:count(mn6)};
 }
 return {sample};
});
