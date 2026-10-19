/* Account only for floating representation error; never round events to UI bins. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FlyEventTime=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function sameTime(a,b){return Math.abs(a-b)<=4*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b));}
 function atOrBefore(event,cursor){return event<=cursor||sameTime(event,cursor);}
 return {sameTime,atOrBefore};
});
