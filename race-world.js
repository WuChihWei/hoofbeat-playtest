import {clamp, LEG_SECONDS} from './game.js?v=r369';

export const ROAD_WIDTH = 13.2;
export const HORSE_Z = -6.4;   // where the runners are on the road (m from the origin): 0.9 further up the road than the -5.5 the camera was framed on, so the player's horse sits about 40 px higher on a phone while the track and backdrop stay put
export const HIT_Z = 1.15;
export const NOTE_LOOKAHEAD = 2.8;
export const NOTE_TRAVEL = 20;
export const RHYTHM_OFFSET = ROAD_WIDTH / 2 - .45;
export const RUNNER_LANES = {player:0,pacer:-2.2,chaser:2.2};
export const raceCameraFov=aspect=>2*Math.atan(Math.tan(58*Math.PI/360)*Math.max(1,.64/aspect))*180/Math.PI;
// Root at 72% leaves room for the trailing hooves/tail above the thumb controls.
export function raceCameraFrame(fov){
  const tangent=Math.tan(fov*Math.PI/360),tilt=Math.atan(tangent*.64),y=9;
  // Keep framing fixed when moving runners forward for cue clearance.
  const z=-3+y/Math.tan(tilt+Math.atan(tangent*.44));
  return {y,z,targetZ:z-(y-.8)/(tangent*.64),targetY:.8};
}
const smooth = t => t * t * (3 - 2 * t);

// All road furniture, runners and beats use this same centreline and normal.
export function roadPose(z, turn, offset = 0) {
  const s = Math.max(0, -z), denominator = 1 + s / 100;
  const x = -turn * .009 * s * s / denominator;
  const slope = turn * .009 * (2 * s + s * s / 100) / (denominator * denominator);
  const heading = Math.atan(slope);
  return {x: x + offset * Math.cos(heading), z: z - offset * Math.sin(heading), heading};
}

export function beatPose(remaining, lane, turn) {
  // Late-window notes stay on the marker instead of flying into the camera.
  return roadPose(HIT_Z - Math.max(0, remaining) * NOTE_TRAVEL, turn, (lane ? 1 : -1) * RHYTHM_OFFSET);
}

export function hurdlePose(remaining,turn,lane=0){return roadPose(HORSE_Z-remaining*12,turn,lane)}

// Compress the true gap for readable racing, without changing simulation results.
export const rivalOffset=lead=>2.6*Math.tanh(lead/9);

// The HUD previews the exact centreline ahead, not an independently timed oval.
export function roadPreview(turn,leads=[0,0],playerLane=0){
  const project=p=>({x:64+p.x*1.55,y:55+p.z*.8});
  const points=Array.from({length:25},(_,i)=>project(roadPose(8-i*66/24,turn)));
  return {path:points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' '),
    runner:project(roadPose(HORSE_Z,turn,playerLane*2.2)),
    pacer:project(roadPose(HORSE_Z+rivalOffset(leads[0]),turn,RUNNER_LANES.pacer)),
    chaser:project(roadPose(HORSE_Z+rivalOffset(leads[1]),turn,RUNNER_LANES.chaser)),points};
}

export function relayActors(team, time, lane) {
  const t = Math.max(0, time), leg = clamp(Math.floor(t / LEG_SECONDS), 0, 2);
  const local = t - leg * LEG_SECONDS;
  const actors = [{id:team[leg],leg,active:true,lane,z:HORSE_Z,opacity:1,running:true}];
  if(leg<2&&local>=LEG_SECONDS-5){
    const approach=smooth(clamp((local-(LEG_SECONDS-.06))/.06,0,1));
    const bay=lane<0?-6.5:lane>0?8.5:5.8;
    actors.push({id:team[leg+1],leg:leg+1,active:false,waiting:true,
      lane:bay+(lane-bay)*approach,z:HORSE_Z+(local-LEG_SECONDS)*12*(1-approach),opacity:1,running:approach>0});
  }
  return actors;
}
