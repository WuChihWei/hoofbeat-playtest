import {compositionRivals} from './race-composition.mjs?v=r357';
import {PRESENTATION as P,CONTROL_LAYOUT} from './presentation-config.mjs?v=r357';
import {SLICE_RIVALS,sectionAt} from './playable/slice-config.mjs?v=r357';
const anchor=a=>`left:${a.center[0]*100}%;top:${a.center[1]*100}%;width:${a.size[0]*100}%;height:${a.size[1]*100}%;transform:translate(-50%,-50%);right:auto;min-width:0;`;
// Five rows: two lines each (name, gap), growing down from the same top edge.
const top=a=>`left:${a.center[0]*100}%;top:${(a.center[1]-a.size[1]/2)*100}%;width:${a.size[0]*100}%;transform:translateX(-50%);right:auto;min-width:0;`;
// Race look HUD (the race concept art): a galloping horse over each leg of the progress bar (run / running / to come),
// a knob on the bar and a chequered flag at the end; ranking rows show the horse each team is riding now.
const FLAG=`<svg class="flag" viewBox="0 0 20 24" aria-hidden="true"><rect x="1" y="1" width="2" height="22" rx="1" fill="#fff"/>${[0,1,2].flatMap(r=>[0,1,2,3].map(c=>`<rect x="${3+c*4}" y="${2+r*4}" width="4" height="4" fill="${(r+c)%2?'#1c1c22':'#fff'}"/>`)).join('')}</svg>`;
const headSrc=coat=>`assets/stable/buddy_${coat}.webp?v=coats-4`;
// The whole track at a glance (instead of announcing the ground ahead): under the bar a strip of the course's ground
// (straight / bend / mud) with a tick at each hurdle, and on the bar a dot per rival (its shirt colour) beside the
// player's knob.
const RUNNER_COLOR={pacer:'#3fae5a',chaser:'#ff5fa2',hazel:'#ff9a3c',rio:'#3f8fe0',sage:'#9b6bff'},GROUND={straight:'#f1e2b0',curve:'#58c7ff',mud:'#8a5a34'};
// rivals: the race's rival teams [{id, name}] (a ranking row each, plus YOU).
export function raceHudMarkup(rivals=SLICE_RIVALS){const rows=[...rivals.map(r=>[r.id,r.name.toUpperCase()]),['player','YOU']],n=rows.length;return `
<header class="slice-hud">
 <button style="${anchor(P.hud.pause)}" id="slice-pause" aria-label="暫停">Ⅱ</button>
 <div class="hud-lap" style="${anchor(P.hud.lap)}"><span id="slice-terrain">LEG</span><b id="slice-leg">1/3</b></div>
 <div class="slice-progress" style="${anchor(P.hud.progress)}"><svg class="trackmap" viewBox="0 0 116 40" aria-hidden="true"></svg><progress id="slice-progress" max="360" value="0" aria-label="賽段進度"></progress><i class="terrain"></i>${rivals.map(r=>`<i class="runner" data-runner="${r.id}" style="--c:${RUNNER_COLOR[r.id]||'#c9c9c9'}"></i>`).join('')}<b class="knob"></b>${FLAG}</div>
 <div class="hud-coins" style="${anchor(P.hud.coins)}"><i class="ui-coin" aria-hidden="true">U</i><b id="slice-coins">0</b></div>
 <div class="hud-position" style="${anchor(P.hud.position)}"><span>POSITION</span><b id="slice-position">${n}/${n}</b></div>
<div class="hud-ranking${n>3?' crowd':''}" style="${n>3?top(P.hud.ranking):anchor(P.hud.ranking)}" aria-label="即時排名">${rows.map(([id,name],i)=>`<div data-rank-row="${id}" class="ranking-row" title="${name}"><b>${i+1}</b><img class="rank-horse" alt=""><span>${name}</span><small class="race-gap"></small><progress max="360" value="0"></progress></div>`).join('')}</div>
</header>`;}
export const hoof=`<svg class="hoof-symbol" viewBox="0 0 100 100" aria-hidden="true"><path fill="currentColor" stroke="var(--hoof-highlight)" stroke-width="2" d="M22 25C17 38 15 52 18 67C21 83 34 91 50 91S79 83 82 67C85 52 83 38 78 25C76 19 69 17 64 22C60 26 62 31 64 37C67 45 69 54 68 62C67 72 60 78 50 78S33 72 32 62C31 54 33 45 36 37C38 31 40 26 36 22C31 17 24 19 22 25Z"/><circle cx="28" cy="58" r="2.4" fill="var(--hoof-cut)"/><circle cx="72" cy="58" r="2.4" fill="var(--hoof-cut)"/></svg>`;
const BOLT='<svg class="charge-bolt" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>';
// The controls: each hoof is a slider knob (tap = rhythm, slide outward = lane change, springs back; both hoofs = jump)
// on its track; the charge button (outer ring: stored segments, inner ring: the next one filling; tap = sprint, or a
// leap right behind a horse); lane dots (where the horse is).
export function raceControlsMarkup(){return `<footer class="slice-controls">
${['left','right'].map((side,i)=>`<div style="${anchor(CONTROL_LAYOUT.tracks[side])}" class="slide-track ${side}" data-side="${i}" aria-hidden="true"><i></i></div>`).join('')}
${['left','right'].map((side,i)=>`<button style="${anchor(P.controls[side])}" id="slice-${side}" class="slice-pad ${side} rhythm-foot" aria-label="${i?'右腳印：點一下踩拍（鍵盤 N），往右滑換道（→）':'左腳印：點一下踩拍（鍵盤 X），往左滑換道（←）'}；兩個腳印同按跳躍">${hoof}</button>`).join('')}
<div style="${anchor(CONTROL_LAYOUT.lanes)}" class="lane-dots" aria-hidden="true"><i></i><i class="on"></i><i></i></div>
<button style="${anchor(CONTROL_LAYOUT.charge)}" id="slice-charge" class="charge-btn" aria-label="蓄力衝刺（空白鍵）"><svg class="charge-rings" viewBox="0 0 100 100" aria-hidden="true"><g class="segs"></g><circle class="inner-track" cx="50" cy="50" r="36"/><circle class="inner-fill" cx="50" cy="50" r="36" pathLength="100"/></svg>${BOLT}<b class="charge-count">0</b><i class="stamina" aria-hidden="true"><i></i></i></button>
<div style="${anchor(CONTROL_LAYOUT.guides.jump)}" class="control-guide jump-guide" aria-label="兩個腳印同按，跳躍">${hoof}<span class="guide-plus">+</span>${hoof}<span class="guide-equals">=</span><b>JUMP</b></div>
<div id="slice-speed" class="sr-only" role="status" aria-label="目前速度">速度 12.0</div>
<span id="slice-energy" class="sr-only" role="status">蓄力 0 段</span>
</footer>`;}
// energy: the charge; cap: the most this horse stores; cost: one segment (one sprint). stamina: 0–1 of the bar over
// the button; tired: not enough of it for a sprint (the button dims, the bar turns red).
export function updateEnergyControls(energy,cap=100,active=false,drafting=false,cost=50,stamina=1,tired=false){
 const b=document.getElementById('slice-charge');if(!b)return;
 const st=Math.round(stamina*100);if(b.dataset.st!==String(st)){b.dataset.st=st;b.style.setProperty('--stamina',st);}b.classList.toggle('tired',tired);
 const n=Math.max(1,Math.round(cap/cost)),have=Math.min(n,Math.floor(energy/cost+1e-9)),part=have>=n?1:(energy-have*cost)/cost;
 if(b.dataset.n!==String(n)){b.dataset.n=n;const gap=4,len=100/n-gap;   // one arc per segment the horse can store
  b.querySelector('.segs').innerHTML=Array.from({length:n},(_,i)=>`<circle cx="50" cy="50" r="46" pathLength="100" stroke-dasharray="${len} ${100-len}" stroke-dashoffset="${-(i*100/n)-gap/2}"/>`).join('');}
 b.querySelectorAll('.segs circle').forEach((c,i)=>c.classList.toggle('on',i<have));
 const p=(part*100).toFixed(0);if(b.dataset.part!==p){b.dataset.part=p;b.style.setProperty('--part',p);}text(b.querySelector('.charge-count'),String(have));
 b.classList.toggle('ready',have>0&&!active);b.classList.toggle('full',have>=n);b.classList.toggle('sprinting',active);b.classList.toggle('drafting',drafting&&!active);
 text(document.getElementById('slice-energy'),`蓄力 ${have}／${n} 段，體力 ${st}%${have&&!active?tired?'，體力不足':'，按蓄力鈕衝刺':''}`);
}

// Written only when it changed: these run every frame, and rewriting text re-lays out the page (phones). Compared with
// what was last written, not with the page: in English the page holds the translation (i18n.js), which never equals v.
const text=(el,v)=>{if(el&&el.shown!==v)el.textContent=el.shown=v;};
// Presentation of existing runner distances only; never updates the simulation.
// The track map (a course with an outline: a city's lap, courses.mjs): the lap as a line, the chequered flag at the line,
// the handoffs, the mud, and a dot each for the rivals, the best run's ghost (solo) and the player. It takes the bar's
// place; the bar is left for the practice course, which has no lap. Drawn once a race (drawMap), then the dots move.
const MAP={w:116,h:40,pad:6};
function drawMap(svg,course,rivals){
  const O=course.outline,n=O.length,L=course.lapLength,xs=O.map(p=>p[0]),zs=O.map(p=>p[1]),mid=a=>(Math.min(...a)+Math.max(...a))/2,span=a=>Math.max(...a)-Math.min(...a)||1;
  const side=span(zs)>span(xs),k=Math.min((MAP.w-2*MAP.pad)/(side?span(zs):span(xs)),(MAP.h-2*MAP.pad)/(side?span(xs):span(zs)));   // a tall lap lies on its side (turned a quarter): the box is wide
  const pts=O.map(([x,z])=>side?[MAP.w/2+(mid(zs)-z)*k,MAP.h/2+(x-mid(xs))*k]:[MAP.w/2+(x-mid(xs))*k,MAP.h/2+(z-mid(zs))*k]),f=v=>v.toFixed(1);
  const at=d=>{const u=((d%L)+L)%L/L*n,i=Math.floor(u)%n,t=u-Math.floor(u),a=pts[i],b=pts[(i+1)%n];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
  const loop='M'+pts.map(p=>f(p[0])+' '+f(p[1])).join('L')+'Z';
  // the mud of one lap (it differs lap to lap: the stretches are shares of the whole race)
  const mud=lap=>{let d='';for(let i=0;i<n;i++){const s=i*L/n+lap*L;if((course.mud||[]).some(([a,b])=>s>=a&&s<=b))d+=`M${f(pts[i][0])} ${f(pts[i][1])}L${f(pts[(i+1)%n][0])} ${f(pts[(i+1)%n][1])}`;}return d;};
  const [fx,fy]=pts[0],flag=[0,1,2].flatMap(r=>[0,1,2].map(c=>`<rect x="${f(fx+.5+c*2.6)}" y="${f(fy-11+r*2.1)}" width="2.6" height="2.1" fill="${(r+c)%2?'#fff':'#14202e'}"/>`)).join('');
  svg.innerHTML=`<path class="case" d="${loop}"/><path class="road" d="${loop}"/><path class="mud" d=""/>`+
    (course.relays||[]).map(r=>{const [x,y]=at(r);return `<circle class="hand" cx="${f(x)}" cy="${f(y)}" r="1.6"/>`;}).join('')+
    `<path class="pole" d="M${f(fx)} ${f(fy)}V${f(fy-11)}"/>${flag}`+
    rivals.map(r=>`<circle class="dot" data-dot="${r.id}" r="2.3" fill="${RUNNER_COLOR[r.id]||'#c9c9c9'}"/>`).join('')+
    '<circle class="dot ghost" data-dot="ghost" r="2.3" visibility="hidden"/><circle class="dot me" data-dot="player" r="3"/>'+
    `<text class="leg" x="${MAP.w/2}" y="${MAP.h/2}"></text>`;   // which leg, in the middle of the lap (relay; 2026-10-04: it was a chip beside the map)
  svg.at=at;svg.mud=mud;svg.leg=svg.querySelector('.leg');svg.dots=Object.fromEntries([...svg.querySelectorAll('[data-dot]')].map(c=>[c.dataset.dot,c]));
}
// The progress bar's knob (--p: 0–1 of the course), the rivals' dots and the terrain strip; or the track map's dots.
export function updateProgress(race,metrics=null){
 const bar=document.querySelector('.slice-progress');if(!bar)return;
 const L=race.config?.length||1,strip=bar.querySelector('.terrain'),map=bar.querySelector('.trackmap'),lap=race.course?.outline?race.course.id+L:'';
 if(map&&map.dataset.course!==lap){map.dataset.course=lap;map.dataset.lap='';bar.classList.toggle('has-map',!!lap);if(lap)drawMap(map,race.course,metrics?.rivals||[]);else map.innerHTML='';}
 if(lap){const put=(id,d)=>{const c=map.dots[id];if(!c)return;const [x,y]=map.at(d),k=x.toFixed(1)+' '+y.toFixed(1);if(c.dataset.k!==k){c.dataset.k=k;c.setAttribute('cx',x.toFixed(1));c.setAttribute('cy',y.toFixed(1));}};
  for(const r of metrics?.rivals||[])put(r.id,r.distance);put('player',race.distance);
  // In the middle of the map: the relay's leg, or the solo run's lap (when it has more than one).
  const laps=race.course.laps,leg=race.config?.solo?(laps>1?`${Math.min(laps,Math.floor(race.distance/race.course.lapLength)+1)}/${laps}`:''):`${race.leg+1}/3`;if(map.dataset.leg!==leg){map.dataset.leg=leg;map.leg.textContent=leg;}
  const lapNo=String(Math.min(race.course.laps-1,Math.floor(race.distance/race.course.lapLength)));if(map.dataset.lap!==lapNo){map.dataset.lap=lapNo;map.querySelector('.mud').setAttribute('d',map.mud(+lapNo));}
  const ghost=bar.querySelector('.marks .ghost'),g=map.dots.ghost;   // the best run's ghost: slice-app keeps its place on the bar (left: % of the course)
  if(ghost&&ghost.style.left){put('ghost',parseFloat(ghost.style.left)/100*L);if(g.getAttribute('visibility'))g.removeAttribute('visibility');}
  return;}
 if(strip&&race.course&&strip.dataset.course!==race.course.id+L){strip.dataset.course=race.course.id+L;   // once per race
  const stops=[];let from=0,kind=sectionAt(0,race.course).kind;
  for(let i=1;i<=200;i++){const k=i<200?sectionAt(L*i/200,race.course).kind:null;if(k!==kind){stops.push(`${GROUND[kind]} ${from/2}% ${i/2}%`);from=i;kind=k;}}
  const ticks=(race.marks?.hurdles||[]).map(h=>{const x=(h/L*100).toFixed(1);return `linear-gradient(90deg,transparent calc(${x}% - 1px),#fff calc(${x}% - 1px) calc(${x}% + 1px),transparent calc(${x}% + 1px))`;});
  strip.style.background=[...ticks,`linear-gradient(90deg,${stops.join(',')})`].join(',');}
 for(const r of metrics?.rivals||[]){const dot=bar.querySelector(`[data-runner="${r.id}"]`),x=(Math.min(1,r.distance/L)*100).toFixed(1);if(dot&&dot.dataset.x!==x){dot.dataset.x=x;dot.style.left=x+'%';}}
 const p=Math.min(1,race.distance/(race.config?.length||1)).toFixed(3);if(bar.dataset.p!==p){bar.dataset.p=p;bar.style.setProperty('--p',p);}
}
export function updateCompositionRanking(race,metrics){
 const coatOf=(horses,leg)=>horses?.[Math.min(leg??0,horses.length-1)]?.coat;
 const runners=[{id:'player',distance:metrics.player.distance,finishTime:metrics.player.finishTime,coat:coatOf(race.horses,race.leg)},...compositionRivals(race,metrics).map(r=>({...r,coat:coatOf(r.horses,r.leg)}))].sort((a,b)=>b.distance-a.distance||(a.finishTime??Infinity)-(b.finishTime??Infinity));
 const host=document.querySelector('.hud-ranking');if(!host)return;
 runners.forEach((r,i)=>{
  const row=host.querySelector(`[data-rank-row="${r.id}"]`);if(!row)return;
  if(row.style.order!==String(i))row.style.order=i;text(row.querySelector('b'),String(i+1));
  const img=row.querySelector('.rank-horse'),coat=r.coat;if(img&&coat!==undefined&&img.dataset.coat!==String(coat)){img.dataset.coat=coat;img.src=headSrc(coat);}
  const progress=row.querySelector('progress'),max=race.config?.length||360,v=Math.round(r.distance);if(progress.max!==max)progress.max=max;if(progress.value!==v)progress.value=v;
  const gap=r.distance-metrics.player.distance,indicator=row.querySelector('.race-gap');
  text(indicator,r.id==='player'?'':`${gap>=0?'+':'−'}${Math.abs(gap).toFixed(Math.abs(gap)<10?1:0)}m`);   // short: it shares the row with the horse head
  row.classList.toggle('is-close',r.id!=='player'&&Math.abs(gap)<6);
  row.classList.toggle('is-player',r.id==='player');
 });
}
