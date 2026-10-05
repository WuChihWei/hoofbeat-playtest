// node dist/course/check.mjs — fails loudly if a course breaks the track rules or the layer boundaries.
import assert from 'node:assert/strict';
import {LANES,PIECES,buildTrack} from './track.mjs';
import {existsSync} from 'node:fs';
import {ASSETS,missingAssets,modelFor} from './assets.mjs';
import {THEMES} from './themes.mjs';
import {COURSES,buildCourse,RELAY_ZONE} from './courses.mjs';

// Geometry: a 360° loop of 45° bends closes on itself, and poses are continuous across every piece joint.
const loop=buildTrack(Array(8).fill('Curve_L45'));
assert(Math.hypot(loop.end.x,loop.end.z)<1e-6&&Math.abs(loop.end.heading-2*Math.PI)<1e-9,'8×45° must close');
for(const c of COURSES){
  const course=buildCourse(c.id),t=course.track;
  for(const p of t.pieces.slice(1)){
    const a=t.pose(p.s0-1e-6),b=t.pose(p.s0+1e-6);
    assert(Math.hypot(a.x-b.x,a.z-b.z)<1e-4&&Math.abs(a.heading-b.heading)<1e-6,`${c.id}: gap at ${p.name}`);
  }
  assert(course.lapLength>=500&&course.lapLength<=800,`${c.id}: lap ${course.lapLength} m outside 500–800`);
  const lap=buildTrack(c.lap),first=lap.pieces[0];
  // Closed circuit: the lap ends where it started, heading one full turn round.
  assert(Math.hypot(lap.end.x,lap.end.z)<1e-6&&Math.abs(Math.abs(lap.end.heading)-2*Math.PI)<1e-9,`${c.id}: lap does not close (end ${lap.end.x.toFixed(2)}, ${lap.end.z.toFixed(2)})`);
  assert(first.straight&&first.length>=20,`${c.id}: Start/Finish needs a ≥20 m straight at s=0`);
  const rz=c.gameplay.relay,rp=lap.pieceAt(rz);
  assert(rp.straight&&rz+RELAY_ZONE<=rp.s0+rp.length+1e-6,`${c.id}: Relay Zone ${rz.toFixed(0)}–${(rz+RELAY_ZONE).toFixed(0)} m must lie on one straight`);
  const inRelay=s=>s>rz-10&&s<rz+RELAY_ZONE+10;
  // No self-crossing: parts of the loop more than 60 m apart along the track stay a road-width+ apart.
  const pts=[];for(let s=0;s<lap.length;s+=4)pts.push([s,lap.pose(s)]);
  for(const [s1,p] of pts)for(const [s2,q] of pts){const d=Math.abs(s1-s2),along=Math.min(d,lap.length-d);
    if(along>60)assert(Math.hypot(p.x-q.x,p.z-q.z)>26,`${c.id}: track passes within 26 m of itself at ${s1.toFixed(0)} / ${s2.toFixed(0)} m`);}
  for(const j of c.gameplay.jumps){
    const [before,after]=lap.straightRun(j.s);
    assert(before>=15&&after>=10,`${c.id}: jump at ${j.s.toFixed(1)} needs a straight (15 m run-up, 10 m landing), got ${before.toFixed(1)}/${after.toFixed(1)}`);
    assert(!inRelay(j.s),`${c.id}: jump at ${j.s.toFixed(0)} too close to the relay zone`);
  }
  for(const coin of c.gameplay.coins){
    assert(LANES.index.includes(coin.lane),`${c.id}: coin lane ${coin.lane}`);
    assert(coin.s>0&&coin.s<lap.length&&!(coin.s>=rz&&coin.s<=rz+RELAY_ZONE),`${c.id}: coin at ${coin.s.toFixed(0)} outside the lap or in the relay zone`);
    assert(c.gameplay.jumps.every(j=>Math.abs(j.s-coin.s)>8),`${c.id}: coin at ${coin.s} sits on a jump`);
  }
  assert(course.relays.length===3&&course.relays.at(-1).final&&Math.abs(course.relays.at(-1).s-t.length)<1e-6,`${c.id}: 3 legs (2 handoffs + finish)`);
  // Layer boundaries: the look never mentions gameplay; gameplay never names assets; every dressed asset renders.
  const theme=THEMES[c.theme];assert(theme,`${c.id}: theme ${c.theme} missing`);
  assert(!/rhythm|coin|jump|relay|tempo|chart/i.test(JSON.stringify(theme)),`${c.theme}: theme mentions gameplay`);
  const gp=JSON.stringify(c.gameplay);assert(Object.keys(ASSETS).every(id=>!gp.includes(id)),`${c.id}: gameplay names an asset`);
  for(const id of [theme.barrier.asset,theme.barrier.far??'Fence_Wood',...theme.rows.map(r=>r.asset),...theme.treeline.assets,...theme.skyline.map(c=>c[0])])
    assert(modelFor(id),`${c.theme}: ${id} has no model or stand-in`);
  for(const r of theme.rows)assert(r.every>0&&r.offset.length===2&&r.height.length===2,`${c.theme}: row ${r.asset} needs every, offset[2], height[2]`);
  assert(existsSync(new URL(`../assets/backdrops/${theme.backdrop}`,import.meta.url)),`${c.theme}: backdrop ${theme.backdrop} missing`);
  if(theme.background){const b=theme.background;   // Far layer (far-background.js)
    assert(existsSync(new URL(`../assets/panoramas/${b.panorama}`,import.meta.url)),`${c.theme}: panorama ${b.panorama} missing`);
    assert(['equirect','strip'].includes(b.projection),`${c.theme}: background.projection equirect|strip`);
    assert(b.projection==='equirect'||(b.span>0&&b.span<=360&&b.horizon>0&&b.horizon<1),`${c.theme}: strip needs span (0–360°) and horizon (0–1)`);
    assert(b.sun&&Number.isFinite(b.sun.u)&&Number.isFinite(b.sun.v),`${c.theme}: background.sun {u, v} (image coordinates; outside 0–1 = a sun that is not in the picture)`);
    for(const k of ['fogColor','ambientColor','keyLightColor'])assert(/^#[0-9a-f]{6}$/i.test(b[k]),`${c.theme}: background.${k}`);}
  for(const k of ['top','horizon'])assert(/^#[0-9a-f]{6}$/i.test(theme.weather.sky[k]),`${c.theme}: weather.sky.${k}`);
  assert(theme.weather.rain>=0&&theme.weather.rain<=1&&theme.weather.cloud>=0&&theme.weather.cloud<=1,`${c.theme}: weather cloud/rain 0–1`);
  const bends=lap.pieces.filter(p=>!p.straight).length;
  console.log(`${c.city.padEnd(10)} ${c.title.padEnd(17)} lap ${course.lapLength.toFixed(1)} m × ${c.gameplay.laps} = ${t.length.toFixed(0)} m · ${bends} bends · closed · legs ${course.relays.map((r,i)=>(r.s-(i?course.relays[i-1].s:0)).toFixed(0)).join('/')} m · ${c.gameplay.jumps.length} jumps · ${c.gameplay.coins.length} coins / lap`);
}
console.log('still to model:',missingAssets().map(a=>a.id).join(', '));
console.log('course check passed');
