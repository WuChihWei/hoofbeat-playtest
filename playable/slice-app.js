import {raceHudMarkup,raceControlsMarkup,updateEnergyControls,hoof} from '../race-hud.js?v=r304';
import {relayCourse,soloCourse} from '../course/courses.mjs?v=r304';
import {esc,icon,brand,wallet,chest} from '../ui/ui.js?v=r304';
import {compositionRank} from '../race-composition.mjs?v=r304';
import {ChaseRenderer} from '../race-scene.js?v=r304';
import {preloadPresentation,preloadModels,preloadBuddies,loadState,loadsSettled} from '../approved-assets.js?v=r304';
import {cityModels} from '../approved-environment.js?v=r304';
import {RaceClock} from '../race-session.js';
import {SliceGame,DEFAULT_TEAM} from './slice-game.mjs?v=r304';
import {ControlRouter} from './control-router.mjs?v=r304';
import {RaceAudio,readLatency} from '../audio.js?v=r304';
import {addLog,raceEntry} from '../playtest.js?v=r304';
import {SLICE_CONFIG,sliceChart,TERRAIN_NAME,SOLO,fieldRivals} from './slice-config.mjs?v=r304';

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
// Practice (2026-10-05, the user: before a regular player's first solo run, and Settings → 新手練習): five things to try,
// one at a time, each on a scene set up for it there and then, so there is nothing to wait for (LESSONS below). It runs
// by the solo rules on the chosen city's track (long: it ends when the five are done, not at a line) with nothing on the
// road but coins and what a lesson puts there (an apple, a fence) and one coach horse the lessons move. No rewards.
// TUTORIAL marks it done.
const PRACTICE_RIVALS=[{id:'coach',name:'教練',types:['straight','curve','mud'],coats:[3,9,8],pace:4,lane:1,start:-300,sprintAt:2,skill:0}];   // not a competitor: a horse to practise on (skill 0: no rhythm, no charge, no sprint), out of sight behind until a lesson places it
// PRACTICE_SAY: what each one's card says before it starts (the game stands still under it, with a picture of the scene:
// assets/ui/practice_<n>.webp; 2026-10-05, the user).
const PRACTICE_SAY=['圓圈滑到腳印時，點那一邊的腳印。連續踩中 5 下，連擊會讓夥伴加速。','蘋果在旁邊的車道。把靠那一邊的腳印往外滑就會換道，跑過去吃掉它，吃到會加速。','對手會從後面、旁邊的車道追上來。把腳印往牠那邊滑，換到牠前面，牠就過不去。','前面有一座欄。圓圈縮到腳印時，兩個腳印一起按，跳過去。','前面有對手擋路。追到牠後面時按右邊的蓄力鈕，從牠頭上飛過去。'];
const PRACTICE_STEPS=['跟著節奏點腳印：連擊會加速','吃蘋果：加速','左右換道：擋住後面的對手','兩個腳印一起按：跳過一座欄','按蓄力鈕：飛越擋在前面的對手'];   // the practice cover's list: all there is to try
const PRACTICE_LENGTH=9000;   // m of track for the practice (about four minutes at an easy pace): the five take about one
export const TUTORIAL='hoofbeat.tutorial.v1';
const TYPE_NAME={straight:'直線型',curve:'彎道型',mud:'泥地型'},GAIT_NAME=['小跑步','大跑步','奔跑'];   // GAIT_NAME: slice-game gait()
// How to play: four picture cards on the start cover, one every 2 s (tap to skip ahead).
const HOW=[
  ['<i class="how-hoof y">%H</i><i class="how-hoof b">%H</i>','跟著節奏點黃／藍腳印','打在中心點 5 下，蓄力鈕存一段'],
  ['<i class="how-key">蓄</i>','有一段就按蓄力鈕衝刺','跟在對手後面按：直接飛越牠 · 換棒時蓄力歸零'],
  ['<i class="how-key">‹</i><i class="how-hoof y">%H</i><b class="how-plus">/</b><i class="how-hoof b">%H</i><i class="how-key">›</i>','腳印往外滑換道','兩個腳印同按：跳欄'],
  ['%L','三棒接力','夥伴的適性對上場地，跑得更快'],
];
// Solo run: its own last card (no relay).
const HOW_SOLO=[HOW[0],['<b class="how-plus">COMBO ×</b>','連擊越久，夥伴越快','小跑步 → 大跑步 → 奔跑 · Miss 會掉速，每位夥伴有自己的上限'],['<i class="how-key">蓄</i>','有一段就按蓄力鈕衝刺','衝刺中漏拍不掉速 · 存滿就不再漲，邊跑邊用'],
  ['<i class="how-key">🍎</i>','吃到蘋果，自動多加速 2 秒','蘋果在金幣旁邊的車道：換道去吃'],HOW[2]];
// ?auto=<share> in the page URL (testing and demos): that share of the notes is hit for you, hurdles are jumped;
// the charge button stays yours.
const AUTO=+new URLSearchParams(location.search).get('auto')||0;
const GHOST_STEP=.5,JUMPS='hoofbeat.jumps.v1',HAND='hoofbeat.hand.v1';   // JUMPS: hurdles cleared so far (the JUMP guide retires after 3); HAND: 'left' puts the charge button on the left
// The apple as a drawing (an emoji is not drawn on every phone).
const APPLE='<svg class="apple-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#ff5a48" d="M12 8c-3-2-7 0-7 5s3 8 5 8c1 0 1-.6 2-.6s1 .6 2 .6c2 0 5-3 5-8s-4-7-7-5z"/><path fill="#7ac74f" d="M12 8c0-2 1-4 3-4 0 2-1 4-3 4z"/></svg>';
// Touch feedback: the phone's own haptics in the iOS app (Capacitor Haptics; web pages cannot vibrate an iPhone), the
// Vibration API elsewhere. kind: tap · hit · strong · good (a reward) · bad.
const BUZZ={tap:['impact',{style:'LIGHT'},12],hit:['impact',{style:'MEDIUM'},22],strong:['impact',{style:'HEAVY'},[25,30,25]],good:['notification',{type:'SUCCESS'},[10,20,10]],bad:['notification',{type:'ERROR'},30]};
const buzz=kind=>{const [method,options,pattern]=BUZZ[kind],native=window.Capacitor?.isNativePlatform?.()&&window.Capacitor.nativePromise;
  if(native)native('Haptics',method,options).catch(()=>{});else navigator.vibrate?.(pattern);};
// practice: the five things to try (see PRACTICE_RIVALS; with solo: its exit dest 'solo' is the real run).
export async function startSlice({onExit,tag='HOOFBEAT',city=null,team=DEFAULT_TEAM.map(h=>({...h,name:'Buddy'})),getForm=null,onFinish=null,getBest=null,getBrief=null,getGhost=null,lean=false,practice=false,solo=false,rivalCount=0}={}){   // getBest() → the record to beat on this track (simulation s) or null
  const rivals=practice?PRACTICE_RIVALS:solo?fieldRivals(rivalCount+1):RIVALS,field=!practice&&rivals.length>0,   // solo (單騎): team is the one horse [{id, name, coat, type, stats}], the SOLO rules, rivalCount (0, 1, 2 or 4) rivals on one buddy each by the same rules; field: there is a place to run for
    rivalName=id=>rivals.find(r=>r.id===id)?.name??'你';
  const ac=new AbortController(),on={signal:ac.signal};
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./slice.css?v=r304',import.meta.url);document.head.append(css);
  await new Promise(r=>{css.onload=css.onerror=r;});   // the page is swapped only once the race's styles are in: without them it was one black frame between the pick page and the race (2026-10-06, seen in a screen recording)
  const app=document.querySelector('#app');
  const lefty=(()=>{try{return localStorage.getItem(HAND)==='left'}catch{return false}})(),touch=matchMedia('(pointer: coarse)').matches,info=getBrief?.()??null;
  app.innerHTML=`<main class="slice-shell ui-root ui-live is-ready${solo?' is-solo':''}${practice?' is-practice':''}${lefty?' lefty':''}${lean?' lean':''}" style="background-image:url(assets/backdrops/${city||'taipei'}.webp)"><canvas id="slice-canvas" aria-label="HOOFBEAT 三車道賽道"></canvas>
    ${raceHudMarkup(rivals)}<div id="slice-coach" aria-live="polite" hidden><b></b><span></span></div>
    <i id="slice-flash" aria-hidden="true"></i><div id="slice-feedback" aria-live="polite"></div><div id="slice-count" aria-live="assertive"></div><div id="slice-combo" data-tier="0"><b>–</b><small>COMBO</small></div>${field?'<div id="slice-rank"><b></b><small></small></div>':''}<b id="judge" class="judge" aria-hidden="true"></b><div id="slice-goal" hidden></div>${solo?`<div id="slice-apples" hidden>${APPLE}<b>0</b></div>`:''}<div id="slice-final-call" hidden></div><div id="slice-chase" hidden></div><i id="chase-left" class="chase-edge" hidden>‹</i><i id="chase-right" class="chase-edge" hidden>›</i><div id="slice-jump-hint"></div>
    ${raceControlsMarkup()}
    <div id="slice-result" hidden></div><div id="slice-cover"><button id="slice-back" class="ui-icon-btn cover-back" aria-label="返回">${icon('back','')}</button><button id="slice-help" class="ui-icon-btn cover-help" aria-label="玩法說明" aria-expanded="false">?</button>
      <section><small>${esc(info?.title??tag)}</small><h1>${practice?'新手練習':esc(info?.goal??(solo?'單騎練跑':'三棒接力'))}</h1>
        ${info&&solo?`<p class="cover-stars" role="img" aria-label="${info.stars} 顆星">${[0,1,2].map(k=>`<i class="${k<info.stars?'on':''}">★</i>`).join('')}</p>`:''}
        ${practice?`<p class="cover-tip">先試這五個操作。每完成一個，下一個情境會自動出現。</p><ol class="cover-steps">${PRACTICE_STEPS.map(t=>`<li>${t}</li>`).join('')}</ol>`:info?.missions?`<details class="cover-fold" ${lean?'':'open'}><summary>這場的任務 ×${info.missions.length}</summary><ul class="cover-missions">${info.missions.map(m=>`<li>${esc(m)}</li>`).join('')}</ul></details>`:''}
        <div class="how-wrap" hidden>${howTo()}${touch?'':'<p class="slice-keys">鍵盤 X／N 踩拍 · ←／→（Z／M）換道 · X＋N 跳欄 · 空白鍵 衝刺 · Esc 暫停</p>'}</div><p class="slice-form" hidden></p>
        <button id="slice-start" class="ui-btn primary block" disabled>準備中…</button>${practice?'<button id="slice-skip" class="ui-btn block">跳過，直接玩</button>':''}</section></div></main>`;
  const $=id=>document.getElementById(id),pads=[$('slice-left'),$('slice-right')],clock=new RaceClock(),shell=document.querySelector('.slice-shell');
  const chargeBtn=$('slice-charge'),tracks=[...document.querySelectorAll('.slide-track')],dots=[...document.querySelectorAll('.lane-dots i')],allControls=[...pads,chargeBtn];
  if(solo)document.querySelector('.hud-position').className='hud-position idle';   // no place to show; the chip shows only once there is a pace to compare with (below)
  const sound=new RaceAudio();
  // Times are shown in wall-clock seconds (simulation seconds / tempo), as the player felt them.
  const wall=t=>{const s=t/SLICE_CONFIG.tempo;return `${Math.floor(s/60)}:${(s%60).toFixed(2).padStart(5,'0')}`;},secs=t=>(Math.abs(t)/SLICE_CONFIG.tempo).toFixed(2);
  let game,renderer,resolver,phase='ready',feedbackUntil=0,bigUntil=0,seen=0,frameId,finalTen=false,peak=0;
  let runs=0,streak=0,gaitShown=0,countShown=null,landAt=0,landClear=false,wasCarried=false,resultTimer=0;
  let trace=[],ghost=null,target=null,leading=null,passAt=0,lostAt=-9,hurry=-1,resumeTimer=0;   // trace: this run's metres every GHOST_STEP; ghost: the best run's; target: the time for the next star
  const shownEarly=new Set();   // notes whose hit was shown at the press (hitNow); the judgement follows a chord window later
  const lag=readLatency()/1000*SLICE_CONFIG.tempo;   // simulation s
  // Playtest log (playtest.js): each run once, as it ends: finished, left, or restarted part-way.
  const logRun=result=>{if(!game||game.logged)return;game.logged=true;
    addLog(raceEntry(game,result,{city,practice,mode:solo?'solo':'relay',team:team.map(h=>h.name),fps:renderer?.frameAverage?Math.round(1000/renderer.frameAverage):null,perf:perfLog(),latency:readLatency()}));};
  const midRace=()=>['running','paused','countdown'].includes(phase);
  // Practice lessons, one at a time in the coach line (n/5 and what to do). `setup` runs once as a lesson starts and puts
  // its scene in front of the player; `tick` every frame (a scene that went by is set up again: nobody waits for a
  // chance); `done` → the next one at once; `win`: what it showed, said as it is ticked off.
  let lesson=0,lessons=[],taught=0,ticking=false;
  const count=(type,from=0)=>game.actions.slice(from).filter(e=>e.type===type).length;   // since action index `from`
  // The coach horse `gap` m from the player (behind: negative) in `lane` at `speed`; it holds that lane (no thinking).
  const coachTo=(gap,lane,speed)=>{const r=game.rivals[0];r.laneChanges.push({from:lane,to:lane,t:game.time});r.targetLane=r.lane=r.laneValue=lane;r.distance=game.distance+gap;r.blockedBy=r.leap=null;r.think=Infinity;coachPace(speed);return r;};
  const coachPace=speed=>game.rivals[0].forms.forEach(f=>f.baseSpeed=speed);
  const beside=()=>game.targetLane<1?game.targetLane+1:game.targetLane-1;   // a lane next to the player's
  const reach=()=>Math.max(42,game.speed*3.6);   // m ahead to put a thing: about 3.6 s to read the line and act
  const LESSONS=()=>[
    // 1 The rhythm: five in a row; the combo is what speeds the buddy up (the solo rules).
    {text:()=>`跟著節奏點腳印：連續踩中 5 下（${Math.min(5,game.combo)}/5）`,done:()=>game.combo>=5,win:'連擊讓夥伴加速了'},
    // 2 An apple in the lane beside (a slide of that pad): missed → another.
    {text:L=>L.lane>game.targetLane?'右邊車道有蘋果：把右腳印往右滑，過去吃掉它':L.lane<game.targetLane?'左邊車道有蘋果：把左腳印往左滑，過去吃掉它':'蘋果就在前面：直直過去吃掉它',
      setup:L=>{L.lane=beside();const a=L.apple=game.apples.find(a=>a.distance>1e8)??game.apples[0];a.collected=false;a.lane=L.lane;a.distance=game.distance+reach();},
      tick:L=>{if(!L.apple.collected&&L.apple.distance<game.distance-4)L.setup(L);},done:from=>count('apple',from)>=1,win:'吃到蘋果會加速'},
    // 3 Blocking: the coach comes up from behind in the lane beside, 3.5 m/s faster; in its lane ahead of it, it is held
    // behind (slice-game move()). It got past → it runs off ahead and comes again.
    {text:L=>game.rivals[0].distance>game.distance?'被牠超過了，再來一次':L.lane>game.targetLane?'後面有對手從右邊追上來：把右腳印往右滑，擋在牠前面':L.lane<game.targetLane?'後面有對手從左邊追上來：把左腳印往左滑，擋在牠前面':'就是這樣：待在牠前面，牠就過不去',
      setup:L=>{L.lane=beside();coachTo(-26,L.lane,game.speed+3.5);},
      tick:L=>{const r=game.rivals[0],past=r.distance>game.distance;coachPace(game.speed+(past?14:3.5));if(r.distance>game.distance+45)L.setup(L);},
      done:()=>game.rivals[0].blockedBy===game,win:'擋住了，牠過不去'},
    // 4 A fence ahead (the coach drops back out of sight); knocked → another.
    {text:L=>L.again?'再試一次：圓圈縮到腳印時，兩個腳印一起按':'前面有一座欄：兩個腳印一起按，跳過去',
      setup:L=>{coachPace(4);const h=L.fence=game.hurdles.find(h=>h.distance>1e8)??game.hurdles[0];h.state=null;delete h.hitAt;delete h.cue;h.distance=game.distance+reach()+8;},
      tick:L=>{if(L.fence.state==='hit'&&game.time>L.fence.hitAt+1){L.again=true;L.setup(L);}},done:from=>count('clear',from)>=1,win:'跳過去了'},
    // 5 The leap, as the charge button works (2026-10-05, the user: the button stays as it is, the lesson says what it
    // does): right behind a horse the button leaps it. The coach is put in the player's lane just ahead, slow, and a
    // sprint is always in hand (charge and stamina given). Pressed too early it is a plain sprint: once close, the button
    // again (or both pads) leaps. Passed some other way → again.
    {text:()=>game.leapTarget(game)?'現在！按蓄力鈕，從牠頭上飛過去':game.boostActive()?'衝刺中：追到牠後面，再按一次蓄力鈕飛過去':'前面有對手擋路：追到牠後面時按蓄力鈕，從牠頭上飛過去',
      setup:()=>{coachTo(18,game.targetLane,8.5);},
      tick:L=>{const c=game.config;if(!game.boostActive()&&game.energy<c.boostCost){game.energy=c.boostCost;game.stamina=game.pool;game.restAt=0;}
        if(game.rivals[0].distance<game.distance-4)L.setup(L);},done:from=>count('leap',from)>=1,win:'飛越成功'},
  ];
  const coaching=practice;
  function coach(){
    const L=lessons[lesson],line=$('slice-coach');
    // A lesson starts with its card: a moment after the last one was ticked off the game stands still, the card says
    // what comes next with a picture of it, and 開始 runs on (two beats) with the scene set; then only the line is left.
    if(L&&L.from===undefined){if(clock.elapsed()<(L.at??0)){put(line,'hidden',true);return;}
      L.from=game.actions.length;L.setup?.(L);pause({small:`第 ${lesson+1} 項 / ${lessons.length}`,title:PRACTICE_STEPS[lesson],text:PRACTICE_SAY[lesson],img:`assets/ui/practice_${lesson+1}.webp?v=1`});return;}
    if(L&&L.done(L.from)){ticking=true;feedback(`第 ${lesson+1} 項完成 · ${L.win}`,'lime',true);ticking=false;lesson++;sound.accent('lesson');buzz('good');if(lessons[lesson])lessons[lesson].at=clock.elapsed()+1.2;else taught=clock.elapsed();return coach();}
    L?.tick?.(L);
    if(!L&&clock.elapsed()>taught+1.6){game.finishTime=game.time;game.finished=true;}   // all five: the practice ends here (the leap has landed)
    put(line,'hidden',!L);if(L){put(line.firstChild,'text',`${lesson+1}/${lessons.length}`);put(line.lastChild,'text',L.text(L));}
  }
  const cover=$('slice-cover');let howTimer=0;
  function howTo(){const how=solo?HOW_SOLO:HOW;
    const legs=`<span class="how-legs">${team.map((h,i)=>`<i><small>第${i+1}棒</small>${esc(h.name)}</i>`).join('')}</span>`;
    return `<div class="how" role="group" aria-label="玩法">${how.map(([art,t,sub],i)=>`<div class="how-card${i?'':' on'}"><div class="how-art">${art.replaceAll('%H',hoof).replace('%L',legs)}</div><b>${t}</b><small>${sub}</small></div>`).join('')}
      <div class="how-dots">${how.map((_,i)=>`<button aria-label="第 ${i+1} 張" class="${i?'':'on'}"></button>`).join('')}</div></div>`;
  }
  function startHow(){
    const cards=[...cover.querySelectorAll('.how-card')],dots=[...cover.querySelectorAll('.how-dots button')];let at=0;
    const show=i=>{at=(i+cards.length)%cards.length;cards.forEach((c,k)=>c.classList.toggle('on',k===at));dots.forEach((d,k)=>d.classList.toggle('on',k===at));};
    dots.forEach((d,i)=>d.onclick=()=>{show(i);restart();});cover.querySelector('.how')?.addEventListener('click',e=>{if(!e.target.closest('button')){show(at+1);restart();}});
    const restart=()=>{clearInterval(howTimer);howTimer=setInterval(()=>show(at+1),2000);};restart();
  }
  // The top line is for the big moments (0.9 s, with a pop; tone: its colour). A hint (tone 'hint', 0.5 s) never takes
  // one over. Hit judgements have their own labels beside the hoofs (judge).
  // keep: a moment big enough to be written even for a lean HUD.
  function feedback(text,tone='',keep=false){
    const now=clock.elapsed(),hint=tone==='hint',el=$('slice-feedback');if(practice&&!ticking&&phase==='running'||lean&&!keep||hint&&now<bigUntil)return;   // the practice: only a lesson ticked off is said here (the line under the map is what to do; a race's own remarks would keep hiding it)
    el.textContent=text;el.className=tone;feedbackUntil=now+(hint?.5:.9);
    if(!hint)bigUntil=feedbackUntil;   // a subtitle (slice.css): no pop
  }
  // The judgement: one label where GO! shows, over the track ahead (2026-10-04, the user: one, there; it was one beside
  // each hoof, then one at the bottom), re-used (a new text and its animation restarted).
  const judgeLabel=$('judge');
  function judge(side,kind,offset=0){
    // A miss or an empty tap has no word: that hoof just goes dark for a moment.
    if(kind==='miss'||kind==='empty'){pads[side].animate([{filter:'brightness(.45) saturate(.4)'},{filter:'none'}],{duration:260,easing:'ease-out'});return;}
    if($('slice-count').getAnimations().length)return;   // the big centre text (GO!, the countdown) is still showing there
    const el=judgeLabel;el.className=`judge ${kind}`;el.textContent=kind==='perfect'?'PERFECT':'GOOD';
    el.animate(still?[{opacity:1},{opacity:1,offset:.8},{opacity:0}]:kind==='perfect'?[{opacity:1,scale:1.22,translate:'0 0'},{opacity:1,scale:1,translate:'0 0',offset:.3},{opacity:0,scale:1,translate:'0 -12px'}]
      :[{opacity:1,scale:1.2},{opacity:1,scale:1,offset:.3},{opacity:0,scale:1}],{duration:380,easing:'ease-out'});
  }
  // A full-screen edge flash (sprint: lime, apple: red, the finish: white).
  function flash(colour,peak=.4,ms=240){if(still)return;const el=$('slice-flash');el.style.setProperty('--c',colour);el.animate([{opacity:peak},{opacity:0}],{duration:ms,easing:'ease-out'});}
  // The big centre text: the countdown, GO!, FINISH.
  function banner(text,kind='',ms=900){const el=$('slice-count');el.textContent=text;el.className=kind;judgeLabel.getAnimations().forEach(x=>x.cancel());
    el.animate(still?[{opacity:1},{opacity:1,offset:.8},{opacity:0}]:[{opacity:1,scale:1.6},{opacity:1,scale:1,offset:.28},{opacity:1,scale:1,offset:.8},{opacity:0,scale:1}],{duration:ms,easing:'ease-out'});}
  // The HUD is written only where a value changed: rewriting it every frame re-laid out the page every frame on phones.
  const shown=new WeakMap(),put=(el,key,v)=>{const o=shown.get(el)??{};if(o[key]===v)return;o[key]=v;shown.set(el,o);
    if(key==='text')el.textContent=v;else if(key in el)el[key]=v;else el.style.setProperty(key,v);};
  // Frame timing for the playtest log (ms): work = this page's frame (simulation, HUD, draw), draw = the renderer's part.
  const perf={n:0,work:0,draw:0,gap:0,last:0},perfLog=()=>perf.n?{workMs:+(perf.work/perf.n).toFixed(1),drawMs:+(perf.draw/perf.n).toFixed(1),frameMs:+(perf.gap/perf.n).toFixed(1)}:null;
  // The rhythm dial (opposite the charge button, under the notes): the streak in the middle, popping on every hit,
  // and round it how far up its range the horse is running (--fill, coloured by gait; frame()).
  // It grows and changes colour with the streak (TIERS) and celebrates at MILESTONES; a long one that breaks falls away.
  const TIERS=[10,25,50],MILESTONES=new Set([10,25,50,75,100]);
  function combo(n,lost=0){const el=$('slice-combo'),num=el.firstChild;
    if(n<3){num.textContent=n?String(n):'–';el.dataset.tier='0';
      if(lost>=10&&!still)el.animate([{filter:'grayscale(1) brightness(.6)',rotate:'-10deg'},{filter:'none',rotate:'0deg'}],{duration:340,easing:'ease-out'});
      return;}
    num.textContent=String(n);el.dataset.tier=String(TIERS.filter(x=>n>=x).length);
    const big=MILESTONES.has(n);if(!still)num.animate([{scale:big?1.9:1.3},{scale:1}],{duration:big?260:160,easing:'ease-out'});
    if(big){sound.accent('milestone');buzz('good');}
  }
  // What a hit looks, sounds and feels like. It runs at the press (down), not when the hit is judged a chord window
  // later: the hand and the hoof beat land together. n: the streak this hit makes.
  function hitNow(side,perfect,offset,n){
    sound.hoof(side,perfect,game.speed/game.config.baseSpeed,n);renderer.pulse(side,game.time,perfect?1:.5);
    hitWave(side,perfect);buzz(perfect?'hit':'tap');judge(side,perfect?'perfect':'good',offset);
  }
  function hitWave(side,perfect){
    const wave=document.createElement('span');wave.className=`hit-wave ${perfect?'perfect':'good'}`;
    pads[side].append(wave);wave.addEventListener('animationend',()=>wave.remove(),{once:true});
    // Pad rebound (CSS `scale`, on top of its centring transform): Good soft and short, Perfect snappier and brighter.
    pads[side].animate(perfect?[{scale:.86,filter:'brightness(1.35)'},{scale:1.1,offset:.45},{scale:1,filter:'none'}]:[{scale:.92},{scale:1.04,offset:.5},{scale:1}],
      {duration:perfect?150:190,easing:'cubic-bezier(.3,1.4,.5,1)'});
  }
  // Coin pickup (race-scene 'coin-burst', screen point): a coin flies from there to the HUD counter, "+10" floats up,
  // the counter pops as it lands.
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const glance=()=>{const r=game.metrics().rivals.sort((a,b)=>Math.abs(a.distance-game.distance)-Math.abs(b.distance-game.distance))[0];if(r)renderer.glance(r.lane<game.laneValue?-1:1);};
  // A phrase of the chart (its notes share the first part of their id): is it all hit so far?
  const phraseOf=n=>n.id.split('-')[0],cleanPhrase=k=>game.notes.every(n=>phraseOf(n)!==k||n.state!=='miss');
  // The run in four quarters against the best run's (its ghost): wall seconds behind (+) or ahead (−) in each, or null.
  const splits=()=>{if(!ghost)return null;const L=game.config.length,when=(a,d)=>{const k=a.findIndex(x=>x>=d);if(k<=0)return k?a.length*GHOST_STEP:0;return (k-1+(d-a[k-1])/((a[k]-a[k-1])||1))*GHOST_STEP;};
    const mine=[...trace,L],at=[0,.25,.5,.75,1].map(q=>[q<1?when(mine,q*L):game.finishTime,when([...ghost,L],q*L)]);
    return [1,2,3,4].map(i=>+(((at[i][0]-at[i-1][0])-(at[i][1]-at[i-1][1]))/game.config.tempo).toFixed(1));};
  const mark=cls=>{const m=shell.querySelector('.slice-progress .marks');if(m&&m.childElementCount<90)m.insertAdjacentHTML('beforeend',`<i class="${cls}" style="left:${(game.distance/game.config.length*100).toFixed(1)}%"></i>`);};
  function tick(t){
    if(phase!=='running')return;
    game.advance(Math.max(0,t),-Infinity);resolver.advance(t);
    if(AUTO){for(const n of game.notes){if(n.t>t)break;if(!n.state&&!n.auto){n.auto=true;if(Math.random()<AUTO)game.single(n.lane,n.t);}}
      const h=game.hurdles.find(h=>!h.state&&h.distance>game.distance);
      if(h&&(h.distance-game.distance)/game.speed<=game.config.jumpLead&&!(game.jumps.at(-1)?.t>game.time-1))game.jump(t);}
    game.expireNotes(Math.min(t-lag-game.config.chordWindow,resolver.oldestPendingTime));   // a note waits `lag` longer for its tap
  }
  // Cover card: title, text, optional stats [[label,value]], then buttons [label, action, kind?] (first = primary).
  function renderCover(title,text,buttons,stats=[],card=null){   // card: a practice lesson's {small, img}
    clearInterval(howTimer);cover.hidden=false;cover.innerHTML='<section><small></small><h1></h1><p></p><dl class="cover-stats"></dl><div class="cover-actions"></div></section>';
    cover.querySelector('small').textContent=card?.small??info?.title??tag;cover.querySelector('h1').textContent=title;cover.querySelector('p').textContent=text;
    if(card?.img){const i=new Image();i.className='cover-shot';i.alt='';i.src=card.img;cover.querySelector('p').before(i);}
    const dl=cover.querySelector('dl');dl.hidden=!stats.length;
    for(const [k,v] of stats){const d=document.createElement('div');d.innerHTML='<dt></dt><dd></dd>';d.querySelector('dt').textContent=k;d.querySelector('dd').textContent=v;dl.append(d);}
    buttons.forEach(([label,action,kind=''],i)=>{const b=document.createElement('button');b.textContent=label;b.className=`ui-btn ${i?kind.replace('confirm',''):'primary'}`;
      // 'confirm': giving the race up takes a second tap within 2 s
      b.onclick=kind.includes('confirm')?e=>{if(b.dataset.sure){action(e);return;}b.dataset.sure='1';b.textContent='再按一次';b.classList.add('danger');setTimeout(()=>{if(b.isConnected){delete b.dataset.sure;b.textContent=label;b.classList.remove('danger');}},2000);}:action;
      cover.querySelector('.cover-actions').append(b);});
    cover.querySelector('.cover-actions button')?.focus();
  }
  const toSetup=()=>exit('race'),toHome=()=>exit('home'),skip=()=>{try{localStorage.setItem(TUTORIAL,'done')}catch{}exit('solo');};   // skip: the practice is not asked again (Settings → 新手練習 still plays it); on to the real run
  let result=null;
  function exit(dest='race'){   // dest: 'race' | 'home' | 'stable' | 'solo' (after the practice: the real run) | 'play' | {city}
    if(phase==='exited')return;if(midRace())logRun('quit');phase='exited';ac.abort();cancelAnimationFrame(frameId);resolver?.reset();sound.stop();
    renderer?.dispose();renderer=null;css.remove();onExit?.(result,dest);
  }
  function pause(card=null){   // card: a practice lesson's card instead of the pause menu
    if(!['running','countdown'].includes(phase))return;
    const before=phase;tick((clock.elapsed()-SLICE_CONFIG.countdown)*SLICE_CONFIG.tempo);
    clock.pause();sound.pause();phase='paused';game.paused=true;resolver.reset();shownEarly.clear();allControls.forEach(p=>p.classList.remove('pressed'));
    // Back in: two beats to find the rhythm again (the race, rivals included, stays frozen), then it runs on.
    const resume=async()=>{if(resumeTimer)return;cover.hidden=true;await sound.prepare();
      const run=()=>{resumeTimer=0;if(phase!=='paused')return;game.paused=false;clock.resume();sound.resume(()=>clock.elapsed());phase=before;};
      if(before!=='running'){run();return;}
      const beat=600/SLICE_CONFIG.tempo;banner('2','',beat);sound.cue('approach');
      resumeTimer=setTimeout(()=>{banner('1','',beat);sound.cue('approach');resumeTimer=setTimeout(run,beat);},beat);};
    const soundLabel=()=>sound.muted?'音效：關':'音效：開',far=game.distance/game.config.length>.2?' confirm':'';   // past a fifth of the way: leaving asks twice
    if(card?.img){renderCover(card.title,card.text,[['開始',resume],['跳過，直接玩',skip,'secondary']],[],card);return;}
    renderCover('已暫停',`已跑 ${Math.round(game.distance/game.config.length*100)}% · ${wall(game.time)} · 連擊 ${game.combo} · 金幣 ${game.coinCount}`,
      [['繼續',resume],['重跑',newRun,'secondary'+far],...(practice?[['跳過，直接玩',skip,'secondary']]:[]),['換夥伴',toSetup,'secondary'+far],['離開',toHome,'secondary'+far],[soundLabel(),e=>{sound.setMuted(!sound.muted);e.target.textContent=soundLabel();},'secondary toggle']]);
  }
  const makeGame=()=>{const g=new SliceGame({config:practice||solo?{solo:true,...(practice?null:getForm?.().config)}:getForm?.().config,team,rivals,chart:practice?sliceChart(600,1e9):null,   // the practice: the plain opening phrases for as long as it takes
    course:practice?soloCourse(city||'taipei',PRACTICE_LENGTH):city?(solo?soloCourse(city):relayCourse(city)):null});
    // Practice: nothing on the road but the coins; the fences and the apples wait far off for a lesson to place them.
    if(practice){g.hurdles=[0,1].map(()=>({distance:1e9,t:1e9,state:null}));g.apples=[0,1,2].map(i=>({id:'p'+i,distance:1e9,lane:0,collected:false}));}
    return g;};
  // The scene is shown complete or not at all (2026-10-06, the user: the race was seen being put together: its sky, ground
  // and painted cards are pictures that arrive after the scene is built, each one popping in). Its canvas stays hidden
  // (slice.css .scene-ready: the city's painted backdrop, the shell's own background, shows meanwhile) until every
  // picture is in and three frames have been drawn with them. At most 10 s: a picture that never arrives must not keep
  // the race shut.
  const frames=n=>Promise.race([new Promise(r=>{const f=()=>--n<0?r():requestAnimationFrame(f);f();}),new Promise(r=>setTimeout(r,1500))]);
  const sceneReady=async()=>{await Promise.race([loadsSettled(),new Promise(r=>setTimeout(r,10000))]);await frames(3);shell.classList.add('scene-ready');};
  const stage=()=>{renderer=new ChaseRenderer($('slice-canvas'),{controls:pads,slice:true,city});renderer.prepare(game);$('slice-canvas').addEventListener('race-render-error',pause);$('slice-canvas').addEventListener('coin-burst',e=>coinFly(e.detail));};
  async function newRun(){
    if(phase==='loading')return;if(midRace())logRun('restart');phase='loading';
    resolver?.reset();sound.stop();cancelAnimationFrame(frameId);clearTimeout(resultTimer);clearTimeout(resumeTimer);resumeTimer=0;
    await sound.prepare();
    $('slice-result').hidden=true;document.querySelector('.slice-shell').classList.remove('is-result');
    clearInterval(howTimer);game=makeGame();lessons=practice?LESSONS():[];lesson=Math.min(lessons.length,+new URLSearchParams(location.search).get('lesson')||0);   // ?lesson=n: straight to the n+1-th (for the cards' pictures)
    taught=0;peak=0;seen=0;feedbackUntil=bigUntil=0;finalTen=false;result=null;phase='countdown';cover.hidden=true;
    streak=0;gaitShown=0;countShown=null;landAt=0;wasCarried=false;shownEarly.clear();$('slice-feedback').textContent='';combo(0);
    shell.classList.remove('is-ready');
    trace=[];ghost=solo&&!field?getGhost?.()??null:null;target=solo?getBrief?.().target??null:null;leading=null;passAt=0;lostAt=-9;hurry=-1;
    // The race bar's marks: the ghost of the best run (solo), an apple dot each, the real handoff points (relay).
    const L=game.config.length,barEl=document.querySelector('.slice-progress');barEl.querySelector('.marks')?.remove();
    barEl.insertAdjacentHTML('beforeend',`<span class="marks">${practice?'':game.apples.map(a=>`<i class="ap" data-apple="${a.id}" style="left:${(a.distance/L*100).toFixed(1)}%"></i>`).join('')}${ghost?'<i class="ghost"></i>':''}</span>`);
    game.course.relays?.forEach((r,k)=>barEl.style.setProperty('--h'+k,(r/L*100).toFixed(2)+'%'));
    let jumped=0;try{jumped=+localStorage.getItem(JUMPS)||0}catch{}document.querySelector('.jump-guide').hidden=jumped>=3&&!practice;
    const best=getBest?.(),goal=$('slice-goal');goal.hidden=!best;if(best)goal.textContent=`要破的紀錄 ${wall(best)}`;
    $('slice-progress').max=game.config.length;
    $('slice-final-call').hidden=true;
    $('slice-chase').hidden=true;
    resolver=new ControlRouter(game,lag);
    try{
      // The scene built for the start card (or the last run) is used again: only what a run leaves behind is cleared
      // (race-scene rerun). Anything else is rebuilt, the old picture staying up until the new one is ready.
      if(!renderer?.rerun(game)){shell.classList.remove('scene-ready');if(renderer){renderer.dispose();const old=$('slice-canvas');old.replaceWith(old.cloneNode(false));}stage();sceneReady();}   // a rebuilt scene: hidden again until it is whole (the countdown runs on)
      clock.reset();if(runs++)clock.start-=1000;   // again: a 2 s countdown (the first second is skipped, its beep too)
      sound.start(()=>clock.elapsed(),game);
      frameId=requestAnimationFrame(frame);
    }catch(error){phase='error';renderCover('無法啟動 3D 畫面',error.message,[['重試',newRun],['返回',toSetup]]);}
  }
  function frame(){
    const workStart=performance.now();if(phase==='running'){if(perf.last)perf.gap+=workStart-perf.last;perf.last=workStart;}
    const wallTime=clock.elapsed()-SLICE_CONFIG.countdown,t=wallTime*SLICE_CONFIG.tempo;
    if(phase==='countdown'&&t>=0){phase='running';banner('GO!','go',520);buzz('strong');renderer.dustBurst(16);$('slice-goal').hidden=true;}
    tick(t);
    for(const e of game.actions.slice(seen)){
      if(e.type==='rhythm'){
        if(!shownEarly.delete(e.noteId))hitNow(e.side,e.judgement==='perfect',e.offset,game.combo);   // not shown at the press (auto-play)
        sound.setCombo(game.combo);combo(streak=game.combo);
        if(e.noteId===game.notes[0].id&&e.judgement==='perfect')feedback('漂亮起跑！','gold');
        // The last note of a phrase with none of it missed: two closing notes in the rest that follows.
        const at=game.notes.findIndex(n=>n.id===e.noteId),k=phraseOf(game.notes[at]),next=game.notes[at+1];if((!next||phraseOf(next)!==k)&&cleanPhrase(k))sound.accent('streak');
      }
      else if(e.type==='rhythm-empty')judge(e.side,'empty',e.offset);
      else if(e.type==='lane')sound.cue('lane');   // the lane dots show it
      else if(e.type==='boundary'){feedback('已在最外側','hint');sound.cue('deny');}
      else if(e.type==='lane-blocked'){feedback('旁邊有對手，等空位','hint');sound.cue('deny');}
      else if(e.type==='charge-empty'){feedback(`還沒存到一段 · 踩準 ${Math.ceil((game.config.boostCost-game.energy)/game.config.perfectEnergy)} 下`,'hint');sound.cue('deny');
        if(!still)chargeBtn.animate([{translate:'0 0'},{translate:'-4px 0'},{translate:'4px 0'},{translate:'0 0'}],{duration:160});}
      else if(e.type==='charge-busy')feedback('衝刺中','hint');
      else if(e.type==='charge-tired'){feedback('體力不足 · 等體力條回來再衝','hint');sound.cue('deny');}
      else if(e.type==='charged'){if(e.segments*game.config.boostCost>=game.cap())feedback(game.fresh()?'蓄力滿了 · 按蓄力鈕衝刺':'蓄力滿了 · 等體力回來',game.fresh()?'lime':'');sound.charged(e.segments,e.segments*game.config.boostCost>=game.cap());buzz('good');
        chargeBtn.animate([{scale:1},{scale:1.3,filter:'brightness(1.6)',offset:.35},{scale:1,filter:'none'}],{duration:380,easing:'cubic-bezier(.3,1.5,.5,1)'});}
      else if(e.type==='leap'){renderer.cheer();feedback(`飛越 ${rivalName(e.over)}！`,'gold',true);sound.jump(true);sound.accent('overtake');buzz('strong');sound.duck();landAt=e.time+game.config.jumpDuration;landClear=true;}
      else if(e.type==='rival-leap'&&e.over==='player'){feedback(`${rivalName(e.id)} 從頭上飛過！`,'warn');sound.accent('warning');buzz('bad');}
      else if(e.type==='rival-trip'&&!practice){const r=game.rivals.find(x=>x.id===e.id);if(r&&Math.abs(r.distance-game.distance)<40)feedback(`${rivalName(e.id)} 絆到了`,'hint');}   // rivals knock hurdles too (the same rules): said when it happens near the player
      else if(e.type==='miss'){shownEarly.delete(e.noteId);judge(e.side,'miss');mark('ms');sound.dropLayer();if(streak>=10){sound.cue('break');buzz('bad');}combo(0,streak);streak=0;}
      else if(e.type==='jump'){sound.jump(true);sound.duck();buzz('tap');landAt=e.time+game.config.jumpDuration;landClear=false;}
      // A hurdle: how clean the take-off was (error from the ideal moment; the window is ±jumpWindow).
      else if(e.type==='clear'){const off=Math.abs(e.error??0)/game.config.jumpWindow;landClear=true;
        if(off<=.35){feedback('完美起跳！','gold',true);buzz('good');renderer.cheer();}else feedback(off>=.75?'好險！':'CLEAR!','green');}
      else if(e.type==='obstacle-miss'){mark('hit');feedback('絆到了！','warn',true);sound.collision();sound.dropLayer();buzz('bad');landAt=0;combo(0,streak);streak=0;}
      // Passed, then back in front within 5 s: "won it back", its own moment.
      else if(e.type==='overtake'){glance();if(e.rank===1)renderer.cheer();const back=clock.elapsed()-lostAt<5;lostAt=-9;feedback(back?`搶回來了！第 ${e.rank} 名`:`超越！第 ${e.rank} 名`,back?'lime':'gold',true);sound.accent(back?'milestone':'overtake');popPlace();buzz('good');}
      else if(e.type==='passed'){glance();lostAt=clock.elapsed();feedback(`被超越了！第 ${e.rank} 名`,'warn',true);sound.accent('warning');buzz('hit');}
      else if(e.type==='boost'){feedback('SPRINT!','sprint',true);sound.accent('sprint');buzz('strong');flash('#d9ff4f');}
      else if(e.type==='coin')sound.coin(+e.id.split('-')[2]||0);   // the picture: race-scene coinBurst → coinFly
      else if(e.type==='apple'){shell.querySelector(`[data-apple="${e.id}"]`)?.classList.add('got');const both=game.boostActive();feedback(both?'極速！':'蘋果加速！',both?'gold':'apple',both);sound.cue('crunch');sound.accent('apple');buzz('good');flash('#ff5a48',.34);}
      else if(e.type==='relay'){const h=team[e.leg];feedback(`第${e.leg+1}棒 ${h.name} · ${TYPE_NAME[h.type]}`);sound.accent('handoff');buzz('good');}
    }
    seen=game.actions.length;
    if(coaching&&phase==='running')coach();
    // Read-only DOM telemetry for acceptance checks; never shown in the HUD.
    // Read-only DOM telemetry for acceptance checks; never shown in the HUD (a few times a second).
    if(!((perf.tick=(perf.tick||0)+1)%8)||phase!=='running')Object.assign($('slice-canvas').dataset,{slicePhase:phase,lane:String(game.targetLane),hits:String(game.actions.filter(e=>e.type==='rhythm').length),jumps:String(game.jumps.length),coins:String(game.coinCount),boosts:String(game.boosts.length),distance:game.distance.toFixed(2),rank:String(game.metrics().rank)});
    if(phase==='countdown'){const n=Math.max(1,Math.ceil(-wallTime));if(n!==countShown){countShown=n;banner(String(n),'',1000);buzz('tap');
      if(!still)pads.forEach(p=>p.animate([{filter:'brightness(1.5)'},{filter:'none'}],{duration:220}));}}
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
      else{const d=(game.time-pace)/game.config.tempo,front=d<=0;   // wall seconds behind (+) or ahead (−)
        put(label,'text',ghost?'比最佳':'比目標');put(chip,'text',`${front?'快':'慢'} ${Math.abs(d).toFixed(1)}`);put(chip.parentElement,'className',`hud-position ${front?'ahead':d>5?'far':'behind'}`);
        if(front&&leading===false&&game.time>5&&clock.elapsed()>passAt+3){passAt=clock.elapsed();feedback(ghost?'超過最佳的自己！':'追上目標了！','lime',true);sound.accent('overtake');buzz('good');}
        leading=front;}
      if(ghost)put(shell.querySelector('.marks .ghost'),'left',`${(Math.min(game.config.length,ghost[Math.min(ghost.length-1,Math.floor(game.time/GHOST_STEP))]??game.config.length)/game.config.length*100).toFixed(1)}%`);}
    const dial=$('slice-combo'),gaitNow=String(game.gait());put(dial,'--fill',game.surge().toFixed(2));if(dial.dataset.gait!==gaitNow)dial.dataset.gait=gaitNow;
    put($('slice-speed'),'text',`${game.carried()?'爆發':'速度'} ${Math.round(game.speed)}`);
    const remaining=Math.max(0,game.config.length-game.distance);
    if(phase==='running'&&!finalTen&&remaining/(Math.max(game.speed,game.config.baseSpeed)*game.config.tempo)<=(solo?6:10)){   // the last 10 s of a relay, 6 of a one-lap run
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
    updateEnergyControls(game.energy,game.cap(),game.boostActive(),game.drafting,game.config.boostCost,game.stamina/game.pool,!game.fresh());   // the bar: this buddy's own pool
    dots.forEach((d,i)=>put(d,'className',i-1===game.targetLane?'on':''));
    const h=game.hurdles.find(h=>!h.state&&h.distance>game.distance),until=h?(h.distance-game.distance)/game.speed:Infinity;   // the next hurdle
    // Its two cues by ear: coming up (1.2 s out), and the take-off window opening.
    if(h&&phase==='running'){const c=game.config;
      if(!h.cue&&until<1.2*c.tempo+c.jumpLead){h.cue=1;sound.cue('approach');}
      if(h.cue===1&&until<=c.jumpLead+c.jumpWindow){h.cue=2;sound.cue('window');}}
    // The sprint running down on the charge button's ring (--left 1 → 0), blinking over its last half second.
    const run=game.boosts.at(-1),left=run&&game.time<run.end?(run.end-game.time)/(run.end-run.t):0;
    put(chargeBtn,'--left',left.toFixed(2));chargeBtn.classList.toggle('ending',left>0&&run.end-game.time<.5*game.config.tempo);
    if(solo){const ap=$('slice-apples'),rush=game.rushes.at(-1),on=rush&&game.time<rush.end;put(ap,'hidden',!game.apples.length);
      put(ap.lastChild,'text',`${game.appleCount}/${game.apples.length}`);put(ap,'--left',on?((rush.end-game.time)/(rush.end-rush.t)).toFixed(2):'0');ap.classList.toggle('on',!!on);}
    // The jump cue is on the hoofs: a ring round each closes in as the hurdle comes (from about 1.4 s out) and turns
    // lime while the take-off window is open; the guide under them says it in words meanwhile (it retires as a
    // standing hint once three hurdles have been cleared).
    const cj=game.config,soon=phase==='running'&&!!h&&until>0&&until<1.8,now=soon&&Math.abs(until-cj.jumpLead)<=cj.jumpWindow,guide=shell.querySelector('.jump-guide');
    put(shell,'--ring',soon?(1+.6*Math.max(0,Math.min(1,(until-cj.jumpLead)/(1.8-cj.jumpLead)))).toFixed(3):'1');shell.classList.toggle('jump-soon',soon);shell.classList.toggle('jump-now',now);
    put(guide.lastElementChild,'text',now?'跳！':soon?'同按':'JUMP');guide.classList.toggle('live',soon);
    // The lane arrows say where the horse can go: grey at the outer lane, gone while a horse is beside (slice.css).
    if(phase==='running')[-1,1].forEach((dir,k)=>{const to=game.targetLane+dir,edge=Math.abs(to)>1,block=!edge&&game.occupied(game,to),i=tracks[k].firstElementChild;
      put(i,'className',edge?'edge':block?'block':'');});
    // Relay: charge does not cross a handoff. With a segment in hand and the line coming, say so once and hurry the button.
    const toLine=!solo&&phase==='running'&&game.leg<2?(game.course.relays[game.leg]-game.distance)/game.speed/cj.tempo:Infinity,warn=game.segments()>0&&game.fresh()&&!game.boostActive()&&toLine>0&&toLine<2+2.6*(game.segments()-1);
    if(warn&&hurry!==game.leg){hurry=game.leg;feedback('快交棒了 · 蓄力帶不過去，快用掉','lime');sound.cue('window');}
    chargeBtn.classList.toggle('hurry',warn);
    const over=phase==='running'&&(game.boostActive()||(game.energy>=game.config.boostCost&&game.fresh()))&&!game.leap&&game.leapTarget(game);   // sprinting or energy for one, behind a horse: it can be leapt
    put($('slice-jump-hint'),'text',$('slice-feedback').textContent?'':over?`按蓄力鈕飛越 ${over.name}`:phase==='running'&&game.drafting&&!game.boostActive()&&game.energy<game.config.boostCost?'跟在後面蓄力加快 · 存到一段就能飛越':'');
    allControls.forEach(p=>put(p,'disabled',phase!=='running'));put($('slice-pause'),'disabled',!['running','countdown'].includes(phase));
    const drawStart=performance.now();renderer.draw(game,phase==='ready'?-1:phase==='countdown'?Math.min(-.001,t):game.time,game.metrics());
    if(phase==='running'){const end=performance.now();perf.n++;perf.work+=end-workStart;perf.draw+=end-drawStart;}
    if(game.finished&&phase==='running'){
      phase='finished';resolver.reset();sound.stop();sound.accent('finish');logRun('finish');$('slice-coach').hidden=true;
      if(practice){try{localStorage.setItem(TUTORIAL,'done')}catch{}   // practice: no rewards, straight to what next
        renderCover('五個操作都會了！','接下來是單人挑戰：跑完賽道拿星星，剛剛練的都用得上。',[['開始單人挑戰',()=>exit('solo')],['再練一次',newRun,'secondary'],['回首頁',toHome,'secondary']]);
        frameId=requestAnimationFrame(frame);return;}
      const m=game.metrics(),c=game.config,state=k=>game.notes.filter(n=>k.includes(n.state)).length,perfect=state(['perfect']);
      const cleared=game.hurdles.filter(h=>h.state==='cleared').length;try{localStorage.setItem(JUMPS,String((+localStorage.getItem(JUMPS)||0)+cleared));}catch{}
      const seen={};for(const n of game.notes)if(n.state&&n.state!=='rest'){const k=phraseOf(n);seen[k]=(seen[k]??true)&&n.state!=='miss';}
      const tally={phrases:Object.values(seen).filter(Boolean).length,phraseTotal:Object.keys(seen).length,bestCombo:game.bestCombo,perfect,hits:state(['perfect','good']),notes:state(['perfect','good','miss']),finishTime:game.finishTime,pickups:game.coinCount,boosts:game.boosts.length,stumbles:game.stumbles.length,cleared,apples:game.appleCount};   // notes: the ones judged (not the chart's tail)
      if(solo){const beat=field?rivals.length+1-m.rank:0;result={solo:true,rank:field?m.rank:null,of:rivals.length+1,bonus:beat*c.coinValue,coins:(game.coinCount+beat)*c.coinValue,appleTotal:game.apples.length,topSpeed:peak,trace,splits:splits(),...tally};}   // solo: the time is the result (the stars); coins picked up are banked, and a coin's worth for every rival beaten
      else{const bonus=c.placeBonus[m.rank-1]||0;result={rank:m.rank,coins:game.coinCount*c.coinValue+bonus,gems:c.gemBonus?.[m.rank-1]||0,bonus,lead:c.length-Math.max(...m.rivals.map(x=>x.distance)),...tally};}   // lead: m ahead of the best rival at the line
      const bank=onFinish?.(result)||{};
      // The line is a moment of its own: FINISH, a flash and a tune for how it went, then the results (a tap skips ahead).
      const grade=!field?(bank.newBest?'win':'podium'):m.rank===1?'win':m.rank<=3?'podium':'lost';
      const clean=tally.notes>0&&tally.hits===tally.notes&&!tally.stumbles;   // not one note missed, no hurdle knocked
      banner(clean?(perfect===tally.notes?'ALL PERFECT':'FULL COMBO'):'FINISH',clean?'finish gold':'finish',900);flash('#ffffff',.55,180);sound.accent(grade);buzz(grade==='lost'?'hit':'strong');
      const show=()=>{clearTimeout(resultTimer);if(phase==='finished'&&$('slice-result').hidden)showResults(result,m,bank,grade);};
      resultTimer=setTimeout(show,900);document.querySelector('.slice-shell').addEventListener('pointerdown',show,{once:true,signal:ac.signal});
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
    const tempo=SLICE_CONFIG.tempo,n=v=>Number(v).toLocaleString('en-US'),total=bank.total??0,gain=r.coins+(bank.extra||0);
    const off=bank.best?(r.finishTime-bank.best)/tempo:null,gems=(r.gems||0)+(bank.newStars||0)+(bank.daily?.gems||0);
    let again=r.solo?'再跑一次':'再來一場',near='',board='';
    if(!r.solo){
      const rows=[{name:`You · ${team.map(h=>h.name).join(' / ')}`,coat:team.at(-1).coat,time:r.finishTime,you:true},
        ...m.rivals.map(x=>({name:`Team ${x.name}`,coat:x.horses.at(-1).coat,time:x.finishTime}))].sort((a,b)=>a.time-b.time);
      // The gap that matters: to the team just ahead. Within 1.5 s it is "so close": the button says what there is to win back.
      const me=rows.findIndex(x=>x.you),up=rows[me-1];
      if(up&&(r.finishTime-up.time)/tempo<=1.5){near='就差一點！';again=`再來一場 · 追回 ${secs(r.finishTime-up.time)} 秒`;}
      board=`<ol class="res-rank">${rows.map((x,i)=>`<li class="ui-pillrow ${x.you?'':'glass'}"><b class="rk">${i+1}</b><img src="assets/stable/buddy_${x.coat}.webp?v=coats-4" alt=""><span>${esc(x.name)}</span><b class="ui-num">${wall(x.time)}</b></li>`).join('')}</ol>`;
    }else board=`<ol class="res-rank">${r.rank?`<li class="ui-pillrow glass">${icon('flag')}<span>名次</span><b>${r.rank} / ${r.of}${r.bonus?` · +${r.bonus}`:''}</b></li>`:''}${bank.xp?`<li class="ui-pillrow glass">${icon('horse')}<span>${esc(team[0].name)} 經驗</span><b>+${bank.xp} · LV ${bank.level}</b></li>`:''}${
      bank.starHint?`<li class="ui-pillrow glass">${icon('star')}<span>下一顆星</span><b>${bank.starHint}</b></li>`:''}</ol>`;
    const small=r.solo?(r.rank===1?'第 1 名！':bank.newBest&&bank.best?'新紀錄！':bank.newStars?'拿到新的星星！':off!==null&&off<=1?'差一點！':'單騎完成'):near||'比賽結果';
    const award=['gold','red','blue'][r.solo&&!r.rank?3-(bank.stars??0):r.rank-1];   // 1st gold, 2nd red, 3rd blue (the user); solo: by its stars
    const tag='<span class="ui-tag yellow">新紀錄</span>',el=$('slice-result');
    const cols=[['獲得金幣','coins','<span data-count>+0</span>',''],['金幣總數','coin',n(total),''],['最高連擊','note',r.bestCombo,bank.newCombo?tag:''],['完美','star',r.perfect,''],['任務獎勵','flag',`+${bank.missionCoins||0}`,'']];
    el.innerHTML=`<header class="ui-top">${brand()}<div class="res-wallets">${wallet(total-gain,{gems:bank.gems??null})}</div></header>
      <div class="res-banner ui-glass ui-enter"><img src="assets/ui/res_laurel_l.webp" alt=""><div><small>${small}</small><b class="res-big">${r.solo?wall(r.finishTime):`第 ${r.rank} 名`}</b></div><img src="assets/ui/res_laurel_r.webp" alt=""></div>
      ${r.solo&&bank.stars!=null?`<p class="res-stars" role="img" aria-label="${bank.stars} 顆星">${[0,1,2].map(k=>`<i class="${k<bank.stars?'on':''}${k>=bank.stars-bank.newStars&&k<bank.stars?' new':''}">★</i>`).join('')}</p>`:''}
      <div class="res-mid">${award?`<img class="res-award" src="assets/ui/award_${award}.webp?v=2" alt="">`:''}
        <p class="res-newsline">${(bank.news||[]).map(x=>`<span class="ui-tag yellow">${esc(x)}</span>`).join('')}${gems?`<span class="ui-tag"><i class="gem">${icon('gem')}</i>+${gems}</span>`:''}${!r.solo&&bank.xp?`<span class="ui-tag">每位 +${bank.xp} XP${bank.levelUp?' · Level up':''}</span>`:''}</p></div>
      <article class="ui-panel res-rewards ui-enter"><h2>比賽獎勵</h2><div>${cols.map(([l,i,v,t])=>`<div><small>${l}</small><img src="assets/ui/res_${i}.webp" alt=""><b>${v}</b>${t}</div>`).join('')}</div></article>
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
  const simTime=stamp=>(clock.inputElapsed(stamp)-SLICE_CONFIG.countdown)*SLICE_CONFIG.tempo;
  function down(side,source,eventStamp){
    if(phase!=='running')return;
    // Hoof taps are judged `lag` earlier (Settings → 節奏校正: players tap to what they hear).
    const t=simTime(eventStamp),at=t-lag;tick(t);pads[side].classList.add('pressed');
    // The note this press will take is looked up now (the same lookup the judgement makes a chord window later, when it
    // is sure the press is not half of a jump) and the hit is shown at once; nothing is scored here.
    const hit=game.noteFor(side,at,shownEarly);
    if(!resolver.down(side,source,at))return;   // an ignored press (that hoof is already down)
    if(hit){shownEarly.add(hit.note.id);hitNow(side,hit.perfect,hit.note.t-at,game.combo+1);}else sound.tap(side);
  }
  function up(side,source){resolver?.up(source);pads[side].classList.remove('pressed');}
  function lane(side){if(phase!=='running')return;tick(simTime(performance.now()));buzz(resolver.lane(side)?.type==='lane'?'tap':'bad');}
  function charge(stamp){if(phase!=='running')return;const t=simTime(stamp);tick(t);resolver.charge(t);}
  // A hoof is a slider knob: a press is a rhythm tap at once; sliding it outward past SLIDE of its track changes lane
  // (once per press) and it springs back on release. Pressing its track works like pressing the knob.
  const SLIDE=.45,slides=new Map();
  pads.forEach((pad,side)=>{
    const out=side?1:-1,room=()=>{const p=pad.getBoundingClientRect(),t=tracks[side].getBoundingClientRect();return side?t.right-p.right:p.left-t.left;};
    const end=id=>{if(!slides.has(id))return;slides.delete(id);pad.classList.remove('sliding');pad.style.translate='';};
    const start=e=>{e.preventDefault();pad.setPointerCapture(e.pointerId);slides.set(e.pointerId,{x:e.clientX,room:Math.max(20,room()),done:false});pad.classList.add('sliding');down(side,`p${e.pointerId}`,e.timeStamp);};
    pad.onpointerdown=start;tracks[side].onpointerdown=start;tracks[side].oncontextmenu=e=>e.preventDefault();
    pad.onpointermove=e=>{const s=slides.get(e.pointerId);if(!s)return;const d=Math.max(0,Math.min(s.room,(e.clientX-s.x)*out));
      pad.style.translate=`${d*out}px 0`;if(!s.done&&d>=s.room*SLIDE){s.done=true;lane(side);}};
    pad.onpointerup=e=>{end(e.pointerId);up(side,`p${e.pointerId}`);};
    pad.onpointercancel=e=>{end(e.pointerId);resolver?.reset();allControls.forEach(p=>p.classList.remove('pressed'));};
    pad.onlostpointercapture=e=>{end(e.pointerId);if(resolver?.feet.sources.has(`p${e.pointerId}`))pad.onpointercancel(e);};
    pad.oncontextmenu=e=>e.preventDefault();
  });
  chargeBtn.onpointerdown=e=>{e.preventDefault();chargeBtn.classList.add('pressed');charge(e.timeStamp);};
  chargeBtn.onpointerup=chargeBtn.onpointercancel=()=>chargeBtn.classList.remove('pressed');chargeBtn.oncontextmenu=e=>e.preventDefault();
  const keys={KeyX:0,KeyN:1},laneKeys={KeyZ:0,ArrowLeft:0,KeyM:1,ArrowRight:1};
  $('slice-pause').onclick=pause;
  window.addEventListener('keydown',e=>{
    if(phase==='exited')return;
    if(e.repeat)return;
    if(e.code==='Escape'){e.preventDefault();if(phase==='paused'){if(!cover.hidden)cover.querySelector('.cover-actions button')?.click();}else pause();return;}
    if(e.code in keys){e.preventDefault();down(keys[e.code],e.code,e.timeStamp);}
    else if(e.code in laneKeys){e.preventDefault();lane(laneKeys[e.code]);}
    else if(e.code==='Space'){e.preventDefault();charge(e.timeStamp);}
  },on);
  window.addEventListener('keyup',e=>{if(e.code in keys){e.preventDefault();up(keys[e.code],e.code);}},on);
  window.addEventListener('blur',pause,on);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();},on);
  $('slice-canvas').addEventListener('race-render-error',pause);
  if(practice)$('slice-skip').onclick=skip;   // at once: it needs nothing loaded
  async function load(){
    startHow();
    $('slice-back').onclick=toSetup;
    $('slice-help').onclick=e=>{const w=cover.querySelector('.how-wrap');w.hidden=!w.hidden;e.currentTarget.setAttribute('aria-expanded',String(!w.hidden));};
    const form=getForm?.();if(form){const p=cover.querySelector('.slice-form');p.hidden=false;p.textContent=form.notes.join(' · ');}
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
    const showHow=practice?0:setTimeout(()=>{cover.classList.add('is-loading');how.hidden=false;},1000);   // not over the practice's card: it lists what to try itself (and is tall: the cards would cover the top buttons)
    const wait=setInterval(()=>{if(loadState.done!==seen){seen=loadState.done;since=performance.now();}
      if(performance.now()-since>25000){clearInterval(wait);btn.disabled=false;btn.textContent='連線太慢，點這裡重新載入';btn.onclick=()=>location.reload();}
      else{const n=loadState.total-n0,d=loadState.done-d0;btn.textContent=n?`準備中… ${d}/${n}`:'準備中…';btn.style.setProperty('--p',n?.8*d/n:0);}},400);   // the models are the first 80% of the bar
    try{try{await Promise.all([preloadPresentation(rivals.length>0||/[?&]lod=far/.test(location.search)),preloadModels(cityModels(city)),preloadBuddies(team.map(h=>h.coat))]);}finally{clearInterval(wait);}
      // The track and the horse stand ready behind the start card (the same scene the run then uses).
      if(phase==='ready'&&!renderer){game=makeGame();resolver=new ControlRouter(game,lag);stage();frameId=requestAnimationFrame(frame);}
      btn.textContent='準備中…';btn.style.setProperty('--p',.9);   // the models are in: the scene's own pictures and first frames are the rest
      // 起跑, and the scene itself, only once it is whole and has drawn (its first frames compile the shaders too).
      await sceneReady();if(phase==='exited')return;
      try{localStorage.setItem('hoofbeat.loadtime.race',((performance.now()-t0)/1000).toFixed(1))}catch{}   // Settings → About shows it (for reports of slow loading)
      clearTimeout(showHow);if(cover.classList.contains('is-loading')){cover.classList.remove('is-loading');how.hidden=true;$('slice-help').setAttribute('aria-expanded','false');}
      $('slice-start').disabled=false;$('slice-start').textContent=practice?'開始練習':'起跑';$('slice-start').onclick=newRun;}
    catch(error){$('slice-start').disabled=false;$('slice-start').textContent='重新載入模型';$('slice-start').onclick=load;feedback('模型載入失敗，請重試');}
  }
  load();
  return {exit};
}
