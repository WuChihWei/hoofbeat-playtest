import {raceHudMarkup,raceControlsMarkup,updateEnergyControls} from '../race-hud.js?v=r551';
import {relayCourse,soloCourse} from '../course/courses.mjs?v=r551';
import {WEATHER} from './progress.mjs?v=r551';
import {esc,icon,brand,wallet,chest} from '../ui/ui.js?v=r551';
import {compositionRank} from '../race-composition.mjs?v=r551';
import {ChaseRenderer} from '../race-scene.js?v=r551';
import {preloadPresentation,preloadModels,preloadBuddies,loadState,loadsSettled} from '../approved-assets.js?v=r551';
import {cityModels} from '../approved-environment.js?v=r551';
import {RaceClock} from '../race-session.js';
import {SliceGame,DEFAULT_TEAM} from './slice-game.mjs?v=r551';
import {RaceAudio} from '../audio.js?v=r551';
import {addLog,raceEntry} from '../playtest.js?v=r551';
import {SLICE_CONFIG,EASY_CHART,TERRAIN_NAME,SOLO,fieldRivals,sectionAt,MVP} from './slice-config.mjs?v=r551';

// onExit(result|null, dest) returns to the app shell: dest 'home', 'race' (the horse step), 'stable', or {city} (the
// level this run opened). `tag` labels the covers. getBrief() → {title, goal, stars, missions: [text], target} for the
// start card; getGhost() → the best run's trace (solo: metres every GHOST_STEP simulation s) or null. lean: a player
// past the first few races: far fewer words on screen (only the big moments get text; the rest is shown by colour,
// shape and sound).
// team: the three relay horses in leg order [{id, name, coat, type}]; getForm() → {config, notes} is the stable's race
// form, read again for every run (stable-care relayForm); onFinish(result) → {total, newBest, xp, level, levelUp}.
// Rivals (slice-config SLICE_RIVALS): team i+1 rides variant i+1 (its shirt colour) and has rider portrait i+1.
// The field: five horses; ?field=3 in the page URL races the three-horse field (player + Willow + Luna) to compare.
const RIVALS=fieldRivals(new URLSearchParams(location.search).get('field')==='3'?3:5);
const TYPE_NAME={straight:'直線型',curve:'彎道型',mud:'泥地型'},GAIT_NAME=['小跑步','大跑步','奔跑'];   // GAIT_NAME: slice-game gait()
// How to play: four picture cards on the start cover, one every 2 s (tap to skip ahead).
const HOW=[   // the ball game (2026-10-11: the cards still taught the rhythm game it replaced on 2026-10-07)
  ['<i class="how-key">●</i>','按住圓球蓄力，放開就衝','越接近白圈放開越快 · 壓過頭會爆掉'],
  ['<i class="how-key">‹</i><i class="how-key">›</i>','左右滑換道，往上滑跳欄','圓球會跟著手指'],
  ['<i class="how-key">🍎</i>','吃到蘋果存一段衝刺','按 ⚡ 用掉'],
  ['<i class="how-key">撞</i>','放得漂亮就存一格撞擊','對手並排時按：撞牠 · 在正後方：踢牠'],
];
// ?auto=<share> in the page URL (testing and demos): that share of the notes is hit for you, hurdles are jumped;
// the charge button stays yours.
const AUTO=+new URLSearchParams(location.search).get('auto')||0;
// ease (home.js: progress.mjs eased): three losses in a row on this stage: the rivals a step slower. intro: the first
// run of the first stage with rammers: none for 15 s, and each takes a second longer. (A settings row, 對手強度 1–5, scaled
// every rival's speed for a day of playtests, 2026-10-11: 3, the game as tuned, played best and the row went.)
const GHOST_STEP=.5,HAND='hoofbeat.hand.v1';   // HAND: 'left' puts the charge button on the left
// The apple as a drawing (an emoji is not drawn on every phone).
const APPLE='<svg class="apple-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#ff5a48" d="M12 8c-3-2-7 0-7 5s3 8 5 8c1 0 1-.6 2-.6s1 .6 2 .6c2 0 5-3 5-8s-4-7-7-5z"/><path fill="#7ac74f" d="M12 8c0-2 1-4 3-4 0 2-1 4-3 4z"/></svg>';
// Touch feedback: the phone's own haptics in the iOS app (Capacitor Haptics; web pages cannot vibrate an iPhone), the
// Vibration API elsewhere. kind: tap · hit · strong · good (a reward) · bad.
const BUZZ={tap:['impact',{style:'LIGHT'},12],hit:['impact',{style:'MEDIUM'},22],strong:['impact',{style:'HEAVY'},[25,30,25]],good:['notification',{type:'SUCCESS'},[10,20,10]],bad:['notification',{type:'ERROR'},30]};
const buzz=kind=>{const [method,options,pattern]=BUZZ[kind],native=window.Capacitor?.isNativePlatform?.()&&window.Capacitor.nativePromise;
  if(native)native('Haptics',method,options).catch(()=>{});else navigator.vibrate?.(pattern);};
export async function startSlice({onExit,tag='ZOOMBUD',city=null,team=DEFAULT_TEAM.map(h=>({...h,name:'Buddy'})),getForm=null,onFinish=null,getBest=null,getBrief=null,getGhost=null,lean=false,relay=false,ease=false,intro=false,thumb=false,arrows=null,perks=null,rivalCount=0,stage:level=null}={}){   // getBest() → the record to beat on this track (simulation s) or null
  const TEMPO=level?.tempo??SLICE_CONFIG.tempo,BALL=/[?&]ball=([\d.,]+)/.exec(location.search)?.[1].split(',').map(Number)||[1],   // 2026-10-07 (the user: 「就改成這遊戲方法」): the ball is the game; ?ball=1,fill,fall,pop (real seconds) tunes it
  locks={...level?.locks};
  const solo=true,rivals=relay?RIVALS:fieldRivals(rivalCount+1),field=rivals.length>0,   // solo (單騎): team is the one horse [{id, name, coat, type, stats}], the SOLO rules, rivalCount (0, 1, 2 or 4) rivals on one buddy each by the same rules; field: there is a place to run for
    rivalName=id=>rivals.find(r=>r.id===id)?.name??'你';
  const ac=new AbortController(),on={signal:ac.signal};
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./slice.css?v=r551',import.meta.url);document.head.append(css);
  await new Promise(r=>{css.onload=css.onerror=r;});   // the page is swapped only once the race's styles are in: without them it was one black frame between the pick page and the race (2026-10-06, seen in a screen recording)
  const app=document.querySelector('#app');
  const lefty=(()=>{try{return localStorage.getItem(HAND)==='left'}catch{return false}})(),touch=matchMedia('(pointer: coarse)').matches,info=getBrief?.()??null;
  app.innerHTML=`<main class="slice-shell ui-root ui-live is-ready${solo?' is-solo':''}${lefty?' lefty':''}${lean?' lean':''}${locks.lane?' no-lanes':''}${arrows?.lane?' hint-lane':''}${arrows?.jump?' hint-jump':''}${locks.sprint?' no-sprint':''}${BALL?' is-ball':''}" style="background-image:url(assets/backdrops/${city||'taipei'}.webp${new URL(import.meta.url).search})"><canvas id="slice-canvas" aria-label="ZOOMBUD 三車道賽道"></canvas>
    ${raceHudMarkup(rivals)}
    <i id="slice-flash" aria-hidden="true"></i><i id="slice-dizzy" aria-hidden="true" hidden>💫</i><div id="slice-feedback" aria-live="polite"></div><div id="slice-count" aria-live="assertive"></div>${field?'<div id="slice-rank"><b></b><small></small></div>':''}<div id="slice-goal" hidden></div>${solo?`<div id="slice-apples" hidden>${APPLE}<b>0</b></div>`:''}<div id="slice-final-call" hidden></div><div id="slice-chase" hidden></div><i id="chase-left" class="chase-edge" hidden>‹</i><i id="chase-right" class="chase-edge" hidden>›</i><div id="slice-jump-hint"></div>
    ${raceControlsMarkup()}
    <div id="slice-result" hidden></div><div id="slice-cover"><button id="slice-back" class="ui-icon-btn cover-back" aria-label="返回">${icon('back','')}</button><button id="slice-help" class="ui-icon-btn cover-help" aria-label="玩法說明" aria-expanded="false">?</button>
      <section><small>${esc(info?.title??tag)}</small><h1>${esc(info?.goal??(relay?'三棒接力':'單騎練跑'))}</h1>
        ${info&&solo&&!relay?`<p class="cover-stars" role="img" aria-label="${info.stars} 顆星">${[0,1,2].map(k=>`<i class="${k<info.stars?'on':''}">★</i>`).join('')}</p>`:''}
        ${info?.missions?`<details class="cover-fold" ${lean?'':'open'}><summary>這場的任務 ×${info.missions.length}</summary><ul class="cover-missions">${info.missions.map(m=>`<li>${esc(m)}</li>`).join('')}</ul></details>`:''}
        <div class="how-wrap" hidden>${howTo()}${touch?'':'<p class="slice-keys">鍵盤：空白鍵 衝刺 · Esc 暫停</p>'}</div><p class="slice-form" hidden></p>
        <button id="slice-start" class="ui-btn primary block" disabled>準備中…</button></section></div></main>`;
  const $=id=>document.getElementById(id),clock=new RaceClock(),shell=document.querySelector('.slice-shell');
  const chargeBtn=$('slice-charge'),allControls=[chargeBtn];
  if(solo)document.querySelector('.hud-position').className='hud-position idle';   // no place to show; the chip shows only once there is a pace to compare with (below)
  const sound=new RaceAudio();
  // Times are shown in wall-clock seconds (simulation seconds / tempo), as the player felt them.
  const wall=t=>{const s=t/TEMPO;return `${Math.floor(s/60)}:${(s%60).toFixed(2).padStart(5,'0')}`;},secs=t=>(Math.abs(t)/TEMPO).toFixed(2);
  if(AUTO)window.__hb={get game(){return game;},get renderer(){return renderer;},get phase(){return phase;}};   // the self-playing check only: lets a test place a rival and read what happened
  let game,renderer,phase='ready',feedbackUntil=0,bigUntil=0,seen=0,frameId,finalTen=false,peak=0;
  let runs=0,streak=0,gaitShown=0,countShown=null,landAt=0,landClear=false,wasCarried=false,resultTimer=0;
  let trace=[],ghost=null,target=null,leading=null,passAt=0,lostAt=-9,hurry=-1,resumeTimer=0;   // trace: this run's metres every GHOST_STEP; ghost: the best run's; target: the time for the next star
  // Playtest log (playtest.js): each run once, as it ends: finished, left, or restarted part-way.
  const logRun=result=>{if(!game||game.logged)return;game.logged=true;
    addLog(raceEntry(game,result,{city,mode:solo&&!relay?'solo':'relay',eased:ease,team:team.map(h=>h.name),fps:renderer?.frameAverage?Math.round(1000/renderer.frameAverage):null,perf:perfLog()}));};
  const midRace=()=>['running','paused','countdown'].includes(phase);
  const cover=$('slice-cover');let howTimer=0;
  function howTo(){const how=HOW;
        return `<div class="how" role="group" aria-label="玩法">${how.map(([art,t,sub],i)=>`<div class="how-card${i?'':' on'}"><div class="how-art">${art}</div><b>${t}</b><small>${sub}</small></div>`).join('')}
      <div class="how-dots">${how.map((_,i)=>`<button aria-label="第 ${i+1} 張" class="${i?'':'on'}"></button>`).join('')}</div></div>`;
  }
  function startHow(){
    const cards=[...cover.querySelectorAll('.how-card')],dots=[...cover.querySelectorAll('.how-dots button')];let at=0;
    const show=i=>{at=(i+cards.length)%cards.length;cards.forEach((c,k)=>c.classList.toggle('on',k===at));dots.forEach((d,k)=>d.classList.toggle('on',k===at));};
    dots.forEach((d,i)=>d.onclick=()=>{show(i);restart();});cover.querySelector('.how')?.addEventListener('click',e=>{if(!e.target.closest('button')){show(at+1);restart();}});
    const restart=()=>{clearInterval(howTimer);howTimer=setInterval(()=>show(at+1),2000);};restart();
  }
  // The top line is for the big moments (0.9 s, with a pop; tone: its colour). A hint (tone 'hint', 0.5 s) never takes
  // one over.
  // keep: a moment big enough to be written even for a lean HUD.
  function feedback(text,tone='',keep=false){
    const now=clock.elapsed(),hint=tone==='hint',el=$('slice-feedback');if(lean&&!keep||hint&&now<bigUntil)return;
    el.textContent=text;el.className=tone;feedbackUntil=now+(hint?.5:.9);
    if(!hint)bigUntil=feedbackUntil;   // a subtitle (slice.css): no pop
  }
  // A full-screen edge flash (sprint: lime, apple: red, the finish: white).
  // The picture shudders (a kick, a shove landing): the canvas only, the HUD holds still.
  function shake(px=7,ms=280){if(still)return;shell.querySelector('canvas')?.animate([{translate:'0 0'},{translate:`${px}px ${-px*.5}px`},{translate:`${-px}px ${px*.4}px`},{translate:`${px*.5}px ${px*.3}px`},{translate:'0 0'}],{duration:ms,easing:'ease-out'});}
  const pop=el=>el?.animate([{scale:1},{scale:.82,offset:.25},{scale:1.22,filter:'brightness(1.5)',offset:.55},{scale:1,filter:'none'}],{duration:320,easing:'ease-out'});
  // The rival hit sees stars (2026-10-10, the user: 「被撞的可能簡單的動畫頭上有💫暈眩」): one emoji turning over its head for DAZE s,
  // placed every frame from where that runner is (race-scene screenOfRunner).
  const DAZE=1.8;let daze=null;const dazed=id=>{if(id==null)return;daze={id,until:performance.now()+DAZE*1000};$('slice-dizzy').hidden=false;};
  function dazeFrame(){const el=$('slice-dizzy');if(!daze)return;if(performance.now()>daze.until||game.finished){daze=null;el.hidden=true;return;}
    const r=daze.id==='player'?game:game.rivals.find(x=>x.id===daze.id);if(!r)return;const p=renderer.screenOfRunner(r.laneValue,r.distance-game.distance,r===game?4.2:2.6,game.config.laneSpacing);el.hidden=p.behind;el.style.translate=`${p.x}px ${p.y}px`;}
  function flash(colour,peak=.4,ms=240){if(still)return;const el=$('slice-flash');el.style.setProperty('--c',colour);el.animate([{opacity:peak},{opacity:0}],{duration:ms,easing:'ease-out'});}
  // The big centre text: the countdown, GO!, FINISH.
  function banner(text,kind='',ms=900){const el=$('slice-count');el.textContent=text;el.className=kind;
    el.animate(still?[{opacity:1},{opacity:1,offset:.8},{opacity:0}]:[{opacity:1,scale:1.6},{opacity:1,scale:1,offset:.28},{opacity:1,scale:1,offset:.8},{opacity:0,scale:1}],{duration:ms,easing:'ease-out'});}
  // The HUD is written only where a value changed: rewriting it every frame re-laid out the page every frame on phones.
  const shown=new WeakMap(),put=(el,key,v)=>{const o=shown.get(el)??{};if(o[key]===v)return;o[key]=v;shown.set(el,o);
    if(key==='text')el.textContent=v;else if(key in el)el[key]=v;else el.style.setProperty(key,v);};
  // Frame timing for the playtest log (ms): work = this page's frame (simulation, HUD, draw), draw = the renderer's part.
  const perf={n:0,work:0,draw:0,gap:0,last:0},perfLog=()=>perf.n?{workMs:+(perf.work/perf.n).toFixed(1),drawMs:+(perf.draw/perf.n).toFixed(1),frameMs:+(perf.gap/perf.n).toFixed(1)}:null;
  // Coin pickup (race-scene 'coin-burst', screen point): a coin flies from there to the HUD counter, "+10" floats up,
  // the counter pops as it lands.
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(/[?&]demo\b/.test(location.search))import('../_demo.js').catch(()=>{});   // dev: a run that plays itself, for recordings (_demo.js, not published)
  if(/[?&](debug|demo)\b/.test(location.search))window.__slice={get game(){return game;},get renderer(){return renderer;},dazed:id=>dazed(id)};   // dev
  function coinFly({x,y}){
    const shell=document.querySelector('.slice-shell'),pill=$('slice-coins').parentElement,s=shell.getBoundingClientRect(),t=pill.getBoundingClientRect();
    const plus=document.createElement('b');plus.className='coin-plus';plus.textContent=`+${game.config.coinValue}`;plus.style.cssText=`left:${x}px;top:${y}px`;shell.append(plus);
    plus.animate([{opacity:0,translate:'-50% -30%'},{opacity:1,translate:'-50% -90%',offset:.25},{opacity:0,translate:'-50% -220%'}],{duration:700,easing:'ease-out'}).onfinish=()=>plus.remove();
    setTimeout(()=>{plus.remove();fly?.remove();},1500);   // also when animations are held (a hidden page)
    const pop=()=>pill.animate([{scale:1},{scale:1.18,offset:.4},{scale:1}],{duration:260,easing:'ease-out'});
    let fly=null;if(still){pop();return;}
    fly=document.createElement('i');fly.className='ui-coin coin-fly';fly.textContent='U';fly.style.cssText=`left:${x}px;top:${y}px`;shell.append(fly);
    const dx=t.left+t.height/2-s.left-x,dy=t.top+t.height/2-s.top-y;
    fly.animate([{transform:'translate(-50%,-50%) scale(1.3)'},{transform:`translate(calc(-50% + ${dx*.35}px),calc(-50% + ${dy*.2-40}px)) scale(1.1)`,offset:.35},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.6)`}],
      {duration:520,easing:'cubic-bezier(.3,.1,.4,1)'}).onfinish=()=>{fly.remove();pop();};
  }
  // Strong cues only for a real sprint or a completed pass (the rank actually changed): the place badge pops.
  const popPlace=()=>($('slice-rank')??$('slice-position').parentElement).animate([{scale:1},{scale:1.22,offset:.35},{scale:1}],{duration:380,easing:'ease-out'});
  // When the best run here (ghost: its metres every GHOST_STEP simulation s) was at distance d; with no ghost, when
  // the pace of the next star (target) is; null with neither.
  const paceAt=d=>{
    if(ghost){const k=ghost.findIndex(x=>x>=d);if(k<0)return ghost.length*GHOST_STEP;if(k===0)return 0;const a=ghost[k-1],b=ghost[k];return (k-1+(b>a?(d-a)/(b-a):0))*GHOST_STEP;}
    return target?target*d/game.config.length:null;};
  // The rider looks toward the nearest rival (one passed, or passing).
  // The run in four quarters against the best run's (its ghost): wall seconds behind (+) or ahead (−) in each, or null.
  const splits=()=>{if(!ghost)return null;const L=game.config.length,when=(a,d)=>{const k=a.findIndex(x=>x>=d);if(k<=0)return k?a.length*GHOST_STEP:0;return (k-1+(d-a[k-1])/((a[k]-a[k-1])||1))*GHOST_STEP;};
    const mine=[...trace,L],at=[0,.25,.5,.75,1].map(q=>[q<1?when(mine,q*L):game.finishTime,when([...ghost,L],q*L)]);
    return [1,2,3,4].map(i=>+(((at[i][0]-at[i-1][0])-(at[i][1]-at[i-1][1]))/TEMPO).toFixed(1));};
  const mark=cls=>{const m=shell.querySelector('.slice-progress .marks');if(m&&m.childElementCount<90)m.insertAdjacentHTML('beforeend',`<i class="${cls}" style="left:${(game.distance/game.config.length*100).toFixed(1)}%"></i>`);};
  function tick(t){
    if(phase!=='running')return;
    game.advance(Math.max(0,t));
    if(AUTO){const h=game.hurdles.find(h=>!h.state&&h.distance>game.distance);
      if(h&&(h.distance-game.distance)/game.speed<=game.config.jumpLead&&!(game.jumps.at(-1)?.t>game.time-1))game.jump(t);}
  }
  // Cover card: title, text, optional stats [[label,value]], then buttons [label, action, kind?] (first = primary).
  function renderCover(title,text,buttons,stats=[]){
    clearInterval(howTimer);cover.hidden=false;cover.innerHTML='<section><small></small><h1></h1><p></p><dl class="cover-stats"></dl><div class="cover-actions"></div></section>';
    cover.querySelector('small').textContent=info?.title??tag;cover.querySelector('h1').textContent=title;cover.querySelector('p').textContent=text;
    const dl=cover.querySelector('dl');dl.hidden=!stats.length;
    for(const [k,v] of stats){const d=document.createElement('div');d.innerHTML='<dt></dt><dd></dd>';d.querySelector('dt').textContent=k;d.querySelector('dd').textContent=v;dl.append(d);}
    buttons.forEach(([label,action,kind=''],i)=>{const b=document.createElement('button');b.textContent=label;b.className=`ui-btn ${i?kind.replace('confirm',''):'primary'}`;
      // 'confirm': giving the race up takes a second tap within 2 s
      b.onclick=kind.includes('confirm')?e=>{if(b.dataset.sure){action(e);return;}b.dataset.sure='1';b.textContent='再按一次';b.classList.add('danger');setTimeout(()=>{if(b.isConnected){delete b.dataset.sure;b.textContent=label;b.classList.remove('danger');}},2000);}:action;
      cover.querySelector('.cover-actions').append(b);});
    cover.querySelector('.cover-actions button')?.focus();
  }
  const toSetup=()=>exit('race'),toHome=()=>exit('home');
  let result=null;
  function exit(dest='race'){   // dest: 'race' | 'home' | 'stable' | {city}
    if(phase==='exited')return;if(midRace())logRun('quit');phase='exited';ac.abort();cancelAnimationFrame(frameId);sound.stop();
    renderer?.dispose();renderer=null;css.remove();onExit?.(result,dest);
  }
  function pause(){
    if(!['running','countdown'].includes(phase))return;
    const before=phase;tick((clock.elapsed()-SLICE_CONFIG.countdown)*TEMPO);
    clock.pause();sound.pause();phase='paused';game.paused=true;allControls.forEach(p=>p.classList.remove('pressed'));
    // Back in: two beats to find the rhythm again (the race, rivals included, stays frozen), then it runs on.
    const resume=async()=>{if(resumeTimer)return;cover.hidden=true;await sound.prepare();
      const run=()=>{resumeTimer=0;if(phase!=='paused')return;game.paused=false;clock.resume();sound.resume(()=>clock.elapsed());phase=before;};
      if(before!=='running'){run();return;}
      const beat=600/TEMPO;banner('2','',beat);sound.cue('approach');
      resumeTimer=setTimeout(()=>{banner('1','',beat);sound.cue('approach');resumeTimer=setTimeout(run,beat);},beat);};
    const soundLabel=()=>sound.muted?'音效：關':'音效：開',far=game.distance/game.config.length>.2?' confirm':'';   // past a fifth of the way: leaving asks twice
    renderCover('已暫停',`已跑 ${Math.round(game.distance/game.config.length*100)}% · ${wall(game.time)} · 金幣 ${game.coinCount}`,
      [['繼續',resume],['重跑',newRun,'secondary'+far],['換夥伴',toSetup,'secondary'+far],['離開',toHome,'secondary'+far],[soundLabel(),e=>{sound.setMuted(!sound.muted);e.target.textContent=soundLabel();},'secondary toggle']]);
  }
  // A run's weather (2026-10-12): drawn once when the stage is opened from what the stage allows (progress.mjs LEVELS
  // weather; a retry keeps it), 'sun' when it names none. It decides the sky (the renderer's city 'id~weather') and what
  // lies on the road (WEATHER: water or snow, how often). ?weather=snow (dev) picks it.
  const SKY=(()=>{const w=level?.weather||['sun'],asked=new URLSearchParams(location.search).get('weather');return WEATHER[asked]?asked:w[Math.floor(Math.random()*w.length)];})();
  // The hurdles of a stage whose road is new every run (LEVELS random): as many as the track has, somewhere else on its
  // straights each time, 80 m from the start, 70 from the line, 60 apart.
  const scatter=course=>{const n=(course.hurdles||[]).length,out=[];for(let tries=0;out.length<n&&tries<400;tries++){const d=80+Math.random()*(course.length-150),sec=course.sections?.find(s=>d>=s.s0&&d<s.s1);
      if((!sec||sec.kind==='straight')&&out.every(h=>Math.abs(h-d)>=60))out.push(Math.round(d));}return out.length===n?out.sort((a,b)=>a-b):course.hurdles;};
  let laid=null;   // this stage's hurdles for this visit: a retry runs the same road
  const COURSE=()=>{if(!city)return null;if(relay)return relayCourse(city);const c=soloCourse(city);return {...c,hurdles:locks.hurdle?[]:level?.random?(laid??=scatter(c)):c.hurdles};};
  // ?hazards=1 (dev): a puddle and a dropping by turns every 70 m, lane after lane, on any stage, to look at them.
  const sampleHazards=L=>{const puddles=[],poops=[];for(let d=90,k=0;d<L-60;d+=70,k++)(k%2?poops:puddles).push({distance:d,lane:k%3-1});return {puddles,poops};};
  // A stage's own (progress.mjs LEVELS hazards {puddle: [first, step], poop: [first, step]}): one every `step` m from
  // `first`, lane after lane, none within 14 m of a hurdle or in the last 60 m.
  // What lies on a stage's road: the weather's patches (water or snow, every WEATHER.every m) and the stage's droppings
  // (every hazards.poop m), each in a lane drawn at random and a little off its mark, none within 14 m of a hurdle or of
  // one another, none in the first 70 m or the last 60: one thing at a place, so two lanes are always clear.
  const levelHazards=(H,course)=>{const W=WEATHER[SKY],taken=[...(course.hurdles||[])],lay=(every,make)=>{const out=[];if(every)for(let d=70+Math.random()*every*.5;d<course.length-60;d+=every*(.75+Math.random()*.5)){
        if(taken.some(x=>Math.abs(x-d)<14))continue;taken.push(d);out.push(make(Math.round(d),Math.floor(Math.random()*3)-1));}return out;};
    return {puddles:lay(W.every,(distance,lane)=>({distance,lane,snow:W.snow})),poops:lay(H.poop,(distance,lane)=>({distance,lane}))};};
  let road=null;   // laid once for this visit, like the hurdles
  const makeGame=()=>{const course=COURSE(),g=new SliceGame({config:{solo:true,tempo:TEMPO,locks,perks,skillTime:.8*TEMPO,rivalPace:ease?.95:1,ball:true,ballFill:(BALL[1]||4.5)*TEMPO,ballFall:(BALL[2]||1.5)*TEMPO,ballPop:(BALL[3]||1.6)*TEMPO,ballLo:.7,ballHi:2.2,ballGood:.65,ballMax:.9,ballBack:.5,ballStack:5,ballGain:.06,ballRush:.6*TEMPO,...(level?.ram?{ram:{time:(level.ram[0]+(intro?1:0))*TEMPO,react:level.ram[1]*TEMPO,gap:level.ram[2]*TEMPO,first:(intro?15:4)*TEMPO,back:!!level.back}}:null),...getForm?.().config,hazards:level?.hazards&&course?(road??=levelHazards(level.hazards,course)):/[?&]hazards=1/.test(location.search)?sampleHazards(course?.length??0):null},team,rivals,chart:level?.plain?EASY_CHART:null,
    course});
    return g;};
  // The scene is shown complete or not at all (2026-10-06, the user: the race was seen being put together: its sky, ground
  // and painted cards are pictures that arrive after the scene is built, each one popping in). Its canvas stays hidden
  // (slice.css .scene-ready: the city's painted backdrop, the shell's own background, shows meanwhile) until every
  // picture is in and three frames have been drawn with them. At most 10 s: a picture that never arrives must not keep
  // the race shut.
  const frames=n=>Promise.race([new Promise(r=>{const f=()=>--n<0?r():requestAnimationFrame(f);f();}),new Promise(r=>setTimeout(r,1500))]);
  const sceneT0=performance.now(),sceneReady=async()=>{await Promise.race([loadsSettled(),new Promise(r=>setTimeout(r,10000))]);await frames(8);shell.classList.add('scene-ready');window.zbMark?.(`race scene ready (+${Math.round(performance.now()-sceneT0)} ms)`);};
  const stage=()=>{settle=20;renderer=new ChaseRenderer($('slice-canvas'),{slice:true,city:level?.random&&SKY!=='sun'?`${city}~${SKY}`:city});renderer.camera.setViewOffset(1,1,0,.08,1,1);   // the ball game: the whole view 8% of the screen higher, so the buddy stands clear of the ring at the foot (2026-10-08, the user: 「按鈕下移，騎士上移一點，不要疊在一起」)
    renderer.prepare(game);$('slice-canvas').addEventListener('race-render-error',pause);$('slice-canvas').addEventListener('coin-burst',e=>coinFly(e.detail));};
  async function newRun(){
    if(phase==='loading')return;if(midRace())logRun('restart');phase='loading';document.querySelector('.slice-shell')?.classList.remove('finish-shot');
    sound.stop();cancelAnimationFrame(frameId);clearTimeout(resultTimer);clearTimeout(resumeTimer);resumeTimer=0;
    await sound.prepare();
    $('slice-result').hidden=true;document.querySelector('.slice-shell').classList.remove('is-result');
    clearInterval(howTimer);game=makeGame();
    peak=0;seen=0;feedbackUntil=bigUntil=0;finalTen=false;result=null;phase='countdown';cover.hidden=true;
    streak=0;gaitShown=0;countShown=null;landAt=0;wasCarried=false;$('slice-feedback').textContent='';
    shell.classList.remove('is-ready');
    trace=[];ghost=solo&&!field?getGhost?.()??null:null;target=solo?getBrief?.().target??null:null;leading=null;passAt=0;lostAt=-9;hurry=-1;
    // The race bar's marks: the ghost of the best run (solo), an apple dot each, the real handoff points (relay).
    const L=game.config.length,barEl=document.querySelector('.slice-progress');barEl.querySelector('.marks')?.remove();
    barEl.insertAdjacentHTML('beforeend',`<span class="marks">${game.apples.map(a=>`<i class="ap" data-apple="${a.id}" style="left:${(a.distance/L*100).toFixed(1)}%"></i>`).join('')}${ghost?'<i class="ghost"></i>':''}</span>`);
    game.course.relays?.forEach((r,k)=>barEl.style.setProperty('--h'+k,(r/L*100).toFixed(2)+'%'));
    const best=getBest?.(),goal=$('slice-goal');goal.hidden=!best;if(best)goal.textContent=`要破的紀錄 ${wall(best)}`;
    $('slice-progress').max=game.config.length;
    $('slice-final-call').hidden=true;
    $('slice-chase').hidden=true;
    try{
      // The scene built for the start card (or the last run) is used again: only what a run leaves behind is cleared
      // (race-scene rerun). Anything else is rebuilt, the old picture staying up until the new one is ready.
      if(!renderer?.rerun(game)){shell.classList.remove('scene-ready');if(renderer){renderer.dispose();const old=$('slice-canvas');old.replaceWith(old.cloneNode(false));}stage();sceneReady();}   // a rebuilt scene: hidden again until it is whole (the countdown runs on)
      clock.reset();if(runs++)clock.start-=1000;   // again: a 2 s countdown (the first second is skipped, its beep too)
      sound.start(()=>clock.elapsed(),game);
      frameId=requestAnimationFrame(frame);
    }catch(error){phase='error';renderCover('無法啟動 3D 畫面',error.message,[['重試',newRun],['返回',toSetup]]);}
  }
  // A cooler phone (2026-10-06, the user: the phone got very hot): 30 pictures a second (taps are judged by their own
  // time stamps, not by frames), and none at all while nothing moves: paused, the results up, or the start card once the
  // scene has settled (settle: frames still to draw there).
  // The ball test (?ball=1, or ?ball=1,fill,fall,pop in real seconds; slice-game config.ball): one ring at the foot of
  // the screen. A thumb anywhere under the top bar holds the ball (it grows; at the white limit ring it pops); dragging
  // SWIPE px left or right is a lane, up a jump (the ball follows the thumb and springs back; one hold can flick again).
  // The sprint button is the other thumb's. The ghost thumb shows through the countdown and until the first hold, on the
  // first stage only (the `thumb` option, home.js; 2026-10-11, the user: it was on every stage).
  let ballT=0;
  if(BALL){const SWIPE=30;
    shell.insertAdjacentHTML('beforeend',`<div id="ball-pad" aria-hidden="true"></div><div id="ball-ring"${thumb?' class="hint"':''} aria-hidden="true"><u></u><i></i><b></b><span></span><em></em><s></s><strong>放開！</strong></div><button id="slice-skill" type="button" aria-label="技能"><i></i><i></i><i></i><b></b><span></span><em class="charge-count">0</em></button>`);
    if(!field)$('slice-skill').hidden=true;   // no rivals on this stage: nothing to use it on
    $('slice-skill').addEventListener('pointerdown',e=>{e.preventDefault();if(phase!=='running')return;tick(simTime(performance.now()));game.useSkill();},on);
    const pad=$('ball-pad'),ring=$('ball-ring');let g=null;
    const off=(x,y)=>{ring.style.setProperty('--dx',x.toFixed(0));ring.style.setProperty('--dy',y.toFixed(0));};
    pad.addEventListener('pointerdown',e=>{if(g)return;pad.setPointerCapture(e.pointerId);g={id:e.pointerId,x:e.clientX,y:e.clientY};game.holding=true;if(phase==='running')ring.classList.remove('hint');},on);
    pad.addEventListener('pointermove',e=>{if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;off(dx,dy);
      if(Math.max(Math.abs(dx),Math.abs(dy))<SWIPE)return;g.x=e.clientX;g.y=e.clientY;setTimeout(()=>off(0,0),90);if(phase!=='running')return;
      if(Math.abs(dx)>Math.abs(dy))lane(dx>0?1:0);else if(dy<0){const t=simTime(performance.now());tick(t);game.jump(t);}},on);   // down does nothing now: the kick is the skill button's
    const up=e=>{if(!g||g.id!==e.pointerId)return;g=null;game.holding=false;off(0,0);};
    pad.addEventListener('pointerup',up,on);pad.addEventListener('pointercancel',up,on);
    pad.addEventListener('touchstart',e=>e.preventDefault(),{...on,passive:false});}   // iOS Safari: a long hold would bring up the text loupe and cancel the touch
  const ballHud=t=>{const ring=$('ball-ring');
    if(phase==='countdown'){if(thumb)ring.classList.add('hint');game.ballStep(Math.max(0,t-ballT),t);}ballT=t;
    sound.layer=Math.min(4,game.streak);   // the music fills in with the streak and thins out when it is lost
    {const b=$('slice-skill'),tg=phase==='running'&&game.skill>=1&&game.blown<=game.time?game.skillTarget():null,key=game.skill+(tg?tg.kind+(tg.side??''):'');
      if(b.dataset.k!==key){b.dataset.k=key;b.dataset.n=game.skill;b.querySelector('em').textContent=game.skill;b.classList.toggle('on',!!tg);b.dataset.dir=tg?tg.kind==='kick'?'down':tg.side?'right':'left':'';b.querySelector('span').textContent=tg?tg.kind==='kick'?'踢':'撞':'';}}
    if(AUTO)game.holding=game.ball<.88;
    const now=phase==='countdown'?t:game.time,k=game.ball,G=game.config.ballGood,M=game.config.ballMax;ring.style.setProperty('--ball',k.toFixed(3));ring.style.setProperty('--size',(k<G?.26+.32*k/G:k<M?.58+.22*(k-G)/(M-G):.8+.155*(k-M)/(1-M)).toFixed(3));   // the ball's size across the ring: the two zones are drawn wider than their share (slice.css: green .58–.8, yellow .8–.955)
    
    {const st=ring.querySelector('strong'),w=k>=M?'極限！':k>=G?'放開！':'集氣中';if(st.textContent!==w)st.textContent=w;}
    ring.classList.toggle('held',game.holding);ring.classList.toggle('warn',k>.6);ring.classList.toggle('hot',k>=G);ring.classList.toggle('max',k>=M);if(ring.dataset.n!==String(game.streak)){ring.dataset.n=game.streak;ring.querySelector('s').textContent=game.streak?'×'+game.streak:'';}ring.classList.toggle('dead',game.blown>now);};
  const HZ=+new URLSearchParams(location.search).get('hz')===30?30:60,GAP=1000/HZ-4;   // pictures a second: 60 (2026-10-10, the user: 「那就60」; it was 30 since 2026-10-06, for a hot phone: ?hz=30 is that again)
  let drawn=0,settle=20;
  function frame(){
    const workStart=performance.now();
    if(workStart-drawn<GAP||phase==='paused'||(phase==='finished'&&!$('slice-result').hidden)||(phase==='ready'&&settle--<=0)){frameId=requestAnimationFrame(frame);return;}
    drawn=workStart;if(phase==='running'){if(perf.last)perf.gap+=workStart-perf.last;perf.last=workStart;}else perf.last=0;   // a pause, the results card or a retry is not a frame: its wait made frameMs read 38–41 on a second run (play log, 2026-10-10)
    const wallTime=clock.elapsed()-SLICE_CONFIG.countdown,t=wallTime*TEMPO;
    if(phase==='countdown'&&t>=0){phase='running';banner('GO!','go',520);buzz('strong');renderer.dustBurst(16);$('slice-goal').hidden=true;}
    tick(t);
    for(const e of game.actions.slice(seen)){
      if(e.type==='lane')sound.cue('lane');
      else if(e.type==='boundary'){feedback('已在最外側','hint');sound.cue('deny');}
      else if(e.type==='lane-blocked'){feedback('旁邊有對手，等空位','hint');sound.cue('deny');}
      else if(e.type==='rammed'){feedback('被撞了！','warn',true);dazed('player');flash('#ff5a4a',.45,300);buzz('bad');sound.collision();sound.dropLayer();streak=0;}
      else if(e.type==='ram-miss'){dazed(e.id);feedback('躲開了！','gold',true);buzz('good');sound.cue('crunch');}
      else if(e.type==='charge-empty'&&BALL){feedback('還沒有衝刺 · 吃蘋果存一段','hint');sound.cue('deny');}
      else if(e.type==='charge-empty'){feedback(`還沒存到一段 · 踩準 ${Math.ceil((game.config.boostCost-game.energy)/game.config.perfectEnergy)} 下`,'hint');sound.cue('deny');
        if(!still)chargeBtn.animate([{translate:'0 0'},{translate:'-4px 0'},{translate:'4px 0'},{translate:'0 0'}],{duration:160});}
      else if(e.type==='charge-busy')feedback('衝刺中','hint');
      else if(e.type==='charge-tired'){feedback('體力不足 · 等體力條回來再衝','hint');sound.cue('deny');}
      else if(e.type==='charged'){if(e.segments*game.config.boostCost>=game.cap())feedback(game.fresh()?'蓄力滿了 · 按蓄力鈕衝刺':'蓄力滿了 · 等體力回來',game.fresh()?'lime':'');sound.charged(e.segments,e.segments*game.config.boostCost>=game.cap());buzz('good');
        chargeBtn.animate([{scale:1},{scale:1.3,filter:'brightness(1.6)',offset:.35},{scale:1,filter:'none'}],{duration:380,easing:'cubic-bezier(.3,1.5,.5,1)'});}
      else if(e.type==='leap'){feedback(`飛越 ${rivalName(e.over)}！`,'gold',true);sound.jump(true);sound.accent('overtake');buzz('strong');sound.duck();landAt=e.time+game.config.jumpDuration;landClear=true;}
      else if(e.type==='rival-leap'&&e.over==='player'){feedback(`${rivalName(e.id)} 從頭上飛過！`,'warn');sound.accent('warning');buzz('bad');}
      else if(e.type==='rival-trip'){const r=game.rivals.find(x=>x.id===e.id);if(r&&Math.abs(r.distance-game.distance)<40)feedback(`${rivalName(e.id)} 絆到了`,'hint');}   // rivals knock hurdles too (the same rules): said when it happens near the player
      else if(e.type==='jump'){sound.jump(true);sound.duck();buzz('tap');landAt=e.time+game.config.jumpDuration;landClear=false;}
      // A hurdle: how clean the take-off was (error from the ideal moment; the window is ±jumpWindow).
      else if(e.type==='clear'){const off=Math.abs(e.error??0)/game.config.jumpWindow;landClear=true;
        if(off<=.35){feedback('完美起跳！','gold',true);buzz('good');}else feedback(off>=.75?'好險！':'CLEAR!','green');}
      else if(e.type==='puddle'){if(e.dry)feedback(e.snow?'不怕雪！':'不怕水！','gold');else{feedback(e.snow?'踩到雪了':'踩到水了','hint');sound.cue('deny');}buzz('tap');}
      else if(e.type==='poop'){feedback('踩到了！','warn',true);shake(5,220);sound.collision();buzz('bad');}
      else if(e.type==='obstacle-miss'){mark('hit');feedback('絆到了！','warn',true);sound.collision();sound.dropLayer();buzz('bad');landAt=0;streak=0;}
      // Passed, then back in front within 5 s: "won it back", its own moment.
      else if(e.type==='overtake'){const back=clock.elapsed()-lostAt<5;lostAt=-9;feedback(back?`搶回來了！第 ${e.rank} 名`:`超越！第 ${e.rank} 名`,back?'lime':'gold',true);sound.accent(back?'milestone':'overtake');popPlace();buzz('good');}
      else if(e.type==='passed'){lostAt=clock.elapsed();feedback(`被超越了！第 ${e.rank} 名`,'warn',true);sound.accent('warning');buzz('hit');}
      else if(e.type==='boost'){feedback('SPRINT!','sprint',true);sound.accent('sprint');buzz('strong');flash('#d9ff4f',.6,360);renderer.dustBurst(14,true);pop(chargeBtn);}
      else if(e.type==='coin')sound.coin(+e.id.split('-')[2]||0);   // the picture: race-scene coinBurst → coinFly
      else if(e.type==='release'){feedback(e.max?'極限！':'漂亮！',e.max?'gold':'',e.max);buzz(e.max?'strong':'good');sound.cue('crunch');$('ball-ring').querySelector('u').animate([{scale:1,opacity:1,borderColor:'#ffd846'},{scale:1.35,opacity:0}],{duration:300,easing:'ease-out'});}
      else if(e.type==='skill-start'){const T=game.skillWait();if(e.kind==='kick')renderer.buck(T-.35);else renderer.ram(e.side,T);   // the kick lands with the hit; the arm is all the way out at it
        feedback(e.kind==='kick'?'準備踢！':'準備撞！','hint');sound.cue('window');buzz('tap');if(!still)$('slice-skill').animate([{scale:1},{scale:1.22}],{duration:T/TEMPO*1000,easing:'ease-in'});}
      else if(e.type==='skill-miss'){feedback('撲空了','hint');sound.cue('deny');}
      else if(e.type==='skill'){dazed(e.id);feedback(e.kind==='kick'?'踢中！':e.pushed?'擠開了！':'撞倒了！','gold',true);buzz('strong');sound.cue('crunch');renderer.dustBurst(18);shake();flash('#ffd846',.5,300);pop($('slice-skill'));}
      else if(e.type==='kickback'){if(e.hit!=null)dazed(e.hit);renderer.buck();feedback(e.hit==null?'踢空':'踢中！',e.hit==null?'':'gold',e.hit!=null);buzz(e.hit==null?'tap':'strong');sound.cue('crunch');renderer.dustBurst(e.hit==null?8:18);if(e.hit!=null){shake();flash('#ffd846',.5,300);}pop($('slice-skill'));}
      else if(e.type==='shove'){if(e.pushed)dazed(e.id);shake(e.pushed?8:4,240);if(e.pushed)flash('#ffd846',.4,260);feedback(BALL?(e.popped?(e.pushed?'擠開了！':'撞倒了！'):'彈開了'):e.pushed?'擠開了！':'撞了一下',BALL&&!e.popped?'':'gold',e.pushed);buzz('strong');sound.cue('crunch');}
      else if(e.type==='blown'){if(BALL)$('ball-ring').querySelector('u').animate([{scale:1,opacity:1},{scale:1.5,opacity:0}],{duration:380,easing:'ease-out'});feedback(BALL?'爆了！':'沒力了！','red',true);buzz('bad');sound.cue('break');}
      else if(e.type==='apple'){shell.querySelector(`[data-apple="${e.id}"]`)?.classList.add('got');const both=game.boostActive();feedback(BALL?'蓄力 +1':both?'極速！':'蘋果加速！',both?'gold':'apple',both);sound.cue('crunch');sound.accent('apple');buzz('good');flash('#ff5a48',.34);}
      else if(e.type==='relay'){const h=team[e.leg];feedback(`第${e.leg+1}棒 ${h.name} · ${TYPE_NAME[h.type]}`);sound.accent('handoff');buzz('good');}
    }
    seen=game.actions.length;
    // Read-only DOM telemetry for acceptance checks; never shown in the HUD.
    // Read-only DOM telemetry for acceptance checks; never shown in the HUD (a few times a second).
    if(!((perf.tick=(perf.tick||0)+1)%8)||phase!=='running')Object.assign($('slice-canvas').dataset,{slicePhase:phase,lane:String(game.targetLane),jumps:String(game.jumps.length),coins:String(game.coinCount),boosts:String(game.boosts.length),distance:game.distance.toFixed(2),rank:String(game.metrics().rank)});
    if(phase==='countdown'){const n=Math.max(1,Math.ceil(-wallTime));if(n!==countShown){countShown=n;banner(String(n),'',1000);buzz('tap');}}
    else if(clock.elapsed()>feedbackUntil&&$('slice-feedback').textContent)$('slice-feedback').textContent='';
    if(phase==='running'){
      // Landing: a thud as the hooves come down (a clean jump: a bright note on it), dust kicked up.
      if(landAt&&game.time>=landAt){landAt=0;sound.land(landClear);renderer.dustBurst(8,true);buzz('hit');}
      // Solo: the gait changing up is a moment of its own (down: the chip just dims).
      if(solo){const s=game.surge(),g=s>=2/3?2:s>=1/3?1:0,chip=$('slice-terrain').parentElement;
        if(g>gaitShown){feedback(`${GAIT_NAME[g]}！`,g>1?'gold':'');sound.accent('gait'+g);if(!still)chip.animate([{scale:1},{scale:1.25,offset:.35},{scale:1}],{duration:320,easing:'ease-out'});}
        else if(g<gaitShown&&!still)chip.animate([{filter:'grayscale(1) brightness(.7)'},{filter:'none'}],{duration:300});
        gaitShown=g;}
      while(trace.length*GHOST_STEP<=game.time)trace.push(+game.distance.toFixed(1));   // this run, to become the ghost if it is the best
      // A sprint or an apple running out.
      const carried=game.carried();if(wasCarried&&!carried)sound.cue('ebb');wasCarried=carried;
    }
    put($('slice-progress'),'value',Math.round(game.distance*4)/4);
    // Leg and the ground underfoot, with this horse's multiplier on it (flashes when the terrain changes).
    const kind=game.terrain.kind;put($('slice-leg'),'text',solo?`${game.driveSpeed<0?'−':'+'}${Math.abs(Math.round(game.driveSpeed*100))}%`:`${game.leg+1}/3`);   // solo: what the combo adds to the horse's own speed
    peak=Math.max(peak,game.speed);
    put($('slice-terrain'),'text',solo?GAIT_NAME[game.gait()]:TERRAIN_NAME[kind]);   // the ground underfoot (solo: the gait, no terrain aptitude there); no multiplier is written (the user: never ×1.2)
    // (No announcement when the ground changes: the strip under the progress bar shows the whole track.)
    put($('slice-coins'),'text',String(game.coinCount));
    // Solo: the chip under the gait says how this run stands against the best one here (its ghost, also a dot on the
    // bar), else against the pace the next star needs; with neither, nothing.
    if(solo){const chip=$('slice-position'),label=chip.previousElementSibling,pace=phase==='running'&&!field?paceAt(game.distance):null;   // against rivals the place is the thing (and the chip would sit under the lap map)
      if(pace===null)put(chip.parentElement,'className','hud-position idle');   // nothing to compare with: no chip (2026-10-05, the user: the speed is not shown)
      else{const d=(game.time-pace)/TEMPO,front=d<=0;   // wall seconds behind (+) or ahead (−)
        put(label,'text',ghost?'比最佳':'比目標');put(chip,'text',`${front?'快':'慢'} ${Math.abs(d).toFixed(1)}`);put(chip.parentElement,'className',`hud-position ${front?'ahead':d>5?'far':'behind'}`);
        if(front&&leading===false&&game.time>5&&clock.elapsed()>passAt+3){passAt=clock.elapsed();feedback(ghost?'超過最佳的自己！':'追上目標了！','lime',true);sound.accent('overtake');buzz('good');}
        leading=front;}
      if(ghost)put(shell.querySelector('.marks .ghost'),'left',`${(Math.min(game.config.length,ghost[Math.min(ghost.length-1,Math.floor(game.time/GHOST_STEP))]??game.config.length)/game.config.length*100).toFixed(1)}%`);}
    put($('slice-speed'),'text',`${game.carried()?'爆發':'速度'} ${Math.round(game.speed)}`);
    const remaining=Math.max(0,game.config.length-game.distance);
    if(phase==='running'&&!finalTen&&remaining/(Math.max(game.speed,game.config.baseSpeed)*TEMPO)<=6){   // the last 6 s
      finalTen=true;sound.accent('final');sound.finalStretch=true;feedback('最後衝線！','gold',true);buzz('strong');
    }
    put($('slice-final-call'),'hidden',!finalTen||phase!=='running');
    if(finalTen)put($('slice-final-call'),'text',`最後衝線 · ${Math.ceil(remaining)} m`);
    // Chase hint, clear of the notes and the hoof pads: an edge arrow (left / right, lower middle) for a rival closing
    // from behind on that side, stronger as it nears. (The name-and-metres tag over the horse ahead went 2026-10-04.)
    const others=game.metrics().rivals,live=phase==='running'&&game.time>1;
    for(const side of ['left','right']){
      const r=others.filter(r=>{const gap=r.distance-game.distance,d=r.lane-game.laneValue;return gap<-1&&gap>-22&&(side==='left'?d<-.3||(Math.abs(d)<=.3&&game.laneValue>0):d>.3||(Math.abs(d)<=.3&&game.laneValue<=0));})
        .sort((a,b)=>b.distance-a.distance)[0],el=$('chase-'+side);
      put(el,'hidden',!live||!r);if(r)put(el,'opacity',(.35+.65*(1-(game.distance-r.distance)/22)).toFixed(1));
    }
    // Relay: the place, alone (2026-10-04, the user: the metres to the horses ahead and behind meant nothing).
    if(field){const card=$('slice-rank'),rank=compositionRank(game,game.metrics());
      put(card.firstChild,'text',String(rank));put(card.lastChild,'text','/'+(others.length+1));put(card,'className',rank===1?'first':'');}
    if(phase==='running'||phase==='countdown')sound.speedFeedback(game.speed/game.config.baseSpeed,game.surge(),game.rush());   // not once the race is over: this brought the wind back every frame after stop() (2026-10-06, the user: the sound should end with the race)
    if(BALL)ballHud(t);
    shell.classList.toggle('is-rush',phase==='running'&&game.boostActive());   // the picture's edge glows for as long as the sprint lasts (slice.css)
    updateEnergyControls(game.energy,game.cap(),game.boostActive(),game.drafting,game.config.boostCost,game.stamina/game.pool,!game.fresh());   // the bar: this buddy's own pool
    const h=game.hurdles.find(h=>!h.state&&h.distance>game.distance),until=h?(h.distance-game.distance)/game.speed:Infinity;   // the next hurdle
    // Its two cues by ear: coming up (1.2 s out), and the take-off window opening.
    if(h&&phase==='running'){const c=game.config;
      if(!h.cue&&until<1.2*TEMPO+c.jumpLead){h.cue=1;sound.cue('approach');}
      if(h.cue===1&&until<=c.jumpLead+c.jumpWindow){h.cue=2;sound.cue('window');}}
    // The sprint running down on the charge button's ring (--left 1 → 0), blinking over its last half second.
    const run=game.boosts.at(-1),left=run&&game.time<run.end?(run.end-game.time)/(run.end-run.t):0;
    put(chargeBtn,'--left',left.toFixed(2));chargeBtn.classList.toggle('ending',left>0&&run.end-game.time<.5*TEMPO);
    if(solo){const ap=$('slice-apples'),rush=game.rushes.at(-1),on=rush&&game.time<rush.end;put(ap,'hidden',!game.apples.length);
      put(ap.lastChild,'text',`${game.appleCount}/${game.apples.length}`);put(ap,'--left',on?((rush.end-game.time)/(rush.end-rush.t)).toFixed(2):'0');ap.classList.toggle('on',!!on);}
    // The jump cue: a ring closes in as the hurdle comes (from about 1.4 s out) and turns lime while the take-off window
    // is open (slice.css: --ring, jump-soon, jump-now).
    const cj=game.config,soon=phase==='running'&&!!h&&until>0&&until<1.8,now=soon&&Math.abs(until-cj.jumpLead)<=cj.jumpWindow;
    put(shell,'--ring',soon?(1+.6*Math.max(0,Math.min(1,(until-cj.jumpLead)/(1.8-cj.jumpLead)))).toFixed(3):'1');shell.classList.toggle('jump-soon',soon);shell.classList.toggle('jump-now',now);
    // Relay: charge does not cross a handoff. With a segment in hand and the line coming, say so once and hurry the button.
    const toLine=(relay||!solo)&&phase==='running'&&game.leg<2?(game.course.relays[game.leg]-game.distance)/game.speed/TEMPO:Infinity,warn=game.segments()>0&&game.fresh()&&!game.boostActive()&&toLine>0&&toLine<2+2.6*(game.segments()-1);
    if(warn&&hurry!==game.leg){hurry=game.leg;feedback('快交棒了 · 蓄力帶不過去，快用掉','lime');sound.cue('window');}
    chargeBtn.classList.toggle('hurry',warn);
    const over=phase==='running'&&(game.boostActive()||(game.energy>=game.config.boostCost&&game.fresh()))&&!game.leap&&game.leapTarget(game);   // sprinting or energy for one, behind a horse: it can be leapt
    put($('slice-jump-hint'),'text',$('slice-feedback').textContent?'':over?`按蓄力鈕飛越 ${over.name}`:phase==='running'&&game.drafting&&!game.boostActive()&&game.energy<game.config.boostCost?'跟在後面蓄力加快 · 存到一段就能飛越':'');
    allControls.forEach(p=>put(p,'disabled',phase!=='running'));put($('slice-pause'),'disabled',!['running','countdown'].includes(phase));
    dazeFrame();
    const drawStart=performance.now();renderer.draw(game,phase==='ready'?-1:phase==='countdown'?Math.min(-.001,t):game.time,game.metrics());
    if(phase==='running'){const end=performance.now();perf.n++;perf.work+=end-workStart;perf.draw+=end-drawStart;}
    if(game.finished&&phase==='running'){
      phase='finished';sound.stop();sound.accent('finish');logRun('finish');
      const m=game.metrics(),c=game.config,cleared=game.hurdles.filter(h=>h.state==='cleared').length;
      const tally={bestCombo:Math.max(0,...game.actions.filter(a=>a.type==='release').map(a=>a.streak)),perfect:game.actions.filter(a=>a.type==='release'&&a.max).length,finishTime:game.finishTime,pickups:game.coinCount,releases:game.actions.filter(a=>a.type==='release').length,limits:game.actions.filter(a=>a.type==='release'&&a.max).length,pops:game.actions.filter(a=>a.type==='blown').length,boosts:game.boosts.length,stumbles:game.stumbles.length,cleared,apples:game.appleCount};   // the streak is the combo, a release at the limit the Perfect
      if(solo&&!relay){const beat=field?rivals.length+1-m.rank:0;result={solo:true,rank:field?m.rank:null,of:rivals.length+1,bonus:beat*c.coinValue,coins:(game.coinCount+beat)*c.coinValue,appleTotal:game.apples.length,topSpeed:peak,trace,splits:splits(),...tally};}   // solo: the time is the result (the stars); coins picked up are banked, and a coin's worth for every rival beaten
      else{const bonus=c.placeBonus[m.rank-1]||0;result={rank:m.rank,coins:game.coinCount*c.coinValue+bonus,gems:c.gemBonus?.[m.rank-1]||0,bonus,lead:c.length-Math.max(...m.rivals.map(x=>x.distance)),...tally};}   // lead: m ahead of the best rival at the line
      const bank=onFinish?.(result)||{};
      // The line is a moment of its own: FINISH, a flash and a tune for how it went, then the results (a tap skips ahead).
      const grade=!field?(bank.newBest?'win':'podium'):m.rank===1?'win':m.rank<=3?'podium':'lost';
      banner('FINISH','finish',900);flash('#ffffff',.55,180);sound.accent(grade);buzz(grade==='lost'?'hit':'strong');
      const show=()=>{clearTimeout(resultTimer);if(phase==='finished'&&$('slice-result').hidden)showResults(result,m,bank,grade);};
      const won=BALL&&(!field||game.metrics().rank===1);if(won)renderer.win();   // first home: the buddy rears, the fist goes up, and the result waits for it
      resultTimer=setTimeout(show,won?2300:1700);document.querySelector('.slice-shell').classList.add('finish-shot');   // long enough for the camera to come round (race-scene FINISH_SHOT); the controls step asidedocument.querySelector('.slice-shell').addEventListener('pointerdown',show,{once:true,signal:ac.signal});
    }
    frameId=requestAnimationFrame(frame);
  }
  // Results, UI v2 (2026-10-05, the user's reference and the mock-up docs/ui-kit.html #a3 / #a7), over the city's far
  // backdrop: the wordmark and the wallet; a glass banner between laurels (the place, or the solo time; its small line
  // says what happened); the stars (solo); an award in the middle (1st gold, 2nd red, 3rd blue rosette; solo by its
  // stars); what opened or was given, as tags; the black rewards card, five columns; the standings (relay) or two glass
  // rows (solo); the green button (the level this run opened, else again) and Home.
  // bank: what home.js made of the run (rewards()). The buttons work from the first frame.
  function showResults(r,m,bank,grade){
    const tempo=TEMPO,n=v=>Number(v).toLocaleString('en-US'),total=bank.total??0,gain=r.coins+(bank.extra||0);
    const off=bank.best?(r.finishTime-bank.best)/tempo:null,gems=MVP.gems?(r.gems||0)+(bank.newStars||0)+(bank.daily?.gems||0):0;
    let again=r.solo?'再跑一次':'再來一場',near='',board='';
    if(!r.solo){
      const rows=[{name:`You · ${team.map(h=>h.name).join(' / ')}`,coat:team.at(-1).coat,time:r.finishTime,you:true},
        ...m.rivals.map(x=>({name:`Team ${x.name}`,coat:x.horses.at(-1).coat,time:x.finishTime}))].sort((a,b)=>a.time-b.time);
      // The gap that matters: to the team just ahead. Within 1.5 s it is "so close": the button says what there is to win back.
      const me=rows.findIndex(x=>x.you),up=rows[me-1];
      if(up&&(r.finishTime-up.time)/tempo<=1.5){near='就差一點！';again=`再來一場 · 追回 ${secs(r.finishTime-up.time)} 秒`;}
      board=`<ol class="res-rank">${rows.map((x,i)=>`<li class="ui-pillrow ${x.you?'':'glass'}"><b class="rk">${i+1}</b><img src="assets/stable/buddy_${x.coat}.webp?v=coats-4" alt=""><span>${esc(x.name)}</span><b class="ui-num">${wall(x.time)}</b></li>`).join('')}</ol>`;
    }else board=`<ol class="res-rank">${r.rank?`<li class="ui-pillrow glass">${icon('flag')}<span>名次</span><b>${r.rank} / ${r.of}${r.bonus?` · +${r.bonus}`:''}</b></li>`:''}${MVP.levels&&bank.xp?`<li class="ui-pillrow glass">${icon('horse')}<span>${esc(team[0].name)} 經驗</span><b>+${bank.xp} · LV ${bank.level}${bank.toNext?` · 再 ${bank.toNext} 升級`:''}</b></li>`:''}${
      bank.starHint?`<li class="ui-pillrow glass res-gap" style="--p:${bank.starGap??0}">${icon('star')}<span>下一顆星</span><b>${bank.starHint}</b></li>`:''}${
      bank.hot>1?`<li class="ui-pillrow glass">${icon('bolt')}<span>連續進步 ×${bank.hot}</span><b>+${bank.hotCoins}</b></li>`:''}${
      bank.tip?`<li class="ui-pillrow glass res-tip">${icon('info')}<span>${esc(bank.tip)}</span></li>`:''}</ol>`;
    const small=r.solo?(r.rank===1?'第 1 名！':bank.newBest&&bank.best?'新紀錄！':bank.newStars?'拿到新的星星！':off!==null&&off<=1?'差一點！':'單騎完成'):near||'比賽結果';
    const award=['gold','red','blue'][r.solo&&!r.rank?3-(bank.stars??0):r.rank-1];   // 1st gold, 2nd red, 3rd blue (the user); solo: by its stars
    const tag='<span class="ui-tag yellow">新紀錄</span>',el=$('slice-result');
    const cols=[['獲得金幣','coins','<span data-count>+0</span>',''],['金幣總數','coin',n(total),''],['極限放手','star',r.perfect,''],...(MVP.missions?[['任務獎勵','flag',`+${bank.missionCoins||0}`,'']]:[])];
    el.innerHTML=`<header class="ui-top">${brand()}<div class="res-wallets">${wallet(total-gain,{gems:bank.gems??null})}</div></header>
      <div class="res-banner ui-glass ui-enter"><img src="assets/ui/res_laurel_l.webp" alt=""><div><small>${small}</small><b class="res-big">${r.solo?wall(r.finishTime):`第 ${r.rank} 名`}</b></div><img src="assets/ui/res_laurel_r.webp" alt=""></div>
      ${r.solo&&bank.stars!=null?`<p class="res-stars" role="img" aria-label="${bank.stars} 顆星">${[0,1,2].map(k=>`<i class="${k<bank.stars?'on':''}${k>=bank.stars-bank.newStars&&k<bank.stars?' new':''}">★</i>`).join('')}</p>`:''}
      <div class="res-mid">${award?`<img class="res-award" src="assets/ui/award_${award}.webp?v=2" alt="">`:''}
        <p class="res-newsline">${(bank.news||[]).map(x=>`<span class="ui-tag yellow">${esc(x)}</span>`).join('')}${gems?`<span class="ui-tag"><i class="gem">${icon('gem')}</i>+${gems}</span>`:''}${MVP.levels&&!r.solo&&bank.xp?`<span class="ui-tag">每位 +${bank.xp} XP${bank.levelUp?' · Level up':''}</span>`:''}</p></div>
      <article class="ui-panel res-rewards ui-enter"><h2>比賽獎勵</h2><div style="--n:${cols.length}">${cols.map(([l,i,v,t])=>`<div><small>${l}</small><img src="assets/ui/res_${i}.webp" alt=""><b>${v}</b>${t}</div>`).join('')}</div></article>
      ${board}<div class="res-acts${bank.next?' three':''}"><button class="ui-btn primary main">${bank.next?`${esc(bank.next.label)}${icon('arrow','')}`:`${icon('again','')}${again}`}</button>
        ${bank.next?`<button class="ui-btn" data-to="again">${again}</button><button class="ui-icon-btn" data-to="home" aria-label="首頁">${icon('home')}</button>`:`<button class="ui-btn" data-to="home">${icon('home')}首頁</button>`}</div>`;
    const go=f=>()=>{sound.cue('click');f();},to={again:newRun,home:toHome};
    el.querySelector('.main').onclick=go(bank.next?()=>exit({city:bank.next.city}):newRun);el.querySelectorAll('[data-to]').forEach(b=>b.onclick=go(to[b.dataset.to]));
    shell.classList.add('is-result');el.hidden=false;el.querySelector('.main').focus();
    if(bank.prizes?.length)openChest(el,bank.prizes,()=>reveal(el,gain,total,grade,bank));else reveal(el,gain,total,grade,bank);
  }
  // What this run gave (a buddy, a look: bank.prizes [{img, text}]) comes out of a chest before the results play: it
  // hops in, turns once and opens (ui chest(), ui-v2.css .ui-prize); 收下 goes on to the results.
  function openChest(el,prizes,then){
    el.insertAdjacentHTML('beforeend',`<div class="ui-prize" role="dialog" aria-modal="true" aria-label="獎品">${chest(prizes)}${prizes.map(p=>`<p>${esc(p.text)}</p>`).join('')}<button class="ui-btn primary">收下</button></div>`);
    const layer=el.lastElementChild,take=layer.querySelector('button');
    setTimeout(()=>{if(layer.isConnected){sound.accent('lesson');buzz('good');}},1300);   // as the lid opens
    setTimeout(()=>{if(layer.isConnected){sound.accent('star');buzz('good');}},2550);   // as the card turns over
    take.onclick=()=>{layer.remove();then();};take.focus();
  }
  // The results played out: the number lands, the stars are stamped one by one, the coins count up (a tick each step,
  // rising), fly to the wallet and the wallet counts on; confetti for a podium, a record or a new star. Reduced
  // motion: the final numbers at once.
  function reveal(el,gain,total,grade,bank){
    const n=v=>Number(v).toLocaleString('en-US'),got=el.querySelector('[data-count]'),purse=el.querySelector('[data-coins]');
    const done=()=>{got.textContent=`+${n(gain)}`;purse.textContent=n(total);};
    if(still||!gain){done();return;}
    el.querySelector('.res-big').animate([{scale:1.5,opacity:0},{scale:1,opacity:1}],{duration:260,easing:'cubic-bezier(.3,1.4,.5,1)'});
    el.querySelectorAll('.res-stars i.on').forEach((st,k)=>{st.animate([{scale:1.8,opacity:0},{scale:1,opacity:1}],{duration:260,delay:250+k*250,easing:'cubic-bezier(.3,1.4,.5,1)',fill:'backwards'});
      if(st.classList.contains('new'))setTimeout(()=>{if(!el.hidden)sound.accent('star');},250+k*250);});
    if(grade!=='lost'||bank.newStars)confetti(el,grade==='win'||bank.newStars?48:24);
    const steps=Math.min(12,Math.max(1,gain/10)),t0=performance.now()+400;let last=-1;
    const run=now=>{if(el.hidden||!got.isConnected)return;const u=Math.min(1,Math.max(0,(now-t0)/600)),k=Math.floor(u*steps);
      got.textContent=`+${n(Math.round(gain*u/10)*10)}`;if(k!==last&&u>0){last=k;sound.cue('count',k,steps);}
      if(u<1){requestAnimationFrame(run);return;}
      // five coins from the card to the wallet, then the wallet counts on
      const from=got.getBoundingClientRect(),to=purse.getBoundingClientRect(),box=el.getBoundingClientRect();
      for(let i=0;i<5;i++){const c=document.createElement('i');c.className='ui-coin coin-fly';c.textContent='U';c.style.cssText=`left:${from.left+from.width/2-box.left}px;top:${from.top+from.height/2-box.top}px`;el.append(c);
        c.animate([{transform:'translate(-50%,-50%) scale(1.2)',opacity:1},{transform:`translate(calc(-50% + ${to.left-from.left}px),calc(-50% + ${to.top-from.top}px)) scale(.6)`,opacity:1}],{duration:520,delay:i*60,easing:'cubic-bezier(.3,.1,.4,1)',fill:'backwards'}).onfinish=()=>{c.remove();
          if(i===4){done();sound.coin(2);purse.parentElement.animate([{scale:1},{scale:1.2,offset:.4},{scale:1}],{duration:260,easing:'ease-out'});}};}
    };requestAnimationFrame(run);
    setTimeout(done,2800);   // also when animations are held (a hidden page)
  }
  // Confetti over the results (CSS only: the race itself has stopped).
  function confetti(host,count){
    const box=document.createElement('div');box.className='confetti';host.append(box);
    for(let i=0;i<count;i++){const p=document.createElement('i'),x=Math.random()*100,d=900+Math.random()*900;p.style.cssText=`left:${x}%;background:${['#ffd846','#d9ff4f','#35c8f4','#ff7a6b','#fff'][i%5]}`;box.append(p);
      p.animate([{transform:'translateY(-10%) rotate(0)',opacity:1},{transform:`translate(${(Math.random()-.5)*120}px,${60+Math.random()*30}vh) rotate(${(Math.random()-.5)*900}deg)`,opacity:0}],{duration:d,delay:Math.random()*350,easing:'cubic-bezier(.2,.6,.4,1)',fill:'both'});}
    setTimeout(()=>box.remove(),2400);
  }
  const simTime=stamp=>(clock.inputElapsed(stamp)-SLICE_CONFIG.countdown)*TEMPO;
  function lane(side){if(phase!=='running'||locks.lane)return;tick(simTime(performance.now()));buzz(game.lane(side)?.type==='lane'?'tap':'bad');}
  function charge(stamp){if(phase!=='running'||locks.sprint)return;const t=simTime(stamp);tick(t);game.charge(t);}
  chargeBtn.onpointerdown=e=>{e.preventDefault();chargeBtn.classList.add('pressed');charge(e.timeStamp);};
  chargeBtn.onpointerup=chargeBtn.onpointercancel=()=>chargeBtn.classList.remove('pressed');chargeBtn.oncontextmenu=e=>e.preventDefault();
  const laneKeys={KeyZ:0,ArrowLeft:0,KeyM:1,ArrowRight:1};
  $('slice-pause').onclick=pause;
  window.addEventListener('keydown',e=>{
    if(phase==='exited')return;
    if(e.repeat)return;
    if(e.code==='Escape'){e.preventDefault();if(phase==='paused'){if(!cover.hidden)cover.querySelector('.cover-actions button')?.click();}else pause();return;}
    if(e.code in laneKeys){e.preventDefault();lane(laneKeys[e.code]);}
    else if(e.code==='Space'){e.preventDefault();charge(e.timeStamp);}
  },on);
  window.addEventListener('blur',pause,on);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();},on);
  $('slice-canvas').addEventListener('race-render-error',pause);
  async function load(){
    startHow();
    $('slice-back').onclick=toSetup;
    $('slice-help').onclick=e=>{const w=cover.querySelector('.how-wrap');w.hidden=!w.hidden;e.currentTarget.setAttribute('aria-expanded',String(!w.hidden));};
    const form=getForm?.();if(form||level?.weather){const p=cover.querySelector('.slice-form');p.hidden=false;p.textContent=[...(level?.weather?[`天氣：${WEATHER[SKY].name}`]:[]),...(form?.notes||[])].join(' · ');
      if(level?.weather){const i=new Image();i.src=`./assets/ui/weather_${SKY}.webp`;i.alt='';i.style.cssText='height:1.6em;vertical-align:-.45em;margin-right:.3em';p.prepend(i);}}
    // While it waits the button counts the model files in (2026-10-05: a player on the live site sat on 準備中… with no
    // sign of anything happening); nothing new for 25 s (a stalled download never fails by itself) → the button reloads
    // the page (what did arrive is in the browser's cache).
    // The loading page (2026-10-06, the user): while the scene is not ready the screen is the city's painting (the scene's
    // canvas is hidden: sceneReady) under the start card, whose button is a bar that fills; after a second of that the
    // how-to-play cards come up above the card (they turn by themselves; slice.css .is-loading). The scene, 起跑 and the
    // cards' leaving all happen at once, when everything is in and has drawn. The usual load (everything already
    // downloaded) is over before the second is.
    const btn=$('slice-start');let seen=-1,since=performance.now();const how=cover.querySelector('.how-wrap'),d0=loadState.done,n0=loadState.total;   // d0, n0: the counts before this load (they run on through the session)
    const t0=performance.now();
    const showHow=setTimeout(()=>{cover.classList.add('is-loading');how.hidden=false;},1000);
    const wait=setInterval(()=>{if(loadState.done!==seen){seen=loadState.done;since=performance.now();}
      if(performance.now()-since>25000){clearInterval(wait);btn.disabled=false;btn.textContent='連線太慢，點這裡重新載入';btn.onclick=()=>location.reload();}
      else{const n=loadState.total-n0,d=loadState.done-d0;btn.textContent=n?`準備中… ${d}/${n}`:'準備中…';btn.style.setProperty('--p',n?.8*d/n:0);}},400);   // the models are the first 80% of the bar
    try{try{await Promise.all([preloadPresentation(rivals.length>0),preloadModels(cityModels(city)),preloadBuddies(team.map(h=>h.coat))]);}finally{clearInterval(wait);}
      // The track and the horse stand ready behind the start card (the same scene the run then uses).
      if(phase==='ready'&&!renderer){game=makeGame();stage();frameId=requestAnimationFrame(frame);}
      btn.textContent='準備中…';btn.style.setProperty('--p',.9);   // the models are in: the scene's own pictures and first frames are the rest
      // 起跑, and the scene itself, only once it is whole and has drawn (its first frames compile the shaders too).
      await sceneReady();if(phase==='exited')return;
      try{localStorage.setItem('hoofbeat.loadtime.race',((performance.now()-t0)/1000).toFixed(1))}catch{}   // Settings → About shows it (for reports of slow loading)
      clearTimeout(showHow);if(cover.classList.contains('is-loading')){cover.classList.remove('is-loading');how.hidden=true;$('slice-help').setAttribute('aria-expanded','false');}
      $('slice-start').disabled=false;$('slice-start').textContent='起跑';$('slice-start').onclick=newRun;}
    catch(error){$('slice-start').disabled=false;$('slice-start').textContent='重新載入模型';$('slice-start').onclick=load;feedback('模型載入失敗，請重試');}
  }
  load();
  return {exit};
}
