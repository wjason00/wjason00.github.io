/* Navigate existing saved spikes; this module never constructs neural events. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./event-time.js'):root.FlyEventTime);if(typeof module==='object'&&module.exports)module.exports=api;else root.FlyMotorNavigation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(T){
 'use strict';
 function events(trials,group){
  if(!['all','MN9','MN6'].includes(group))throw Error('Unknown motor group');
  const times=[];
  for(const trial of trials)for(const [name,channel] of Object.entries(trial.channels)){
   if(!name.startsWith('MN9')&&!name.startsWith('MN6'))continue;
   if(group!=='all'&&!name.startsWith(group))continue;
   for(const time of channel.spikes){if(!Number.isFinite(time)||time<0||time>1)throw Error('Invalid saved motor event');times.push(time);}
  }
  return [...new Set(times)].sort((a,b)=>a-b);
 }
 function adjacent(times,time,direction){
  let low=0,high=times.length;
  while(low<high){const mid=(low+high)>>>1;if(T.atOrBefore(times[mid],time))low=mid+1;else high=mid;}
  if(direction>0)return times[low]??null;
  let i=low-1;if(T.sameTime(times[i],time))i--;return times[i]??null;
 }
 return {events,adjacent};
});
