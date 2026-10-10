import {PRESENTATION as P} from './presentation-config.mjs?v=r412';
// Screen-space presentation only. Does not read or mutate note state or game time.
export const PRESENTATION_LOOKAHEAD=P.rhythm.lookahead;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function playerRhythmPath({remaining,lookahead=PRESENTATION_LOOKAHEAD,start,beside,knots,target,width,height,obstacles=[],lane=0,lateWindow=.22}){
 const progress=1-clamp(remaining/lookahead,0,1);
 // Keep the note circular, including at the judgement target. Its final
 // diameter follows the actual DOM control rather than an assumed viewport.
 const farSize=width*P.rhythm.diameter[0];
 const size=farSize+(target.size*1.05-farSize)*progress;
 // Notes lie flat on the track (reference ellipses) and round up as they dock on the circular control.
 const road=P.rhythm.squash[0]+(P.rhythm.squash[1]-P.rhythm.squash[0])*progress;
 const squash=remaining<=0?1:road+(1-road)*(1-clamp(remaining/.35,0,1));
 // Past the judgement point an unhit note is not held on the pad: it keeps going the way it came, straight on along
 // the ribbon's last stretch at the speed it arrived with (and off the screen).
 if(remaining<=0){
  if(!remaining)return {x:target.x,y:target.y,size,squash};
  const e=.05,q=knots||start?playerRhythmPath({remaining:e,lookahead,start,beside,knots,target,width,height}):{x:target.x,y:target.y-target.size*.16};
  return {x:target.x+(target.x-q.x)*-remaining/e,y:target.y+(target.y-q.y)*-remaining/e,size,squash};
 }
 // Catmull-Rom interpolation through measured screen points. The last point
 // always docks at the actual DOM control, regardless of lane-follow offset.
 const pts=knots?[...knots.slice(0,3),target]:[start,{x:start.x,y:(start.y+beside.y)/2},beside,target];
 const u=progress*3,i=Math.min(2,Math.floor(u)),t=u-i;
 const a=pts[Math.max(0,i-1)],b=pts[i],c=pts[i+1],d=pts[Math.min(3,i+2)];
 const interpolate=axis=>.5*((2*b[axis])+(-a[axis]+c[axis])*t+(2*a[axis]-5*b[axis]+4*c[axis]-d[axis])*t*t+(-a[axis]+3*b[axis]-3*c[axis]+d[axis])*t*t*t);
 const x=interpolate('x'),y=interpolate('y');
 // The original spline visually overlapped the hoof long before the timing
 // window opened. Keep the last approach readable and dock at exactly t=0.
 const approach=clamp(remaining/.8,0,1);
 const finalApproachOffset=remaining<.8?target.size*1.45*remaining*(1-approach):0;

 return {x:clamp(x,size/2+4,width-size/2-4),y:y-finalApproachOffset,size,squash};
}
