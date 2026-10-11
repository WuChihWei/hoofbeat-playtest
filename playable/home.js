// App shell: hash routes over one 9:16 frame. Look and components: ../ui/ui.css + ../ui/ui.js (docs/UI_FRAMEWORK.md).
//   #home ─ RACE → #race (course + horse; Relay | Solo) → #play (relay race) or #solo (solo run) → result → #home
//         ├ MISSIONS → #missions (coming soon)
//         ├ TRACKS → #tracks (the city courses) → #race
//         └ BUDDIES → #horses (a horse opens it in #stable)
//   bottom nav: #home · #ranch (the whole ranch, the buddies out on it; a tap on one → #stable: Feed · Brush · Buddies · Items; Gear and the relay on the horse card) · #shop (Feed · Care · Decor) · #settings
// Profile, wallet and care live in localStorage; the player's look feeds the race through PLAYER_LOOK.
import {startSlice,TUTORIAL} from './slice-app.js?v=r460';
import {COURSES,buildCourse,relayCourse,soloCourse} from '../course/courses.mjs?v=r460';
import {PLAYER_LOOK,GEAR,HAIR,COATS,MODEL_VERSION,preloadPresentation} from '../approved-assets.js?v=r460';
// In the background from the moment the game is open (2026-10-06, the user: the ranch took five seconds on a phone, and a
// race was seen being put together), in the order they are likely to be wanted: the ranch's models and its barn
// painting, the race's near models, the pictures of the chosen city's scene (warmCity), the rivals' light models.
const barn=new Image();   // kept: the ranch opens with its painting already there (it came two frames after the buddy)
setTimeout(()=>{barn.src='assets/stable/barn-plate.webp';preloadRanch(owned().slice(0,14).map(h=>h.coat)).catch(()=>{}).then(()=>preloadStable()).catch(()=>{}).then(()=>preloadPresentation(false)).then(()=>{warmCity(profile.city);return preloadPresentation();}).catch(()=>{});},300);
import {lang,setLang,translate} from '../i18n.js?v=r460';
import {ITEMS,itemEffect,readCare,readItems,saveCare,careAction,level,XP_LEVEL,relayForm,soloForm as careForm,afterRace,afterSolo,recover} from '../stable-care.js?v=r460';
import {SLICE_CONFIG,AFFINITY,TERRAIN_NAME,SOLO,MAX_LEVEL,STAT_FULL,buddyStats,racing,legMains,MVP} from './slice-config.mjs?v=r460';
import {mountStableView,preloadStable} from './stable-view.js?v=r460';
import {mountRanchView,preloadRanch,RANCH} from './ranch-view.js?v=r460';
import {FARM,readFarm,saveFarm,stage,growth,tend,bedsFor,dormsFor,pensFor} from '../farm.mjs?v=r460';
import {cityPictures} from '../approved-environment.js?v=r460';
import {calibrateLatency,readLatency,saveLatency} from '../audio.js?v=r460';
import {RaceClock} from '../race-session.js';
import {readLog,clearLog,summary,FEEDBACK_URL} from '../playtest.js?v=r460';
import {esc,icon,brand,coin,wallet,header,nav,bar,toaster} from '../ui/ui.js?v=r460';
import {LEVELS,PERKS,PERK_COINS,HORSE_PRICE,STARTERS,whoIsOut,cleared,maneOpen,riderColors,fresh,restore,totalStars,levelOf,unlocked,relayOpen,owns,nextStarTime,currentLevel,missionsFor,finish,buy,nextGoal,BALL_GAME} from './progress.mjs?v=r460';

const GHOST='hoofbeat.ghost.v4.',HOT='hoofbeat.hot.v1',SOLO_BEST='hoofbeat.solo.v4',RELAY_BEST='hoofbeat.relay.v3',WALLET='hoofbeat.wallet.v1',PROFILE='hoofbeat.profile.v1',BEST='hoofbeat.bestcombo.v1',OWNED_DECOR='hoofbeat.decor.v1',PROGRESS='hoofbeat.progress.v1';
const store={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}},del:k=>{try{localStorage.removeItem(k)}catch{}}};
// v2 (2026-10-05): a solo run became one lap, so the best times and traces of the two-lap runs (v1) say nothing now: dropped.
try{Object.keys(localStorage).filter(k=>/^hoofbeat\.(solo\.v[123]$|ghost\.v[123]\.|relay\.v[12]$)/.test(k)).forEach(store.del)}catch{}
// The role (Settings; 2026-10-05, the user, to test the playtest build): 最高管理者 has coins and diamonds that never run
// out and every stage open. The wallets read as ∞ and are left alone (nothing is paid in or out), so going back to
// 一般使用者 finds them as they were; what was bought or won meanwhile stays.
const ROLE='hoofbeat.role.v1',admin=()=>store.get(ROLE)==='admin';
export const readCoins=()=>admin()?Infinity:+store.get(WALLET)||0;
export const addCoins=n=>admin()||store.set(WALLET,String(readCoins()+n));
const spendCoins=n=>readCoins()>=n&&(addCoins(-n),true);

// Stable decorations: 2D stickers on the barn plate (assets/stable/deco/<id>.webp). slot = [centre x, centre y, width]
// as fractions of barn-plate.webp (941×1672; 2026-10-09: the plate painted for the higher camera, the slots moved with
// it: the wall panel right of the middle post, above and below its rail; the post itself; the post left of the window;
// the straw by the right partition), clear of the window and the painted lantern, and inside x .12–.88 (a tall phone
// crops the plate's sides). Bought in the Shop;
// postcards are earned by finishing a race in their city. Owned ids: hoofbeat.decor.v1.
const DECOR=[
  {id:'bunting',name:'彩色三角旗',price:250,slot:[.69,.085,.22]},{id:'nameplate',name:'夥伴名牌',price:200,slot:[.69,.36,.18]},
  {id:'rosette_blue',name:'藍色緞帶花',price:150,slot:[.615,.165,.07]},{id:'rosette_red',name:'紅色緞帶花',price:150,slot:[.69,.165,.07]},
  {id:'rosette_gold',name:'金色緞帶花',price:150,slot:[.765,.165,.07]},{id:'trophy',name:'金色獎盃',price:400,slot:[.82,.41,.085]},
  {id:'horseshoe_wall',name:'幸運掛飾',price:180,slot:[.53,.2,.045]},{id:'lantern',name:'掛燈',price:150,slot:[.135,.2,.045]},
  {id:'flowerpot',name:'小花盆',price:120,slot:[.83,.5,.1]},
];
const POSTCARDS=['taipei','tokyo','paris','stockholm','seoul'].map((c,i)=>({id:`postcard_${c}`,city:c,slot:[.6+i*.058,.235,.052]}));
const readDecor=()=>{try{return new Set(JSON.parse(store.get(OWNED_DECOR)||'[]'))}catch{return new Set()}};
const addDecor=id=>{const d=readDecor();d.add(id);store.set(OWNED_DECOR,JSON.stringify([...d]));};

// The player's horses, like a card collection: add a horse by adding a line (a new unique id; stable care starts it
// fresh). type: its one aptitude (slice-config AFFINITY: straight / curve / mud); coat: an approved-assets COAT index
// stats (0–1): its own top in Speed, Accel and Stamina (slice-config buddyStats: shown as now / full, its level sets how
// much of them it uses; racing(): what they are on the track, the same sums for the rivals); Handling waits for the
// next stage.
// (approved-assets COATS: 0 Pinto · 1 Midnight · 2 Palomino · 3 Chestnut · 4 Snowflake · 5 Buckskin · 6 Buckloosa · 7 Appaloosa ·
// 8 Roan · 9 Storm; a new look needs a COATS entry and a buddy_<coat>.webp portrait, rendered by _coat-lineup.html).
// 10 and 11 are not horses: COATS gives them a species and a model of their own (a llama, a rhino); everything here
// treats them like any buddy, only the look sheet has no mane for them.
const ROSTER=[
  {id:1,name:'Ember',type:'straight',coat:0,swatch:'#a0623f',tag:'Best at long straights.',about:'A spirited and reliable partner who shines on open tracks.',stats:{Speed:.78,Stamina:.6,Handling:.8,Accel:.55}},
  {id:0,name:'Swift',type:'curve',coat:2,swatch:'#d6a866',tag:'Loves the bends.',about:'Calm and even-paced; keeps the rhythm through long curves.',stats:{Speed:.64,Stamina:.82,Handling:.72,Accel:.7}},
  {id:2,name:'Summit',type:'mud',coat:1,swatch:'#2c2623',tag:'Steady in mud and rain.',about:'Sure-footed and patient; forgives an early or late step.',stats:{Speed:.6,Stamina:.7,Handling:.88,Accel:.5}},
  {id:3,name:'Chestnut',type:'straight',coat:3,swatch:'#bd6c43',tag:'Quick off the line.',about:'Bright and eager; loves a long, open gallop.',stats:{Speed:.8,Stamina:.58,Handling:.7,Accel:.9}},
  {id:4,name:'Snowflake',type:'curve',coat:4,swatch:'#ece6e2',tag:'Light on its feet in the turns.',about:'Gentle and graceful; carves every bend cleanly.',stats:{Speed:.62,Stamina:.76,Handling:.86,Accel:.75}},
  {id:5,name:'Buckskin',type:'mud',coat:5,swatch:'#d6a674',tag:'Tough on soft ground.',about:'Hardy and level-headed; mud never breaks its rhythm.',stats:{Speed:.66,Stamina:.84,Handling:.7,Accel:.45}},
  {id:6,name:'Buckloosa',type:'mud',coat:6,swatch:'#a95b3c',tag:'Spotted and sure-footed.',about:'Playful but careful; picks its way through the wettest going.',stats:{Speed:.6,Stamina:.78,Handling:.84,Accel:.6}},
  {id:7,name:'Appaloosa',type:'curve',coat:7,swatch:'#e8cba1',tag:'Smooth through the bends.',about:'Even-tempered; holds a tight line round long curves.',stats:{Speed:.66,Stamina:.72,Handling:.84,Accel:.65}},
  {id:8,name:'Roan',type:'straight',coat:8,swatch:'#b2644b',tag:'Builds speed down the straights.',about:'Strong and steady; the longer the straight, the better.',stats:{Speed:.82,Stamina:.66,Handling:.62,Accel:.35}},
  {id:9,name:'Storm',type:'straight',coat:9,swatch:'#9e9aa4',tag:'Fast when the track opens up.',about:'Bold and focused; saves its best for the home straight.',stats:{Speed:.84,Stamina:.6,Handling:.66,Accel:.3}},
  {id:10,name:'Alpa',type:'curve',coat:10,stats:{Speed:.68,Stamina:.8,Handling:.85,Accel:.8}},
  {id:11,name:'Rumble',type:'mud',coat:11,stats:{Speed:.62,Stamina:.95,Handling:.6,Accel:.4}},
  {id:12,name:'Bruno',type:'mud',coat:12,stats:{Speed:.6,Stamina:.9,Handling:.72,Accel:.5}},   // the bear
  {id:13,name:'Zigzag',type:'straight',coat:13,stats:{Speed:.8,Stamina:.7,Handling:.68,Accel:.7}},   // the zebra
  {id:14,name:'Daisy',type:'mud',coat:14,stats:{Speed:.58,Stamina:.92,Handling:.7,Accel:.45}},   // the cow
  {id:15,name:'Frost',type:'curve',coat:15,stats:{Speed:.74,Stamina:.86,Handling:.8,Accel:.72}},   // the wolf
];
const DIFF=['','入門','進階','挑戰'];
const defaults={name:'Rider',horse:1,city:'taipei',gear:{},order:[1,0,2]};   // new players start on the ★1 course   // order: relay legs 1–3 (horse ids)   // gear: {material: colour} from GEAR (approved-assets)
let profile={...defaults};
try{profile={...defaults,...JSON.parse(store.get(PROFILE)||'{}')}}catch{}
// Older profiles kept only a shirt and a saddle colour ('' = authored leather).
if(profile.shirt||profile.saddle){profile.gear={Rider_Shirt:profile.shirt||undefined,Tack_Saddle:profile.saddle||undefined,...profile.gear};delete profile.shirt;delete profile.saddle;}
profile.gear=Object.fromEntries(Object.entries(profile.gear||{}).filter(([m,c])=>GEAR.some(g=>g.mat===m&&g.colors.includes(c))));
{const ids=ROSTER.map(h=>h.id),o=profile.order;   // three different horses the player still has
  if(!(Array.isArray(o)&&o.length===3&&new Set(o).size===3&&o.every(id=>ids.includes(id))))profile.order=ROSTER.slice(0,3).map(h=>h.id);}
const horseById=id=>ROSTER.find(h=>h.id===id)||ROSTER[0];
// Progress (progress.mjs): stars per level, the horses owned, runs, the daily bonus. The relay team and the solo horse
// are always horses the player owns.
let prog=fresh();try{prog=restore(JSON.parse(store.get(PROGRESS)||'null'))}catch{}
const saveProg=()=>store.set(PROGRESS,JSON.stringify(prog)),today=()=>new Date().toLocaleDateString('sv');   // 'sv': YYYY-MM-DD, local
// The relay team: three different buddies the player has (fewer while the relay is closed: the first owned ones).
const fixOrder=()=>{const o=profile.order;if(!(o.length===3&&new Set(o).size===3&&o.every(id=>owns(prog,id))))profile.order=[...new Set([...o.filter(id=>owns(prog,id)),...prog.owned])].slice(0,3);};fixOrder();
if(!owns(prog,profile.solo??profile.horse))profile.solo=STARTERS[0];if(!owns(prog,profile.horse))profile.horse=STARTERS[0];
const stageOpen=city=>admin()||unlocked(prog,city),fixCity=()=>{if(!stageOpen(profile.city))profile.city=currentLevel(prog).city;};fixCity();
// Solo run: the horse picked for it (else the one last looked at), best times {`city:horse id`: simulation s}, and a
// time as the player felt it (wall clock).
const soloHorse=()=>horseById(profile.solo??profile.horse),readJson=k=>{try{return JSON.parse(store.get(k)||'{}')||{}}catch{return {}}},readSolo=()=>readJson(SOLO_BEST),readRelay=()=>readJson(RELAY_BEST);   // RELAY_BEST: {city: {time, rank}}, the best relay time (simulation s) and place per track
const tempoOf=city=>LEVELS.find(l=>l.city===city)?.tempo??SLICE_CONFIG.tempo;   // a solo stage's own tempo (progress.mjs LEVELS)
const wallTime=(t,city)=>{const s=t/tempoOf(city);return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;};
// The relay team is profile.order (legs 1–3, set on the race page): a horse's leg
// label, or '' when it is not racing. profile.horse is only the horse the Stable opens on (the last one looked at).
const legLabel=id=>{const k=MVP.relay&&relayOpen(prog)?profile.order.indexOf(id):-1;return k<0?'':`第${k+1}棒`;};
function putOnLeg(id,k){const at=profile.order.indexOf(id);if(at>=0)[profile.order[at],profile.order[k]]=[profile.order[k],profile.order[at]];else profile.order[k]=id;saveProfile();}
const TYPE_NAME={straight:'直線型',curve:'彎道型',mud:'泥地型'};
function saveProfile(){store.set(PROFILE,JSON.stringify(profile));applyLook();}
function applyLook(h=horseById(profile.horse)){Object.assign(PLAYER_LOOK,{coat:h.coat,gear:Object.fromEntries(Object.entries(profile.gear).filter(([m])=>riderColors(prog)||!m.startsWith('Rider_'))),hair:maneOf(h.id)});}   // the rider's clothes keep their first colour until stage 4 is cleared
// Mane and tail styles (approved-assets HAIR): every buddy wears its own, set on its card in the stable (2026-10-04, the
// user: not sold in the shop, a setting of the animal). profile.manes = {buddy id: style id}; none: the classic one.
const maneOf=id=>HAIR.some(x=>x.id===profile.manes?.[id])&&maneOpen(prog,profile.manes[id])?profile.manes[id]:'classic';
// What clearing a stage gives (progress.mjs: a buddy by its price's `stage`, or a PERK), as words; '' when nothing.
const stageGift=n=>{const b=Object.entries(HORSE_PRICE).find(([,c])=>c.stage===n);return b?horseById(+b[0]).name:!Object.values(PERKS).some(x=>x.stage===n)?'':MVP.perks?(PERKS.mane.stage===n?HAIR.find(x=>x.id===PERKS.mane.id).name:'騎士服裝顏色'):`${PERK_COINS} 金幣`;};
let care=readCare({getItem:store.get},ROSTER.map(h=>h.id)),bag=readItems({getItem:store.get});
let justRan=null;   // {id, at, won}: the buddy of the last solo run, this session
if(/[?&]debug\b/.test(location.search))window.__home={ran:(id,won=true)=>{justRan={id,at:Date.now(),won};}};   // dev: as if that buddy had just run
// While you were away (SPEC 11 P2): back on the ranch after AWAY ms, its line first says the one thing that waits for
// you (wheat ripe > a hungry buddy > a dusty one), for AWAY_SAY ms. Nothing new is counted: the field and the care bars.
const SEEN='hoofbeat.seen.v1',AWAY=5*60e3,AWAY_SAY=3500;
function awayNews(ripe){const was=+store.get(SEEN)||0,now=Date.now();store.set(SEEN,String(now));if(!was||now-was<AWAY)return null;
  const need=k=>owned().map(h=>[h,care[h.id]?.[k]??100]).filter(([,v])=>v<40).sort((a,b)=>a[1]-b[1])[0]?.[0];
  if(ripe)return `你不在的時候，${ripe} 格麥子熟了`;const hungry=need('hunger');if(hungry)return `${hungry.name} 餓了，在等你`;const dusty=need('clean');if(dusty)return `${dusty.name} 想刷毛了`;return null;}
setInterval(()=>{if(document.visibilityState==='visible'&&/^#(ranch|stable)/.test(location.hash))store.set(SEEN,String(Date.now()));},30e3);   // on the ranch you are not away
// Amounts of money are written the way games do: the currency's icon, then the number (never the word). A diamond is
// worth about 200 coins (the prices in progress.mjs HORSE_PRICE keep to that); the game does not state the rate or
// exchange them, and some things sell for diamonds only (the three special coats, progress.mjs HORSE_PRICE).
const GEM=`<i class="gem">${icon('gem')}</i>`;
const gemsShown=()=>MVP.gems?readGems():null;   // MVP: the diamonds are kept, not shown
const readGems=()=>admin()?Infinity:+store.get('hoofbeat.gems.v1')||0,addGems=n=>n&&!admin()&&store.set('hoofbeat.gems.v1',String(readGems()+n));   // diamonds: a new star, a relay podium, day 7 in a row; they buy buddies
// Saves from the day the long mane was sold in the shop: the style worn goes onto every buddy, the diamonds come back.
if(profile.hair||profile.hairs){if(profile.hairs?.includes('long'))addGems(2);if(profile.hair&&profile.hair!=='classic')profile.manes={...Object.fromEntries(ROSTER.map(h=>[h.id,profile.hair])),...profile.manes};
  delete profile.hair;delete profile.hairs;store.set(PROFILE,JSON.stringify(profile));}
const cityName=id=>COURSES.find(c=>c.id===id)?.city??id,wallets=()=>`<div class="wallets">${wallet(readCoins(),{gems:gemsShown()})}</div>`;
const starRow=n=>`<i class="stars" role="img" aria-label="${n} 顆星">${[0,1,2].map(k=>`<i class="${k<n?'on':''}">★</i>`).join('')}</i>`;
const bestOn=city=>{const v=Object.entries(readSolo()).filter(([k])=>k.startsWith(city+':')).map(([,x])=>x);return v.length?Math.min(...v):0;};   // best solo time on a track, any horse (0: none; Infinity → 0 below)
// A buddy's level (stable-care: 40 xp a level, to MAX_LEVEL) and its three numbers, written now / full (2026-10-04, the
// user: 20/120, never ×1.2: full is the buddy's own, its level sets how much of it is in use). The bar is on one scale
// for every buddy (STAT_FULL): bright to what it uses now, dim to its own top.
const lvOf=h=>level(care[h.id]??{xp:0}),lv=h=>MVP.levels?`LV ${lvOf(h)}`:'',sub=h=>[MVP.types?TYPE_NAME[h.type]:'',lv(h)].filter(Boolean).join(' · ');   // MVP: no level, no type label
const STAT_NAME={Speed:'速度',Accel:'加速',Stamina:'體力'};
const statRows=h=>{const st=buddyStats(h.stats,lvOf(h));return `<div class="buddy-stats">${Object.entries(STAT_NAME).map(([k,name])=>`<div><span>${name}</span><i style="--now:${st[k].now/STAT_FULL*100}%;--full:${st[k].full/STAT_FULL*100}%"></i><b>${st[k].now}<small>/${st[k].full}</small></b></div>`).join('')}</div>`;};
// A runner of the player's for the race: its look and its numbers (slice-game: stats and level; race-scene: coat and mane).
const racer=h=>({id:h.id,name:h.name,coat:h.coat,type:h.type,stats:h.stats,level:lvOf(h),hair:maneOf(h.id)});
// How a buddy suits a leg, in a word (the aptitude multiplier is not shown).
const suits=x=>x>=1.15?'擅長':x>=1.07?'普通':'吃力';
// What to look forward to next (progress nextGoal), as a line with a bar: {text, have, need, img}.
function goalLine(){
  const g=nextGoal(prog,readCoins());if(!g)return null;const left=g.need-g.have,h=g.id!=null?horseById(g.id):null;
  return {have:g.have,need:g.need,img:h?buddyImg(h):null,
    text:g.kind==='level'?`跑完第 ${levelOf(g.city)} 關就開放第 ${levelOf(g.city)+1} 關 ${cityName(g.city)}`:g.kind==='relay'?(MVP.relay?`再 ${left} 顆星開放三棒接力`:''):g.kind==='gift'?`再 ${left} 顆星送你 ${h.name}`:left>0?`下一位夥伴 ${h.name}：${g.have} / ${g.need} 金幣`:`金幣夠了：去解鎖 ${h.name}！`};
}
// Unlocking a horse (coins or diamonds): a confirm sheet in `el` (needs .ui-scrim and .buy-sheet), then done().
function horseSheet(el,h,done){
  const scrim=el.querySelector('.ui-scrim'),sheet=el.querySelector('.buy-sheet'),c=HORSE_PRICE[h.id],coins=readCoins(),gems=readGems(),close=()=>{scrim.hidden=sheet.hidden=true;};
  const pay=(k,have,art)=>c[k]?`<button class="ui-btn primary" data-pay="${k}" ${have<c[k]?'disabled':''}>${art}${c[k]}${have<c[k]?`<small>還差 ${c[k]-have}</small>`:''}</button>`:'';
  sheet.innerHTML=`<header><h2>${h.name}</h2><button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header>
    <img class="buy-art" src="${buddyImg(h)}" alt="">${sub(h)?`<p class="ui-sub">${sub(h)}</p>`:''}${statRows(h)}
    <p class="ui-label">${c.stars?`集滿 ${c.stars} 顆星會免費送你（現在 ${totalStars(prog)} 顆）· `:c.stage?`破第 ${c.stage} 關會免費送你 · `:''}${MVP.gems?(c.coins?'用金幣或鑽石都可以解鎖':'只能用鑽石解鎖'):'用金幣解鎖'}</p>
    <div class="buy-actions ${c.coins&&MVP.gems?'':'one'}">${pay('coins',coins,coin)}${MVP.gems?pay('gems',gems,`<i class="gem">${icon('gem')}</i>`):''}</div>`;
  scrim.hidden=sheet.hidden=false;scrim.onclick=close;sheet.querySelector('[data-close]').onclick=close;
  sheet.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{const k=b.dataset.pay,r=buy(prog,h.id,k,k==='gems'?readGems():readCoins());if(r.fail)return;
    if(k==='gems')addGems(-r.cost);else addCoins(-r.cost);prog=r.p;saveProg();close();done();});
}
// What a finished run earned beyond its coins, for the results screen (slice-app showResults): stars, missions, the
// day's bonus, what opened, and the next thing to look forward to. seconds: the solo time (wall clock), else null.
// One thing to try next run, from what this one lacked (2026-10-10, the hooks: the results always say what to do next).
const tipFor=(r,f)=>r.perfect<8?'踩拍再準一點：完美越多，連擊越快':r.bestCombo<12?'別斷連擊：連擊越長跑越快':r.coins<4?'路上的金幣多吃一點':f.runStars<3?'蓄滿就衝刺，直線最划算':'已經很強了：換一關試試';
function rewards(f,city,seconds){
  const t=seconds!=null&&nextStarTime(city,f.stars);
  return {extra:f.coins,stars:f.stars,runStars:f.runStars??null,newStars:f.newStars,starHint:t?`再快 ${(seconds-t).toFixed(1)} 秒拿第 ${f.stars+1} 顆星`:'',starGap:t?Math.min(1,t/seconds):null,   // how close the run came to the next star, 0–1 (the bar)
    missions:f.missions,missionCoins:f.missionCoins,phraseCoins:f.phraseCoins,daily:f.daily,next:f.opened[0]?{city:f.opened[0],label:`下一關：${cityName(f.opened[0])}`}:null,goal:goalLine(),
    news:[`小麥種子 +${FARM.raceSeeds}`,...f.opened.map(id=>`第 ${levelOf(id)+1} 關 ${cityName(id)} 開放了！`),...(f.relayOpened?['三棒接力開放了！']:[]),...f.gifts.map(id=>`新夥伴 ${horseById(id).name} 加入牧場！`),
      ...(f.perks||[]).map(k=>k==='mane'?`新造型：${HAIR.find(x=>x.id===PERKS.mane.id).name}`:'騎士服裝的顏色開放了！'),...(f.perkCoins?[`過關獎勵 +${f.perkCoins}`]:[])],
    // What was given (a buddy, a mane style, the rider's colours): each comes out of the prize chest first (slice-app openChest).
    // img, name, tag, sub: its card (ui chest()); text: the line under the chest.
    prizes:[...f.gifts.map(id=>{const h=horseById(id);return {img:buddyImg(h),text:`新夥伴 ${h.name} 加入牧場！`,name:h.name,tag:'新夥伴',sub:MVP.types?TYPE_NAME[h.type]:''};}),
      ...(f.perks||[]).map(k=>{const mane=HAIR.find(x=>x.id===PERKS.mane.id).name;return k==='mane'?{img:`assets/ui/hair_${PERKS.mane.id}.webp?v=1`,text:`新造型：${mane}`,name:mane,tag:'新造型',sub:'鬃毛造型'}
        :{img:'assets/ui/rider_0.webp?v=2',text:'騎士服裝的顏色開放了！',name:'騎士服裝顏色',tag:'新開放'};})]};
}
// Before a race (slice-app's start card): the level, the goal of this run and its three missions.
function brief(c,solo){
  const st=prog.stars[c.id]||0,t=nextStarTime(c.id,st),best=bestOn(c.id),clock=x=>`${Math.floor(x/60)}:${(x%60).toFixed(1).padStart(4,'0')}`;
  return {title:`第 ${levelOf(c.id)+1} 關 · ${c.city}`,stars:st,missions:MVP.missions?missionsFor(prog.runs,solo,solo?LEVELS[levelOf(c.id)]?.locks:{}).map(m=>m.text):null,
    goal:!solo?'目標：跑進前 3 名':!st?'先跑完一趟，拿第 1 顆星':t?`目標 ${clock(t)} · 拿第 ${st+1} 顆星`:`三星了 · 破自己的 ${wallTime(best,c.id)}`,
    target:solo&&st&&t?t*tempoOf(c.id):null};   // target: the time to beat for the next star (simulation s)
}

const buddyImg=h=>`assets/stable/buddy_${h.coat}.webp?v=coats-4`;   // re-rendered from approved-assets COATS (_coat-lineup.html)
ROSTER.forEach(h=>{new Image().src=buddyImg(h);});
// A city's scene is about twenty pictures, 1.5–1.9 MB (its painted trees, lamps and far view; approved-environment
// cityPictures). The scene is shown only once they are all in, so they are asked for ahead: the chosen city's when the
// game opens, and any city's when its pick page is opened.
const warmed=new Set(),warmCity=id=>{if(warmed.has(id))return;warmed.add(id);for(const u of cityPictures(id)){const i=new Image();i.crossOrigin='anonymous';i.src=u;}};   // the portraits (110 KB in all) are asked for at once: the row of heads on the pick page was black circles for a moment the first time
// The rider's level is the ranch's level: how many buddies there are (farm.mjs; 2026-10-10: it was 100 xp of the
// buddies' a level, a second number nobody could read). What gets the next one: the next stage that gives a buddy, else the shop.
const ranchLevel=()=>owned().length;
const nextBuddy=()=>{const gift=Object.entries(HORSE_PRICE).filter(([id,c])=>c.stage&&!owns(prog,+id)).map(([,c])=>c.stage).sort((a,b)=>a-b)[0];
  return gift?`過第 ${gift} 關拿下一隻夥伴`:owned().length<ROSTER.length?'商店可以帶下一隻夥伴回來':'夥伴都到齊了';};

// ---- course drawing (Tracks card, race setup, tracks list): the real lap from the course generator ----
function drawCourse(canvas,id,{decor=false}={}){
  const g=canvas.getContext('2d'),W=canvas.width,H=canvas.height,c=buildCourse(id),t=c.track,th=c.theme,top=decor?.2:0;
  const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,th.sky.top);bg.addColorStop(top,th.sky.horizon);bg.addColorStop(top,th.ground.verge);bg.addColorStop(1,th.ground.grass);
  g.fillStyle=bg;g.fillRect(0,0,W,H);
  if(decor){g.fillStyle='#8c95b8';for(let i=0;i<9;i++){const x=i*W/7.5-30,h=H*(.08+(i*37%50)/1000);g.beginPath();g.moveTo(x,H*top);g.lineTo(x+W*.08,H*top-h);g.lineTo(x+W*.16,H*top);g.fill();}}
  const pts=[];for(let s=0;s<c.lapLength;s+=3)pts.push(t.pose(s));
  const xs=pts.map(p=>-p.x),zs=pts.map(p=>-p.z),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
  const tilt=decor?.62:1,cx=decor?.66:.5,cy=decor?.62:.5;
  const k=Math.min(W*(decor?.5:.84)/(x1-x0),H*(decor?.7:.8)/((z1-z0)*tilt));
  const P=p=>[W*cx+(-p.x-(x0+x1)/2)*k,H*cy+(-p.z-(z0+z1)/2)*k*tilt];
  const loop=(w,col)=>{g.beginPath();pts.forEach((p,i)=>{const[x,y]=P(p);i?g.lineTo(x,y):g.moveTo(x,y)});g.closePath();g.lineJoin='round';g.lineWidth=w;g.strokeStyle=col;g.stroke();};
  let seed=7;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
  for(let i=0;i<(decor?70:40);i++){const x=rnd()*W,y=H*(top+.02)+rnd()*H*(1-top),r=Math.max(5,W/90);
    if(pts.some(p=>{const[a,b]=P(p);return Math.hypot(a-x,b-y)<k*9+r}))continue;
    g.fillStyle='#2f6b3c';g.beginPath();g.moveTo(x,y-r*2);g.lineTo(x+r,y+r*.4);g.lineTo(x-r,y+r*.4);g.fill();}
  loop(Math.max(3,k*11),'#f6f4ee');loop(Math.max(2,k*9),th.ground.road);
  const rz=c.relayZone;g.strokeStyle='#ffffffaa';g.lineWidth=Math.max(2,k*9);g.beginPath();
  for(let s=rz.s;s<=rz.s+rz.length;s+=2){const[x,y]=P(t.pose(s));s===rz.s?g.moveTo(x,y):g.lineTo(x,y);}g.stroke();
  const[a,b]=P(t.pose(0,-1.6)),[a2,b2]=P(t.pose(0,1.6));g.strokeStyle='#1d2622';g.lineWidth=Math.max(3,k*2.4);g.setLineDash([4,4]);g.beginPath();g.moveTo(a,b);g.lineTo(a2,b2);g.stroke();g.setLineDash([]);
  return c;
}
const courseFacts=c=>`${Math.round(c.lapLength)} m / 圈 · ${c.track.pieces.filter(p=>!p.straight).length/c.gameplay.laps} 彎 · ${c.gameplay.jumps.length} 跳欄`;

// ---- router ----
const app=()=>document.querySelector('#app');
let leave=null,stableFocus=null,playFromSetup=false,practiceNext=false;   // practiceNext: the next #solo is the practice (Settings → 新手練習)  // stableFocus: horse id Collection asked the Stable to open on
// replace: swap the current history entry (leaving a race must not leave #play behind for the back button)
const go=(r,{replace=false}={})=>{if(r==='play'||r==='solo')playFromSetup=location.hash==='#race';
  if(location.hash==='#'+r)render();else if(replace)location.replace('#'+r);else location.hash=r;};
// Back goes to the page's parent (course → tracks, everything else → home). It steps back through history only when
// the page before was that parent; otherwise (reload, opened directly, came from outside) it swaps to the parent, so
// back never leaves the app or lands on an unrelated page.
const PARENT={course:'tracks',stable:'ranch'};
let shown=null,before=null;   // routes rendered now / just before
function render(){
  leave?.();leave=null;
  const route=location.hash.slice(1)||'home';
  if(route!==shown){before=shown;shown=route;}
  (PAGES[route]||PAGES.home)();
  const root=app(),parent=PARENT[route]||(route==='horses'&&before==='stable'?'stable':'home');   // Buddies from the Stable goes back there
  root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  root.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>before===parent?history.back():go(parent,{replace:true}));
}
// The scene behind every page: the chosen city's far backdrop (UI v2: glass takes its colour from a bright scene).
const frame=(cls,inner)=>{app().innerHTML=`<div class="home-shell ui-root ${cls}" style="background-image:url(assets/backdrops/${profile.city}.webp${new URL(import.meta.url).search})">${inner}</div>`;return app().firstElementChild;};
const weatherOf=w=>w.rain>0?['rain','Rain']:w.cloud>0?['cloud','Cloudy']:['sun','Sunny'];

// The ranch (2026-10-09): the buddies owned are out on the lawn; with more than six, some stay in (2026-10-10, the
// user: 「有些馬可以待在宿舍裡不用所有的都出來，20%或超過6再出來」「或是20%出來就好」): one in five is out, a different few
// each hour, so everyone is seen in turn; never more than eight (a performance number to be measured on a phone):
// progress.mjs whoIsOut. Its tabs: the 3D ranch's two views with the dormitory between them: that one is
// the close-up page (#stable), opened and left like a shot, the same row of tabs on both pages (the user: one ranch,
// not a second place behind a button).
const owned=()=>ROSTER.filter(h=>owns(prog,h.id)),mine=()=>whoIsOut(owned()),out=mine;
// Where each buddy is on the ranch, as the player left it (hoofbeat.ranch.v1: place {id: {stall} | {at: [x, y]}},
// doors {stall: open?}); a buddy never placed is where whoIsOut has it: out on a free spot, or in the next free stall.
// At most RANCH_DRAWN are drawn (a performance number, to be measured on a phone).
const RANCH_KEY='hoofbeat.ranch.v1',RANCH_DRAWN=14;
const readRanch=()=>{let r={};try{r=JSON.parse(store.get(RANCH_KEY)||'{}')}catch{}return {place:{...r.place},doors:{...r.doors}};},saveRanch=r=>store.set(RANCH_KEY,JSON.stringify(r));
function placed(R,dorms=1){const all=owned().slice(0,RANCH_DRAWN),outs=new Set(whoIsOut(all).map(h=>h.id)),taken=new Set(),stalls=6*dorms,list=[];
  for(const h of all){const w=R.place[h.id];if(w?.stall!=null&&w.stall<stalls&&!taken.has(w.stall)){taken.add(w.stall);list.push([h,{stall:w.stall}]);}else list.push([h,Array.isArray(w?.at)?{at:w.at}:null]);}
  return list.map(([h,w])=>{if(w)return [h,w];if(outs.has(h.id))return [h,{}];let k=0;while(taken.has(k))k++;if(k>=stalls)return [h,{}];taken.add(k);return [h,{stall:k}];});}
const RANCH_TABS=[{shot:'all',name:'全景'},{dorm:true,name:'宿舍'},{shot:'field',name:'麥田'}];
// Seeds and wheat counted like the coins (the user: 「種子和收成要有數值和對應的icon像錢幣一樣」), in a row of their own
// under the tabs, on the field's shot only (「不應該跟金幣在同一行？他只出現在農場的時候？」).
const cropPills=bag=>`<div class="ui-wallet crop" aria-label="種子"><img src="assets/stable/item_seed.webp" alt=""><b data-seed>${bag.seed||0}</b></div><div class="ui-wallet crop" aria-label="小麥"><img src="assets/stable/item_wheat.webp" alt=""><b data-wheat>${bag.wheat||0}</b></div>`;
const ranchTabs=on=>`<div class="ui-tabs ui-panel deep ranch-shots" role="tablist" aria-label="畫面" style="--n:${RANCH_TABS.length}">${RANCH_TABS.map((t,i)=>`<button role="tab" data-rtab="${i}" aria-selected="${i===on}">${t.name}</button>`).join('')}</div>`;
const PAGES={
  ranch(){
    // The 3D ranch: the view up the strip (a drag slides it along) and the field's shot, by the tabs under the header
    // or a sideways swipe. A tap on a buddy opens the dormitory on it. One dormitory, however many buddies are owned
    // (2026-10-09, the user: 「先只要一個馬殿就好」; the layout can stand more behind it, one every 15 m). ?pens=2x2,2x1,2x2
    // and ?dorms= (dev) show a longer strip: the beds beyond the field's six are drawn shut.
    const all=mine(),tabOf=shot=>RANCH_TABS.findIndex(t=>t.shot===shot),dev=new URLSearchParams(location.search);
    const lv=ranchLevel(),beds=bedsFor(lv),pens=dev.get('pens')?.split(',').map(p=>p.split('x').map(Number))??pensFor(beds),dorms=Math.max(dormsFor(lv),+dev.get('dorms')||0);PAGES.ranch.shot||='all';   // pens: ranch-view layout's own (a pen of four beds and a pen of two: farm.mjs's six)
    bag=readItems({getItem:store.get});let farm=readFarm({getItem:store.get});
    const el=frame('page-ranch ui-live',`<div class="view"></div><p class="stage-loading">載入牧場…</p>
      <header class="ui-header st-top"><button class="ui-icon-btn" data-back aria-label="返回">${icon('back','')}</button><h1>Ranch</h1>${wallet(readCoins(),{gems:gemsShown()})}</header>
      ${ranchTabs(tabOf(PAGES.ranch.shot))}<div class="ranch-level ui-wallet" aria-label="牧場等級"><b>Lv ${lv}</b></div><div class="ranch-crops">${cropPills(bag)}</div><p class="ranch-hint ui-panel deep"></p>${nav('ranch')}`),toast=toaster(el);
    let view=null,alive=true;const grow=setInterval(()=>show(),1000);leave=()=>{alive=false;clearInterval(grow);view?.dispose();};
    const tabs=[...el.querySelectorAll('[data-rtab]')],hint=el.querySelector('.ranch-hint');let news;
    // The wheat field (farm.mjs): a tap on an empty bed sows a seed, on a ripe one reaps it; the line over the nav says
    // what can be done (on the field's shot), the crops are redrawn every few seconds as they grow.
    const show=()=>{view?.field(farm.beds.slice(0,beds).map(b=>b?growth(b):null));el.querySelector('[data-seed]').textContent=bag.seed||0;el.querySelector('[data-wheat]').textContent=bag.wheat||0;say();};
    const say=()=>{const id=PAGES.ranch.shot,st=farm.beds.slice(0,beds).map(b=>stage(b)),ripe=st.filter(s=>s===3).length;
      tabs[tabOf('field')]?.classList.toggle('has-dot',ripe>0);
      if(news===undefined){news=awayNews(ripe);if(news)setTimeout(()=>{news=null;if(alive)say();},AWAY_SAY);}
      hint.textContent=news?news:id!=='field'?`牧場 Lv ${lv} · ${nextBuddy()}`:ripe?`${ripe} 格熟了 · 點一下收成`:st.includes(0)?(bag.seed>0?`種子 ×${bag.seed} · 點空的田種下`:'沒有種子 · 商店買或比賽拿'):'麥子在長 · 晚點再來';};
    const mark=shot=>{PAGES.ranch.shot=shot;tabs.forEach((b,k)=>b.setAttribute('aria-selected',k===tabOf(shot)));say();};
    // What a tap on a bed did, shown where the finger was: the wheat reaped rises and fades, a seed drops in.
    const pop=(x,y,html)=>{const box=el.getBoundingClientRect(),p=document.createElement('i');p.className='ranch-pop';p.innerHTML=html;p.style.left=`${x-box.left}px`;p.style.top=`${y-box.top}px`;el.append(p);p.onanimationend=()=>p.remove();};
    const bed=(i,x,y)=>{if(i>=beds)return;const res=tend(farm,bag,i);if(res.fail){toast(res.secs?(res.secs>=90?`還要 ${Math.ceil(res.secs/60)} 分鐘才熟`:`還要 ${res.secs} 秒才熟`):res.fail);return;}
      farm=res.farm;bag=res.items;saveFarm({setItem:store.set},farm);saveCare({setItem:store.set},care,bag);
      pop(x,y,res.did==='sow'?'<b>−1</b> 種子':`<img src="assets/stable/item_wheat.webp" alt=""><b>+${FARM.yield}</b>`);show();};
    const open=i=>{const t=RANCH_TABS[i];if(!t)return;if(t.dorm)return go('stable');view?.shot(t.shot);mark(t.shot);};
    mark(PAGES.ranch.shot);tabs.forEach((b,i)=>b.onclick=()=>open(i));
    const R=readRanch();
    mountRanchView(el.querySelector('.view'),{buddies:placed(R,dorms).map(([h,where])=>({id:h.id,coat:h.coat,hair:maneOf(h.id),...where,ran:justRan?.id===h.id&&Date.now()-justRan.at<60e3?{left:60-(Date.now()-justRan.at)/1000,won:justRan.won}:null})),doors:R.doors,pens,dorms,open:beds,shot:PAGES.ranch.shot,
      onSwipe:d=>open(tabOf(PAGES.ranch.shot)+d),onBed:bed,onMove:(id,where)=>{R.place[id]=where;for(const k in R.doors)delete R.doors[k];saveRanch(R);},onDoor:(k,on)=>{R.doors[k]=on;saveRanch(R);}})
      .then(v=>{if(!alive){v.dispose();return;}view=v;el.querySelector('.stage-loading')?.remove();show();})
      .catch(e=>{console.error(e);const l=el.querySelector('.stage-loading');if(l)l.textContent='3D 無法載入';});
  },
  home(){
    // Home (2026-10-04, the user's third sketch): the course card stays at the bottom, over the nav; above it the stages are wide cards
    // in a list, stage 1 first, scrolling beneath the card. Tapping one picks it: the scene and the card follow. The card says one thing (what to beat next) and has the one button → the buddy (#race).
    // 2026-10-05 (the user): every stage card says how hard it is (the course's difficulty: its word and one to three dots).
    const s=totalStars(prog);
    const el=frame('page-home',`<i class="home-scene" aria-hidden="true"></i><header class="ui-top">${brand()}${wallets()}</header>
      <main class="stage-row" aria-label="關卡">${LEVELS.map((l,i)=>{const open=stageOpen(l.city),st=prog.stars[l.city]||0,d=COURSES.find(c=>c.id===l.city).difficulty;
        return `<button class="stage ${open?'':'locked'}" data-level="${l.city}" aria-label="第 ${i+1} 關 ${cityName(l.city)}${open?`，${st} 顆星`:`，先跑完第 ${i} 關`}">
          <span class="dot"><canvas width="700" height="352" aria-hidden="true"></canvas>${open?'':icon('lock')}</span><b>${i+1} · ${cityName(l.city)}</b><small class="ui-tag diff">${[1,2,3].map(k=>`<i class="${k<=d?'on':''}"></i>`).join('')}${DIFF[d]}</small>${open?starRow(st):`<small class="ui-tag muted">${icon('lock')}</small>`}</button>`;}).join('')}</main><section class="next-race ui-panel" aria-live="polite"></section>${nav('home')}`);
    el.querySelectorAll('.stage canvas').forEach(cv=>drawCourse(cv,cv.closest('.stage').dataset.level));
    const row=el.querySelector('.stage-row'),stages=[...row.querySelectorAll('.stage')];
    let at=-1;
    const paint=i=>{if(i===at)return;at=i;
      const l=LEVELS[i],c=COURSES.find(x=>x.id===l.city),open=stageOpen(l.city),st=prog.stars[l.city]||0,best=bestOn(l.city),next=nextStarTime(l.city,st);
      profile.city=l.city;store.set(PROFILE,JSON.stringify(profile));
      stages.forEach((b,k)=>b.classList.toggle('is-selected',k===i));
      el.querySelector('.home-scene').style.backgroundImage=`url(assets/backdrops/${l.city}.webp${new URL(import.meta.url).search})`;
      const gift=stageGift(i+1),line=!open?`先跑完第 ${i} 關`:!st?(gift?`破關送 ${gift}`:'跑完拿第 1 顆星'):next?`${next} 秒內拿第 ${st+1} 顆星`:`三星了 · 最佳 ${wallTime(best,l.city)}`;
      el.querySelector('.next-race').innerHTML=`<div class="ui-card-head"><b>${c.title}</b><span>${DIFF[c.difficulty]}</span></div><p>${line}</p>
        <div class="acts"><button class="ui-icon-btn plain" data-to="course" aria-label="賽道介紹">${icon('info')}</button><button class="ui-btn primary block" data-to="race" ${open?'':'disabled'}>${open?`選夥伴${icon('arrow','')}`:icon('lock')}</button></div>`;
      el.querySelectorAll('.next-race [data-to]').forEach(b=>b.onclick=()=>go(b.dataset.to));};
    stages.forEach((b,i)=>b.onclick=()=>{paint(i);b.scrollIntoView({block:'nearest',behavior:'smooth'});});
    const first=Math.max(0,levelOf(profile.city));paint(first);stages[first].scrollIntoView({block:'nearest'});
  },

  race(){
    // Step 2 of a race (step 1 is the level, on the Home map): the buddy (the animal: 夥伴 in the UI since 2026-10-04, it may not
    // always be a horse), then 出發. 單騎: one shown large with its level and its best time here; a horse not owned yet
    // can be looked at, and the button unlocks it (horseSheet). 三棒接力 (open from RELAY_NEED stars): pick a leg slot,
    // tap a horse card for it; every card shows its speed on each leg; 推薦 fills the best order.
    // UI v2 (2026-10-04, the user approved the mock-up docs/ui-kit.html #a2 / #a6): round heads to pick from (a white ring on
    // the chosen one), one black card of numbers (now | full; best | next star), the type, the course's conditions on
    // glass, the green button. Relay: three big heads are the legs (a tag: which leg, its ground), the heads under them
    // go onto the chosen leg; the card sets the three side by side.
    const c=COURSES.find(x=>x.id===profile.city)||COURSES[0],relayOk=relayOpen(prog),mine=ROSTER.filter(h=>owns(prog,h.id)),bc=buildCourse(c.id),[wi,wl]=weatherOf(bc.theme.weather);
    warmCity(c.id);
    if(!MVP.relay||!relayOk||!profile.mode)profile.mode='solo';
    fixOrder();
    const cond=(n,foes=null)=>`<article class="ui-panel soft ui-card-body cond"><div><b>賽道狀況</b><p><span>${wl}</span><span>${bc.surface}</span><span>${n} 跳欄</span>${foes?`<span>${foes} 位對手</span>`:''}</p></div>${icon(wi)}</article>`;
    const head=(h,attr,cls='')=>`<button class="ui-marker ${cls} ${owns(prog,h.id)?'':'locked'}" role="listitem" ${attr}="${h.id}" aria-label="${h.name}${owns(prog,h.id)?'':'（還沒解鎖）'}">${owns(prog,h.id)?`<img src="${buddyImg(h)}" alt="">`:icon('lock')}</button>`;
    const rc=relayCourse(c.id),legs=legMains(rc),bests=readSolo();
    const el=frame('page-race',`${header('選夥伴',readCoins())}<main class="page-body">
      ${MVP.relay?`<div class="ctr"><div class="ui-tabs" role="tablist" aria-label="比賽方式" style="--n:2"><button role="tab" data-mode="solo">單騎</button><button role="tab" data-mode="relay" ${relayOk?'':'disabled'}>${relayOk?'三棒接力':`${icon('lock')}接力 · 要 3 位夥伴`}</button></div></div>`:''}
      <section data-for="solo"><div class="buddy-tray" role="list" aria-label="夥伴">${[...mine,...ROSTER.filter(h=>!owns(prog,h.id))].map(h=>head(h,'data-solo')).join('')}</div>
        <div class="stack"><article class="ui-panel ui-card-body pickcard"></article><div class="ui-pillrow">${icon('horse')}<span>類型</span><b class="pick-type"></b></div>${cond(bc.gameplay.jumps.length,LEVELS.find(l=>l.city===c.id)?.rivals)}<div class="go-row"></div></div></section>
      <section data-for="relay"><div class="legs">${[0,1,2].map(k=>`<div><button class="ui-marker big" data-leg="${k}"></button><span class="ui-tag"></span></div>`).join('')}</div>
        <div class="buddy-tray" role="list" aria-label="我的夥伴">${mine.map(h=>head(h,'data-horse')).join('')}<button class="ui-tag yellow" data-best>推薦</button></div>
        <div class="stack"><article class="ui-panel ui-card-body team"></article>${cond(rc.hurdles.length)}<button class="ui-btn primary block" data-go="play">出發${icon('arrow','')}</button></div></section></main>
      <div class="ui-scrim" hidden></div><section class="ui-modal ui-panel deep buy-sheet" role="dialog" aria-modal="true" hidden></section>`);
    let sel=0,see=soloHorse().id;
    const fit=(h,k)=>Object.entries(legs[k].share).reduce((a,[kind,x])=>a+x*AFFINITY[h.type][kind],0);   // its aptitude on leg k (the speed multiplier: shown as a word, suits())
    const paint=()=>{
      const solo=profile.mode==='solo';
      el.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-selected',b.dataset.mode===profile.mode));
      el.querySelectorAll('[data-for]').forEach(x=>x.hidden=x.dataset.for!==profile.mode);
      if(solo){
        const h=horseById(see),has=owns(prog,h.id),best=bests[`${c.id}:${h.id}`],p=HORSE_PRICE[h.id],st=buddyStats(h.stats,lvOf(h)),next=nextStarTime(c.id,prog.stars[c.id]||0);
        el.querySelector('.pickcard').innerHTML=`<div class="ui-card-head"><b>${h.name}</b><span>${lv(h)}</span></div>
          <dl class="ui-data"><h3>能力<i>現在 / 上限</i></h3>${Object.entries(STAT_NAME).map(([k,name])=>`<span>${name}</span><b>${st[k].now}</b><b>${st[k].full}</b>`).join('')}</dl>
          ${has?`<dl class="ui-data"><h3>這條賽道<i>最佳 / 下一顆星</i></h3><span>秒</span><b>${best?(best/tempoOf(profile.city)).toFixed(1):'–'}</b><b>${next??'–'}</b></dl>`
            :`<p class="pickprice">${MVP.gems?`${p.coins?`${coin}${p.coins} 或 `:''}${GEM}${p.gems}`:`${coin}${p.coins}`}${p.stars?` · 集滿 ${p.stars} ★ 免費`:p.stage?` · 破第 ${p.stage} 關送`:''}</p>`}`;
        {const t=el.querySelector('.pick-type');t.textContent=TYPE_NAME[h.type];t.closest('.ui-pillrow').style.display=MVP.types?'':'none';}
        el.querySelectorAll('[data-solo]').forEach(b=>b.classList.toggle('is-selected',+b.dataset.solo===h.id));
        el.querySelector('.go-row').innerHTML=has?`<button class="ui-btn primary block" data-start>出發 · ${h.name}${icon('arrow','')}</button>`:`<button class="ui-btn primary block" data-unlock>${icon('lock')}解鎖 ${h.name}</button>`;
        el.querySelector('[data-start]')?.addEventListener('click',()=>go('solo'));
        el.querySelector('[data-unlock]')?.addEventListener('click',()=>horseSheet(el,h,()=>{profile.solo=h.id;saveProfile();render();}));
        return;}
      const team=profile.order.map(horseById),sts=team.map(h=>buddyStats(h.stats,lvOf(h)));
      el.querySelectorAll('.legs>div').forEach((d,k)=>{const h=team[k],b=d.firstElementChild;
        b.innerHTML=`<img src="${buddyImg(h)}" alt="">`;b.classList.toggle('is-selected',sel===k);b.setAttribute('aria-label',`第${k+1}棒 ${h.name}，${suits(fit(h,k))}${sel===k?'，選取中':''}`);
        d.lastElementChild.textContent=`第${k+1}棒 · ${TERRAIN_NAME[legs[k].main]}`;});
      el.querySelectorAll('[data-horse]').forEach(b=>b.classList.toggle('is-selected',+b.dataset.horse===profile.order[sel]));
      el.querySelector('.team').innerHTML=`<div class="ui-card-head"><b>隊伍</b><span>${Math.round(rc.length)} m</span></div>
        <dl class="ui-data team"><h3>能力<i>現在</i></h3><span></span>${team.map(h=>`<b class="who">${h.name}</b>`).join('')}
          ${Object.entries(STAT_NAME).map(([k,name])=>`<span>${name}</span>${sts.map(s=>`<b>${s[k].now}</b>`).join('')}`).join('')}
          <span>這一段</span>${team.map((h,k)=>{const x=fit(h,k);return `<b class="fit ${x>=1.15?'':x>=1.07?'mid':'warn'}">${suits(x)}</b>`;}).join('')}</dl>`;
    };
    el.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{profile.mode=b.dataset.mode;saveProfile();paint();});
    el.querySelectorAll('[data-solo]').forEach(b=>b.onclick=()=>{see=+b.dataset.solo;if(owns(prog,see)){profile.solo=see;saveProfile();}paint();});
    el.querySelectorAll('[data-leg]').forEach(b=>b.onclick=()=>{sel=+b.dataset.leg;paint();});
    el.querySelectorAll('[data-horse]').forEach(b=>b.onclick=()=>{putOnLeg(+b.dataset.horse,sel);sel=(sel+1)%3;saveProfile();paint();});
    el.querySelector('[data-best]').onclick=()=>{   // every ordered pick of three from the horses owned
      let best=null,score=-1;for(const a of mine)for(const b of mine)for(const d of mine){if(a===b||b===d||a===d)continue;
        const v=fit(a,0)+fit(b,1)+fit(d,2);if(v>score+1e-9){score=v;best=[a.id,b.id,d.id];}}
      profile.order=best;saveProfile();paint();};
    paint();
  },

  async play(){
    const c=COURSES.find(x=>x.id===profile.city)||COURSES[0],team=profile.order.map(horseById);applyLook(team[0]);
    let session=null,gone=false;leave=()=>{gone=true;session?.exit();};
    // The stable feeds the race (form from Hunger / Stamina / Mood / Lv) and the race feeds the stable back.
    const form=()=>relayForm(team.map(h=>recover(care[h.id])),team.map(h=>({...SLICE_CONFIG,...racing(buddyStats(h.stats,lvOf(h)))})),team.map(h=>h.name));   // each buddy's own numbers at its level, then its care
    const bank=r=>{
      addCoins(r.coins);addGems(r.gems||0);if(MVP.decor)addDecor(`postcard_${c.id}`);const best=+store.get(BEST)||0;store.set(BEST,String(Math.max(best,r.bestCombo)));
      const all=readRelay(),old=all[c.id],newBest=!old||r.finishTime<old.time;
      all[c.id]={time:newBest?+r.finishTime.toFixed(3):old.time,rank:Math.min(old?.rank??9,r.rank)};store.set(RELAY_BEST,JSON.stringify(all));
      const runs=team.map(h=>{const a=afterRace(care[h.id],r);care[h.id]=a.care;return a;});bag={...bag,seed:(bag.seed||0)+FARM.raceSeeds};saveCare({setItem:store.set},care,bag);   // a race brings a wheat seed home (farm.mjs)   // every leg's horse ran
      // What the next race would cost: a hungry, tired or dirty horse runs slower, and the results say so (it was silent).
      const worn=form().notes.filter(n=>/肚子餓|毛髒/.test(n)).map(n=>`下一場 ${n}（會變慢）· 先去牧場照顧`);
      const f=finish(prog,{city:c.id,solo:false,result:r,today:today()});prog=f.p;saveProg();addCoins(f.coins);addGems(f.gems);
      return {total:readCoins(),gems:gemsShown(),newCombo:r.bestCombo>best,best:old?.time||0,newBest,xp:runs[0].xp,level:level(care[team[0].id]),levelUp:runs.some(a=>a.levelUp),notes:worn,...rewards(f,c.id,null)};
    };
    session=await startSlice({city:c.id,team:team.map(racer),getForm:form,onFinish:bank,getBest:()=>readRelay()[c.id]?.time,getBrief:()=>brief(c,false),lean:prog.runs>=3,
      tag:`${c.city.toUpperCase()} · ${c.title.toUpperCase()} · RELAY`,
      onExit:(result,dest)=>{if(location.hash!=='#play')return;  // already navigated away (back gesture)
        if(dest?.city){profile.city=dest.city;saveProfile();go('race',{replace:true});}
        else if(dest==='play')go('play',{replace:true});
        else if(dest==='race'&&playFromSetup)history.back();else go(dest,{replace:true});}});
    if(gone)session.exit();
  },

  async solo(){
    // Solo run (單騎練跑): one buddy over about SOLO.target m of the city's track, no rivals, no handoffs, on the new
    // rules' first stage (slice-config SOLO), on its own numbers at its level. Practice: no stable form and no wear,
    // and it earns xp (stable-care afterSolo, by the run's stars; 2026-10-04, the user); the coins picked up are banked
    // and the best time per track and buddy is kept (SOLO_BEST, simulation seconds).
    // 2026-10-05 (the user): a regular player's first solo start is the practice (five things to try, slice-app LESSONS:
    // no rewards, no time kept); done once (TUTORIAL), its green button comes back here for the real run. 最高管理者 skips
    // it; Settings → 新手練習 plays it again.
    const h=soloHorse(),c=COURSES.find(x=>x.id===profile.city)||COURSES[0],key=`${c.id}:${h.id}`,L=LEVELS[levelOf(c.id)],tut=store.get(TUTORIAL)==='done'?3:+store.get(TUTORIAL)||0,again=practiceNext,practice=again||(!admin()&&!BALL_GAME&&tut<Math.min(levelOf(c.id)+1,3));   // the ball game: no rhythm lessons before a stage (the ring shows a thumb)practiceNext=false;applyLook(h);
    // The practice goes stage by stage (2026-10-06): before stage 1 the rhythm, before stage 2 lanes, before stage 3 the fence
    // and the sprint (LEVELS lesson); TUTORIAL counts how many of the three are done ('done': all). Settings → 新手練習: all five.
    const stage={...L,...(practice?again?{lesson:[0,5],tut:'done'}:{lesson:LEVELS[tut].lesson,tut:tut>=2?'done':String(tut+1)}:null)};
    let session=null,gone=false;leave=()=>{gone=true;session?.exit();applyLook();};
    const bank=r=>{const all=readSolo(),best=all[key]||0,newBest=!best||r.finishTime<best,seconds=r.finishTime/tempoOf(c.id);
      if(newBest){all[key]=+r.finishTime.toFixed(3);store.set(SOLO_BEST,JSON.stringify(all));if(r.trace)store.set(GHOST+key,JSON.stringify(r.trace));}
      const f=finish(prog,{city:c.id,solo:true,result:{...r,seconds},today:today()});prog=f.p;saveProg();addCoins(r.coins+f.coins);addGems(f.gems);
      const bestCombo=+store.get(BEST)||0;store.set(BEST,String(Math.max(bestCombo,r.bestCombo||0)));   // the settings page's 「最高連擊」 (2026-10-10: only the relay wrote it)
      justRan={id:h.id,at:Date.now(),won:r.rank==null||r.rank===1};   // the ranch shows it for a minute (ranch-view RANCH.ran)
      const a=afterSolo(care[h.id],{stars:f.runStars,perfect:r.perfect});care[h.id]=a.care;bag={...bag,seed:(bag.seed||0)+FARM.raceSeeds};saveCare({setItem:store.set},care,bag);
      // The hot streak: runs in a row that got somewhere (a new best or a new star); each one pays a little more, up to five.
      const hot=MVP.daily&&(newBest||f.newStars)?Math.min(5,(+store.get(HOT)||0)+1):0;store.set(HOT,String(hot));const hotCoins=hot>1?hot*10:0;if(hotCoins)addCoins(hotCoins);
      return {total:readCoins(),gems:gemsShown(),best,newBest,xp:a.xp,level:level(a.care),levelUp:a.levelUp,hot,hotCoins,tip:tipFor(r,f),...rewards(f,c.id,seconds)};};
    const ghost=()=>{try{return JSON.parse(store.get(GHOST+key)||'null')}catch{return null}};
    // What the ranch gives a solo run (2026-10-06: a tester could not feel the items; they only reached the relay): the start
    // energy, from how rested the buddy is (精神) plus an energy bar. Only ever a help: nothing here slows a solo run.
    const soloForm=()=>careForm(care[h.id],{...SLICE_CONFIG,...racing(buddyStats(h.stats,lvOf(h)))});   // this buddy's own numbers at its level, then its care: felt on every stage (2026-10-10; the first two had none)
    session=await startSlice({city:c.id,solo:true,practice,stage,rivalCount:L?.rivals??0,team:[racer(h)],...(practice?null:{getForm:soloForm,onFinish:bank,getBest:()=>readSolo()[key],getBrief:()=>brief(c,true),getGhost:ghost,lean:prog.runs>=3}),
      tag:practice?'PRACTICE':`${c.city.toUpperCase()} · ${c.title.toUpperCase()} · SOLO · ${h.name.toUpperCase()}`,
      onExit:(result,dest)=>{if(location.hash!=='#solo')return;  // already navigated away (back gesture)
        if(dest?.city){profile.city=dest.city;saveProfile();go('race',{replace:true});}   // the level this run opened
        else if(dest==='solo')go('solo',{replace:true});   // the practice is done: the real run
        else if(dest==='race'&&playFromSetup)history.back();else go(dest,{replace:true});}});
    if(gone)session.exit();
  },


  stable(){
    // Ranch, UI v2 (2026-10-05, the user approved the mock-up docs/ui-kit.html #a8–#a10): flat barn plate + 3D close-up.
    // Top: back, title, wallets; under them a row of round heads, the buddies owned (a tap shows that one; + → My
    // Buddies). Bottom, over the thumbs: a black card (name, LV, the four care bars: white, yellow under 30), then the
    // actions: Feed and Brush big and green (Feed shows the food it will give), Look and Items small glass buttons
    // (white while their sheet is open). Look is a sheet in the card's place, the stage stays live; Items is a black
    // sheet with three tabs (food to pick for Feed, care items used on tap, tools).
    care=readCare({getItem:store.get},ROSTER.map(h=>h.id));   // stamina rested back since the last visit
    let index=Math.max(0,ROSTER.findIndex(h=>h.id===(stableFocus??profile.horse))),pane=null,food='wheat',picked=false,view=null,alive=true;   // the feed button feeds wheat, the ranch's own food, unless a treat was picked from the items
    const maned=()=>MVP.perks&&!COATS[ROSTER[index].coat].species;let part=maned()?'mane':GEAR[0].mat,kind='food';   // MVP: no mane styles   // part: 'mane' (this buddy's mane and tail style; a llama or a rhino has none) or a GEAR material
    const owned=readDecor(),deco=MVP.decor?[...DECOR,...POSTCARDS].filter(d=>owned.has(d.id)):[];
    const el=frame('page-stable ui-live',`<div class="st-bg" aria-hidden="true"></div><div class="st-decor" aria-hidden="true">${deco.map(d=>
        `<i data-deco="${d.id}" style="left:${d.slot[0]*100}%;top:${d.slot[1]*100}%;width:${d.slot[2]*100}%"><img src="assets/stable/deco/${d.id}.webp" alt="">${d.id==='nameplate'?'<b></b>':''}</i>`).join('')}</div><div class="view"></div><p class="stage-loading">載入牧場…</p>
      <i class="st-door" aria-hidden="true"></i><header class="ui-header st-top"><button class="ui-icon-btn" data-back aria-label="返回">${icon('back','')}</button><h1>Ranch</h1>${wallet(readCoins(),{gems:gemsShown()})}</header>
      ${ranchTabs(RANCH_TABS.findIndex(t=>t.dorm))}<div class="st-tray buddy-tray" role="list" aria-label="我的夥伴"></div><div class="ui-scrim st-scrim" hidden></div><section class="st-pop ui-modal ui-panel deep" role="dialog" aria-modal="true" hidden></section>
      <i class="st-heart" aria-hidden="true"></i>
      <div class="st-foot"><section class="st-sheet ui-panel" aria-label="造型" hidden></section><aside class="st-buddy ui-panel"></aside>
        <div class="st-acts"><button class="side" data-pane="gear" aria-expanded="false"><span class="ui-icon-btn">${icon('palette')}</span>造型</button>
        <button class="big" data-act="feed"><span>${icon('fork')}<i class="st-food"></i></span>Feed</button><button class="big" data-act="brush"><span>${icon('brush')}</span>Brush</button>
        <button class="side" data-pane="items" aria-expanded="false"><span class="ui-icon-btn">${icon('items')}</span>Items</button></div></div>`);
    const toast=toaster(el);
    const heart=()=>{const h=el.querySelector('.st-heart');h.classList.remove('pop');void h.offsetWidth;h.classList.add('pop');};
    const worn=g=>profile.gear[g.mat]??g.colors[0];
    const shown=(g,c)=>c===g.colors[0]&&g.mat==='Tack_Pad'&&COATS[ROSTER[index].coat].species?'#c4a07c':c;   // the first swatch is "as built": a llama's or a rhino's own pad is tan, not the horse's dark grey
    // The horse's moods (stable-view): any touch on the page gets it up if it lay down to rest; a bar filled to 100 → it
    // rears for joy once the act is done.
    el.addEventListener('pointerdown',()=>view?.wake(),{capture:true});
    const filled=(was,now)=>{if(['hunger','clean'].some(k=>now[k]>=100&&was[k]<100))view?.cheer();};
    function paint(){
      const h=ROSTER[index],cr=care[h.id];
      el.querySelectorAll('[data-pane]').forEach(b=>b.setAttribute('aria-expanded',b.dataset.pane===pane));
      if(!picked)food='wheat';else if(!(bag[food]>0)){picked=false;food='wheat';}   // out of the treat picked: back to wheat
      el.querySelector('.st-food').innerHTML=`<img src="assets/stable/item_${food}.webp" alt=""><b>${bag[food]??0}</b>`;
      const pop=el.querySelector('.st-pop'),card=el.querySelector('.st-buddy'),sheet=el.querySelector('.st-sheet'),gear=pane==='gear';
      pop.hidden=el.querySelector('.st-scrim').hidden=!pane||gear;sheet.hidden=!gear;
      const plate=el.querySelector('[data-deco=nameplate] b');if(plate)plate.textContent=h.name;
      const stat=(ic,label,v)=>`<div class="st-stat ${v<30?'low':''}" role="img" aria-label="${label} ${v} / 100">${icon(ic)}${bar(v,v<30?'var(--ui-yellow)':'')}</div>`;   // icon + bar (the number only for screen readers); yellow: it needs care
      card.innerHTML=`<div class="ui-card-head"><b>${h.name}</b><span>${lv(h)}</span></div><div class="st-stats">${stat('fork','Hunger',cr.hunger)+stat('sparkle','Clean',cr.clean)}</div>`;
      // The heads: the buddies owned; a tap shows that one here (and the ranch opens on it next time).
      const tray=el.querySelector('.st-tray');
      tray.innerHTML=ROSTER.filter(x=>owns(prog,x.id)).map(x=>`<button class="ui-marker ${x.id===h.id?'is-selected':''}" role="listitem" data-see="${x.id}" aria-label="${x.name}"><img src="${buddyImg(x)}" alt=""></button>`).join('')+`<button class="ui-marker locked" data-more aria-label="我的夥伴">${icon('plus','')}</button>`;
      tray.querySelectorAll('[data-see]').forEach(b=>b.onclick=()=>{if(view?.busy)return;index=ROSTER.findIndex(x=>x.id===+b.dataset.see);profile.horse=ROSTER[index].id;saveProfile();if(part==='mane'&&!maned())part=GEAR[0].mat;paint();});
      tray.querySelector('[data-more]').onclick=()=>go('horses');
      // Items: the foods in the bag; a tap picks the one Feed gives (wheat unless a treat is picked).
      const have=ITEMS.filter(it=>bag[it.id]>0&&it.kind==='food'),tile=it=>`<button class="ui-card" data-item="${it.id}" ${it.kind==='food'?`aria-pressed="${it.id===food}"`:''} aria-label="${it.name}${it.kind==='tool'?'':' '+bag[it.id]}"><img src="assets/stable/item_${it.id}.webp" alt="">${it.kind==='tool'?'':`<b>×${bag[it.id]}</b>`}</button>`;
      if(pane==='items')pop.innerHTML=`<header><h2>Items</h2><button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header>
        <div class="st-grid items">${have.map(tile).join('')}</div><p class="st-hint ui-label">${have.length?'選一個，「餵食」就餵它':'沒有食物：去麥田收成'}</p>
        <button class="ui-btn block" data-go="shop">去商店買更多${icon('arrow','')}</button>`;
      const g=GEAR.find(x=>x.mat===part),mane=maneOf(h.id),riderShut=x=>x.mat.startsWith('Rider_')&&!riderColors(prog),gears=GEAR.filter(x=>MVP.perks||!x.mat.startsWith('Rider_'));   // MVP: the rider's clothes stay as they are
      if(gear)sheet.innerHTML=`<header><b>造型</b><button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header><div class="parts" role="tablist" ${maned()?'':'style="grid-template-columns:repeat(6,1fr)"'}>
          ${maned()?`<button role="tab" aria-selected="${part==='mane'}" data-part="mane"><i class="mane" style="background-image:url(assets/ui/hair_${mane}.webp?v=1)"></i>鬃毛</button>`:''}${gears.map(x=>`<button role="tab" aria-selected="${x.mat===part}" data-part="${x.mat}"><i style="background:${shown(x,worn(x))}"></i>${x.name}</button>`).join('')}</div>
        ${g?`<div class="swatches" role="radiogroup" aria-label="${g.name}顏色">${g.colors.map((c,i)=>`<button role="radio" aria-label="${i?c:'原色'}" aria-checked="${worn(g)===c}" data-color="${c}" style="background:${shown(g,c)}" ${i&&riderShut(g)?'disabled':''}></button>`).join('')}</div>${riderShut(g)?`<p class="look-note ui-label">${icon('lock')}破第 ${PERKS.rider.stage} 關開放</p>`:''}`
          :`<div class="manes" role="radiogroup" aria-label="鬃毛造型">${HAIR.map(x=>`<button role="radio" aria-checked="${x.id===mane}" data-mane="${x.id}" ${maneOpen(prog,x.id)?'':'disabled'}><img src="assets/ui/hair_${x.id}.webp?v=1" alt=""><span>${maneOpen(prog,x.id)?x.name:`破第 ${PERKS.mane.stage} 關開放`}</span></button>`).join('')}</div>`}`;
      for(const x of [pop,sheet])x.querySelector('[data-close]')?.addEventListener('click',()=>{pane=null;paint();});
      pop.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const it=ITEMS.find(x=>x.id===b.dataset.item);
        food=it.id;picked=it.id!=='wheat';toast(`餵食會用${it.name}`);paint();});
      pop.querySelector('[data-go]')?.addEventListener('click',()=>go('shop'));
      sheet.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{part=b.dataset.part;paint();});
      sheet.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{const c=b.dataset.color;
        if(c===g.colors[0])delete profile.gear[part];else profile.gear[part]=c;saveProfile();paint();});
      sheet.querySelectorAll('[data-mane]').forEach(b=>b.onclick=()=>{profile.manes={...profile.manes,[h.id]:b.dataset.mane};saveProfile();paint();});   // this buddy's own
      const look=h.coat+mane+JSON.stringify(profile.gear);if(look!==paint.look){paint.look=look;applyLook(h);const come=paint.who!==h.id;paint.who=h.id;view?.show(cr.hunger<40?'hungry':cr.hunger>80&&cr.clean>80?'happy':null,come);}   // how it greets you (stable-view ARRIVE)
    }
    el.querySelectorAll('[data-pane]').forEach(b=>b.onclick=()=>{pane=pane===b.dataset.pane?null:b.dataset.pane;paint();});
    el.querySelector('.st-scrim').onclick=()=>{pane=null;paint();};
    const esc=e=>{if(e.key==='Escape'&&pane){e.stopImmediatePropagation();pane=null;paint();}};   // Esc closes the pop-up before leaving the page
    window.addEventListener('keydown',esc,true);
    el.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
      if(view?.busy)return;   // let the brushing finish
      pane=null;
      const h=ROSTER[index],act=b.dataset.act,res=careAction(care[h.id],bag,act,food);
      if(res.fail){toast(res.fail);paint();return;}
      const was=care[h.id];care[h.id]=res.care;bag=res.items;
      saveCare({setItem:store.set},care,bag);toast(`${h.name} ${res.msg}`);
      view?.react(act,()=>alive&&heart(),`assets/stable/item_${food}.webp`);   // heart on the bite / once combing is under way
      paint();filled(was,res.care);
    });
    stableFocus=null;
    leave=()=>{alive=false;window.removeEventListener('keydown',esc,true);view?.dispose();applyLook();};
    el.querySelectorAll('[data-rtab]').forEach((b,i)=>b.onclick=()=>{const t=RANCH_TABS[i];if(t.dorm||view?.busy)return;PAGES.ranch.shot=t.shot;go('ranch',{replace:true});});   // the other tabs: that shot of the 3D ranch (this page leaves no history entry behind: back from the ranch goes home)
    paint.look=null;paint();
    const t0=performance.now();mountStableView(el.querySelector('.view')).then(v=>{store.set('hoofbeat.loadtime.ranch',((performance.now()-t0)/1000).toFixed(1));if(!alive){v.dispose();return;}view=v;el.querySelector('.stage-loading')?.remove();paint.look=paint.who=null;paint();})
      .catch(()=>{el.querySelector('.stage-loading').textContent='3D 無法載入';});
  },


  tracks(){
    // Tracks mock: a swipeable map card per city (city chip, the name over the map, tagline), dots, the centred one's
    // facts (Course · Surface · Weather), VIEW COURSE → the course page.
    let at=Math.max(0,COURSES.findIndex(c=>c.id===profile.city));
    const el=frame('page-tracks',`${header('Tracks',readCoins())}<main class="page-body">
      <p class="ui-eyebrow">Choose your next ride</p>
      <div class="track-carousel">${COURSES.map(c=>`<article class="track-card ui-panel" data-id="${c.id}"><div class="map"><canvas width="680" height="560" aria-hidden="true"></canvas>
        <span class="ui-chip">${c.city}</span><h2>${c.title}</h2></div><p>${c.tagline}</p></article>`).join('')}</div>
      <div class="ui-dots" aria-hidden="true">${COURSES.map(()=>'<i></i>').join('')}</div>
      <dl class="ui-facts ui-panel" id="facts"></dl>
      <button class="ui-btn primary block caps" data-course>View course${icon('arrow','')}</button></main>${nav('home')}`);
    const row=el.querySelector('.track-carousel'),cards=[...row.children];
    cards.forEach(a=>drawCourse(a.querySelector('canvas'),a.dataset.id));
    const show=i=>{at=i;const c=buildCourse(COURSES[i].id),[wi,wl]=weatherOf(c.theme.weather);
      el.querySelectorAll('.ui-dots i').forEach((d,k)=>d.classList.toggle('on',k===i));
      el.querySelector('#facts').innerHTML=[['tracks','Course',`${Math.round(relayCourse(c.id).lapLength)} m`],['horse','Surface',c.surface],[wi,'Weather',wl]]
        .map(([ic,k,v])=>`<div><dt>${icon(ic)}${k}</dt><dd>${v}</dd></div>`).join('');};
    row.onscroll=()=>{const i=Math.round(row.scrollLeft/(cards[1]?cards[1].offsetLeft-cards[0].offsetLeft:1));if(i!==at&&cards[i])show(i);};
    requestAnimationFrame(()=>{row.scrollLeft=at*(cards[1]?cards[1].offsetLeft-cards[0].offsetLeft:0);});show(at);
    el.querySelector('[data-course]').onclick=()=>{profile.city=COURSES[at].id;saveProfile();go('course');};
  },

  course(){
    // Course page mock: the course name, CITY · N LAPS, the big map, Know the course, RACE HERE → race setup.
    const c=buildCourse(profile.city);   // the lap's length: a solo run is one lap (2026-10-05), the relay two or three
    const el=frame('page-course',`${header(c.title,readCoins())}<main class="page-body">
      <p><span class="ui-chip">${c.city} · ${Math.round(c.lapLength)} m</span></p>
      <div class="course-map ui-panel"><canvas width="720" height="620" aria-hidden="true"></canvas></div>
      <section class="ui-panel know"><h2 class="ui-section">Know the course</h2><dl class="ui-facts">
        ${[['Layout',c.brief],
          ['Terrain',`${c.surface} / ${c.scenery}`]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>
      <button class="ui-btn primary block caps" data-go="race">Race here${icon('arrow','')}</button></main>${nav('home')}`);
    drawCourse(el.querySelector('.course-map canvas'),c.id);
  },

  shop(){
    // Shop (guideline §14): Feed · Care · Decor; a card is image, name, effect, a rule, Owned and the price. The whole
    // card is the button: it opens a confirm sheet (so a stray tap never spends). Food and care go into the Items bag;
    // decor goes on the stable wall (one each); postcards come from racing.
    let tab=PAGES.shop.tab||'food';
    const el=frame('page-shop',`${header('Shop',readCoins())}<div class="ui-tabs ui-panel" role="tablist" style="--n:4"></div><main class="page-body shop"></main>
      <div class="ui-scrim" hidden></div><section class="ui-modal ui-panel deep buy-sheet" role="dialog" aria-modal="true" hidden></section>${nav('shop')}`),toast=toaster(el);
    const scrim=el.querySelector('.ui-scrim'),sheet=el.querySelector('.buy-sheet'),close=()=>{scrim.hidden=sheet.hidden=true;};
    scrim.onclick=close;
    const price=(p,coins)=>`<span class="ui-price ${coins<p?'short':''}">${coin}${p}</span>`;
    function confirm(id){
      const it=ITEMS.find(x=>x.id===id),d=DECOR.find(x=>x.id===id),cost=(it||d).price,coins=readCoins(),name=(it||d).name;
      sheet.innerHTML=`<header><h2>${name}</h2><button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header>
        <img class="buy-art" src="${it?`assets/stable/item_${id}.webp`:`assets/stable/deco/${id}.webp`}" alt="">
        <p class="ui-sub">${it?itemEffect(it):'掛在牆上'}</p><p class="ui-label">${it?`擁有 ${bag[id]}`:''}${coins<cost?`${it?' · ':''}金幣不夠，去比賽賺一點`:''}</p>
        <div class="buy-actions"><button class="ui-btn" data-close>取消</button><button class="ui-btn primary" data-buy ${coins<cost?'disabled':''}>購買 ${coin}${cost}</button></div>`;
      scrim.hidden=sheet.hidden=false;sheet.querySelector('[data-buy]').focus();
      sheet.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
      sheet.querySelector('[data-buy]').onclick=()=>{
        if(!spendCoins(cost)){toast('金幣不夠，去比賽賺一點');return;}
        if(it){bag={...bag,[id]:bag[id]+1};saveCare({setItem:store.set},care,bag);toast(`買了${it.name}（擁有 ${bag[id]}）`);}
        else{addDecor(id);toast(`${d.name}已經掛到牆上了`);}
        close();paint();};
    }
    function paint(){
      const coins=readCoins(),owned=readDecor();el.querySelector('[data-coins]').textContent=coins.toLocaleString('en-US');
      const tabs=[['food','Food'],['horses','夥伴']];   // MVP (2026-10-10): the care items and the decorations are hidden
      const card=(img,name,sub,foot,id,cls='',tag='button')=>`<${tag} class="ui-card shop-card ${cls}" ${tag==='button'?`data-id="${id}"`:''}><span class="art"><img src="${img}" alt=""></span><b>${name}</b><small>${sub}</small>
        <span class="foot">${foot}</span></${tag}>`;
      const gem=`<i class="gem">${icon('gem')}</i>`;
      const list=tab==='horses'?ROSTER.map(h=>{const p=HORSE_PRICE[h.id];return owns(prog,h.id)?card(buddyImg(h),h.name,lv(h),'<span class="own">已擁有</span>',h.id,'owned','article')
            :card(buddyImg(h),h.name,[lv(h),p.stars?`${p.stars}★ 送`:p.stage?`第 ${p.stage} 關送`:''].filter(Boolean).join(' · '),`<span class="own">${MVP.gems?`${gem}${p.gems}`:''}</span>${price(p.coins,coins)}`,'horse-'+h.id);}).join('')   // no coin price: diamonds only
        :tab==='decor'
        ?DECOR.map(d=>owned.has(d.id)?card(`assets/stable/deco/${d.id}.webp`,d.name,'掛在牆上','<span class="own">已擁有</span>',d.id,'owned','article')
            :card(`assets/stable/deco/${d.id}.webp`,d.name,'掛在牆上',`<span class="own"></span>${price(d.price,coins)}`,d.id)).join('')
          +`<h2 class="ui-section">城市明信片</h2><p class="shop-note ui-label">在該城市完賽取得</p>`+POSTCARDS.map(p=>card(`assets/stable/deco/${p.id}.webp`,COURSES.find(c=>c.id===p.city).city,
            owned.has(p.id)?'已收集':'還沒去比賽','',p.id,`postcard ${owned.has(p.id)?'':'locked'}`,'article')).join('')
        :ITEMS.filter(it=>(it.kind===tab||tab==='food'&&it.kind==='seed')&&it.price).sort((a,b)=>(b.kind==='seed')-(a.kind==='seed')).map(it=>card(`assets/stable/item_${it.id}.webp`,it.name,itemEffect(it)||'種在麥田，長成小麥',`<span class="own">×${bag[it.id]}</span>${price(it.price,coins)}`,it.id)).join('');
      el.querySelector('.ui-tabs').innerHTML=tabs.map(([k,l])=>`<button role="tab" aria-selected="${k===tab}" data-tab="${k}">${l}</button>`).join('');   // outside the scroller: the tabs stay put while the goods scroll (2026-10-05, the user)
      el.querySelector('.shop').innerHTML=`<div class="shop-grid">${list}</div>`;
      el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=PAGES.shop.tab=b.dataset.tab;paint();el.querySelector('.shop').scrollTop=0;});
      el.querySelectorAll('button.shop-card').forEach(b=>b.onclick=()=>b.dataset.id.startsWith('horse-')?horseSheet(el,horseById(+b.dataset.id.slice(6)),paint):confirm(b.dataset.id));
    }
    paint();
  },

  missions(){
    const el=frame('page-missions',`${header('Missions',readCoins())}<main class="page-body">
      <div class="ui-card small locked">${icon('lock')}<small>即將開放</small></div></main>${nav('home')}`);
  },

  horses(){
    // My Buddies, 3 columns: portrait, name + Lv (+ its relay leg), one bar (progress to the next level); the three
    // relay horses are the selected cards; the pill sorts by level. A card opens the horse in the Stable. Horses not
    // owned yet come after, greyed with their price: a tap opens the unlock sheet (horseSheet).
    care=readCare({getItem:store.get},ROSTER.map(h=>h.id));
    const desc=PAGES.horses.desc??true,mine=ROSTER.filter(h=>owns(prog,h.id)).sort((a,b)=>(care[b.id].xp-care[a.id].xp)*(desc?1:-1)),rest=ROSTER.filter(h=>!owns(prog,h.id));
    const el=frame('page-horses',`${header('My Buddies',readCoins())}<main class="page-body">
      <div class="horses-head"><p class="ui-eyebrow">你的夥伴</p><p class="ui-eyebrow">${mine.length} / ${ROSTER.length}</p></div>
      ${MVP.levels?`<div class="horse-filter ui-panel deep"><span>All buddies</span><button data-sort aria-label="依等級排序">Level ${desc?'↓':'↑'}</button></div>`:''}
      <div class="horse-grid">${mine.map(h=>{const cr=care[h.id],leg=legLabel(h.id);
        return `<button class="ui-card small ${leg?'is-selected':''}" data-see="${h.id}" aria-label="${h.name}${lv(h)?'，'+lv(h):''}${leg?'，'+leg:''}">
          <span class="art"><img src="${buddyImg(h)}" alt=""></span><span class="name"><b>${h.name}</b><small>${[lv(h),leg].filter(Boolean).join(' · ')||'在牧場'}</small></span>${MVP.levels?bar(level(cr)>=MAX_LEVEL?100:cr.xp%XP_LEVEL/XP_LEVEL*100):''}</button>`;}).join('')}
        ${rest.map(h=>{const p=HORSE_PRICE[h.id];return `<button class="ui-card small to-unlock" data-unlock="${h.id}" aria-label="${h.name}，還沒解鎖，${p.coins} 金幣${MVP.gems?`或 ${p.gems} 鑽石`:''}">
          <span class="art"><img src="${buddyImg(h)}" alt="">${icon('lock')}</span><span class="name"><b>${h.name}</b><small>${coin}${p.coins}${p.stars?` · ${p.stars}★`:p.stage?` · 第 ${p.stage} 關送`:''}</small></span></button>`;}).join('')}</div></main>
      <div class="ui-scrim" hidden></div><section class="ui-modal ui-panel deep buy-sheet" role="dialog" aria-modal="true" hidden></section>${nav('home')}`);
    const sortBtn=el.querySelector('[data-sort]');if(sortBtn)sortBtn.onclick=()=>{PAGES.horses.desc=!desc;render();};
    el.querySelectorAll('[data-see]').forEach(b=>b.onclick=()=>{stableFocus=+b.dataset.see;profile.horse=stableFocus;saveProfile();go('stable');});
    el.querySelectorAll('[data-unlock]').forEach(b=>b.onclick=()=>horseSheet(el,horseById(+b.dataset.unlock),render));
  },

  settings(){
    // Settings mock: rider card (name, Lv and bar: every 100 xp the horses earn), one list of rows (switch, value or →).
    // The About row: the build, the models, and the screen as width × the height that can be seen / the height the browser
    // lays out (they differ where a browser bar covers the page: index.html --app-h); for a tester's screenshot.
    care=readCare({getItem:store.get},ROSTER.map(h=>h.id));
    const muted=store.get('hoofbeat.muted')==='true',xp=ROSTER.reduce((t,h)=>t+care[h.id].xp,0),best=+store.get(BEST)||0;
    const el=frame('page-settings',`${header('Settings',readCoins())}<main class="page-body">
      <section class="rider-card ui-panel"><img class="ui-avatar" src="assets/ui/rider_0.webp?v=2" alt=""><div>
        <input class="rider-name" id="rider-name" maxlength="16" value="${esc(profile.name)}" autocomplete="off" aria-label="騎士名字">
        <small class="ui-sub">Lv. ${ranchLevel()} · Best combo ${best}</small>${bar(ranchLevel()/ROSTER.length*100)}</div></section>
      <div class="ui-tabs ui-panel" role="tablist" aria-label="權限" style="--n:2">${[['user','一般使用者'],['admin','最高管理者']].map(([k,l])=>`<button role="tab" aria-selected="${admin()===(k==='admin')}" data-role="${k}">${l}</button>`).join('')}</div>
      ${admin()?'<p class="ui-label role-note">金幣和鑽石無限 · 所有關卡開放</p>':''}
      <ul class="ui-list ui-panel">
        <li>${icon('sound')}<span>Sound</span><input class="ui-switch" id="sound" type="checkbox" role="switch" aria-label="音效" ${muted?'':'checked'}></li>
        <li data-i18n-off>${icon('info')}<span>English</span><input class="ui-switch" id="lang" type="checkbox" role="switch" aria-label="English" ${lang()==='en'?'checked':''}></li>
        <li>${icon('bolt')}<span>蓄力鈕在左手邊</span><input class="ui-switch" id="hand" type="checkbox" role="switch" aria-label="蓄力鈕在左手邊" ${store.get('hoofbeat.hand.v1')==='left'?'checked':''}></li>
        <li><button class="row" data-go="horses">${icon('horse')}<span>我的夥伴</span><small>${prog.owned.length} / ${ROSTER.length}</small>${icon('arrow','chev')}</button></li>
        <li><button class="row" data-help>${icon('info')}<span>Race controls</span>${icon('arrow','chev')}</button></li>
        <li><button class="row" data-cal>${icon('music')}<span>節奏校正</span><small id="cal-value">${latencyLabel()}</small>${icon('arrow','chev')}</button></li>
        ${BALL_GAME?'':`<li><button class="row" data-practice>${icon('horse')}<span>新手練習</span><small>${store.get(TUTORIAL)==='done'?'已完成':'約 1 分鐘'}</small>${icon('arrow','chev')}</button></li>`}
        <li><button class="row" data-log>${icon('info')}<span>測試紀錄</span><small>${summary().races} 場</small>${icon('arrow','chev')}</button></li>
        <li><button class="row" onclick="location.href='perf.html'">${icon('bolt')}<span>效能測試</span><small>約 30 秒</small>${icon('arrow','chev')}</button></li>
        <li>${icon('horse')}<span style="white-space:nowrap">About HOOFBEAT</span><small style="text-align:right">${new URL(import.meta.url).searchParams.get('v')||''} · 模型 ${MODEL_VERSION} · ${innerWidth}×${Math.round(window.visualViewport?.height??innerHeight)}/${innerHeight} · 載入 ${store.get('hoofbeat.loadtime.ranch')||'–'}/${store.get('hoofbeat.loadtime.race')||'–'} s</small></li>
        <li><button class="row danger" id="reset">${icon('reset')}<span>Reset progress</span>${icon('arrow','chev')}</button></li></ul></main>
      <div class="ui-scrim" hidden></div><section class="ui-modal ui-panel deep" role="dialog" aria-modal="true" hidden><header><h2>Race controls</h2>
        <button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header><ul class="ui-list controls">
        <li><span><b>點黃 / 藍腳印</b><small class="note">節奏點到按鈕時按下（鍵盤 X / N）</small></span></li>
        <li><span><b>腳印往外滑</b><small class="note">換道，放手彈回（鍵盤 ← / →）</small></span></li>
        <li><span><b>兩個腳印同按</b><small class="note">跳過障礙（X＋N）</small></span></li>
        <li><span><b>蓄力鈕 ⚡</b><small class="note">中心點打 5 下存一段，按一下衝刺；跟在對手後面按是飛越（空白鍵）</small></span></li>
        <li><span><b>Ⅱ / Esc</b><small class="note">暫停：繼續、重新開始、音效、離開</small></span></li></ul></section>
      <section class="ui-modal ui-panel deep cal" role="dialog" aria-modal="true" aria-label="節奏校正" hidden><header><h2>節奏校正</h2>
        <button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header>
        <p class="ui-muted">戴上比賽時用的耳機或喇叭，專心聽嗶聲（不用看畫面），每一聲都點一下大按鈕，或按空白鍵。前兩聲是預備，共 10 下。</p>
        <button class="ui-btn primary block cal-tap">開始</button><p class="cal-out" aria-live="polite">目前：${latencyLabel()}</p>
        <button class="ui-btn sm block" data-cal-zero>歸零（不校正）</button></section>
      <section class="ui-modal ui-panel deep plog" role="dialog" aria-modal="true" aria-label="測試紀錄" hidden><header><h2>測試紀錄</h2>
        <button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header>
        <p class="ui-muted">每一場比賽（跑完、中途離開、重來）和錯誤都記在這支手機上。測試結束請按「複製」貼給我們，或下載檔案傳過來。</p>
        <p class="plog-sum"></p><button class="ui-btn primary block" data-log-copy>複製紀錄</button><button class="ui-btn block" data-log-save>下載檔案</button>
        ${FEEDBACK_URL?`<a class="ui-btn block" href="${esc(FEEDBACK_URL)}" target="_blank" rel="noopener">填寫回饋問卷</a>`:''}<button class="ui-btn sm block danger" data-log-clear>清除紀錄</button></section>${nav('settings')}`);
    const help=el.querySelector('.ui-modal:not(.cal)'),cal=el.querySelector('.cal'),scrim=el.querySelector('.ui-scrim');
    let open=null,run=null;const show=m=>{if(open)open.hidden=true;open=m;scrim.hidden=!m;if(m)m.hidden=false;if(!m)run=null;};
    el.querySelector('[data-help]').onclick=()=>show(help);el.querySelector('[data-cal]').onclick=()=>show(cal);
    scrim.onclick=()=>show(null);el.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>show(null));
    // Tap latency (audio.js calibrateLatency): taps are timed on pointerdown / Space, like the race pads.
    const tapBtn=cal.querySelector('.cal-tap'),out=cal.querySelector('.cal-out'),set=ms=>{saveLatency(ms);el.querySelector('#cal-value').textContent=latencyLabel();};
    const hit=stamp=>{if(!run?.tap)return;const n=run.tap(stamp);tapBtn.textContent=`點！ ${Math.min(n,run.total)} / ${run.total}`;};
    const press=async stamp=>{if(run){hit(stamp);return;}
      run={};tapBtn.textContent='聽…';out.textContent='';const r=await calibrateLatency(new RaceClock());if(!run)return;run=r;
      const ms=await r.done;if(!run)return;run=null;tapBtn.textContent='再測一次';
      if(ms===null){out.textContent='點得不夠穩（至少要 6 下對上拍子），請再試一次';return;}
      set(ms);out.textContent=`你的延遲 ${ms>0?'+':''}${ms} ms，已套用到比賽的踩拍判定`;};
    tapBtn.onpointerdown=e=>{e.preventDefault();press(e.timeStamp);};
    cal.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat){e.preventDefault();press(e.timeStamp);}});
    cal.querySelector('[data-cal-zero]').onclick=()=>{set(0);out.textContent='已歸零';};
    // Playtest log (playtest.js): summary, copy / download as JSON, clear.
    const plog=el.querySelector('.plog'),paintLog=()=>{const x=summary();plog.querySelector('.plog-sum').textContent=
      `正式比賽 ${x.races} 場（跑完 ${x.finished}、第 1 名 ${x.wins}${x.hitRate===null?'':`、平均命中 ${x.hitRate}%`}）· 練習 ${x.practice} 場 · 錯誤 ${x.errors} 筆`;
      el.querySelector('[data-log] small').textContent=`${x.races} 場`;};
    const logText=()=>JSON.stringify({app:'HOOFBEAT',build:MODEL_VERSION,exported:new Date().toISOString(),log:readLog()},null,1);
    el.querySelector('[data-log]').onclick=()=>{paintLog();show(plog);};
    if(!BALL_GAME)el.querySelector('[data-practice]').onclick=()=>{practiceNext=true;go('solo');};   // the practice teaches the rhythm game: not offered in the ball game
    plog.querySelector('[data-log-copy]').onclick=async e=>{try{await navigator.clipboard.writeText(logText());e.target.textContent='已複製';}catch{e.target.textContent='無法複製，請改用下載';}};
    plog.querySelector('[data-log-save]').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([logText()],{type:'application/json'}));
      a.download=`hoofbeat-playtest-${new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
    plog.querySelector('[data-log-clear]').onclick=()=>{if(confirm(translate('清除這支手機上的測試紀錄？'))){clearLog();paintLog();}};
    el.querySelector('#rider-name').onchange=e=>{profile.name=e.target.value.trim()||defaults.name;saveProfile();};
    el.querySelector('#sound').onchange=e=>store.set('hoofbeat.muted',String(!e.target.checked));
    el.querySelector('#lang').onchange=e=>setLang(e.target.checked?'en':'zh');
    el.querySelector('#hand').onchange=e=>store.set('hoofbeat.hand.v1',e.target.checked?'left':'right');
    el.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{store.set(ROLE,b.dataset.role);fixCity();saveProfile();go('settings');});
    el.querySelector('#reset').onclick=()=>{if(!confirm(translate('確定要重設所有進度（關卡、星星、解鎖的夥伴、金幣、照顧、外觀）？')))return;[WALLET,PROFILE,BEST,SOLO_BEST,RELAY_BEST,PROGRESS,OWNED_DECOR,TUTORIAL,'hoofbeat.care.v2','hoofbeat.items.v1','hoofbeat.gems.v1','hoofbeat.hand.v1','hoofbeat.jumps.v1'].forEach(store.del);
      try{Object.keys(localStorage).filter(k=>k.startsWith(GHOST)).forEach(store.del)}catch{}prog=fresh();
      profile={...defaults,gear:{}};care=readCare({getItem:store.get},ROSTER.map(h=>h.id));bag=readItems({getItem:store.get});applyLook();go('home');};
  },
};
PAGES.collection=PAGES.horses;   // old links

const latencyLabel=()=>{const ms=readLatency();return ms?`${ms>0?'+':''}${ms} ms`:'未校正';};

export function startHome(){
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./home.css?v=r460',import.meta.url);document.head.append(css);
  if(/[?&]fps\b/.test(location.search))import('./fps.js?v=r460');   // a frame counter in the corner (fps.js)
  applyLook();window.addEventListener('hashchange',render);
  // Esc = back on app pages (the race handles its own Esc = pause)
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!['#play','#solo'].includes(location.hash)&&!['','#home'].includes(location.hash))app().querySelector('[data-back]')?.click();});
  render();
}
