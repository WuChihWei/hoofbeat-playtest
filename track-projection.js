import {lapSections,LEG_SECONDS,clamp} from './game.js?v=r266';
const smooth=t=>t*t*(3-2*t);
export function turnAt(city,time){
  const leg=clamp(Math.floor(Math.max(0,time)/LEG_SECONDS),0,2),local=Math.max(0,time)-leg*LEG_SECONDS;
  const sign=city===1?-1:1;
  const bend=lapSections(city,leg).find(section=>section[2]==='curve');
  return sign*smooth(clamp((local-bend[0])/1.5,0,1))*(1-smooth(clamp((local-(bend[1]-1.5))/1.5,0,1)));
}
export function trackPoint(width,height,depth,turn){
  const d=clamp(depth,0,1);
  return {x:width*(.5+.43*turn*Math.pow(1-d,2.25)),y:height*(.16+.84*d),half:width*(.075+.48*d)};
}

export const HIT_DEPTH=(.87-.16)/.84;
export const RHYTHM_LANE=.56;

// Road-relative coordinates shared by notes, receptors and every relay runner.
export function trackPose(width,height,depth,turn,lane=0){
  const p=trackPoint(width,height,depth,turn),d=clamp(depth,0,1);
  const dx=-width*.43*turn*2.25*Math.pow(1-d,1.25);
  return {...p,x:p.x+lane*p.half,y:height*(.16+.84*depth),heading:Math.atan2(-dx,height*.84)};
}

export function rhythmPose(width,height,progress,turn,lane){
  return trackPose(width,height,progress*HIT_DEPTH,turn,(lane?1:-1)*RHYTHM_LANE);
}
