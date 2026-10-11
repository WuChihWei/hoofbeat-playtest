import {PRESENTATION as P} from './presentation-config.mjs?v=r471';
export function chaseComposition(aspect,laneWorld=0){
 const c=P.camera,tangent=c.horizontalTangent/Math.max(.38,Math.min(.85,aspect));
 const fov=2*Math.atan(tangent)*180/Math.PI,pitch=Math.atan((1-2*c.horizon)*tangent);
 const y=c.headWorldY+c.distance*Math.tan(pitch+Math.atan((2*c.headAnchorY-1)*tangent));
 return {fov,x:laneWorld*c.laneFollow,y,z:-5.5+c.distance,targetY:y-Math.tan(pitch)*c.lookDistance,targetZ:-5.5+c.distance-c.lookDistance,horizon:c.horizon};
}
// Opponent positions reflect independently accumulated race distance, in their real lanes (slice-game lanes).
export function compositionRivals(race,metrics){
 if(!race.slice)return metrics.rivals;
 return metrics.rivals.map(r=>({...r,visualGap:r.distance-metrics.player.distance,visualLane:r.lane*race.config.laneSpacing}));
}
export function compositionRank(race,metrics){return race.slice?metrics.rank:1+metrics.rivals.filter(r=>r.distance>metrics.player.distance).length;}
