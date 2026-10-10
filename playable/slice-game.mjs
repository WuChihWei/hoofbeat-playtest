import {STALLS,SLICE_CONFIG,SLICE_CHART,soloChart,SLICE_RIVALS,RIVAL_LEVEL,RIVAL_SKILL,RIVAL_BUDDY,AFFINITY,SOLO,buddyStats,racing,courseMarks,templateCourse,sectionAt,legMains,sliceCoins,sliceApples} from './slice-config.mjs?v=r437';
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
    // Pace test (config.pace, 2026-10-07, the user: 「類似油門…加速表」「純配速」): no notes to hit. The two pads are the
    // whip; how often they are tapped is the pace (the needle: this.pace, 0–1.1; one tap a beat holds it at paceAt, in the
    // green between paceLo and paceHi). Under the green the buddy runs slower, in it at its top, over it faster still but
    // its wind runs down; out of wind it is blown for blownTime. An apple stores a sprint (a segment of charge) instead
    // of speeding it up there and then. beats: the chart, kept for the music alone.
    if(c.pace){this.beats=chart;chart=[];}
    // Gait test (config.gait, 2026-10-07, the user asked to play the combination I recommended): no notes either. The
    // buddy runs in one of four gaits (this.gear 0–3: walk, trot, canter, gallop), shifted up and down; each has its own
    // speed (GAIT_DRIVE of the solo model) and what it does to the wind a second (gaitWind: the gallop spends it, twice
    // as fast round a bend; the others give it back; tucked in behind a runner gives draftWind more). Out of wind: blown,
    // back to a walk for blownTime. A lane change into a runner alongside shoves it (shove()). beats: [] (no music beat).
    // Ball test (config.ball, 2026-10-07, the user's ring control: 「按住就衝、放開回復」「一直壓著球…會爆掉…快到臨界點要放開」): no
    // notes. this.ball 0–1 grows while the thumb holds (ballFill s from empty to the limit) and shrinks when it lets go
    // (ballFall); the drive follows it from a cruise (ballLo) to flat out (ballHi, × the buddy's top). At the limit it
    // pops: back to nothing and the buddy is blown for ballPop. It runs through the countdown too (slice-app), so what
    // is in the ball at GO is the start. Apples store a sprint as in the pace test; a lane change shoves (shove()).
    if(c.gait){this.beats=[];chart=[];}
    if(c.ball){this.beats=chart;chart=[];}   // the chart stays for the music alone
    this.ball=0;this.holding=false;this.wasHeld=false;this.streak=0;this.skill=c.ball?1:0;   // skill: charges of the skill button (one to start with)
    this.gear=1;
    this.pace=0;this.rate=0;this.lastTap=-9;this.wind=1;this.blown=-99;
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
    if(this.config.pace){const gap=Math.max(.12,pressedAt-this.lastTap);this.rate+=(1/gap-this.rate)*.5;this.lastTap=pressedAt;this.impulses.push({t:this.time,amount:this.config.goodImpulse});return this.emit('whip',{side});}
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
    if(this.occupied(this,next)&&!(this.config.gait&&this.shove(side,next)))return this.emit('lane-blocked',{side,to:next});   // a horse beside: no cutting into it (the gait test: unless it is shoved over)
    const change={from:this.laneAt(this.time),to:next,t:this.time};
    this.targetLane=next;this.laneChanges.push(change);
    return this.emit('lane',{side,to:next});
  }
  // A rival's ram (2026-10-10, the user: 「對手撞你」「不要有明顯的符號提示，要有明顯的身體提示」「一個完整的撞可能三秒，在一點五秒的時候
  // 可以反應」「不用閃，因為換道就可以躲」「但要有給反應時間」). config.ram {time, react, gap} (simulation s) switches it on.
  // A rival running beside the player comes over at it: `time` from its first lean to the hit, its body telling the
  // whole way (race-scene: it rolls toward the player and drifts over; it is across its lane line at `react`, so
  // `time - react` is left to get out of the way). The way out is the game's own: change lane. Nothing new to press.
  //   still beside it at the hit   the player stumbles, loses its sprint and its built-up drive, and is put a lane
  //                                over when there is room
  //   a lane away by then          it hits nothing: once it is across its line (`react`) it is committed and stumbles
  //                                itself; before that it only calls the ram off
  //   also out of it               a sprint (it cannot hold on beside a sprinting buddy), or knocking it first (the skill)
  // It only starts one when the player has a free lane on the far side to go to.
  rammer(){return this.rivals.find(r=>r.ram)??null;}
  ramStep(r){const c=this.config,R=c.ram;
    if(!R||this.finished)return;
    const reach=c.followGap*(r.ram?1.6:1.3),beside=!r.stall&&r.finishTime===null&&Math.abs(r.distance-this.distance)<reach,apart=Math.abs(r.targetLane-this.targetLane);   // it picks the player up a little way off and closes (rivalStep holds it beside)
    if(!r.ram){const out=this.targetLane+Math.sign(this.targetLane-r.targetLane);   // the lane the player would get away into
      if(this.time<(this.ramNext??R.first)||this.rammer()||!beside||apart!==1||r.targetLane%1||Math.abs(r.laneValue-r.targetLane)>1e-6||Math.abs(this.laneValue-this.targetLane)>1e-6
        ||Math.abs(out)>1||this.occupied(this,out)||this.stumbleFactor(this.time,r)<1||this.stumbleFactor()<1||this.boostActive()||this.blown>this.time||this.jumps.length&&this.time-this.jumps.at(-1).t<c.jumpDuration)return;
      r.ram={t:this.time,side:r.targetLane>this.targetLane?1:0};this.emit('ram-start',{id:r.id,side:r.ram.side});return;}
    const u=this.time-r.ram.t,side=r.ram.side,end=(why,data)=>{r.ram=null;this.ramNext=this.time+R.gap*(.7+.6*hash(this.time,r.phase+3));this.emit(why,{id:r.id,side,...data});};
    if(this.stumbleFactor(this.time,r)<1)return end('ram-broken');   // knocked first
    const there=beside&&apart===1&&!this.boostActive();
    if(!there&&u<R.react)return end('ram-off');                       // not committed yet: it lets it go
    if(u<R.time)return;
    if(!there){r.stumbles.push({t:this.time});r.rhythmDrive=0;r.drive=Math.min(0,r.drive);for(const x of [...r.boosts,...r.rushes])if(x.end>this.time)x.end=this.time;return end('ram-miss');}   // it threw itself at nothing
    this.combo=0;this.rhythmDrive=0;this.drive=Math.min(0,this.drive);this.stumbles.push({t:this.time});for(const b of [...this.boosts,...this.rushes])if(b.end>this.time)b.end=this.time;
    const to=this.targetLane+(side?-1:1);let pushed=false;if(Math.abs(to)<=1&&!this.occupied(this,to)){this.laneChanges.push({from:this.laneAt(this.time),to,t:this.time});this.targetLane=to;pushed=true;}
    end('rammed',{pushed});}
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
    if(r.ram)return;   // coming over at the player: ramStep moves it
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
  stumbleFactor(t=this.time,o=this){const s=o.stumbles.at(-1),age=t-(s?.t??-9),c=this.config,T=c.stumbleTime*(s?.k??1);return age>=0&&age<T?1-c.stumbleDip*Math.sin(Math.PI*age/T):1;}   // k: a runner the player knocked (bump, kick) is out of it c.knock times as long
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
  // The ball test, one step of dt at simulation time `at` (the countdown too: at<0, where the speed is what the ball says).
  // Letting go is the hit (r319, the user: 「讓人可以挑戰極限」): from ballGood up a good release (streak +1, a short
  // speed-up), from ballMax up a limit one (+2, twice as long); the ball drops to ballBack so the next takes a climb.
  // Each step of the streak (to ballStack) is ballGain more speed. A pop takes the whole streak.
  ballStep(dt,at){const c=this.config,S=this.solo;
    if(this.wasHeld&&!this.holding&&at>=0&&this.ball>=c.ballGood&&this.blown<=at){const max=this.ball>=c.ballMax;
      this.streak=Math.min(c.ballStack,this.streak+(max?2:1));this.skill=Math.min(3,this.skill+(max?2:1));this.ball=c.ballBack;this.rushes.push({t:at,end:at+c.ballRush*(max?2:1)});this.emit('release',{max,streak:this.streak});}
    this.wasHeld=this.holding;
    this.ball=this.blown>at?0:Math.max(0,this.ball+(this.holding?dt/c.ballFill:-dt/c.ballFall));
    if(this.ball>=1){this.ball=0;this.streak=Math.floor(this.streak/2);this.blown=at+c.ballPop;if(at>=0)this.stumbles.push({t:at});this.emit('blown');}   // spent: it stumbles
    this.drive=this.blown>at?S.floor:S.top*(c.ballLo+(c.ballHi-c.ballLo)*this.ball)*(1+c.ballGain*this.streak);
    if(at<0)this.driveSpeed=this.drive;}
  // The ball game: who a kick behind would reach (the same lane, within a following gap and a third behind) → the runner or undefined.
  behind(){const c=this.config;return this.rivals.find(r=>!r.stall&&r.finishTime===null&&Math.abs(r.laneValue-this.laneValue)<c.laneOverlap&&this.distance-r.distance>0&&this.distance-r.distance<c.followGap*1.3);}
  // The kick behind (the thumb dragged down; 2026-10-08, the user: 「踢的時候要減速且球大一節」): it costs a notch of the
  // ball (at the limit it pops) and a moment's speed, hit or miss, and shares the shove's wait. A hit: that runner
  // stumbles and whatever sprint it was on ends.
  kickBack(){const c=this.config;if(this.paused||this.finished||!c.ball||this.blown>this.time||this.time<(this.shoveAt??-9))return;
    const r=this.behind();this.ball+=c.shoveWind;this.driveSpeed*=.55;this.shoveAt=this.time+c.ballRush*4;
    if(r){r.stumbles.push({t:this.time,k:c.knock});r.rhythmDrive=0;r.drive=Math.min(0,r.drive);for(const x of [...r.boosts,...r.rushes])if(x.end>this.time)x.end=this.time;}
    return this.emit('kickback',{hit:r?.id??null});}
  // The gait test: one gear up or down (dir +1 / -1); not while blown.
  shift(dir){if(this.paused||this.finished||this.blown>this.time)return;const to=clamp(this.gear+dir,0,3);if(to===this.gear)return;this.gear=to;return this.emit('gear',{gear:to});}
  // The gait test: changing lane into a runner alongside at a canter or faster shoves it. With room on its far side it
  // is pushed a lane over and the lane is the player's (→ true); with none it stumbles where it is (→ false). Costs wind.
  // The skill button (2026-10-08, the user: 「把後踢側撞獨立出來一個累積的按鈕」「未來就可以把其他效果加在這」): charges (this.skill,
  // at most 3) come from letting go well: one for a nice release, two for one at the limit, and one to start with. What
  // a press does is whatever there is someone for, the nearest first: a runner alongside is bumped (it stumbles, and is
  // pushed a lane over if there is room), one right behind is kicked (it stumbles, its sprint ends). It always works and
  // costs the charge alone. No one in reach: nothing happens and nothing is spent. A swipe no longer bumps or kicks.
  skillTarget(){const L=this.besideAt(this.targetLane-1),R=this.besideAt(this.targetLane+1),B=this.behind(),d=r=>Math.abs(r.distance-this.distance);
    return [L&&{kind:'bump',side:0,r:L},R&&{kind:'bump',side:1,r:R},B&&{kind:'kick',r:B}].filter(Boolean).sort((a,b)=>d(a.r)-d(b.r))[0]??null;}
  useSkill(){if(this.paused||this.finished||!this.config.ball)return;const t=this.skill>=1&&this.blown<=this.time?this.skillTarget():null;
    if(!t)return this.emit('skill-none',{empty:this.skill<1});
    const r=t.r;this.skill--;r.stumbles.push({t:this.time,k:this.config.knock});r.rhythmDrive=0;r.drive=Math.min(0,r.drive);for(const x of [...r.boosts,...r.rushes])if(x.end>this.time)x.end=this.time;
    let pushed=false;if(t.kind==='bump'){const to=r.targetLane+(t.side?1:-1);if(Math.abs(to)<=1&&!this.occupied(r,to)){r.laneChanges.push({from:r.laneValue,to,t:this.time});r.targetLane=r.lane=to;pushed=true;}}
    return this.emit('skill',{kind:t.kind,side:t.side??null,id:r.id,pushed});}
  // The ball game's bump as it was before the skill button (unused since; kept for ?-switch tests) (2026-10-08, the user: 「撞人是一種策略但不是隨時能用的，應該是有條件用且有條件損失」): it takes a
  // step of the streak, so it is earned by letting go well and costs that step's speed. Both balls swell a notch
  // (shoveWind); nobody wins on size: whoever's ball is over the limit pops and stumbles. His pops: the lane is the
  // player's if there is room to push him over. Neither pops: both stay where they are (the block holds) and the step
  // is spent for nothing. The player's own pop is ballStep's (the whole streak goes).
  besideAt(next){const c=this.config;return this.rivals.find(r=>!r.stall&&r.finishTime===null&&Math.abs(r.laneValue-next)<c.laneOverlap&&Math.abs(r.distance-this.distance)<c.followGap);}
  canBump(side){const next=clamp(this.targetLane+(side?1:-1),-1,1);return next!==this.targetLane&&this.streak>=1&&this.blown<=this.time&&this.time>=(this.shoveAt??-9)&&!!this.besideAt(next);}
  // A rival's ball: what it holds (by its skill), breathing a tenth either way as it presses and lets go (a slow wave,
  // each rival at its own point of it), and what a bump has just added (that eases back: rivalStep). 2026-10-08, the
  // user: a strong rival should go down to one bump half the time and need two the other half: at skill .6 it holds .8,
  // so a notch (.2) pops it only on the upper half of the wave; the second bump, while the first notch is still on it, always does.
  rivalBall(r){return .35+.75*r.skill+.1*Math.sin(2*Math.PI*(this.time/(this.config.ballFill*.8)+(r.phase||0)*.37))+(r.bump||0);}
  bump(side,next){const c=this.config,r=this.besideAt(next);
    if(!r||this.streak<1||this.blown>this.time||this.time<(this.shoveAt??-9))return false;
    this.streak--;this.shoveAt=this.time+c.ballRush*4;this.ball+=c.shoveWind;r.bump=(r.bump||0)+c.shoveWind;
    const popped=this.rivalBall(r)>=1,to=r.targetLane+(side?1:-1),room=popped&&Math.abs(to)<=1&&!this.occupied(r,to);
    if(popped){r.bump=0;r.blown=this.time+c.ballPop;r.stumbles.push({t:this.time});for(const x of [...r.boosts,...r.rushes])if(x.end>this.time)x.end=this.time;}
    if(room){r.laneChanges.push({from:r.laneValue,to,t:this.time});r.targetLane=r.lane=to;}
    this.emit('shove',{id:r.id,popped,pushed:room,self:this.ball>=1});return room&&this.ball<1;}
  shove(side,next){
    if(this.config.ball)return this.bump(side,next);
    const c=this.config,r=this.rivals.find(r=>Math.abs(r.laneValue-next)<c.laneOverlap&&Math.abs(r.distance-this.distance)<c.followGap);
    if(!r||this.gear<2||this.wind<c.shoveWind||r.stall)return false;
    this.wind-=c.shoveWind;
   const to=r.targetLane+(side?1:-1),room=Math.abs(to)<=1&&!this.occupied(r,to);
    if(room){r.laneChanges.push({from:r.laneValue,to,t:this.time});r.targetLane=r.lane=to;}
    if(!room){r.stumbles.push({t:this.time});r.rhythmDrive=0;r.drive=Math.min(0,r.drive);}
    this.emit('shove',{id:r.id,pushed:room});return room;
  }
  // The reins test: a kick at the runner alongside on that side (side 0 left, 1 right): in the next lane, within a
  // following gap. It stumbles (as off a knocked fence); the kick costs wind and has to come back (kickWait).
  kick(side){
    const c=this.config;if(this.paused||this.finished||this.time<(this.kickAt??0))return;
    const lane=this.laneValue+(side?1:-1),hit=this.rivals.find(r=>Math.abs(r.laneValue-lane)<.6&&Math.abs(r.distance-this.distance)<c.followGap);
    this.kickAt=this.time+c.kickWait;this.wind=Math.max(0,this.wind-c.kickWind);
    if(hit){hit.stumbles.push({t:this.time});hit.rhythmDrive=0;hit.drive=Math.min(0,hit.drive);for(const x of [...hit.boosts,...hit.rushes])if(x.end>this.time)x.end=this.time;}
    return this.emit('kick',{side,hit:hit?.id??null});
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
    for(const a of this.apples)if(!a.collected&&reached(a)){a.collected=true;this.appleCount++;if(this.config.gait)this.wind=Math.min(1,this.wind+this.config.appleWind);else if(this.config.pace||this.config.ball&&!this.config.locks?.sprint){const had=this.segments();this.energy=Math.min(this.cap(),this.energy+this.config.boostCost);if(this.segments()>had)this.emit('charged',{segments:this.segments()});}else this.rushes.push({t:this.time,end:this.time+this.config.appleTime});this.emit('apple',{id:a.id});}
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
    const solo=this.solo&&!r.pace;if(solo&&c.ball)r.bump=Math.max(0,(r.bump||0)-dt/(c.ballFill*2));   // a bump's notch eases off: for a moment it is nearer its limit
    if(solo&&c.ball)r.drive=(r.blown??-9)>mid?this.solo.floor:(r.form.top??this.solo.top)*(c.ballLo+(c.ballHi-c.ballLo)*(.12+.7*r.skill))*(1+c.ballGain*c.ballStack*r.skill*.7*Math.min(1,mid/(c.ballFill*6)));   // the ball test: a rival holds its ball at a steady share of the limit and builds a share of the streak, both by its skill
    if(solo)r.driveSpeed+=(r.drive-r.driveSpeed)*(1-Math.exp(-(r.drive<r.driveSpeed?this.solo.fall:this.solo.response)*dt));
    const own=solo?r.form.baseSpeed*(1+r.driveSpeed):r.form.baseSpeed+r.rhythmSpeed;
    r.speed=this.leapPace(r,Math.max(4,own+c.boostSpeed*strength(r.boosts,mid,c)+(c.appleSpeed||0)*strength(r.rushes,mid,c))*(this.solo?1:AFFINITY[r.horses[r.leg].type][sec.kind])*this.stumbleFactor(mid,r));
    if(r.ram)r.speed=Math.max(4,this.speed+clamp((this.distance-r.distance)*1.5,-3,3));   // a ram: it holds on beside the player
    if(r.targetLane%1&&(!this.solo||Math.abs(r.targetLane)>1)&&r.distance>3*c.breakOut)r.speed*=.75;   // still out in an outer stall with no room beside it: it eases off and drops in behind. In a solo race only the outer ones (2026-10-10; the relay keeps its rule, its checks are tuned on it): all four easing off together stayed level, at three quarters speed for the first 9 s of stages 4 and 5, and the player was a quarter lap up
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
      if(c.gait&&this.solo){const S=this.solo,g=this.blown>mid?0:this.gear,bend=sectionAt(this.distance,this.course).bend;
        this.wind=clamp(this.wind+(c.gaitWind[g]*(g===3&&bend?2:1)+(this.drafting?c.draftWind:0))*dt,0,1);
        if(!this.wind&&this.blown<=mid){this.blown=mid+c.blownTime;this.gear=0;this.emit('blown');}
        this.drive=[S.floor,S.top*.3,S.top*.75,S.top*1.5][g];}
      if(c.pace&&this.solo){const S=this.solo,eff=Math.min(this.rate,1/Math.max(mid-this.lastTap,1e-3)),to=this.blown>mid?.15:Math.min(1.1,Math.max(this.holding?c.paceHold:0,eff*.6*c.paceAt));   // .6: a beat   // holding (the reins test): both reins in hand is a steady pace at the foot of the green
        this.pace+=(to-this.pace)*(1-Math.exp(-5*dt));const p=this.pace,hot=p>c.paceHi;
        this.wind=Math.max(0,Math.min(1,this.wind+(hot?-c.windDrain:c.windBack)*dt));
        if(!this.wind&&this.blown<=mid){this.blown=mid+c.blownTime;this.rate=0;this.emit('blown');}
        this.drive=this.blown>mid?S.floor:p<c.paceLo?S.floor+(S.top*.6-S.floor)*p/c.paceLo:hot?S.top*1.25:S.top;}
      if(c.ball&&this.solo)this.ballStep(dt,mid);
      if(this.solo)this.driveSpeed+=(this.drive-this.driveSpeed)*(1-Math.exp(-(this.drive<this.driveSpeed?this.solo.fall:this.solo.response)*dt));
      const own=this.solo?this.solo.speed*(1+this.driveSpeed):f.baseSpeed+this.rhythmSpeed+impulse;
      // Drafting: right behind a horse in the lane → energy builds faster toward a leap (config draft*).
      this.drafting=this.drafts(this);this.rest(this,dt);
      if(this.drafting&&!this.boostActive()){const had=this.segments();this.energy=Math.min(this.cap(),this.energy+c.draftTrickle*dt);if(this.segments()>had)this.emit('charged',{segments:this.segments()});}   // a segment filled by drafting counts like one filled by a hit
      this.speed=this.leapPace(this,Math.max(4,own+c.boostSpeed*this.boostStrength(mid)+(c.appleSpeed||0)*this.appleStrength(mid))*this.affinity*this.stumbleFactor(mid));
      for(const r of this.rivals){this.rivalLanes(r);this.rivalStep(r,dt,mid);this.ramStep(r);}
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
    const rivals=this.rivals.map(r=>({id:r.id,name:r.name,team:r.team,horses:r.horses,leg:r.leg,lane:r.laneValue,speed:r.speed,distance:r.distance,jumps:r.jumps,stumbleAt:r.stumbles.at(-1)?.t??null,stumbleK:r.stumbles.at(-1)?.k??1,ram:r.ram?{t:r.ram.t,dir:r.ram.side?-1:1}:null,
      boosting:strength(r.boosts,this.time,this.config)>0,finishTime:r.finishTime??this.time+Math.max(0,L-r.distance)/Math.max(r.speed,1)}));
    const rank=1+rivals.filter(r=>this.finished?r.finishTime<this.finishTime:r.distance>this.distance+1e-9||(Math.abs(r.distance-this.distance)<=1e-9&&r.speed>this.speed)).length;
    return {player:{distance:this.distance,speed:this.speed,finishTime:this.finishTime,lane:this.laneValue},rivals,rank};
  }
}
