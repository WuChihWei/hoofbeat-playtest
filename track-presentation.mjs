import {PRESENTATION as P} from './presentation-config.mjs?v=r362';
// Straight, parallel road edges: they converge on the horizon like the reference (no far-end widening).
export function roadHalfWidth(){return P.track.width*.5;}
export function fencePose(z,side){return {x:side*P.track.fenceX,angle:Math.PI/2};}
