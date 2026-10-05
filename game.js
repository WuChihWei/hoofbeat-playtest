export const ARCHETYPES = {
  burst:{name:'Burst',label:'Burst horse',note:'40% stronger accurate hits on straights.',specialty:'Fast beats'},
  steady:{name:'Steady',label:'Steady horse',note:'35% stronger alternating hits on bends.',specialty:'Alternating beats'},
  technique:{name:'Technique',label:'Technique horse',note:'50 ms more tolerance on mud or in rain.',specialty:'Complex patterns'}
};
// Active roster. Add future horses here with a new contiguous id; the stable and
// selection views render from this catalog without changing the three-role rule.
export const HORSES = [
  {id:0,name:'Swift',en:'SWIFT',archetype:'steady',color:'#85b9c9'},
  {id:1,name:'Ember',en:'EMBER',archetype:'burst',color:'#e99974'},
  {id:2,name:'Summit',en:'SUMMIT',archetype:'technique',color:'#b4c791'}
].map(h=>({...h,type:ARCHETYPES[h.archetype].name,note:ARCHETYPES[h.archetype].note}));
export const TRACKS = {
  straight:{name:'Fast straight',short:'Straight',bpm:160,detail:'160 BPM / fast beats',pattern:'L R L R L R'},
  curve:{name:'Bend',short:'Bend',bpm:120,detail:'120 BPM / alternating',pattern:'L R L R L R'},
  mud:{name:'Mud',short:'Mud',bpm:120,detail:'Uneven alternating steps',pattern:'L R · L R · L R'}
};
export const WEATHER = {
  sun:{name:'Sunny',icon:'☀',detail:'Standard rhythm and timing'},
  cloud:{name:'Cloudy',icon:'cloud',rain:0},
  drizzle:{name:'Light rain',icon:'cloud-drizzle',rain:.45},
  rain:{name:'Rain',icon:'cloud-rain',rain:1,detail:'Offbeats and repeats'}
};
export const FORECASTS={sun:{name:'Clouds to rain',icon:'cloud',laps:['cloud','drizzle','rain']},rain:{name:'Rainy run',icon:'cloud-rain',laps:['drizzle','rain','rain']}};
export const CITIES = [
  {name:'Taipei',en:'TAIPEI',track:'A / Riverside relay',detail:'Start fast, turn, then finish in mud.',segments:['straight','curve','mud'],sky:'#b5cfbf',ground:'#58745c',road:'#42574a',edge:'#d2dfb3',accent:'#cadf9d'},
  {name:'Tokyo',en:'TOKYO',track:'B / City relay',detail:'Mud first; save the straight for last.',segments:['mud','curve','straight'],sky:'#b7ccd6',ground:'#677878',road:'#3c4d54',edge:'#c4d3d5',accent:'#a9d5e0'},
  {name:'Dubai',en:'DUBAI',track:'C / Desert relay',detail:'Bend, mud, then a fast finish.',segments:['curve','mud','straight'],sky:'#e6cda8',ground:'#b29570',road:'#806c54',edge:'#ecdcbb',accent:'#e9c591'}
];
export const COUNTDOWN=3,LAP_SECONDS=25,LEG_SECONDS=LAP_SECONDS,DURATION=LAP_SECONDS*3;
export const CHART_VERSION='stride-gestures-2',IMPULSE_BUDGET=40;
export const BOOST_COST=50,BOOST_DURATION=2.4,LANE_CHANGE_DURATION=.3;
export const PERFECT_WINDOW=.085,GOOD_WINDOW=.17;
export const JUMP_DURATION=1.05,JUMP_LEAD=.45,JUMP_WINDOW=.2;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const legAt=t=>t<0?-1:Math.min(2,Math.floor(t/LEG_SECONDS));
export function lapWeather(scenario,lap){return (FORECASTS[scenario]||FORECASTS.sun).laps[clamp(lap,0,2)]}
export function weatherAt(scenario,t){return lapWeather(scenario,Math.max(0,legAt(t)))}
export function weatherAmount(scenario,t){
  const lap=Math.max(0,legAt(t)),local=Math.max(0,t)-lap*LAP_SECONDS,current=WEATHER[lapWeather(scenario,lap)].rain;
  const before=lap?WEATHER[lapWeather(scenario,lap-1)].rain:current,k=clamp(local/2,0,1);
  return before+(current-before)*k*k*(3-2*k);
}
export function lapSections(city,lap){
  const main=CITIES[city].segments[lap];
  return main==='straight'?[[0,14,'straight'],[14,18,'curve'],[18,21,'mud'],[21,25,'straight']]:main==='curve'?[[0,2,'straight'],[2,16,'curve'],[16,19,'mud'],[19,25,'straight']]:[[0,2,'straight'],[2,16,'mud'],[16,20,'curve'],[20,25,'straight']];
}
export function trackAt(city,t){
  const lap=Math.max(0,legAt(t)),local=clamp(t-lap*LAP_SECONDS,0,LAP_SECONDS);
  return lapSections(city,lap).find(([start,end])=>local>=start&&local<end)?.[2]||'straight';
}
export function relayRest(t){return [LAP_SECONDS,LAP_SECONDS*2].some(boundary=>t>=boundary-.8&&t<=boundary+.8)}
export function conditions(city,weather,leg){return{track:CITIES[city].segments[leg],weather:lapWeather(weather,leg)}}
export function isComplex(track,weather){return track==='mud'||(WEATHER[weather]?.rain||0)>0}
export function ability(horse,track,weather) {
  if(horse.archetype==='burst'&&track==='straight')return 'Hit impulse +40%';
  if(horse.archetype==='steady'&&track==='curve')return 'Alternating impulse +35%';
  if(horse.archetype==='technique'&&isComplex(track,weather))return 'Timing tolerance +50 ms';
  return 'Standard performance';
}
export function timingWindows(horse,track,weather) {
  const rain=(WEATHER[weather]?.rain||0)*.03;
  const bonus=horse.archetype==='technique'&&isComplex(track,weather)?.05:0;
  return{perfect:PERFECT_WINDOW-rain+bonus,good:GOOD_WINDOW-rain+bonus};
}
export function judge(delta,windows={perfect:PERFECT_WINDOW,good:GOOD_WINDOW}) {
  const d=Math.abs(delta);return d<=windows.perfect+1e-9?'perfect':d<=windows.good+1e-9?'good':null;
}
export function makeHurdles(){return [0,1,2].flatMap(leg=>[8,18].map(local=>({t:leg*LEG_SECONDS+local,leg,state:null,hitAt:null})))}
export function jumpRest(t){return makeHurdles().some(h=>t>=h.t-.85&&t<=h.t+.7)}
export function makeNotes(city=0,weather='sun') {
  const notes=[];
  CITIES[city].segments.forEach((_,leg)=>{
    const sky=lapWeather(weather,leg);
    let local=leg===0?.75:1.5,index=0,previous=null;
    while(local<=24+1e-9) {
      const track=trackAt(city,leg*LEG_SECONDS+local),intervals=track==='straight'?[.375]:track==='curve'?[.5]:[.5,.75,.375,.625,.5,.375,.875];
      const opening=leg===0&&index<4;
      const irregular=!opening&&track!=='curve'&&(WEATHER[sky].rain||0)>0&&index%6===3;
      const time=local+(irregular?.125:0);
      const lane=opening?index%2:irregular&&previous!==null?previous:track==='mud'?[0,0,1,1,0,1,0][index%7]:index%2;
      notes.push({t:leg*LEG_SECONDS+time,lane,leg,track:trackAt(city,leg*LEG_SECONDS+time),weather:sky,state:null,hitAt:null});
      // A readable opening, a short relay reset, then the terrain's full pattern.
      const base=intervals[index%intervals.length];
      const interval=opening||local<1.5?.75:leg===0?Math.max(.5,base):leg===2&&local>=20?.375:base;
      previous=lane;local+=interval;index++;
    }
  });return notes.filter(n=>!jumpRest(n.t)&&!relayRest(n.t)).map((note,index)=>({...note,lane:index%2}));
}
// One horse of each archetype: selecting a horse places its type in the chosen slot.
export function selectHorse(team,slot,id) {
  const next=[...team],previous=next.findIndex(h=>HORSES[h].archetype===HORSES[id].archetype);
  if(previous<0)throw new Error('Each lineup must contain all three archetypes');
  next[previous]=id;
  [next[previous],next[slot]]=[next[slot],next[previous]];
  return next;
}
export function newRace(team,city,weather='sun') {
  if(team.length!==3||new Set(team.map(id=>HORSES[id]?.archetype)).size!==3||team.some(id=>!HORSES[id]))throw new Error('Select one horse per archetype');
  const notes=makeNotes(city,weather);
  const opponents=CITIES[city].segments.map(t=>({straight:1,curve:0,mud:2}[t]));
  const rivals=[{id:'pacer',name:'Pacer',team:opponents},{id:'chaser',name:'Chaser',team:opponents.map(id=>(id+1)%3)}];
  return {team:Object.freeze([...team]),city,weather,opponents,rivals,notes,
    counts:[0,1,2].map(leg=>notes.filter(n=>n.leg===leg).length),
    stats:Array.from({length:3},()=>({perfect:0,good:0,miss:0,stray:0,rescued:0,bonus:0})),
    combo:0,bestCombo:0,events:[],lastStray:-Infinity,finished:false,
    energy:0,boosts:[],laneChanges:[],
    hurdles:makeHurdles(),jumps:[],lastJump:-Infinity,sprint:{streak:0,last:-Infinity,leg:-1},sprints:[]};
}
// The same passive rule is used by the player and AI. No rank-dependent boosts.
export function sprintTrigger(skill,horse,n,state,t,city){
  if(skill.leg!==n.leg){skill.leg=n.leg;skill.streak=0;skill.last=-Infinity}
  skill.streak=horse.archetype==='burst'&&n.track==='straight'&&['perfect','good'].includes(state)?skill.streak+1:0;
  if(skill.streak<4||t-skill.last<8||trackAt(city,t)!=='straight')return null;
  const end=Math.min(t+2,n.leg*LEG_SECONDS+lapSections(city,n.leg).find(([start,end])=>t-n.leg*LEG_SECONDS>=start&&t-n.leg*LEG_SECONDS<end)?.[1]);
  if(!Number.isFinite(end)||end-t<1)return null;
  skill.last=t;skill.streak=0;
  return {t,end,leg:n.leg};
}
export function sprintEvents(sprint){
  return Array.from({length:Math.ceil((sprint.end-sprint.t)/.25)},(_,i)=>({t:sprint.t+i*.25,leg:sprint.leg,state:'sprint',amount:.3,bonus:.3}));
}
export function sprintActive(r,t){return r.sprints.some(s=>t>=s.t&&t<s.end)}
export function boostActive(r,t){return r.boosts.some(boost=>t>=boost.t&&t<boost.end)}
export function inputBoost(r,t){
  if(r.finished||t<0||t>=DURATION||relayRest(t)||r.energy<BOOST_COST||boostActive(r,t))return null;
  const boost={t,end:Math.min(t+BOOST_DURATION,DURATION),leg:legAt(t)};
  r.energy-=BOOST_COST;r.boosts.push(boost);
  for(let at=t;at<boost.end-1e-9;at+=.2)r.events.push({t:at,leg:legAt(at),state:'boost',amount:.36,bonus:0});
  return boost;
}
export function raceLane(r,t){
  const change=r.laneChanges.findLast(change=>change.t<=t);
  if(!change)return 0;
  const progress=clamp((t-change.t)/LANE_CHANGE_DURATION,0,1);
  return change.from+(change.to-change.from)*progress*progress*(3-2*progress);
}
export function inputLane(r,direction,t){
  if(r.finished||t<0||t>=DURATION||relayRest(t)||![-1,1].includes(direction))return null;
  const previous=r.laneChanges.at(-1);
  if(previous&&t-previous.t<LANE_CHANGE_DURATION)return null;
  const from=raceLane(r,t),to=clamp(from+direction,-1,1);
  if(to===from)return null;
  const change={t,from,to};r.laneChanges.push(change);return change;
}
// A recognized steering gesture replaces nearby steps without scoring or a miss.
export function inputSteer(r,direction,t,start=t){
  const change=inputLane(r,direction,t);
  if(r.finished||t<0||t>=DURATION||relayRest(t))return null;
  for(const note of r.notes)if(!note.state&&note.t>=start-.12&&note.t<=t+.12){note.state='steer';note.hitAt=t}
  return change;
}
export function expireHurdles(r,t){
  const collided=[];
  for(const h of r.hurdles)if(!h.state&&t>=h.t){
    h.state='hit';h.hitAt=h.t;r.combo=0;r.sprint.streak=0;
    r.events.push({t:h.t,leg:h.leg,state:'hurdle-hit',amount:-2.4,bonus:0});collided.push(h);
  }
  return collided;
}
export function inputJump(r,t){
  if(r.finished||t<0||t>=DURATION||relayRest(t))return null;
  expireHurdles(r,t);
  if(t-r.lastJump<JUMP_DURATION-1e-9)return null;
  r.lastJump=t;r.jumps.push({t,leg:legAt(t)});
  const h=r.hurdles.find(h=>!h.state&&Math.abs(t-(h.t-JUMP_LEAD))<=JUMP_WINDOW+1e-9);
  if(h){
    h.state='cleared';h.hitAt=t;
    r.events.push({t:h.t,leg:h.leg,state:'hurdle-clear',amount:.7,bonus:0});
    r.jumps.at(-1).cleared=true;
    return {state:'cleared',delta:t-(h.t-JUMP_LEAD)};
  }
  const nearest=r.hurdles.reduce((a,b)=>Math.abs(a.t-JUMP_LEAD-t)<=Math.abs(b.t-JUMP_LEAD-t)?a:b);
  return {state:t<nearest.t-JUMP_LEAD?'early':'late'};
}
export function jumpCue(r,t){
  const next=r.hurdles.find(h=>!h.state&&h.t>=t);
  const ready=!!next&&Math.abs(t-(next.t-JUMP_LEAD))<=JUMP_WINDOW+1e-9;
  return {next,ready,until:next?next.t-JUMP_LEAD-t:Infinity,cooldown:clamp((t-r.lastJump)/JUMP_DURATION,0,1)};
}
export function jumpMotion(r,t,pacer=false){
  const starts=pacer?r.hurdles.map(h=>h.t-JUMP_LEAD):r.jumps.map(j=>j.t);
  const start=starts.slice().reverse().find(start=>t>=start&&t<start+JUMP_DURATION+.24);
  if(start===undefined)return {height:0,pitch:0,airborne:false,tuck:0,crouch:0,landing:0,phase:0};
  const age=t-start,airborne=age<JUMP_DURATION-1e-9,phase=clamp(age/JUMP_DURATION,0,1),ease=x=>{const k=clamp(x,0,1);return k*k*(3-2*k)};
  const landing=age>=JUMP_DURATION?Math.sin(Math.PI*(age-JUMP_DURATION)/.24):0;
  return {height:airborne?1.55*Math.sin(Math.PI*phase):0,
    pitch:airborne?.19*Math.sin(2*Math.PI*phase):-.055*landing,
    airborne,phase,landing,
    tuck:ease(phase/.22)*(1-ease((phase-.58)/.34)),
    crouch:phase<.14?Math.sin(Math.PI*phase/.14):0};
}
function gain(state,horse,track,alternating) {
  const base={perfect:1,good:.55,miss:-.22,stray:-.2}[state];
  const multiplier=horse.archetype==='burst'&&track==='straight'?1.4:horse.archetype==='steady'&&track==='curve'&&alternating?1.35:1;
  return{base,bonus:base>0?base*(multiplier-1):0};
}
function record(r,n,state,t,delta=0) {
  const i=r.notes.indexOf(n),previous=r.notes[i-1],horse=HORSES[r.team[n.leg]],track=n.track;
  const alternating=previous?.leg===n.leg&&previous.lane!==n.lane&&['perfect','good'].includes(previous.state);
  const value=gain(state,horse,track,alternating),normal=timingWindows({archetype:'none'},track,n.weather);
  const rescued=state!=='miss'&&Math.abs(delta)>normal.good+1e-9;
  const scale=IMPULSE_BUDGET/r.counts[n.leg];
  n.state=state;n.hitAt=t;r.stats[n.leg][state]++;r.stats[n.leg].bonus+=value.bonus*scale;
  if(state==='perfect'||state==='good')r.energy=Math.min(100,r.energy+(state==='perfect'?10:6));
  if(rescued)r.stats[n.leg].rescued++;
  if(state==='miss')r.combo=0;else{r.combo++;r.bestCombo=Math.max(r.bestCombo,r.combo)}
  r.events.push({t,leg:n.leg,state,lane:n.lane,amount:(value.base+value.bonus)*scale,bonus:value.bonus*scale,rescued});
  const sprint=sprintTrigger(r.sprint,horse,n,state,t,r.city);
  if(sprint){r.sprints.push(sprint);r.events.push(...sprintEvents(sprint))}
}
export function expireNotes(r,t) {
  expireHurdles(r,t);
  let count=0;
  for(const n of r.notes) {
    const window=timingWindows(HORSES[r.team[n.leg]],n.track,n.weather).good;
    if(!n.state&&t>n.t+window+1e-9){record(r,n,'miss',n.t+window);count++}
  }return count;
}
export function input(r,lane,t) {
  if(r.finished||t<0||t>=DURATION||relayRest(t))return null;
  expireNotes(r,t);
  // Judge the closest unplayed note first, so adjacent wide windows cannot skip a wrong side.
  const n=r.notes.filter(n=>!n.state&&Math.abs(t-n.t)<=timingWindows(HORSES[r.team[n.leg]],n.track,n.weather).good+1e-9).sort((a,b)=>Math.abs(a.t-t)-Math.abs(b.t-t))[0];
  if(n){const delta=t-n.t,state=n.lane===lane?judge(delta,timingWindows(HORSES[r.team[n.leg]],n.track,n.weather)):'miss';record(r,n,state,t,delta);return{state,lane,delta,reason:state==='miss'?'wrong-side':state==='good'?(delta<0?'early':'late'):null}}
  // A slightly late attempt already paid the missed-note penalty, not a second stray penalty.
  const late=r.notes.find(n=>n.state==='miss'&&n.lane===lane&&t>n.t&&t-n.t<=timingWindows(HORSES[r.team[n.leg]],n.track,n.weather).good+.12);
  if(late)return {state:'miss',lane,reason:'late'};
  const leg=legAt(t),local=t-leg*LEG_SECONDS;
  if(local<.3||local>LEG_SECONDS-.25||jumpRest(t)||t-r.lastStray<.18)return null;
  r.lastStray=t;r.stats[leg].stray++;r.combo=0;r.sprint.streak=0;r.events.push({t,leg,state:'stray',lane,amount:-.2,bonus:0});
  const nearest=r.notes.reduce((a,b)=>Math.abs(a.t-t)<=Math.abs(b.t-t)?a:b);
  return{state:'stray',lane,reason:t<nearest.t?'early':'late'};
}
const metricCaches=new WeakMap();
function timeline(events){
  let sum=0,residual=0,last=0;
  return events.slice().sort((a,b)=>a.t-b.t).map(e=>{
    residual=residual*Math.exp(-(e.t-last)/.4)+e.amount;sum+=e.amount;last=e.t;
    return {t:e.t,sum,residual};
  });
}
function sampleTimeline(entries,time){
  let low=0,high=entries.length;
  while(low<high){const mid=(low+high)>>>1;if(entries[mid].t<=time)low=mid+1;else high=mid}
  const e=entries[low-1];if(!e)return {distance:12*time,speed:12};
  const residual=e.residual*Math.exp(-(time-e.t)/.4);
  return {distance:12*time+e.sum-residual,speed:12+residual/.4};
}
function cachedMetrics(r){
  let cache=metricCaches.get(r);
  if(!cache){
    const rivals=r.rivals.map((rival,index)=>{
      const skill={streak:0,last:-Infinity,leg:-1},boosts=[];
      const pattern=index===0?['perfect','good','good','perfect','good','miss','good','perfect']:['good','perfect','perfect','miss','good','good','miss','good'];
      const events=r.notes.map((n,i)=>{
        const state=pattern[i%pattern.length],previous=r.notes[i-1],prevState=pattern[(i-1+pattern.length)%pattern.length];
        const alternating=previous?.leg===n.leg&&previous.lane!==n.lane&&prevState!=='miss';
        const value=gain(state,HORSES[rival.team[n.leg]],n.track,alternating);
        const sprint=sprintTrigger(skill,HORSES[rival.team[n.leg]],n,state,n.t,r.city);
        if(sprint)boosts.push(...sprintEvents(sprint));
        return {t:n.t,amount:(value.base+value.bonus)*IMPULSE_BUDGET/r.counts[n.leg]};
      });
      return timeline([...events,...boosts,...r.hurdles.map(h=>({t:h.t,amount:.7}))]);
    });
    cache={rivals,count:0,player:[]};metricCaches.set(r,cache);
  }
  // Append in constant time; delayed/out-of-order judgments fall back to a rebuild.
  if(cache.count>r.events.length){cache.player=timeline(r.events);cache.count=r.events.length}
  for(let i=cache.count;i<r.events.length;i++){
    const event=r.events[i],last=cache.player.at(-1);
    if(last&&event.t<last.t){cache.player=timeline(r.events);break}
    cache.player.push({t:event.t,sum:(last?.sum||0)+event.amount,residual:(last?last.residual*Math.exp(-(event.t-last.t)/.4):0)+event.amount});
  }
  cache.count=r.events.length;
  return cache;
}
export function metrics(r,t) {
  const time=clamp(t,0,DURATION),cache=cachedMetrics(r),player=sampleTimeline(cache.player,time);
  const rivals=r.rivals.map((rival,index)=>{const target={...rival,...sampleTimeline(cache.rivals[index],time)};target.lead=player.distance-target.distance;return target});
  const opponent=rivals[0],leader=rivals.reduce((a,b)=>a.distance>=b.distance?a:b),lead=player.distance-leader.distance;
  return{player,opponent,rivals,leader,lead,gap:lead/12,rank:1+rivals.filter(rival=>rival.distance>player.distance+.12).length};
}
export function totals(r){return r.stats.reduce((a,s)=>{for(const k of Object.keys(a))a[k]+=s[k];return a},{perfect:0,good:0,miss:0,stray:0,rescued:0,bonus:0})}
