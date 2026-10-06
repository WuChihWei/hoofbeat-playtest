import {STALLS,SLICE_CONFIG,SLICE_CHART,soloChart,SLICE_RIVALS,RIVAL_LEVEL,RIVAL_SKILL,RIVAL_BUDDY,AFFINITY,SOLO,buddyStats,racing,courseMarks,templateCourse,sectionAt,legMains,sliceCoins,sliceApples} from './slice-config.mjs?v=r307';
export {sectionAt};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=u=>u*u*(3-2*u);
const hash=(k,s)=>{const x=Math.sin(k*12.9898+s*78.233)*43758.5453;return x-Math.floor(x);};   // fixed per note and rider: replays alike
// The stand-in team (tests, the dev pages): the three starters at the level the template course expects.
export const DEFAULT_TEAM=[{id:1,type:'straight',coat:0},{id:0,type:'curve',coat:2},{id:2,type:'mud',coat:1}].map(h=>({...h,stats:RIVAL_BUDDY[h.type],level:RIVAL_LEVEL[3]}));
// A rival team rides its horses in the order that suits this course's legs best (the same choice the player makes).
const PERMS=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
function bestOrder({types,coats},course){
  const legs=legMains(course),fit=p=>p.reduce((s,t,k)=>s+Object.entries(legs[k].share).reduce((a,[kind,x])=>a+x*AFFINITY[types[t]][kind],0),0);
  return PERMS.reduce((a,b)=>fit(b)>fit(a)+1e-9?b:a).map(i=>({type:types[i],coat:coats[i]}));
}
// Lane value at time t from a list of {t, from, to} changes (smoothstep over laneDuration).
function laneAt(changes,t,duration){
  const c=changes.findLast(c=>c.t<=t);if(!c)return null;
  const p=clamp((t-c.t)/duration,0,1);return c.from+(c.to-c.from)*ease(p);
}
function strength(boosts,t,c){
  const b=boosts.findLast(b=>t>=b.t&&t<b.end);if(!b)return 0;
  return Math.min(ease(clamp((t-b.t)/c.boostAttack,0,1)),ease(clamp((b.end-t)/c.boostRelease,0,1)));
}
export class SliceGame {
  // team: the player's three buddies in leg order [{id, type, coat, stats, level}] (stats, level: its numbers on the
  // track, slice-config racing(); without them the config's own); config.legs: per-leg form overrides (stable).
  // course: the city's relay course (course/courses.mjs relayCourse); default: the template course.
  // rivals: slice-config fieldRivals(3 | 5); default: the five-horse field.
  constructor({config={},chart=null,coins=null,team=DEFAULT_TEAM,rivals=SLICE_RIVALS.slice(0,4),course=null}={}) {
    const c=this.config={...SLICE_CONFIG,...(config.solo?SOLO:null),...config};course??=templateCourse(c);coins??=sliceCoins(course);chart??=c.solo?soloChart(course.length):SLICE_CHART;
    this.course=course;const m=this.marks=courseMarks(course);c.length=m.length;
    // A runner's leg: the config, its buddy's own numbers, then (the player) what the stable makes of them.
    const numbers=h=>h?.stats?racing(buddyStats(h.stats,h.level)):null;
    this.legForm=k=>({...c,...numbers(team[k]),...c.legs?.[k]});
    this.time=0;this.distance=0;this.leg=0;this.form=this.legForm(0);this.speed=this.form.baseSpeed;
    this.horses=team;this.team=team.map(h=>h.id);
    // Solo run (config.solo): the combo speed model (slice-config SOLO) on the buddy's own numbers; drive: where the
    // combo has taken it, driveSpeed: where its running speed is (both fractions of its own speed).
    this.solo=c.solo?{...SOLO,speed:this.form.baseSpeed,accel:this.form.accel,top:this.form.top}:null;this.drive=0;this.driveSpeed=0;
    this.notes=chart.map(n=>({...n,state:null,leg:n.leg??0,track:'straight',weather:'cloud'}));   // leg: estimated (music colour)
    this.coins=coins.map(c=>({...c,collected:false}));this.coinCount=0;
    this.apples=(c.solo?sliceApples(course):[]).map(a=>({...a,collected:false}));this.appleCount=0;this.rushes=[];   // rushes: the apples' speed-ups {t, end}
    if(c.locks?.lane)for(const x of [...this.coins,...this.apples])x.lane=0;   // no lane changes yet: everything to pick up is straight ahead
    this.rhythmDrive=0;this.rhythmSpeed=0;this.lastRhythm=-Infinity;this.finishTime=null;this.lastRank=null;
    this.energy=c.startEnergy;this.pool=this.stamina=this.form.stamina;this.restAt=0;this.combo=0;this.bestCombo=0;this.finished=false;this.paused=false;
    this.targetLane=0;this.laneValue=0;this.laneChanges=[];this.boosts=[];this.jumps=[];this.sprints=[];this.stumbles=[];
    this.actions=[];this.impulses=[];this.hurdles=m.hurdles.map(distance=>({distance,t:distance/c.baseSpeed,state:null}));
    this.terrain=sectionAt(0,course);
    const tier=course.difficulty in RIVAL_LEVEL?course.difficulty:3;   // easier cities: lower rival buddies and riders (the template course: as ★3)
    // The start gate (2026-10-06, the user): a field of four or more starts level, side by side, one stall each (STALLS,
    // in lanes: the player has the middle one). The ones between two lanes (targetLane not whole) run their stall's
    // line, clear of their neighbours, and after breakOut m take the lane beside them once it is free near them: ahead
    // of the buddy in it if they broke faster, behind it if slower (rivalLanes; move: the narrow stallOverlap).
    const gate=rivals.length>2&&!rivals.some(r=>r.pace);
    this.rivals=rivals.map((r,i)=>{if(gate)r={...r,lane:STALLS[i],start:0};const horses=bestOrder(r,course),forms=horses.map(h=>({...c,...racing(buddyStats(RIVAL_BUDDY[h.type],RIVAL_LEVEL[tier])),...(r.pace?{baseSpeed:r.pace}:null)}));   // pace: the practice coach's own slow speed (slice-app PRACTICE_RIVALS)
      return {...r,horses,forms,form:forms[0],team:[0,1,2],leg:0,stall:r.lane%1!==0,distance:r.start??0,speed:forms[0].baseSpeed,phase:2*i,targetLane:r.lane,laneValue:r.lane,laneChanges:[],
        boosts:[],jumps:[],stumbles:[],jumped:new Set(),finishTime:null,energy:0,pool:forms[0].stamina,stamina:forms[0].stamina,restAt:0,skill:r.skill??RIVAL_SKILL[tier]+(r.edge??0),noteAt:0,
        rhythmDrive:0,rhythmSpeed:0,lastRhythm:-Infinity,drive:0,driveSpeed:0,rushes:[]};});
    // Adapter fields consumed by the existing renderer.
    this.slice=true;this.city=0;this.weather='sun';
  }
  // How far up its own range the horse is running, 0–1 (the look and the sound follow it: crouch, music, wind).
  surge(){return this.solo?clamp(this.driveSpeed/this.solo.top,0,1):clamp(this.rhythmSpeed/this.config.rhythmMax,0,1);}
  // The player's gait (the stride on screen, the HUD): 0 小跑步 · 1 大跑步 · 2 奔跑. A sprint or an apple is a gallop; a solo
  // run changes up at a third and two thirds of the surge; the relay (its rhythm drive dips at every rest in the chart)
  // canters while the rhythm holds.
  gait(){const s=this.surge();return this.rush()>0?2:this.solo?(s>=2/3?2:s>=1/3?1:0):s>.1?1:0;}
  emit(type,data={}){const event={type,time:this.time,...data};this.actions.push(event);return event;}
  laneAt(t){return laneAt(this.laneChanges,t,this.config.laneDuration)??0;}
  // Mean bend of the road 15–75 m ahead of d: the renderer curves the road with it before a bend arrives.
  terrainAt(d){return sectionAt(d,this.course).kind;}
  bendAhead(d=this.distance){let s=0;for(let k=0;k<13;k++)s+=sectionAt(d+15+k*5,this.course).bend;return s/13;}
  legStart(k){return k?this.course.relays[k-1]:0;}
  legEnd(k){return k<2?this.course.relays[k]:this.course.length;}
  // The note a press on `side` at `pressedAt` takes: the nearest open one inside the Good window → {note, perfect}, or
  // null. skip: note ids to pass over (slice-app shows a hit at the press, a chord window before it is judged here).
  noteFor(side,pressedAt,skip=null){
    const c=this.config,note=this.notes.filter(n=>!n.state&&!skip?.has(n.id)&&n.lane===side&&Math.abs(n.t-pressedAt)<=c.goodWindow+1e-9)
      .sort((a,b)=>Math.abs(a.t-pressedAt)-Math.abs(b.t-pressedAt)||a.t-b.t||a.id.localeCompare(b.id))[0];
    return note?{note,perfect:Math.abs(note.t-pressedAt)<=c.perfectWindow+1e-9}:null;
  }
  single(side,pressedAt){
    if(this.paused||this.finished)return;
    const c=this.config,f=this.form,{note,perfect}=this.noteFor(side,pressedAt)??{};
    if(note){
      note.state=perfect?'perfect':'good';note.hitAt=pressedAt;
      const gain=(perfect?c.perfectEnergy:c.goodEnergy)*(this.drafting?c.draftGain:1),had=this.segments();this.energy=Math.min(this.cap(),this.energy+gain);
      this.lastRhythm=this.time;this.rhythmDrive=Math.min(c.rhythmMax,this.rhythmDrive+(perfect?f.rhythmGain:f.goodRhythmGain));
      if(this.solo)this.drive=Math.min(this.solo.top,(1+Math.max(0,this.drive))*(1+this.solo.accel*(perfect?1:.5))-1);
      this.combo++;this.missRun=0;this.bestCombo=Math.max(this.combo,this.bestCombo);
      this.impulses.push({t:this.time,amount:perfect?c.hitImpulse:c.goodImpulse});
      const hit=this.emit('rhythm',{side,noteId:note.id,judgement:note.state,pressedAt,offset:note.t-pressedAt,energy:this.energy,gain});   // offset > 0: pressed early
      if(this.segments()>had)this.emit('charged',{segments:this.segments()});   // a segment stored: the charge button celebrates
      return hit;
    }
    const nearest=this.notes.filter(n=>n.lane===side&&n.state!=='rest').sort((a,b)=>Math.abs(a.t-pressedAt)-Math.abs(b.t-pressedAt))[0];
    return this.emit('rhythm-empty',{side,pressedAt,offset:nearest?nearest.t-pressedAt:null});
  }
  // Stamina, the same for every runner: a pool of the buddy's own size (o.pool); a sprint takes sprintStamina off as it
  // starts, and from staminaWait after the last one ended it comes back at staminaRegen / s.
  fresh(o=this){return o.stamina>=this.config.sprintStamina-1e-9;}
  spend(o,end){const c=this.config;o.stamina-=c.sprintStamina;o.restAt=end+c.staminaWait;}
  rest(o,dt){if(this.time>=o.restAt)o.stamina=Math.min(o.pool,o.stamina+this.config.staminaRegen*dt);}
  // Charge, the same for every runner: segments of boostCost, up to charges[type] of the buddy running this leg (a solo
  // run: soloCharges, whatever its type).
  cap(o=this){const c=this.config;return c.boostCost*(c.soloCharges??c.charges[o.horses[o.leg].type]);}
  segments(o=this){return Math.floor(o.energy/this.config.boostCost+1e-9);}
  missed(o){const c=this.config;o.energy=Math.max(this.segments(o)*c.boostCost,o.energy-c.missEnergy);}   // a stored segment stays
  drafts(o){const c=this.config;return this.runners().some(x=>x!==o&&Math.abs(x.laneValue-o.laneValue)<c.laneOverlap&&x.distance>o.distance&&x.distance-o.distance<c.draftReach);}
  lane(side){
    if(this.paused||this.finished||this.config.locks?.lane)return;   // locks: what the stage does not have yet (progress.mjs LEVELS)
    const next=clamp(this.targetLane+(side===0?-1:1),-1,1);
    if(next===this.targetLane)return this.emit('boundary',{side});
    if(this.occupied(this,next))return this.emit('lane-blocked',{side,to:next});   // a horse beside: no cutting into it
    const change={from:this.laneAt(this.time),to:next,t:this.time};
    this.targetLane=next;this.laneChanges.push(change);
    return this.emit('lane',{side,to:next});
  }
  // Traffic, the same for every runner. Lane `to` is taken near `self` if another runner is in it (within laneOverlap)
  // or heading into it, closer than a horse length plus what the two could close up during a lane change.
  runners(){return [this,...this.rivals];}
  occupied(self,to){
    const c=this.config;
    return this.runners().some(o=>o!==self&&(Math.abs(o.laneValue-to)<c.laneOverlap||o.targetLane===to)&&
      Math.abs(o.distance-self.distance)<c.followGap+Math.abs(o.speed-self.speed)*c.laneDuration+.5);
  }
  // Leaders move first; nobody closes inside followGap of a runner ahead in an overlapping lane: they follow at its
  // speed (a sprint or a plain jump does not pass through either). Passing takes a clear side lane, or a sprint leap.
  move(dt){
    // On a bend the inside lane is the shorter way round: a runner covers bendLane more of the course per lane inside the
    // middle one, and as much less per lane outside it (bend: +1 left; lane: +1 right).
    const c=this.config,list=this.runners().map(o=>{const k=1-c.bendLane*sectionAt(o.distance,this.course).bend*o.laneValue;return {o,k,d:o.distance,nd:o.distance+o.speed*dt*k,by:null};}).sort((a,b)=>b.d-a.d);
    for(const [i,a] of list.entries())for(const b of list.slice(0,i))if(Math.abs(a.o.laneValue-b.o.laneValue)<(a.o.stall||b.o.stall?c.stallOverlap:c.laneOverlap)&&a.o.leap?.over!==b.o){
      const room=b.nd-c.followGap*(a.o!==b.o&&list.some(x=>x.o.leap?.over===a.o)?2:1),limit=a.d>room?a.d+Math.max(0,b.nd-b.d):room;   // already inside the gap: never close it
      if(a.nd>limit){a.nd=Math.max(a.d,limit);a.by=b.o;}
    }
    for(const a of list){a.o.speed=(a.nd-a.d)/dt/a.k;   // speed: how fast it runs (k: how much of the course that covers here)
    a.o.distance=a.nd;a.o.blockedBy=a.by;}
  }
  // Rival riding: stuck behind someone → take a clear side lane (inner first), or leap it if sprinting; otherwise hold
  // its line. A blocker (r.block) up to 25 m ahead of the player moves onto the lane the player was in blockReaction
  // ago (it sees where the player is, not what was pressed) once there is room: it holds position.
  rivalLanes(r){
    if(this.time<(r.think??0)||Math.abs(r.laneValue-r.targetLane)>1e-6)return;r.think=this.time+.4;
    const c=this.config,go=to=>{r.laneChanges.push({from:r.laneValue,to,t:this.time});r.targetLane=to;};
    if(r.targetLane%1){if(r.distance>=c.breakOut){const to=[...new Set([Math.floor(r.targetLane),Math.ceil(r.targetLane)].map(l=>Math.max(-1,Math.min(1,l))))].sort((a,b)=>Math.abs(a-r.targetLane)-Math.abs(b-r.targetLane)).find(l=>!this.occupied(r,l));if(to!==undefined){go(to);r.lane=to;}}return;}   // out of the stalls: into the lane beside it
    if(r.blockedBy){for(const to of [r.targetLane-1,r.targetLane+1].filter(l=>Math.abs(l)<=1).sort((a,b)=>Math.abs(a)-Math.abs(b)))if(!this.occupied(r,to)){go(to);return;}
      const sprinting=strength(r.boosts,this.time,c)>0,cooling=r.jumps.length&&this.time-r.jumps.at(-1).t<c.jumpDuration;   // no leap straight out of a jump (as the player: charge())
      const over=!r.leap&&!cooling&&(sprinting||(r.energy>=c.boostCost&&this.fresh(r)))&&this.leapTarget(r);
      if(over){if(!sprinting)this.rivalSprint(r);r.leap={over,end:this.time+c.jumpDuration};r.jumps.push({t:this.time,leap:true});this.emit('rival-leap',{id:r.id,over:over.id??'player'});}
      return;}
    const ahead=r.distance-this.distance,bend=sectionAt(r.distance+10,this.course).bend,line=r.block&&ahead>0&&ahead<25?Math.round(this.laneAt(this.time-c.blockReaction)):bend?-bend:r.lane;   // else the inside of the bend it is on or coming to, its own lane on a straight
    if(line!==r.targetLane){const to=r.targetLane+Math.sign(line-r.targetLane);if(!this.occupied(r,to))go(to);}
  }
  expireNotes(cutoff){
    for(const n of this.notes)if(!n.state&&cutoff>n.t+this.config.goodWindow+1e-9){
      n.state='miss';this.combo=0;this.missRun=(this.missRun||0)+1;this.missed(this);   // missRun: misses in a row (the rider sits up at two)this.impulses.push({t:this.time,amount:this.config.missImpulse});
      if(this.solo&&!this.carried())this.drive=Math.max(this.solo.floor,this.drive-this.solo.missDrop);
      this.emit('miss',{noteId:n.id,side:n.lane});
    }
  }
  stumbleFactor(t=this.time,o=this){const s=o.stumbles.at(-1),age=t-(s?.t??-9),c=this.config;return age>=0&&age<c.stumbleTime?1-c.stumbleDip*Math.sin(Math.PI*age/c.stumbleTime):1;}
  boostActive(t=this.time){return this.boosts.some(b=>t>=b.t&&t<b.end-1e-9);}
  boostStrength(t=this.time){return strength(this.boosts,t,this.config);}
  // An apple's speed-up, eased like a sprint; carried: a sprint or an apple has the horse; rush: how hard (the look).
  appleStrength(t=this.time){return strength(this.rushes,t,this.config);}
  carried(t=this.time){return this.boostActive(t)||this.rushes.some(b=>t>=b.t&&t<b.end-1e-9);}
  rush(t=this.time){return Math.max(this.boostStrength(t),this.appleStrength(t));}
  boost(){
    const c=this.config;if(this.paused||this.finished||c.locks?.sprint||this.energy<c.boostCost||!this.fresh()||this.boostActive())return false;
    const end=this.time+this.form.boostDuration;this.energy-=c.boostCost;this.boosts.push({t:this.time,end});this.spend(this,end);
    this.emit('boost');return true;
  }
  // Jump (both hoofs at once): clears a hurdle; in a sprint it leaps the horse just ahead.
  jump(pressedAt=this.time){
    if(this.paused||this.finished)return;
    if(this.jumps.length&&pressedAt-this.jumps.at(-1).t<this.config.jumpDuration)return this.emit('jump-unavailable');
    const c=this.config,over=this.boostActive()&&this.leapTarget(this);
    this.jumps.push({t:pressedAt,leap:!!over});
    if(over){this.leap={over,end:pressedAt+c.jumpDuration};return this.emit('leap',{over:over.id});}
    return this.emit('jump');
  }
  // The charge button: a sprint on one stored segment; right behind a horse with room to land, the sprint leaps it.
  charge(pressedAt=this.time){
    if(this.paused||this.finished||this.config.locks?.sprint)return;
    const c=this.config,cooling=this.jumps.length&&pressedAt-this.jumps.at(-1).t<c.jumpDuration,over=!cooling&&this.leapTarget(this);
    if(over&&(this.boostActive()||(this.energy>=c.boostCost&&this.fresh()))){if(!this.boostActive())this.boost();return this.jump(pressedAt);}
    if(this.boostActive())return this.emit('charge-busy');
    return this.boost()?this.actions.at(-1):this.emit(this.energy>=c.boostCost?'charge-tired':'charge-empty');   // tired: a segment stored, no stamina for it yet
  }
  // Leap, the same for every runner: a jump in a sprint clears the horse just ahead in its lane (within followGap +
  // leapReach) when there is room to land a following gap in front of it. → that runner, or null. A horse that is in a
  // leap itself cannot be leapt: two leaping each other each chased the other's landing spot and ran away (hundreds of
  // metres in half a second).
  leapTarget(o){
    const c=this.config,ahead=this.runners().filter(x=>x!==o&&Math.abs(x.laneValue-o.laneValue)<c.laneOverlap&&x.distance>o.distance).sort((a,b)=>a.distance-b.distance);
    const [over,next]=ahead;
    return over&&!over.leap&&over.distance-o.distance<=c.followGap+c.leapReach&&(!next||next.distance-over.distance>=2*c.followGap)?over:null;
  }
  // In a leap the jumper goes over `over` and lands a following gap in front of it as the jump ends.
  leapPace(o,speed){
    const L=o.leap,left=L?L.end-this.time:0;if(!L)return speed;
    if(left<=1e-9){o.leap=null;return speed;}
    return Math.max(speed,(L.over.distance+L.over.speed*left+this.config.followGap+.2-o.distance)/left);
  }
  // Swept pickup in longitudinal/lateral space, subdivided at simulation steps.
  collectSweep(fromDistance,toDistance,fromLane,toLane){
    const dx=toDistance-fromDistance,dy=(toLane-fromLane)*this.config.laneSpacing;
    const reached=c=>{const ax=fromDistance-c.distance,ay=(fromLane-c.lane)*this.config.laneSpacing,u=clamp(-(ax*dx+ay*dy)/(dx*dx+dy*dy||1),0,1);
      return Math.hypot(ax+u*dx,ay+u*dy)<=this.config.coinRadius;};
    for(const c of this.coins)if(!c.collected&&reached(c)){c.collected=true;this.coinCount++;this.emit('coin',{id:c.id});}
    for(const a of this.apples)if(!a.collected&&reached(a)){a.collected=true;this.appleCount++;this.rushes.push({t:this.time,end:this.time+this.config.appleTime});this.emit('apple',{id:a.id});}
  }
  // Rest the notes around a coming jump press: both thumbs are on the arrows then, so a miss there is unavoidable.
  restNotes(){
    const c=this.config,h=this.hurdles.find(h=>!h.state&&h.distance>this.distance);if(!h)return;
    const press=this.time+(h.distance-this.distance)/Math.max(this.speed,1)-c.jumpLead;
    for(const n of this.notes)if(!n.state&&n.t-this.time<3&&n.t-this.time>.8&&Math.abs(n.t-press)<.55)n.state='rest';
  }
  // A rival runs by the player's sums: its buddy's base speed + the rhythm drive its hits build (let go after
  // rhythmGrace without one) + its sprint, × its aptitude for the ground, × the dip of a knocked hurdle.
  rivalStep(r,dt,mid){
    const c=this.config,sec=sectionAt(r.distance,this.course),f=(r.distance-this.legStart(r.leg))/(this.legEnd(r.leg)-this.legStart(r.leg));
    this.rivalCharge(r,dt,f);if(c.locks?.sprint)r.energy=0;   // no sprints on this stage: none for the rivals either
    if(mid-r.lastRhythm>c.rhythmGrace)r.rhythmDrive=Math.max(0,r.rhythmDrive-c.rhythmDecay*dt);
    r.rhythmSpeed+=(r.rhythmDrive-r.rhythmSpeed)*(1-Math.exp(-c.rhythmResponse*dt));
    // A solo race: the player's solo sums (its own speed × (1 + combo drive), an apple's speed-up, no aptitude). Not the
    // practice coach (r.pace): it keeps the pace it is given.
    const solo=this.solo&&!r.pace;if(solo)r.driveSpeed+=(r.drive-r.driveSpeed)*(1-Math.exp(-(r.drive<r.driveSpeed?this.solo.fall:this.solo.response)*dt));
    const own=solo?r.form.baseSpeed*(1+r.driveSpeed):r.form.baseSpeed+r.rhythmSpeed;
    r.speed=this.leapPace(r,Math.max(4,own+c.boostSpeed*strength(r.boosts,mid,c)+(c.appleSpeed||0)*strength(r.rushes,mid,c))*(this.solo?1:AFFINITY[r.horses[r.leg].type][sec.kind])*this.stumbleFactor(mid,r));
    if(r.targetLane%1&&r.distance>3*c.breakOut)r.speed*=.75;   // still between two lanes with no room beside it: it eases off and drops in behind
    r.laneValue=laneAt(r.laneChanges,this.time,c.laneDuration)??r.laneValue;
    if(r.stall&&r.laneValue%1===0)r.stall=false;   // in its lane: the full traffic rule from here
  }
  // The notes round a rival's own hurdle jump are rested for it, as the player's are (restNotes): hands on the jump.
  rested(r,t){
    const c=this.config,h=this.hurdles.find(h=>!r.jumped.has(h)&&h.distance>r.distance),next=h?this.time+(h.distance-r.distance)/Math.max(r.speed,1)-c.jumpLead:Infinity;
    return Math.abs(t-(r.hop??-9))<.55||Math.abs(t-next)<.55;
  }
  // Rivals ride the chart by the player's rules: each note as it passes (hit by skill, half of them Perfect) charges
  // and drives the rhythm, a miss takes missEnergy back; drafting; the cap and the stamina of the buddy it rides. A
  // segment is spent once past sprintAt (or when full, so nothing is wasted), and on a runner it is boxed in behind
  // (rivalLanes: the leap).
  rivalCharge(r,dt,f){
    const c=this.config,cap=this.cap(r),n=this.notes;r.drafting=this.drafts(r);
    for(;r.noteAt<n.length&&n[r.noteAt].t<=this.time;r.noteAt++){const k=r.noteAt;if(this.rested(r,n[k].t))continue;
      if(hash(k,r.phase+1)<r.skill){const perfect=hash(k+.5,r.phase+1)<.5;r.energy=Math.min(cap,r.energy+(perfect?c.perfectEnergy:c.goodEnergy)*(r.drafting?c.draftGain:1));
        r.lastRhythm=this.time;r.rhythmDrive=Math.min(c.rhythmMax,r.rhythmDrive+(perfect?r.form.rhythmGain:r.form.goodRhythmGain));
        if(this.solo)r.drive=Math.min(r.form.top,(1+Math.max(0,r.drive))*(1+r.form.accel*(perfect?1:.5))-1);}
      else{this.missed(r);if(this.solo&&!(strength(r.boosts,this.time,c)>0||strength(r.rushes,this.time,c)>0))r.drive=Math.max(this.solo.floor,r.drive-this.solo.missDrop);}}
    const sprinting=strength(r.boosts,this.time,c)>0;this.rest(r,dt);
    if(r.drafting&&!sprinting)r.energy=Math.min(cap,r.energy+c.draftTrickle*dt);
    if(!sprinting&&!r.finishTime&&r.energy>=c.boostCost&&this.fresh(r)&&(f>=r.sprintAt||r.energy>=cap-1e-9))this.rivalSprint(r);
  }
  rivalSprint(r){const end=this.time+r.form.boostDuration;r.energy-=this.config.boostCost;r.boosts.push({t:this.time,end});this.spend(r,end);}
  advance(toTime,missCutoff=toTime-this.config.chordWindow){
    if(this.paused||this.finished)return;
    const c=this.config;
    while(this.time<toTime-1e-9&&!this.finished){
      const dt=Math.min(c.fixedStep,toTime-this.time),before=this.distance,oldLane=this.laneAt(this.time),f=this.form;
      const mid=this.time+dt/2;
      const impulse=this.impulses.reduce((s,e)=>s+e.amount*Math.exp(-Math.max(0,mid-e.t)/c.impulseDecay)/c.impulseDecay,0);
      if(mid-this.lastRhythm>c.rhythmGrace)this.rhythmDrive=Math.max(0,this.rhythmDrive-c.rhythmDecay*dt);
      this.rhythmSpeed+=(this.rhythmDrive-this.rhythmSpeed)*(1-Math.exp(-c.rhythmResponse*dt));
      this.terrain=sectionAt(this.distance,this.course);this.affinity=this.solo?1:AFFINITY[this.horses[this.leg].type][this.terrain.kind];
      if(this.solo)this.driveSpeed+=(this.drive-this.driveSpeed)*(1-Math.exp(-(this.drive<this.driveSpeed?this.solo.fall:this.solo.response)*dt));
      const own=this.solo?this.solo.speed*(1+this.driveSpeed):f.baseSpeed+this.rhythmSpeed+impulse;
      // Drafting: right behind a horse in the lane → energy builds faster toward a leap (config draft*).
      this.drafting=this.drafts(this);this.rest(this,dt);
      if(this.drafting&&!this.boostActive()){const had=this.segments();this.energy=Math.min(this.cap(),this.energy+c.draftTrickle*dt);if(this.segments()>had)this.emit('charged',{segments:this.segments()});}   // a segment filled by drafting counts like one filled by a hit
      this.speed=this.leapPace(this,Math.max(4,own+c.boostSpeed*this.boostStrength(mid)+(c.appleSpeed||0)*this.appleStrength(mid))*this.affinity*this.stumbleFactor(mid));
      for(const r of this.rivals){this.rivalLanes(r);this.rivalStep(r,dt,mid);}
      const back=this.rivals.map(r=>r.distance),wasBlocked=this.blockedBy;this.move(dt);
      if(this.blockedBy&&!wasBlocked)this.emit('blocked',{by:this.blockedBy.id});
      for(const [i,r] of this.rivals.entries()){const b=back[i];
        // A rival's hurdle: it jumps on the lead; (1 - skill) / 3 of them it mistimes and knocks as it crosses: the
        // player's stumble (the dip, the sprint and the rhythm drive lost).
        for(const [k,h] of this.hurdles.entries())if(!r.jumped.has(h)&&(h.distance-r.distance)/r.speed<=c.jumpLead&&h.distance>b){r.jumped.add(h);r.jumps.push({t:this.time});r.hop=this.time;
          if(hash(k+.25,r.phase+1)<(1-r.skill)/3)r.trip=h;}
        if(r.trip&&r.distance>=r.trip.distance){r.trip=null;r.stumbles.push({t:this.time});r.rhythmDrive=0;r.drive=Math.min(0,r.drive);for(const x of [...r.boosts,...r.rushes])if(x.end>this.time)x.end=this.time;this.emit('rival-trip',{id:r.id});}
        for(const a of this.apples)if(!a.collected&&a.distance>b&&a.distance<=r.distance&&Math.abs(a.lane-r.laneValue)*c.laneSpacing<=c.coinRadius){a.collected=true;r.rushes.push({t:this.time,end:this.time+c.appleTime});}   // an apple it runs over is its own (the player's rule)
        if(r.leg<2&&r.distance>=this.course.relays[r.leg]){r.leg++;r.energy=0;r.form=r.forms[r.leg];r.pool=r.stamina=r.form.stamina;r.restAt=0;}
        if(!r.finishTime&&r.distance>=c.length)r.finishTime=this.time+dt*(c.length-r.distance)/(r.distance-b);}
      this.time+=dt;this.laneValue=this.laneAt(this.time);
      this.collectSweep(before,this.distance,oldLane,this.laneValue);
      for(const h of this.hurdles){
        if(h.state||before>=h.distance||this.distance<h.distance)continue;
        const crossed=this.time-dt+dt*(h.distance-before)/(this.distance-before),j=this.jumps.at(-1);
        const cleared=j&&Math.abs(crossed-j.t-c.jumpLead)<=c.jumpWindow+1e-9;
        h.state=cleared?'cleared':'hit';h.hitAt=crossed;
        if(!cleared){   // stumble: a short dip in speed, the sprint (an apple's too) and the built-up rhythm are lost; controls stay live
          this.combo=0;this.rhythmDrive=0;this.drive=Math.min(0,this.drive);this.stumbles.push({t:crossed});for(const b of [...this.boosts,...this.rushes])if(b.end>this.time)b.end=this.time;}
        this.emit(cleared?'clear':'obstacle-miss',{error:j?crossed-j.t-c.jumpLead:null});   // error: how far off the ideal take-off (simulation s)
      }
      for(const h of this.hurdles)h.t=h.hitAt??this.time+(h.distance-this.distance)/this.speed;
      // Handoff: the next horse takes over where this one is, with no charge and full stamina (each horse spends its own). Combo, lane
      // and gaps carry on.
      if(this.leg<2&&this.distance>=this.course.relays[this.leg]){this.leg++;this.energy=0;this.form=this.legForm(this.leg);this.pool=this.stamina=this.form.stamina;this.restAt=0;this.emit('relay',{leg:this.leg,horse:this.horses[this.leg]});}
      if(this.distance>=c.length){this.finishTime=this.time-dt+dt*(c.length-before)/(this.distance-before);this.distance=c.length;this.finished=true;this.emit('finish');}
    }
    this.restNotes();
    this.expireNotes(Math.min(missCutoff,this.time));
    const rank=this.metrics().rank;
    if(this.lastRank!==null){
      if(rank<this.lastRank)this.emit('overtake',{rank});
      else if(rank>this.lastRank)this.emit('passed',{rank});
    }
    this.lastRank=rank;
  }
  metrics(){
    const L=this.config.length;
    // Rivals keep running past the line (no snap back beside the player); unfinished ones are projected.
    const rivals=this.rivals.map(r=>({id:r.id,name:r.name,team:r.team,horses:r.horses,leg:r.leg,lane:r.laneValue,speed:r.speed,distance:r.distance,jumps:r.jumps,
      boosting:strength(r.boosts,this.time,this.config)>0,finishTime:r.finishTime??this.time+Math.max(0,L-r.distance)/Math.max(r.speed,1)}));
    const rank=1+rivals.filter(r=>this.finished?r.finishTime<this.finishTime:r.distance>this.distance+1e-9||(Math.abs(r.distance-this.distance)<=1e-9&&r.speed>this.speed)).length;
    return {player:{distance:this.distance,speed:this.speed,finishTime:this.finishTime,lane:this.laneValue},rivals,rank};
  }
}
