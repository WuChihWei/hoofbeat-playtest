// App shell: hash routes over one 9:16 frame. Look and components: ../ui/ui.css + ../ui/ui.js (docs/UI_FRAMEWORK.md).
//   #home ─ RACE → #race (course + horse; Relay | Solo) → #play (relay race) or #solo (solo run) → result → #home
//         ├ MISSIONS → #missions (coming soon)
//         ├ TRACKS → #tracks (the city courses) → #race
//         └ BUDDIES → #horses (a horse opens it in #stable)
//   bottom nav: #home · #ranch (the whole ranch, the buddies out on it; a tap on one → #stable: Feed · Brush · Buddies · Items; Gear and the relay on the horse card) · #shop (Feed · Care · Decor) · #settings
// Profile, wallet and care live in localStorage; the player's look feeds the race through PLAYER_LOOK.
import {startSlice} from './slice-app.js?v=r766';
import {COURSES,buildCourse,relayCourse,soloCourse} from '../course/courses.mjs?v=r766';
import {PLAYER_LOOK,GEAR,SHIRTS,PATTERNED,HAIR,COATS,MODEL_VERSION,preloadPresentation} from '../approved-assets.js?v=r766';
// In the background from the moment the game is open (2026-10-06, the user: the ranch took five seconds on a phone, and a
// race was seen being put together), in the order they are likely to be wanted: the ranch's models and its barn
// painting, the race's near models, the pictures of the chosen city's scene (warmCity), the rivals' light models.
const barn=new Image();   // kept: the ranch opens with its painting already there (it came two frames after the buddy)
// 2026-10-12 (the user: the order, and the cover as the loading page): what the next tap most likely needs comes first:
// the race's own models (the buddy on the pick page, the race itself) and the chosen city's pictures, and only then is
// the cover let go (zb-ready); behind the home page: the ranch's models, the stable's, the rivals' light ones. It was
// the ranch first. Every step is a checkpoint (zbMark; ?perf shows them).
// A 3D page while its models come in and its scene is built (2026-10-13, the user: a page must never stand blank): a card in
// the middle with what is happening and a bar that keeps moving. The page takes it away when its view is up.
const loadingCard=text=>`<div class="stage-loading" role="status"><span>${text}</span><i><b></b></i></div>`;
const step=(name,k)=>()=>{window.zbMark?.('loaded: '+name);dispatchEvent(new CustomEvent('zb-load',{detail:k}));};
setTimeout(()=>{window.zbMark?.('preload starts');dispatchEvent(new CustomEvent('zb-load',{detail:.15}));
  preloadPresentation(false).catch(()=>{}).then(step('race models',.7)).then(()=>{warmCity(profile.city);step('city pictures',1)();dispatchEvent(new Event('zb-ready'));barn.src='assets/stable/barn-plate.webp';
    return preloadRanch(owned().slice(0,14).map(h=>h.coat),owned().slice(0,14).map(lvOf));}).catch(()=>{}).then(step('ranch models',1)).then(()=>preloadStable()).catch(()=>{}).then(step('stable models',1)).then(()=>preloadPresentation()).catch(()=>{}).then(step('rivals\' light models',1));},50);
import {lang,setLang,translate} from '../i18n.js?v=r766';
import {ITEMS,itemEffect,likes,sellAll,readCare,readItems,saveCare,careAction,level,LV_TOP,LV_SPEED,lvLeft,lvPart,soloForm as careForm,fitNotes,fitness,feedAll,FULL,afterRace,afterSolo} from '../stable-care.js?v=r766';
import {SLICE_CONFIG,SOLO,MAX_LEVEL,STAT_FULL,buddyStats,racing,MVP,BUDDY_PERK,SLICE_RIVALS} from './slice-config.mjs?v=r766';
import {mountStableView,preloadStable} from './stable-view.js?v=r766';
import {mountRiderView} from './rider-view.js?v=r766';
import {mountRanchView,preloadRanch,RANCH,autoHuts,hutOffers} from './ranch-view.js?v=r766';
import {FARM,readFarm,saveFarm,stage,growth,tend,bedsFor,stallsFor,pensFor,cast,rush,tendAll,castAll,reapAll,sowAll} from '../farm.mjs?v=r766';
import {cityPictures} from '../approved-environment.js?v=r766';
import {readLog,clearLog,summary,FEEDBACK_URL,addLog,dayNumber} from '../playtest.js?v=r766';
import {esc,icon,brand,coin,wallet,header,nav,bar,toaster,chest} from '../ui/ui.js?v=r766';
import {STAR_MAX,LEVELS,SHOWN,STAGES,TIERS,TIER_AT,tierOf,PERKS,PERK_COINS,STAGE_GIFT,TROPHY_STAGE,trophy,HORSE_PRICE,STARTERS,whoIsOut,cleared,maneOpen,riderColors,fresh,restore,totalStars,levelOf,unlocked,relayOpen,owns,nextStarTime,currentLevel,missionsFor,finish,buy,nextGoal,eased,entryFee,PURSE,purseWon,BETS,BET_NAME,forecast,rivalAge,rivalPace} from './progress.mjs?v=r766';

const GHOST='hoofbeat.ghost.v4.',HOT='hoofbeat.hot.v1',SOLO_BEST='hoofbeat.solo.v4',RELAY_BEST='hoofbeat.relay.v3',WALLET='hoofbeat.wallet.v1',PROFILE='hoofbeat.profile.v1',BEST='hoofbeat.bestcombo.v1',OWNED_DECOR='hoofbeat.decor.v1',PROGRESS='hoofbeat.progress.v1';
const store={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}},del:k=>{try{localStorage.removeItem(k)}catch{}}};
// v2 (2026-10-05): a solo run became one lap, so the best times and traces of the two-lap runs (v1) say nothing now: dropped.
try{Object.keys(localStorage).filter(k=>/^hoofbeat\.(solo\.v[123]$|ghost\.v[123]\.|relay\.v[12]$)/.test(k)).forEach(store.del)}catch{}
// The role (Settings; 2026-10-05, the user, to test the playtest build): 最高管理者 has coins and diamonds that never run
// out and every stage open. The wallets read as ∞ and are left alone (nothing is paid in or out), so going back to
// 一般使用者 finds them as they were; what was bought or won meanwhile stays.
const ROLE='hoofbeat.role.v1',admin=()=>store.get(ROLE)==='admin';
// A new player's wallet starts with START_COINS (2026-10-14: with a star at 10 coins, one lost race on stage 2 left 53, under stage 3's fee of 60: no stake to play for; 100 for an hour, then 200, the user: enough to raise on the first two stakes, not on a third after two losses).
export const START_COINS=200,readCoins=()=>admin()?Infinity:store.get(WALLET)==null?START_COINS:+store.get(WALLET)||0;
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
// A colour that is no longer sold (2026-10-13: the tack went to four colours, the clothes to the interface's five) comes off, and one
// that was bought is paid back (COLOR_PRICE: 150 each, the only price a colour has had).
{const sold=(m,v)=>v[0]!=='#'||GEAR.find(g=>g.mat===m)?.colors.includes(v);for(const m of Object.keys(profile.gear||{}))if(!sold(m,profile.gear[m]))delete profile.gear[m];
  const gone=(profile.wardrobe||[]).filter(k=>{const i=k.indexOf(':');return !sold(k.slice(0,i),k.slice(i+1));});if(gone.length){profile.wardrobe=profile.wardrobe.filter(k=>!gone.includes(k));addCoins(150*gone.length);store.set(PROFILE,JSON.stringify(profile));}}
{const w=new Set(profile.wardrobe||[]);for(const src of [profile.gear,profile.patterns])for(const [m,v] of Object.entries(src||{}))if(v)w.add(`${m}:${v}`);profile.wardrobe=[...w];}   // what a save already wears is its own (the wardrobe, 2026-10-13)
if(profile.shirt||profile.saddle){profile.gear={Rider_Shirt:profile.shirt||undefined,Tack_Saddle:profile.saddle||undefined,...profile.gear};delete profile.shirt;delete profile.saddle;}
profile.gear=Object.fromEntries(Object.entries(profile.gear||{}).filter(([m,c])=>GEAR.some(g=>g.mat===m&&g.colors.includes(c))));
{const ids=ROSTER.map(h=>h.id),o=profile.order;   // three different horses the player still has
  if(!(Array.isArray(o)&&o.length===3&&new Set(o).size===3&&o.every(id=>ids.includes(id))))profile.order=ROSTER.slice(0,3).map(h=>h.id);}
const horseById=id=>ROSTER.find(h=>h.id===id)||ROSTER[0];
// A buddy's own name (profile.names {id: name}), asked once as it arrives (PAGES.stable: newBuddy).
const cleanName=n=>String(n??'').replace(/[<>&"'`]/g,'').trim().slice(0,12);   // names go into the pages' markup as they are
for(const h of ROSTER){const n=cleanName(profile.names?.[h.id]);if(n)h.name=n;}
// The sky of a stage's next run (2026-10-14, after three first-look reviews: the weather was told on the ticket, after the buddy was picked):
// drawn when the picker opens, kept until that run is finished, handed to the race (startSlice sky).
const wx=k=>`<img class="wx" src="assets/ui/weather/${k}.webp" alt="">`;   // the user's weather icons (references/weather/sheet-weather.png, 2026-10-14)
const skyFor={},skyOf=city=>skyFor[city]??=(w=>w[Math.floor(Math.random()*w.length)])(LEVELS[levelOf(city)]?.weather||['sun']),SKY_NEED={rain:'water',snow:'snow'},SKY_TEXT={rain:'今天下雨，路上水窪多',snow:'今天下雪，路上有雪堆'};
let newBuddy=null;   // a buddy just given or bought, this session: the next page is the dorm, where it walks in and is named
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
function applyLook(h=horseById(profile.horse),stage=lvOf(h)){Object.assign(PLAYER_LOOK,{stage,coat:h.coat,gear:{...profile.gear},hair:maneOf(h.id),patterns:{...profile.patterns}});}   // the rider's clothes keep their first colour (and no pattern) until stage 4 is cleared
// Mane and tail styles (approved-assets HAIR): every buddy wears its own, set on its card in the stable (2026-10-04, the
// user: not sold in the shop, a setting of the animal). profile.manes = {buddy id: style id}; none: the classic one.
const maneOf=id=>HAIR.some(x=>x.id===profile.manes?.[id])&&maneOpen(prog,profile.manes[id])?profile.manes[id]:'classic';
// What clearing a stage gives (progress.mjs: a buddy by its price's `stage`, or a PERK), as words; '' when nothing.
const stageGift=n=>{const b=Object.entries(HORSE_PRICE).find(([,c])=>c.stage===n);const g=STAGE_GIFT[n];if(g)return g.items?'種子和魚':`${g.coins} 金幣`;if(n===TROPHY_STAGE)return '冠軍獎盃';if(n===PERKS.rider.stage)return '騎士服裝顏色';return b?horseById(+b[0]).name:!Object.values(PERKS).some(x=>x.stage===n)?'':MVP.perks?(PERKS.mane.stage===n?HAIR.find(x=>x.id===PERKS.mane.id).name:'騎士服裝顏色'):`${PERK_COINS} 金幣`;};
let care=readCare({getItem:store.get},ROSTER.map(h=>h.id)),bag=readItems({getItem:store.get});
// Fishing is put away (2026-10-14): bait already in the bag becomes the fish it would have caught.
if(bag.bait>0){bag={...bag,fish:(bag.fish||0)+bag.bait*FARM.yield,bait:0};saveCare({setItem:store.set},care,bag);}
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
const starRow=n=>`<i class="stars" role="img" aria-label="${n} 顆星">${[0,1,2].slice(0,STAR_MAX).map(k=>`<i class="${k<n?'on':''}">★</i>`).join('')}</i>`;
const bestOn=city=>{const v=Object.entries(readSolo()).filter(([k])=>k.startsWith(city+':')).map(([,x])=>x);return v.length?Math.min(...v):0;};   // best solo time on a track, any horse (0: none; Infinity → 0 below)
// A buddy's level (stable-care LV_XP: three, its three ages) and its three numbers, written now / full (2026-10-04, the
// user: 20/120, never ×1.2: full is the buddy's own, its level sets how much of it is in use). The bar is on one scale
// for every buddy (STAT_FULL): bright to what it uses now, dim to its own top.
const lvOf=h=>level(care[h.id]??{xp:0}),lv=h=>MVP.levels?`LV ${lvOf(h)}`:'',sub=h=>[MVP.types?TYPE_NAME[h.type]:'',lv(h)].filter(Boolean).join(' · ');   // MVP: no level, no type label
const STAT_NAME={Speed:'速度',Accel:'加速',Stamina:'體力'};
const PERK_TEXT={water:'不怕水窪：踩到水不會變慢',tough:'皮粗肉厚：被撞恢復快一倍',quick:'出手快：撞人更快打到',snow:'不怕雪：踩到雪不會變慢',charge:'集氣快：能量球漲得更快',clean:'腳步穩：踩到便便不會滑'},perksOf=h=>BUDDY_PERK[COATS[h.coat]?.species||'horse']||[],perkOf=h=>perksOf(h).slice(0,lvOf(h));   // the first is there from LV 1 (2026-10-14: a buddy given for the rain has to be good in the rain the day it comes), the second from LV 2 (they were LV 2 and LV 3)
// The three ages (approved-assets GROW) and what the next one brings, for the buddy's cards and the level-up.
const AGE=['LV 1','LV 2','LV 3'],   /* 2026-10-14 (a reviewer: 幼年 LV 1 after three runs, two ways of growing): the level is said, the age words are gone */
  perkName=p=>PERK_TEXT[p].split('：')[0],pips=l=>`<i class="lv-pips" role="img" aria-label="第 ${l} 級，共 ${LV_TOP} 級">${AGE.map((_,k)=>`<i class="${k<l?'on':''}"></i>`).join('')}</i>`,RUN_XP=12;   // RUN_XP: what a run gives, about (stable-care SOLO_XP and the perfect hits)
const nextUp=h=>{const cr=care[h.id]??{xp:0},l=level(cr),p=perksOf(h)[l];return l>=LV_TOP?'已經長到最大了':`再 ${Math.ceil(lvLeft(cr)/RUN_XP)} 場升 ${AGE[l]}${p?`，解鎖「${perkName(p)}」`:''}`;};
const grewCard=h=>{const l=lvOf(h),p=perksOf(h)[l-1];return {img:buddyImg(h),text:`${h.name} 升上 ${AGE[l-1]} 了！`,name:h.name,tag:'長大了',sub:[`速度 +${Math.round((l-1)*LV_SPEED*100)}%`,p&&perkName(p)].filter(Boolean).join(' · '),what:`${p?`新特長　${PERK_TEXT[p]}。`:''}到宿舍看牠的新樣子。`};};
// What seeds and bait are for, said wherever they are given (a stage, the day's gift).
const WHAT_SEEDS='種子種在麥田，長成小麥。小麥和魚用來餵夥伴，餵了會成長。魚在商店買。';
// A buddy whole, at a stage (tools/grow-photos.sh), and its growth card: the three ages side by side, each with what it has.
const growImg=(h,l)=>`assets/ui/grow/${h.coat}_${l}.webp?v=1`;
const growCard=h=>`<div class="grow-ages">${AGE.map((a,k)=>{const l=k+1,p=perksOf(h)[k],now=lvOf(h)===l;return `<div class="${now?'now':lvOf(h)>l?'done':'later'}"><img src="${growImg(h,l)}" alt=""><b>${a}</b><small>LV ${l}${now?' · 現在':''}</small><span>${l>1?`速度 +${Math.round(k*LV_SPEED*100)}%`:'基本速度'}</span><span>${p?PERK_TEXT[p]:''}</span></div>`;}).join('')}</div>`;
// The wardrobe (2026-10-13, the user: 建立花錢的地方): a colour or a pattern of a part is bought once in the shop (PAGES.looks)
// and then owned (profile.wardrobe ['<material>:<colour or pattern id>']); a part's first colour and no pattern are everyone's.
// The dorm and the house only list what is owned; wearing it costs nothing. Colours and patterns are bought apart and worn
// together (blue and stars: a blue pad with stars). For an afternoon each change cost 10 coins instead.
const COLOR_PRICE=150,PATTERN_PRICE=400,lookKey=(mat,v)=>`${mat}:${v}`,lookPrice=v=>v[0]==='#'?COLOR_PRICE:PATTERN_PRICE;
const hasLook=(mat,v)=>!v||v===GEAR.find(g=>g.mat===mat)?.colors[0]||(profile.wardrobe||[]).includes(lookKey(mat,v));
const patternRow=(part,all=false)=>PATTERNED.includes(part)?`<div class="shirts" role="radiogroup" aria-label="花紋">${[{id:'',name:'素色'},...SHIRTS].filter(x=>all||hasLook(part,x.id)).map(x=>`<button role="radio" aria-checked="${(profile.patterns?.[part]||'')===x.id}" data-shirt="${x.id}">${x.name}</button>`).join('')}</div>`:'';
const wearPattern=(part,id)=>{profile.patterns={...profile.patterns};if(id)profile.patterns[part]=id;else delete profile.patterns[part];saveProfile();};
const grew=new Map();   // buddy id → the level it was at before it grew: the dorm shows the change once (PAGES.stable grow)
const statRows=h=>{const st=buddyStats(h.stats,MAX_LEVEL);return `<div class="buddy-stats">${Object.entries(STAT_NAME).map(([k,name])=>`<div><span>${name}</span><i style="--now:${st[k].now/STAT_FULL*100}%;--full:${st[k].full/STAT_FULL*100}%"></i><b>${st[k].now}<small>/${st[k].full}</small></b></div>`).join('')}</div>`;};
// A runner of the player's for the race: its look and its numbers (slice-game: stats and level; race-scene: coat and mane).
const racer=h=>({id:h.id,name:h.name,coat:h.coat,type:h.type,stats:h.stats,level:MAX_LEVEL,hair:maneOf(h.id),stage:lvOf(h)});
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
    if(k==='gems')addGems(-r.cost);else addCoins(-r.cost);prog=r.p;saveProg();close();newBuddy=stableFocus=h.id;go('stable');});   // straight to the dorm: it walks in (done() used to repaint the page it was bought on)
}
// What a finished run earned beyond its coins, for the results screen (slice-app showResults): stars, missions, the
// day's bonus, what opened, and the next thing to look forward to. seconds: the solo time (wall clock), else null.
// One thing to try next run, from what this one lacked (2026-10-10, the hooks: the results always say what to do next).
// Who has how much (2026-10-13, the user: 一起比賽的人，誰有多少錢、你排第幾): the riders the player races against (slice-config
// SLICE_RIVALS) have purses of their own, kept in this browser. In a race with a stake each of them pays the fee the player pays
// and is paid by its place, by the same rule (progress.mjs purseWon); so the list is the same five people every time, and it moves
// by what happened on the track. Made-up riders: nothing is sent anywhere.
const PURSES='hoofbeat.rivals.v1',PURSE_START={pacer:2400,chaser:1800,hazel:1300,rio:900,sage:600,poppy:700};
const readPurses=()=>({...PURSE_START,...readJson(PURSES)}),rivalOf=id=>SLICE_RIVALS.find(r=>r.id===id);
// field: [{id, rank}] of the rivals that ran, fee and pot of that race → what each of them made (and the purses are saved).
function payRivals(field,fee,pot){const p=readPurses(),of=field.length+1,made={};for(const f of field){made[f.id]=purseWon(pot,f.rank,of)-fee;p[f.id]=Math.max(0,(p[f.id]??0)+made[f.id]);}store.set(PURSES,JSON.stringify(p));return made;}
// only: the ids to list (a race's field), else everyone. made: {id: coins made just now}, mine: what the player made.
function richList(only=null,made=null,mine=null){const p=readPurses(),me={name:profile.name||'你',coins:admin()?0:readCoins(),you:true,coat:horseById(profile.solo??profile.horse).coat,made:mine};
  const all=[...SLICE_RIVALS.filter(r=>!only||only.includes(r.id)).map(r=>({id:r.id,name:r.name,coins:p[r.id]??0,coat:r.coats[0],made:made?.[r.id]??null})),me].sort((a,b)=>b.coins-a.coins);return {all,rank:all.indexOf(me)+1,next:all[all.indexOf(me)-1]||null};}
function richSheet(el){const {all,rank,next}=richList(),n=v=>v.toLocaleString('en-US');
  el.insertAdjacentHTML('beforeend',`<div class="ui-scrim"></div><section class="ui-modal ui-panel deep rich" role="dialog" aria-modal="true" aria-label="誰有多少錢"><header><h2>誰有多少錢</h2><button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header>
    <p class="rich-next">${next?`<span>你第 ${rank} 名，再</span><b>${n(next.coins-readCoins()+1)}</b>${coin}<span>超過 ${esc(next.name)}</span>`:'你是第 1 名！'}</p>
    <ol>${all.map((r,i)=>`<li class="${r.you?'you':''}"><b class="rk">${i+1}</b><img src="assets/stable/buddy_${r.coat}.webp?v=coats-4" alt=""><span>${esc(r.name)}</span><b class="amt">${n(r.coins)}${coin}</b></li>`).join('')}</ol></section>`);
  const sheet=el.lastElementChild,scrim=sheet.previousElementSibling,close=()=>{sheet.remove();scrim.remove();};scrim.onclick=close;sheet.querySelector('[data-close]').onclick=close;}
const LAST_RANK='hoofbeat.lastrank.v1';   // {city: the place of the last solo run there}: a reason to double (slice-app stake)
const tipFor=(r,f)=>r.pops>1?'別壓過頭：爆掉會絆一下':r.perfect<3?'快到頂再放手：極限衝得更久':r.coins<4?'路上的金幣多吃一點':f.runStars<3?'蓄滿就衝刺，直線最划算':'已經很強了：換一關試試';
function rewards(f,city,seconds){if(f.gifts.length)newBuddy=f.gifts.at(-1);const out=rewards0(f,city,seconds);if(f.gifts.length&&out.next)out.next={...out.next,label:`看新夥伴 ${horseById(newBuddy).name}`};return out;}   // the next page is the dormitory, where it walks in: the button said 下一關 and went there (2026-10-14, the first-look reviews)
function rewards0(f,city,seconds){
  const t=seconds!=null&&nextStarTime(city,f.stars);
  const pts=f.p?.points??0,tk=tierOf(pts),tierLine=f.points?(f.tierUp!=null?{img:TIERS[f.tierUp].img,text:`升上${TIERS[f.tierUp].name}！`}:{img:TIERS[tk].img,text:tk<TIERS.length-1?`牌位積分 +${f.points}，再 ${TIER_AT[tk+1]-pts} 分升${TIERS[tk+1].name}`:`牌位積分 +${f.points}`}):null;   // the tier: what this run added, how far the next one is (2026-10-14)
  return {tierLine,extra:f.coins,stars:f.stars,runStars:f.runStars??null,newStars:f.newStars,starHint:t?`再快 ${(seconds-t).toFixed(1)} 秒拿第 ${f.stars+1} 顆星`:'',starGap:t?Math.min(1,t/seconds):null,   // how close the run came to the next star, 0–1 (the bar)
    missions:f.missions,missionCoins:f.missionCoins,daily:f.daily,next:f.opened[0]?{city:f.opened[0],label:`下一關：${cityName(f.opened[0])}`}:null,goal:goalLine(),
    // lines for what has no card of its own (a card says the rest: the chest, slice-app openChest)
    news:[...f.opened.map(id=>`第 ${levelOf(id)+1} 關 ${cityName(id)} 開放了！`),...(f.relayOpened?['三棒接力開放了！']:[])],
    // What was given (a buddy, a mane style, the rider's colours): each comes out of the prize chest first (slice-app openChest).
    // img, name, tag, sub: its card (ui chest()); text: the line under the chest.
    prizes:[...(f.trophy?[{img:'assets/ui/award_trophy.webp?v=5',text:'冠軍獎盃放進騎士的家了！',name:'冠軍獎盃',tag:'全破',what:'十關全部破完的紀念。到牧場的「我家」，架子上看得到。'}]:[]),...(f.items?[{img:'assets/stable/item_seed.webp',text:'種子 +5，魚 +15',name:'種子和魚',tag:'過關獎勵',what:WHAT_SEEDS}]:[]),...f.gifts.map(id=>{const h=horseById(id);return {img:buddyImg(h),text:`新夥伴 ${h.name} 加入牧場！`,name:h.name,tag:'新夥伴',sub:MVP.types?TYPE_NAME[h.type]:'',what:`選夥伴時可以騎牠出賽。${perksOf(h).map((p,k)=>k?`升上 ${AGE[k]} 學會「${perkName(p)}」`:`牠一開始就會「${perkName(p)}」`).join('，')}。`};}),
      ...(f.perks||[]).map(k=>{const mane=HAIR.find(x=>x.id===PERKS.mane.id).name;return k==='mane'?{img:`assets/ui/hair_${PERKS.mane.id}.webp?v=1`,text:`新造型：${mane}`,name:mane,tag:'新造型',sub:'鬃毛造型',what:'在宿舍的「造型」裡換上。'}
        :{img:'assets/ui/rider_0.webp?v=2',text:'騎士服裝的顏色開放了！',name:'騎士服裝顏色',tag:'新開放',what:'到牧場的「我家」，幫騎士換帽子、上衣、褲子的顏色。'};})]};
}
// Before a race (slice-app's start card): the level, the goal of this run and its three missions.
function brief(c,solo){
  const st=prog.stars[c.id]||0,t=nextStarTime(c.id,st),best=bestOn(c.id),clock=x=>`${Math.floor(x/60)}:${(x%60).toFixed(1).padStart(4,'0')}`;
  return {title:`第 ${levelOf(c.id)+1} 關 · ${c.city}`,stars:st,missions:MVP.missions?missionsFor(prog.runs,solo,solo?LEVELS[levelOf(c.id)]?.locks:{}).map(m=>m.text):null,
    goal:!solo?'目標：跑進前 3 名':!st?'先跑完一趟，拿第 1 顆星':t?`目標 ${clock(t)} · 拿第 ${st+1} 顆星`:`${STAR_MAX<3?'過關了':'三星了'} · 破自己的 ${wallTime(best,c.id)}`,
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
let leave=null,stableFocus=null,playFromSetup=false;   // stableFocus: horse id Collection asked the Stable to open on
// replace: swap the current history entry (leaving a race must not leave #play behind for the back button)
const go=(r,{replace=false}={})=>{if(r==='play'||r==='solo')playFromSetup=location.hash==='#race';
  if(location.hash==='#'+r)render();else if(replace)location.replace('#'+r);else location.hash=r;};
// Back goes to the page's parent (course → tracks, everything else → home). It steps back through history only when
// the page before was that parent; otherwise (reload, opened directly, came from outside) it swaps to the parent, so
// back never leaves the app or lands on an unrelated page.
const PARENT={course:'tracks',stable:'ranch',house:'ranch',looks:'shop'};
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
const readRanch=()=>{let r={};try{r=JSON.parse(store.get(RANCH_KEY)||'{}')}catch{}return {place:{...r.place},doors:{...r.doors},huts:Array.isArray(r.huts)?r.huts:null};},saveRanch=r=>store.set(RANCH_KEY,JSON.stringify(r));
function placed(R,stalls=1){const all=owned().slice(0,RANCH_DRAWN),outs=new Set(whoIsOut(all).map(h=>h.id)),taken=new Set(),list=[];
  for(const h of all){const w=R.place[h.id];if(w?.stall!=null&&w.stall<stalls&&!taken.has(w.stall)){taken.add(w.stall);list.push([h,{stall:w.stall}]);}else list.push([h,Array.isArray(w?.at)?{at:w.at}:null]);}
  return list.map(([h,w])=>{if(w)return [h,w];if(outs.has(h.id))return [h,{}];let k=0;while(taken.has(k))k++;if(k>=stalls)return [h,{}];taken.add(k);return [h,{stall:k}];});}
const RANCH_TABS=[{shot:'all',name:'全景'},{dorm:true,name:'宿舍'},{shot:'field',name:'麥田'},{house:true,name:'我家'}];   // 我家: the rider's house (2026-10-12, the user: the house on the ranch was hard to find)
// Seeds and wheat counted like the coins (the user: 「種子和收成要有數值和對應的icon像錢幣一樣」), in a row of their own
// under the tabs, on the field's shot only (「不應該跟金幣在同一行？他只出現在農場的時候？」).
// The ranch's tools (2026-10-14, the user: 這一層 UI 複雜有問題；數字超過一百怎麼辦): two columns at the bottom, each a button with what it
// uses over it: 全部餵飽 under the food (wheat, fish), 全部收成 under what it sows with (seed, bait). The second is a button to the shop;
// a count of 0 there is a ＋.
const ranchTools=bag=>{const n=(k,img)=>`<img src="assets/stable/item_${img}.webp" alt=""><b data-${k}>${bag[k]||0}</b>`;
  return `<div class="ranch-tools top"><p class="stock" aria-label="小麥和魚">${n('wheat','wheat')}${n('fish','fish')}</p></div><div class="ranch-tools three"><button class="ui-btn" data-do="feed">全部餵飽</button><button class="ui-btn" data-do="reap">全部收成</button><button class="ui-btn" data-do="sow">播種<small data-seed>×${bag.seed||0}</small></button></div>`;};   /* 2026-10-14: the seed is the 播種 button with how many are left (the seed picture read as nothing) */   /* the counts are a row under the tabs (later the same day, the user's sketch), each over its button's side */
const ranchTabs=on=>`<div class="ui-tabs ui-panel deep ranch-shots" role="tablist" aria-label="畫面" style="--n:${RANCH_TABS.length}">${RANCH_TABS.map((t,i)=>`<button role="tab" data-rtab="${i}" aria-selected="${i===on}">${t.name}</button>`).join('')}</div>`;
// The first opening (2026-10-12, the user): the player names the rider (「他就是那個騎士」), then five pages to swipe or skip:
// three of the race, with the introduction page's clips (dist/intro), and two of the ranch. Once per browser (WELCOME).
// 2026-10-13 (the user: 教學應該是使用者三十秒就可以抓到重點，然後進行第一關): one page, the one thing the first stage asks
// (hold, let go in the white ring), and its button starts stage 1. Lanes, jumps, sprints and bumps are shown on the stage
// that opens each (slice-app's hints); the ranch explains itself when it is opened. It was five pages.
const WELCOME='hoofbeat.welcome.v1',TOUR=[
  {clip:'clip-hold',title:'按住，長到黃圈就放手',text:'按住畫面，黃球會變大。長到黃圈再放開，夥伴衝得最快。早一點放也可以，碰到紅圈就爆掉。'}];
function welcome(host){
  host.insertAdjacentHTML('beforeend',`<section class="welcome" role="dialog" aria-modal="true" aria-label="歡迎">
    <form class="wl-name"><img src="assets/ui/rider_0.webp?v=2" alt=""><h2>你就是這位騎士</h2><p>幫自己取個名字</p>
      <input id="wl-name" maxlength="16" autocomplete="off" enterkeyhint="done" placeholder="騎士名字" value="${esc(profile.name===defaults.name?'':profile.name)}" aria-label="騎士名字"><button class="ui-btn primary block">開始</button></form>
    <div class="wl-tour" hidden>
      <div class="wl-slides">${TOUR.map(s=>`<article><div class="wl-shot">${s.clip?`<video src="intro/${s.clip}.mp4?7" poster="intro/${s.clip}.jpg?6" muted loop playsinline preload="none"></video>`:`<img src="intro/${s.still}.webp" alt="">`}</div><h2>${s.title}</h2><p>${s.text}</p></article>`).join('')}</div>
      <div class="wl-dots" aria-hidden="true">${TOUR.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('')}</div><button class="ui-btn primary block wl-next" type="button">下一頁</button></div></section>`);
  const el=host.querySelector('.welcome'),form=el.querySelector('.wl-name'),tour=el.querySelector('.wl-tour'),row=el.querySelector('.wl-slides'),dots=[...el.querySelectorAll('.wl-dots i')],next=el.querySelector('.wl-next');
  const done=()=>{store.set(WELCOME,'1');el.remove();profile.city=LEVELS[0].city;profile.mode='solo';saveProfile();go('solo');},at=()=>Math.round(row.scrollLeft/Math.max(1,row.clientWidth));
  const show=()=>{const k=at();dots.forEach((d,i)=>d.classList.toggle('on',i===k));next.textContent=translate(k===TOUR.length-1?'開始第一關':'下一頁');
    [...row.children].forEach((a,i)=>{const v=a.querySelector('video');if(v)i===k?v.play().catch(()=>{}):v.pause();});};
  form.onsubmit=e=>{e.preventDefault();profile.name=form.querySelector('input').value.trim()||defaults.name;saveProfile();form.hidden=true;tour.hidden=false;show();};
  row.addEventListener('scroll',show,{passive:true});el.querySelector('.wl-dots').hidden=TOUR.length<2;
  next.onclick=()=>at()>=TOUR.length-1?done():row.scrollTo({left:(at()+1)*row.clientWidth,behavior:'smooth'});
}
// A level gained, said where it happens: the results of a run and the dorm's toast after a feed.
const levelNews=(h,cr)=>`${h.name} 升上 ${AGE[level(cr)-1]} 了！速度 +${Math.round((level(cr)-1)*LV_SPEED*100)}%`;
const PAGES={
  ranch(){
    // The 3D ranch: the view up the strip (a drag slides it along) and the field's shot, by the tabs under the header
    // or a sideways swipe. A tap on a buddy opens the dormitory on it. One dormitory, however many buddies are owned
    // (2026-10-09, the user: 「先只要一個馬殿就好」; the layout can stand more behind it, one every 15 m). ?pens=2x2,2x1,2x2
    // and ?dorms= (dev) show a longer strip: the beds beyond the field's six are drawn shut.
    const all=mine(),tabOf=shot=>RANCH_TABS.findIndex(t=>t.shot===shot),dev=new URLSearchParams(location.search);
    const lv=ranchLevel(),beds=bedsFor(lv),pens=dev.get('pens')?.split(',').map(p=>p.split('x').map(Number))??pensFor(beds);PAGES.ranch.shot||='all';   // pens: ranch-view layout's own (a pen of four beds and a pen of two: farm.mjs's six)
    bag=readItems({getItem:store.get});let farm=readFarm({getItem:store.get});
    const el=frame('page-ranch ui-live',`<div class="view"></div>${loadingCard('夥伴們正在集合…')}
      <header class="ui-header st-top"><button class="ui-icon-btn" data-back aria-label="返回">${icon('back','')}</button><h1>牧場</h1>${wallet(readCoins(),{gems:gemsShown()})}</header>
      ${ranchTabs(tabOf(PAGES.ranch.shot))}${ranchTools(bag)}<p class="ranch-hint ui-panel deep"></p>${nav('ranch')}`),toast=toaster(el);
    let view=null,alive=true;const grow=setInterval(()=>show(),1000);leave=()=>{alive=false;clearInterval(grow);view?.dispose();};
    const tabs=[...el.querySelectorAll('[data-rtab]')],hint=el.querySelector('.ranch-hint');let news;
    // The wheat field (farm.mjs): a tap on an empty bed sows a seed, on a ripe one reaps it; the line over the nav says
    // what can be done (on the field's shot), the crops are redrawn every few seconds as they grow.
    const show=()=>{view?.field(farm.beds.slice(0,beds).map(b=>b?growth(b):null));view?.pond(null);for(const k of ['seed','wheat','bait','fish']){const b=el.querySelector(`[data-${k}]`);if(b)b.textContent=(k==='seed'?'×':'')+(bag[k]||0);}for(const k of ['seed'])el.querySelector(`[data-${k}]`)?.classList.toggle('none',!(bag[k]>0));say();};
    const say=()=>{const id=PAGES.ranch.shot,st=farm.beds.slice(0,beds).map(b=>stage(b)),ripe=st.filter(s=>s===3).length;
      tabs[tabOf('field')]?.classList.toggle('has-dot',ripe>0);const ps=farm.pond.map(b=>stage(b)),on=ps.filter(s=>s===3).length;tabs[tabOf('pond')]?.classList.toggle('has-dot',on>0);
      if(!news&&id==='pond'){hint.textContent=on?`${on} 條魚上鉤了 · 點浮標收魚`:ps.includes(0)?(bag.bait>0?`魚餌 ×${bag.bait} · 點白圈下餌`:'沒有魚餌 · 去商店買'):'魚還沒上鉤 · 晚點再來';return;}
      if(news===undefined){news=awayNews(ripe);if(news)setTimeout(()=>{news=null;if(alive)say();},AWAY_SAY);}
      hint.textContent=news?news:id!=='field'?nextBuddy():ripe?`${ripe} 格熟了 · 點一下收成`:st.includes(0)?(bag.seed>0?`種子 ×${bag.seed} · 點空的田種下`:'沒有種子 · 商店買或比賽拿'):'麥子在長 · 晚點再來';};
    const mark=shot=>{PAGES.ranch.shot=shot;tabs.forEach((b,k)=>b.setAttribute('aria-selected',k===tabOf(shot)));say();};
    // What a tap on a bed did, shown where the finger was: the wheat reaped rises and fades, a seed drops in.
    const pop=(x,y,html)=>{const box=el.getBoundingClientRect(),p=document.createElement('i');p.className='ranch-pop';p.innerHTML=html;p.style.left=`${x-box.left}px`;p.style.top=`${y-box.top}px`;el.append(p);p.onanimationend=()=>p.remove();};
    // Still growing: the first tap says how long and what it costs to have it now, a second tap on the same one within RUSH_ASK ms pays (FARM.rush).
    const RUSH_ASK=4000;let asked=null;
    const wait=(key,i,secs,x,y,word)=>{const now=Date.now(),t=secs>=90?`${Math.ceil(secs/60)} 分鐘`:`${secs} 秒`;
      if(asked&&asked.key===key&&asked.i===i&&now-asked.at<RUSH_ASK){asked=null;if(readCoins()<FARM.rush){toast(`金幣不夠：馬上${word}要 ${FARM.rush}`);return;}
        const f=rush(farm,key,i);if(!f)return;farm=f;addCoins(-FARM.rush);saveFarm({setItem:store.set},farm);pop(x,y,`<b>−${FARM.rush}</b> 金幣`);el.querySelectorAll('[data-coins]').forEach(b=>b.textContent=readCoins().toLocaleString('en-US'));show();return;}
      asked={key,i,at:now};toast(`還要 ${t}才${word}。再點一次：付 ${FARM.rush} 金幣馬上${word}`);};
    const bed=(i,x,y)=>{if(i>=beds)return;const res=tend(farm,bag,i);if(res.fail){if(res.secs)wait('beds',i,res.secs,x,y,'熟');else toast(res.fail);return;}
      farm=res.farm;bag=res.items;saveFarm({setItem:store.set},farm);saveCare({setItem:store.set},care,bag);
      pop(x,y,res.did==='sow'?'<b>−1</b> 種子':`<img src="assets/stable/item_wheat.webp" alt=""><b>+${FARM.yield}</b>`);show();};
    const hook=(i,x,y)=>{const res=cast(farm,bag,i);if(res.fail){if(res.secs)wait('pond',i,res.secs,x,y,'上鉤');else toast(res.fail);return;}
      farm=res.farm;bag=res.items;saveFarm({setItem:store.set},farm);saveCare({setItem:store.set},care,bag);if(PAGES.ranch.shot!=='pond'){view?.shot('pond');mark('pond');}
      pop(x,y,res.did==='sow'?'<b>−1</b> 魚餌':`<img src="assets/stable/item_fish.webp" alt=""><b>+${FARM.yield}</b>`);show();};
    // 全部餵飽 (2026-10-13, the user): everyone out walks back to the dormitory (ranch-view home()), then one card says what
    // was eaten and who is still hungry (stable-care feedAll). Shown while someone has room for a meal.
    const feedBtn=el.querySelector('[data-do=feed]'),herdOf=()=>all.map(h=>({id:h.id,species:COATS[h.coat]?.species||'horse'})),roomy=()=>all.some(h=>care[h.id].hunger<=FULL);
    // always there (2026-10-13, the user did not find it: it was hidden while everyone was full)
    feedBtn.onclick=async()=>{if(!roomy()){toast('大家都吃飽了');return;}feedBtn.disabled=true;if(PAGES.ranch.shot!=='all'){view?.shot('all');mark('all');}
      const res=feedAll(care,bag,herdOf()),names=ids=>ids.map(id=>horseById(id).name).join('、');
      await view?.home();if(!alive)return;
      if(res.fed.length){care=res.care;bag=res.items;saveCare({setItem:store.set},care,bag);for(const id of res.grew)grew.set(id,lvOf(horseById(id))-1);show();}
      const rows=[res.used.wheat?`<li><img src="assets/stable/item_wheat.webp" alt=""><span>小麥</span><b>−${res.used.wheat}</b></li>`:'',res.used.fish?`<li><img src="assets/stable/item_fish.webp" alt=""><span>魚</span><b>−${res.used.fish}</b></li>`:''].join('');
      const short=res.short.length?`<p class="warn">${esc(names(res.short))} 還餓，食物不夠了</p>`:'';
      el.insertAdjacentHTML('beforeend',`<div class="ui-prize feed-all" role="dialog" aria-modal="true" aria-label="全部餵飽"><div class="ui-panel deep"><b>${res.fed.length?`餵了 ${res.fed.length} 隻`:'沒有食物可以餵'}</b>${rows?`<ul>${rows}</ul>`:''}${short}<button class="ui-btn primary">好</button></div></div>`);
      const card=el.lastElementChild;card.querySelector('button').onclick=()=>{card.remove();feedBtn.disabled=false;};card.querySelector('button').focus();};
    // 全部收成 (2026-10-14; it was two buttons, 播種 and 下餌, that nobody read as buttons): every ripe bed and float is taken, then
    // every empty one is set with what there is (farm.mjs tendAll, castAll). Tapping one bed or float still does that one.
    el.querySelector('[data-do=reap]').onclick=()=>{if(PAGES.ranch.shot!=='all'){view?.shot('all');mark('all');}
      const a=reapAll(farm,bag,beds),b={...a,reaped:0,sown:0};   /* the pond is put away (2026-10-14): the field only; sowing is its own button */
      if(!a.reaped){toast(farm.beds.slice(0,beds).some(x=>x)?'還沒熟，晚點再來':'田是空的：先播種');return;}
      farm=b.farm;bag=b.items;saveFarm({setItem:store.set},farm);saveCare({setItem:store.set},care,bag);show();
      toast([a.reaped?`小麥 +${a.reaped*FARM.yield}`:'',b.reaped?`魚 +${b.reaped*FARM.yield}`:'',a.sown?`種了 ${a.sown} 格`:'',b.sown?`下餌 ${b.sown} 格`:''].filter(Boolean).map(t=>translate(t)).join(' · '));};   /* each part put into the language by itself: the whole line matched no pattern */
    el.querySelector('[data-do=sow]').onclick=()=>{if(!(bag.seed>0)){toast('沒有種子：去商店買，或跑比賽拿');go('shop');return;}if(PAGES.ranch.shot!=='all'){view?.shot('all');mark('all');}
      const a=sowAll(farm,bag,beds);if(!a.sown){toast('田都種滿了');return;}farm=a.farm;bag=a.items;saveFarm({setItem:store.set},farm);saveCare({setItem:store.set},care,bag);show();toast(translate(`種了 ${a.sown} 格`));};
    const open=i=>{const t=RANCH_TABS[i];if(!t)return;if(t.house)return go('house');if(t.dorm)return go('stable');view?.shot(t.shot);mark(t.shot);};
    mark(PAGES.ranch.shot);tabs.forEach((b,i)=>b.onclick=()=>open(i));
    // The huts (ranch-view layout): a hut a buddy, each on its plot, for good. A save from before the huts has them where
    // nobody chose; a buddy that has none yet gets the one plot there is, or the player picks left or right (the
    // panel, or a tap on a pale slab), one buddy at a time. ?huts=9 (dev): that many, where nobody chose.
    const ranchT0=performance.now(),R=readRanch(),need=Math.min(stallsFor(lv),RANCH_DRAWN),devHuts=+dev.get('huts')||0;
    let huts=devHuts?autoHuts(devHuts):[...new Set((R.huts??autoHuts(need)).filter(p=>Number.isInteger(p)&&p>=0))].slice(0,need),offers=[];
    if(!devHuts){while(huts.length<need){offers=hutOffers(huts);if(offers.length!==1)break;huts.push(offers[0]);offers=[];}
      if(String(huts)!==String(R.huts)){R.huts=huts;saveRanch(R);}}
    let pick=null;const build=plot=>{if(!offers.includes(plot))return;R.huts=[...huts,plot];saveRanch(R);render();};
    if(offers.length===2){const who=owned()[huts.length],p=document.createElement('div');p.className='ranch-build ui-panel deep';
      p.innerHTML=`<p><b>${esc(who?.name||'新夥伴')} 的小屋蓋在哪裡？</b><small>蓋了就不能搬</small></p><div><button class="ui-btn" data-build="0">蓋在左邊</button><button class="ui-btn" data-build="1">蓋在右邊</button></div>`;
      el.append(p);hint.hidden=true;PAGES.ranch.shot='all';const first=p.innerHTML;
      const ask=()=>{p.innerHTML=first;p.querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>sure(+b.dataset.build));};
      const sure=k=>{p.innerHTML=`<p><b>確定蓋在${k?'右邊':'左邊'}嗎？</b><small>蓋了就不能搬</small></p><div><button class="ui-btn" data-no>再想想</button><button class="ui-btn primary" data-yes>確定</button></div>`;p.querySelector('[data-no]').onclick=ask;p.querySelector('[data-yes]').onclick=()=>build(offers[k]);};   // asked once more: it cannot be moved (2026-10-11)
      pick=plot=>sure(offers.indexOf(plot));ask();}
    mountRanchView(el.querySelector('.view'),{buddies:placed(R,huts.length).map(([h,where])=>({id:h.id,coat:h.coat,hair:maneOf(h.id),stage:lvOf(h),...where,ran:justRan?.id===h.id&&Date.now()-justRan.at<60e3?{left:60-(Date.now()-justRan.at)/1000,won:justRan.won}:null})),doors:R.doors,pens,huts,offers,open:beds,shot:PAGES.ranch.shot,
      onHouse:()=>go('house'),onStore:()=>go('shop'),onOffer:plot=>pick?.(plot),onBed:bed,onPond:()=>{},onMove:(id,where)=>{R.place[id]=where;for(const k in R.doors)delete R.doors[k];saveRanch(R);},onDoor:(k,on)=>{R.doors[k]=on;saveRanch(R);}})
      .then(v=>{window.zbMark?.(`ranch shown (+${Math.round(performance.now()-ranchT0)} ms)`);if(!alive){v.dispose();return;}view=v;el.querySelector('.stage-loading')?.remove();show();})
      .catch(e=>{console.error(e);const l=el.querySelector('.stage-loading');if(l)l.textContent='3D 無法載入';});
  },
  home(){
    if(!store.get(WELCOME))setTimeout(()=>shown==='home'&&!app().querySelector('.welcome')&&welcome(app().firstElementChild),0);   // after this page is in
    // The day's gift comes as cards out of the chest (2026-10-12, the user: 「每天開app就要先送幾張卡片」; it was a toast): after the
    // boot cover has gone, and after the first opening's pages if those are up.
    if(loginGift){loginGift=false;const cards=()=>{if(shown!=='home')return;const host=app().firstElementChild;if(host.querySelector('.welcome'))return setTimeout(cards,600);
        const prizes=[['seed','小麥種子'],['fish','魚']].map(([k,n])=>({img:`assets/stable/item_${k}.webp`,name:`${n} ×${LOGIN_GIFT[k]}`,tag:'每日登入'}));
        host.insertAdjacentHTML('beforeend',`<div class="ui-prize daily" role="dialog" aria-modal="true" aria-label="每日登入">${chest(prizes)}<p>今天的禮物：種子和魚<small>${WHAT_SEEDS}</small></p><button class="ui-btn primary">收下</button></div>`);
        const layer=host.lastElementChild;layer.querySelector('button').onclick=()=>layer.remove();};
      setTimeout(cards,2600);}   // ponytail: a fixed wait for the boot cover to go (index.html: 1.5 s and a fade); hook its end if the cover's time changes
    // Home (2026-10-04, the user's third sketch): the course card stays at the bottom, over the nav; above it the stages are wide cards
    // in a list, stage 1 first, scrolling beneath the card. Tapping one picks it: the scene and the card follow. The card says one thing (what to beat next) and has the one button → the buddy (#race).
    // 2026-10-05 (the user): every stage card says how hard it is (the course's difficulty: its word and one to three dots).
    const s=totalStars(prog);
    const el=frame('page-home',`<i class="home-scene" aria-hidden="true"></i><header class="ui-top">${brand()}<button class="rich-open" aria-label="富豪榜">${wallets()}</button></header>
      <main class="stage-row" aria-label="關卡">${SHOWN.map((l,i)=>{const open=stageOpen(l.city),st=prog.stars[l.city]||0,d=COURSES.find(c=>c.id===l.city).difficulty;
        return `<button class="stage ${open?'':'locked'}" data-level="${l.city}" aria-label="第 ${i+1} 關 ${cityName(l.city)}${open?`，${st} 顆星`:`，先跑完第 ${i} 關`}">
          <span class="dot"><canvas width="700" height="352" aria-hidden="true"></canvas>${open?'':icon('lock')}</span><b>${i+1} · ${cityName(l.city)}</b><small class="ui-tag diff">${[1,2,3].map(k=>`<i class="${k<=d?'on':''}"></i>`).join('')}${DIFF[d]}</small>${open?'':`<small class="ui-tag muted">${icon('lock')}</small>`}</button>`;   /* no stars on the picture (2026-10-14, the user) */}).join('')}</main><section class="next-race ui-panel" aria-live="polite"></section>${nav('home')}`);
    el.querySelector('.rich-open').onclick=()=>richSheet(el);
    el.querySelectorAll('.stage canvas').forEach(cv=>drawCourse(cv,cv.closest('.stage').dataset.level));
    const row=el.querySelector('.stage-row'),stages=[...row.querySelectorAll('.stage')];
    let at=-1;
    const paint=i=>{if(i===at)return;at=i;
      const l=LEVELS[i],c=COURSES.find(x=>x.id===l.city),open=stageOpen(l.city),st=prog.stars[l.city]||0,best=bestOn(l.city),next=nextStarTime(l.city,st);
      profile.city=l.city;store.set(PROFILE,JSON.stringify(profile));
      stages.forEach((b,k)=>b.classList.toggle('is-selected',k===i));
      el.querySelector('.home-scene').style.backgroundImage=`url(assets/backdrops/${l.city}.webp${new URL(import.meta.url).search})`;
      const gift=stageGift(i+1),line=!open?`先跑完第 ${i} 關`:!st?(gift?`破關送 ${gift}`:'跑完拿第 1 顆星'):next?`${next} 秒內拿第 ${st+1} 顆星`:`${STAR_MAX<3?'過關了':'三星了'} · 最佳 ${wallTime(best,l.city)}`;
      const rider=soloHorse(),hungry=open&&fitness(care[rider.id]).feed>0;   // 2026-10-14 (a reviewer only learnt it on the race ticket): a hungry buddy is said here, with the way to the dorm
      const SKY_NAME={sun:'晴天',rain:'下雨',snow:'下雪'},cast=forecast(l.city).map(f=>`<span>${wx(f.sky)}${SKY_NAME[f.sky]} ${f.pct}%</span>`).join(''),field=(l.field||[]).map(id=>SLICE_RIVALS.find(r=>r.id===id)).filter(Boolean).sort((a,b)=>b.tier-a.tier);   // 2026-10-14 (the user: 場地要有天氣的機率，出現玩家階級): the forecast and who runs, by tier
      el.querySelector('.next-race').innerHTML=`<div class="ui-card-head"><b>${c.title}</b><span class="diff-tag d${c.difficulty}">${DIFF[c.difficulty]}</span></div><p>${line}</p><dl class="stage-facts"><div><dt>天氣預報</dt><dd>${cast}</dd></div></dl>${hungry?`<button class="hungry" data-feed>${icon('fork')}<span>${esc(rider.name)} 餓了，跑得慢，只能小押</span><b>去餵</b></button>`:''}
        <div class="acts"><button class="ui-icon-btn plain" data-to="course" aria-label="賽道介紹">${icon('info')}</button><button class="ui-btn primary block" data-to="race" ${open?'':'disabled'}>${open?`選夥伴${icon('arrow','')}`:icon('lock')}</button></div>`;
      el.querySelectorAll('.next-race [data-to]').forEach(b=>b.onclick=()=>go(b.dataset.to));
      const fd=el.querySelector('.next-race [data-feed]');if(fd)fd.onclick=()=>{stableFocus=rider.id;go('stable');};};
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
    const sky=skyOf(c.id),suits=h=>!!SKY_NEED[sky]&&owns(prog,h.id)&&[].concat(perkOf(h)).includes(SKY_NEED[sky]);
    const head=(h,attr,cls='')=>`<button class="ui-marker ${cls} ${owns(prog,h.id)?'':'locked'} ${attr==='data-solo'&&suits(h)?'suits':''}" role="listitem" ${attr}="${h.id}" aria-label="${h.name}${owns(prog,h.id)?'':'（還沒解鎖）'}">${owns(prog,h.id)?`<img src="${buddyImg(h)}" alt="">`:icon('lock')}${attr==='data-solo'&&suits(h)?`<i class="sky-ok">${icon(sky==='rain'?'rain':'cloud')}</i>`:''}</button>`;
    // 2026-10-14 (the user: 卡牌方式顯示，夥伴要有屬性的 icon，直接秀出騎士和夥伴的 3D): a grid of cards, each with its perks
    // (lit from its level, dim before), suits today / hungry; the chosen one is ridden in 3D above (stable-view with the rider).
    const card=h=>{const has=owns(prog,h.id),p=HORSE_PRICE[h.id]||{},hungry=has&&fitness(care[h.id]).feed>0;   // 2026-10-14 (the user: names may be long; hungry and 👍 in the corner): the head and its level, the name on a line of its own, the perks as icons
      return `<button class="pick-card ${has?'':'locked'}" role="listitem" data-solo="${h.id}" aria-label="${h.name}"><span class="top"><img src="${buddyImg(h)}" alt=""><span class="side"><small>${has?lv(h):p.stage?`破第 ${p.stage} 關送`:p.stars?`集滿 ${p.stars} 顆星`:`${coin}${p.coins??''}`}</small><span class="perks">${perksOf(h).map((x,k)=>`<img class="${has&&k<lvOf(h)?'':'shut'}" src="assets/ui/perk/${x}.webp" alt="${perkName(x)}" title="${PERK_TEXT[x]}">`).join('')}</span></span></span><span class="badges">${has&&suits(h)?'<i aria-label="推薦">👍</i>':''}${hungry?`<i class="hungry" aria-label="餓了">${icon('fork')}</i>`:''}</span><b>${h.name}</b></button>`;};
    let view=null,alive=true,shown=null;
    const rc=relayCourse(c.id),bests=readSolo();
    const el=frame('page-race',`<div class="view" aria-hidden="true"></div>${loadingCard('夥伴準備中…')}${header('選夥伴',readCoins())}<main class="page-body">
      ${MVP.relay?`<div class="ctr"><div class="ui-tabs" role="tablist" aria-label="比賽方式" style="--n:2"><button role="tab" data-mode="solo">單騎</button><button role="tab" data-mode="relay" ${relayOk?'':'disabled'}>${relayOk?'三棒接力':`${icon('lock')}接力 · 要 3 位夥伴`}</button></div></div>`:''}
      <section data-for="solo">${SKY_TEXT[sky]?`<p class="pick-sky">${wx(sky)}<span>${SKY_TEXT[sky]}</span></p>`:''}<section class="ui-panel deep pick-panel"><div class="pick-cards" role="list" aria-label="夥伴">${[...mine,...ROSTER.filter(h=>!owns(prog,h.id))].map(card).join('')}</div><div class="go-row"></div></section></section>
      <section data-for="relay"><div class="legs">${[0,1,2].map(k=>`<div><button class="ui-marker big" data-leg="${k}"></button><span class="ui-tag"></span></div>`).join('')}</div>
        <div class="buddy-tray" role="list" aria-label="我的夥伴">${mine.map(h=>head(h,'data-horse')).join('')}</div>
        <div class="stack"><article class="ui-panel ui-card-body team"></article><button class="ui-btn primary block" data-go="play">出發${icon('arrow','')}</button></div></section></main>
      <div class="ui-scrim" hidden></div><section class="ui-modal ui-panel deep buy-sheet" role="dialog" aria-modal="true" hidden></section>`);
    let sel=0,see=soloHorse().id;
    el.style.backgroundImage=`url(assets/backdrops/paddock.webp${new URL(import.meta.url).search})`;   // the user's paddock stage (references/backdrops/paddock-stage.png): the pair stands on its round stage
    const paint=()=>{
      const solo=profile.mode==='solo';
      el.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-selected',b.dataset.mode===profile.mode));
      el.querySelectorAll('[data-for]').forEach(x=>x.hidden=x.dataset.for!==profile.mode);
      if(solo){
        const h=horseById(see),has=owns(prog,h.id);if(shown!==h.id){shown=h.id;applyLook(h);view?.show(null,true);}
        el.querySelectorAll('[data-solo]').forEach(b=>b.classList.toggle('is-selected',+b.dataset.solo===h.id));
        el.querySelector('.go-row').innerHTML=has?`<button class="ui-btn primary block" data-start>出發 · ${h.name}${icon('arrow','')}</button>`:`<button class="ui-btn primary block" data-unlock>${icon('lock')}解鎖 ${h.name}</button>`;
        el.querySelector('[data-start]')?.addEventListener('click',()=>go('solo'));
        el.querySelector('[data-unlock]')?.addEventListener('click',()=>horseSheet(el,h,()=>{profile.solo=h.id;saveProfile();render();}));
        return;}
      const team=profile.order.map(horseById),sts=team.map(h=>buddyStats(h.stats,MAX_LEVEL));
      el.querySelectorAll('.legs>div').forEach((d,k)=>{const h=team[k],b=d.firstElementChild;
        b.innerHTML=`<img src="${buddyImg(h)}" alt="">`;b.classList.toggle('is-selected',sel===k);b.setAttribute('aria-label',`第${k+1}棒 ${h.name}${sel===k?'，選取中':''}`);
        d.lastElementChild.textContent=`第${k+1}棒`;});
      el.querySelectorAll('[data-horse]').forEach(b=>b.classList.toggle('is-selected',+b.dataset.horse===profile.order[sel]));
      el.querySelector('.team').innerHTML=`<div class="ui-card-head"><b>隊伍</b><span>${Math.round(rc.length)} m</span></div>
        ${team.map((h,k)=>fitNotes(care[h.id],`第 ${k+1} 棒 ${h.name}`).map(n=>`<p class="fit ${n.ok?'ok':'bad'} ${n.icon}">${icon(n.icon)}<span>${n.text}</span></p>`).join('')).join('')}`;   // each leg's buddy: fit to run, or what it needs (the numbers went, 2026-10-13)
    };
    el.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{profile.mode=b.dataset.mode;saveProfile();paint();});
    el.querySelectorAll('[data-solo]').forEach(b=>b.onclick=()=>{see=+b.dataset.solo;if(owns(prog,see)){profile.solo=see;saveProfile();}paint();});
    el.querySelectorAll('[data-leg]').forEach(b=>b.onclick=()=>{sel=+b.dataset.leg;paint();});
    el.querySelectorAll('[data-horse]').forEach(b=>b.onclick=()=>{putOnLeg(+b.dataset.horse,sel);sel=(sel+1)%3;saveProfile();paint();});
    paint();{const sc=el.querySelector('.pick-cards'),c0=sc?.querySelector('.pick-card');if(c0)requestAnimationFrame(()=>{const gap=parseFloat(getComputedStyle(sc).rowGap)||0;sc.style.maxHeight=`${c0.offsetHeight*2.5+gap*2}px`;const on=sc.querySelector('.is-selected');if(on)sc.scrollTop=on.offsetTop-sc.offsetTop;place();});}   /* two rows and a half in view (2026-10-14, the user), the chosen buddy's row at the top */
    // The paddock's stage and the pair on it sit just over the card panel, whatever the screen (2026-10-14, the user: the pair
    // was under the panel on a phone): the picture is moved so its stage (54% down it, cover) is there, and the 3D frame's
    // feet with it. Measured, not guessed from the screen's shape: the panel's height depends on the cards.
    const PADDOCK={stage:.5395,ratio:2149/1080};
    function place(){const pn=el.querySelector('.pick-panel'),v=el.querySelector('.view');if(!pn||!v)return;const box=el.getBoundingClientRect(),W=box.width,H=box.height,bgH=Math.max(H,W*PADDOCK.ratio);
      let T=pn.getBoundingClientRect().top-box.top-12,y=T-PADDOCK.stage*bgH;if(y>0){y=0;T=PADDOCK.stage*bgH;}   // never a gap over the sky
      const over=el.querySelector('.pick-sky')||el.querySelector('.ui-header'),top=over?over.getBoundingClientRect().bottom-box.top+6:0,vh=Math.max(120,Math.min(.34*H,(T-top)/.97));   /* no taller than the room between the weather bar and the stage */
      el.style.backgroundPosition=`50% ${y}px`;v.style.height=`${vh}px`;v.style.top=`${T-vh*.97}px`;
      const ld=el.querySelector('.stage-loading');if(ld){ld.style.top=v.style.top;ld.style.height=v.style.height;ld.style.bottom='auto';}}
    const ro=new ResizeObserver(()=>place());ro.observe(el);{const pn=el.querySelector('.pick-panel');if(pn)ro.observe(pn);}   /* again whenever the page or the panel changes size (the first measure came before the cards were laid out) */
    leave=()=>{alive=false;ro.disconnect();view?.dispose();applyLook();};
    applyLook(horseById(see));shown=see;mountStableView(el.querySelector('.view'),{rider:true,center:true}).then(v=>{if(!alive){v.dispose();return;}view=v;applyLook(horseById(shown));v.show(null,true);el.classList.add('has-view');el.querySelector('.stage-loading')?.remove();}).catch(e=>{console.error(e);const l=el.querySelector('.stage-loading span');if(l)l.textContent=translate('3D 無法載入');});   // the 3D shows once it is whole (.has-view)
  },

  async play(){
    const c=COURSES.find(x=>x.id===profile.city)||COURSES[0],team=profile.order.map(horseById);applyLook(team[0]);
    let session=null,gone=false;leave=()=>{gone=true;session?.exit();};
    // The stable feeds the race (form from Hunger / Stamina / Mood / Lv) and the race feeds the stable back.
    // The relay is the ball game too (2026-10-11, the user: 「接力改成現在玩法」): the stage's own tempo and rammers, every
    // move open, three buddies in turn, each on its own numbers at its level and its care (the solo form, one a leg).
    const L={...LEVELS[levelOf(c.id)],locks:{},plain:false};
    const form=()=>{const fs=team.map(h=>careForm(care[h.id],{...SLICE_CONFIG,...racing(buddyStats(h.stats,MAX_LEVEL))}));return {config:{startEnergy:fs[0].config.startEnergy,legs:fs.map(f=>f.config.legs[0])},notes:fs[0].notes};};
    const bank=r=>{
      addCoins(r.coins);addGems(r.gems||0);if(MVP.decor)addDecor(`postcard_${c.id}`);const best=+store.get(BEST)||0;store.set(BEST,String(Math.max(best,r.bestCombo)));
      const all=readRelay(),old=all[c.id],newBest=!old||r.finishTime<old.time;
      all[c.id]={time:newBest?+r.finishTime.toFixed(3):old.time,rank:Math.min(old?.rank??9,r.rank)};store.set(RELAY_BEST,JSON.stringify(all));
      const runs=team.map(h=>{const a=afterRace(care[h.id],r);care[h.id]=a.care;return a;});bag={...bag,seed:(bag.seed||0)+FARM.raceSeeds};saveCare({setItem:store.set},care,bag);   // a race brings a wheat seed home (farm.mjs)   // every leg's horse ran
      // What the next race would cost: a hungry, tired or dirty horse runs slower, and the results say so (it was silent).
      const worn=form().notes.filter(n=>!n.ok).map(n=>n.text);
      const f=finish(prog,{city:c.id,solo:false,result:r,today:today()});prog=f.p;saveProg();addCoins(f.coins+(f.first?r.coins:0));addGems(f.gems);
      const rw=rewards(f,c.id,null),up=team.filter((h,i)=>runs[i].levelUp);rw.news=[...up.map(h=>levelNews(h,care[h.id])),...rw.news];rw.prizes=[...up.map(h=>{grew.set(h.id,lvOf(h)-1);return grewCard(h);}),...rw.prizes];
      return {total:readCoins(),gems:gemsShown(),newCombo:r.bestCombo>best,best:old?.time||0,newBest,xp:runs[0].xp,level:level(care[team[0].id]),levelUp:runs.some(a=>a.levelUp),notes:worn,...rw};
    };
    session=await startSlice({city:c.id,solo:true,relay:true,perks:team.map(perkOf),ease:eased(prog,c.id,false),stage:L,team:team.map(racer),getForm:form,onFinish:bank,getBest:()=>readRelay()[c.id]?.time,getBrief:()=>brief(c,false),lean:prog.runs>=3,
      tag:`${c.city.toUpperCase()} · ${c.title.toUpperCase()} · RELAY`,
      onExit:(result,dest)=>{if(location.hash!=='#play')return;  // already navigated away (back gesture)
        if(newBuddy!=null&&dest!=='home'){stableFocus=newBuddy;go('stable',{replace:true});return;}
        /* 2026-10-14 playtest: the Home button goes home; 看新夥伴 still goes to the dorm */   // a buddy came with this run: it walks in first
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
    const h=soloHorse(),c=COURSES.find(x=>x.id===profile.city)||COURSES[0],key=`${c.id}:${h.id}`,L=LEVELS[levelOf(c.id)];applyLook(h);
    let session=null,gone=false;leave=()=>{gone=true;session?.exit();applyLook();};
    // The stake (progress.mjs entryFee): paid as a run starts (pay), the share of the pot won comes with the result (r.stake).
    const fee=entryFee(c.id),stake=fee?{fee,purse:fee*PURSE,bets:BETS,betName:BET_NAME,hungry:()=>fitness(care[h.id]).feed>0,fit:()=>!fitness(care[h.id]).feed,lastWon:()=>readJson(LAST_RANK)[c.id]===1,won:purseWon,can:k=>readCoins()>=fee*(k||1),pay:k=>{const f=fee*(k||1);if(readCoins()<f)return false;addCoins(-f);return true;},coins:readCoins}:null;
    const bank=r=>{delete skyFor[c.id];if(r.stake?.won)addCoins(r.stake.won);const made=r.stake&&r.field?payRivals(r.field,stake.fee,stake.purse)   /* the rivals ran for the plain pot: the player's raise and weather bonus are the player's own (2026-10-14: a horse took 360 on a rain stage) */:null;if(r.rank){const lr=readJson(LAST_RANK);lr[c.id]=r.rank;store.set(LAST_RANK,JSON.stringify(lr));}const all=readSolo(),best=all[key]||0,newBest=!best||r.finishTime<best,seconds=r.finishTime/tempoOf(c.id);
      if(newBest){all[key]=+r.finishTime.toFixed(3);store.set(SOLO_BEST,JSON.stringify(all));if(r.trace)store.set(GHOST+key,JSON.stringify(r.trace));}
      const f=finish(prog,{city:c.id,solo:true,result:{...r,seconds},today:today()});prog=f.p;saveProg();addCoins(r.coins*(f.first?2:1)+f.coins);addGems(f.gems);if(f.items)for(const [k,n] of Object.entries(f.items))bag={...bag,[k]:(bag[k]||0)+n};   // the day's first run: its coins twice; a stage's seeds and bait (progress.mjs STAGE_GIFT)
      const bestCombo=+store.get(BEST)||0;store.set(BEST,String(Math.max(bestCombo,r.bestCombo||0)));   // the settings page's 「最高連擊」 (2026-10-10: only the relay wrote it)
      justRan={id:h.id,at:Date.now(),won:r.rank==null||r.rank===1};   // the ranch shows it for a minute (ranch-view RANCH.ran)
      const a=afterSolo(care[h.id],{stars:f.runStars,perfect:r.perfect});care[h.id]=a.care;bag={...bag,seed:(bag.seed||0)+FARM.raceSeeds};saveCare({setItem:store.set},care,bag);
      // The hot streak: runs in a row that got somewhere (a new best or a new star); each one pays a little more, up to five.
      const hot=MVP.daily&&(newBest||f.newStars)?Math.min(5,(+store.get(HOT)||0)+1):0;store.set(HOT,String(hot));const hotCoins=hot>1?hot*10:0;if(hotCoins)addCoins(hotCoins);
      const rw=rewards(f,c.id,seconds);if(a.levelUp){rw.news=[levelNews(h,a.care),...rw.news];grew.set(h.id,lvOf(h)-1);rw.prizes=[grewCard(h),...rw.prizes];}   // a level gained is said first (2026-10-12: it has to be seen)
      return {total:readCoins(),gems:gemsShown(),best,newBest,xp:a.xp,level:level(a.care),toNext:lvLeft(a.care),levelUp:a.levelUp,hot,hotCoins,...rw,extra:(rw.extra||0)+(r.stake?.won||0),runs:Math.ceil(lvLeft(a.care)/RUN_XP),age:AGE[level(a.care)-1],nextAge:AGE[level(a.care)]||'',
        // the money of this run, in the order it is read: [what for, coins]; net: all of it, the fee taken off
        money:made?richList(r.field.map(f=>f.id),made,(r.stake.won||0)-r.stake.fee+r.coins*(f.first?2:1)+f.coins).all:null,   // the player's: all the run made, as the big number says
        parts:[['獎金',r.stake?.won||0],['報名費',-(r.stake?.fee||0)],[f.first?'路上撿的，今天第一場 ×2':'路上撿的',r.coins*(f.first?2:1)],['星星和過關',f.coins]].filter(p=>p[1])};};
    const ghost=()=>{try{return JSON.parse(store.get(GHOST+key)||'null')}catch{return null}};
    // What the ranch gives a solo run (2026-10-06: a tester could not feel the items; they only reached the relay): the start
    // energy, from how rested the buddy is (精神) plus an energy bar. Only ever a help: nothing here slows a solo run.
    const soloForm=()=>careForm(care[h.id],{...SLICE_CONFIG,...racing(buddyStats(h.stats,MAX_LEVEL))});   // this buddy's own numbers at its level, then its care: felt on every stage (2026-10-10; the first two had none)
    session=await startSlice({city:c.id,solo:true,stage:L,stake,sky:skyOf(c.id),tiers:{me:tierOf(prog.points),list:TIERS,you:profile.name||'你'},you:`${h.name} · LV ${lvOf(h)}${perkOf(h).length?` · ${perkOf(h).map(perkName).join('、')}`:''}`,rivalGrow:(1+(rivalAge(c.id)-1)*LV_SPEED)*rivalPace(c.id),rivalStep:LV_SPEED,perks:[perkOf(h)],thumb:levelOf(c.id)===0,arrows:{lane:levelOf(c.id)===LEVELS.findIndex(l=>!l.locks?.lane),jump:levelOf(c.id)===LEVELS.findIndex(l=>!l.locks?.hurdle),skill:levelOf(c.id)===LEVELS.findIndex(l=>l.rivals>0),sprint:levelOf(c.id)===LEVELS.findIndex(l=>!l.locks?.sprint)},ease:eased(prog,c.id),intro:!prog.stars[c.id]&&levelOf(c.id)===LEVELS.findIndex(l=>l.ram),rivalCount:L?.rivals??0,team:[racer(h)],getForm:soloForm,onFinish:bank,getBest:()=>readSolo()[key],getBrief:()=>brief(c,true),getGhost:ghost,lean:prog.runs>=3,
      tag:`${c.city.toUpperCase()} · ${c.title.toUpperCase()} · SOLO · ${h.name.toUpperCase()}`,
      onExit:(result,dest)=>{if(location.hash!=='#solo')return;  // already navigated away (back gesture)
        if(newBuddy!=null&&dest!=='home'){stableFocus=newBuddy;go('stable',{replace:true});return;}
        /* 2026-10-14 playtest: the Home button goes home; 看新夥伴 still goes to the dorm */   // a buddy came with this run: it walks in first
        if(dest?.city){profile.city=dest.city;saveProfile();go('race',{replace:true});}   // the level this run opened
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
    let index=Math.max(0,ROSTER.findIndex(h=>h.id===(stableFocus??profile.horse))),pane=null,food='wheat',picked=false,view=null,alive=true;const came=new Set();   // the buddies that have already walked in on this visit to the dorm: picked again, one just stands there (2026-10-11, the user). Gone with the page   // the feed button feeds wheat, the ranch's own food, unless a treat was picked from the items
    const maned=()=>MVP.perks&&!COATS[ROSTER[index].coat].species;let part=maned()?'mane':GEAR[0].mat,kind='food';   // MVP: no mane styles   // part: 'mane' (this buddy's mane and tail style; a llama or a rhino has none) or a GEAR material
    const owned=readDecor(),deco=MVP.decor?[...DECOR,...POSTCARDS].filter(d=>owned.has(d.id)):[];
    const el=frame('page-stable ui-live',`<div class="st-bg" aria-hidden="true"></div><div class="st-decor" aria-hidden="true">${deco.map(d=>
        `<i data-deco="${d.id}" style="left:${d.slot[0]*100}%;top:${d.slot[1]*100}%;width:${d.slot[2]*100}%"><img src="assets/stable/deco/${d.id}.webp" alt="">${d.id==='nameplate'?'<b></b>':''}</i>`).join('')}</div><div class="view"></div>${loadingCard('夥伴們正在集合…')}
      <i class="st-door" aria-hidden="true"></i><header class="ui-header st-top"><button class="ui-icon-btn" data-back aria-label="返回">${icon('back','')}</button><h1>牧場</h1>${wallet(readCoins(),{gems:gemsShown()})}</header>
      ${ranchTabs(RANCH_TABS.findIndex(t=>t.dorm))}<div class="st-tray buddy-tray" role="list" aria-label="我的夥伴"></div><div class="ui-scrim st-scrim" hidden></div><section class="st-pop ui-modal ui-panel deep" role="dialog" aria-modal="true" hidden></section>
      <i class="st-heart" aria-hidden="true"></i>
      <div class="st-foot"><section class="st-sheet ui-panel" aria-label="造型" hidden></section><aside class="st-buddy ui-panel"></aside>
        <div class="st-acts"><button class="side" data-pane="gear" aria-expanded="false"><span class="ui-icon-btn">${icon('palette')}</span>造型</button>
        ${['wheat','fish'].map(f=>`<button class="big feed" data-act="feed" data-food="${f}"><span><img src="assets/stable/item_${f}.webp" alt=""><i class="st-food" data-count="${f}"></i><em hidden>愛吃</em></span>${f==='wheat'?'餵小麥':'餵魚'}</button>`).join('')}${MVP.mood?`<button class="big" data-act="brush"><span>${icon('brush')}</span>刷毛</button>`:''}
        <button class="side" data-pane="items" aria-expanded="false"><span class="ui-icon-btn">${icon('items')}</span>道具</button></div></div>`);
    const toast=toaster(el);
    const heart=()=>{const h=el.querySelector('.st-heart');h.classList.remove('pop');void h.offsetWidth;h.classList.add('pop');};
    const worn=g=>profile.gear[g.mat]??g.colors[0];
    const shown=(g,c)=>c===g.colors[0]&&g.mat==='Tack_Pad'&&COATS[ROSTER[index].coat].species?'#c4a07c':c;   // the first swatch is "as built": a llama's or a rhino's own pad is tan, not the horse's dark grey
    // The horse's moods (stable-view): any touch on the page gets it up if it lay down to rest; a bar filled to 100 → it
    // rears for joy once the act is done.
    el.addEventListener('pointerdown',()=>view?.wake(),{capture:true});
    const filled=(was,now)=>{if(['hunger','clean'].some(k=>now[k]>=100&&was[k]<100))view?.cheer();};
    // A buddy that grew (grew: in a race, or fed just now) is shown as it was, with a card over it: its new age and what
    // that brings. Closing the card changes it (2026-10-12, the user: no flash; the card first, then the change).
    const shownLv=h=>grew.get(h.id)??lvOf(h);let growing=0;
    const grow=h=>{if(growing||!view||!grew.has(h.id))return;growing=setTimeout(()=>{if(!alive)return;const l=lvOf(h),p=perksOf(h)[l-1];
      el.insertAdjacentHTML('beforeend',`<div class="ui-prize grow" role="dialog" aria-modal="true" aria-label="長大了"><div class="grow-card ui-panel"><span class="ui-tag yellow">長大了</span><img src="${growImg(h,l)}" alt=""><b>${h.name} 升上 ${AGE[l-1]} 了！</b>${pips(l)}
        <ul><li>速度 +${Math.round((l-1)*LV_SPEED*100)}%</li>${p?`<li>新特長　${PERK_TEXT[p]}</li>`:''}<li>樣子變了</li></ul></div><button class="ui-btn primary">看看牠</button></div>`);
      const layer=el.lastElementChild;layer.querySelector('button').onclick=()=>{layer.remove();growing=0;grew.delete(h.id);paint();view?.cheer();};},1200);};
    function paint(){
      const h=ROSTER[index],cr=care[h.id];grow(h);
      el.querySelectorAll('[data-pane]').forEach(b=>b.setAttribute('aria-expanded',b.dataset.pane===pane));
      const fav=likes(COATS[ROSTER[index].coat]?.species||'horse');if(picked&&!(bag[food]>0))picked=false;if(!picked)food=bag[fav]>0||!(bag.wheat>0)?fav:'wheat';   // nothing picked: what this buddy likes best (the bear and the wolf: fish), or the wheat there is
      el.querySelectorAll('.st-acts .feed').forEach(b=>{const f=b.dataset.food;b.querySelector('.st-food').innerHTML=`<b>${bag[f]??0}</b>`;b.querySelector('em').hidden=true;b.disabled=f!==fav;b.classList.toggle('none',f===fav&&!(bag[f]>0));});   // the one this buddy does not eat is off (2026-10-12, the user)   // two ways to feed (2026-10-12, the user): wheat or fish, the one this buddy likes marked
      const pop=el.querySelector('.st-pop'),card=el.querySelector('.st-buddy'),sheet=el.querySelector('.st-sheet'),gear=pane==='gear';
      pop.hidden=el.querySelector('.st-scrim').hidden=!pane||gear;sheet.hidden=!gear;
      const plate=el.querySelector('[data-deco=nameplate] b');if(plate)plate.textContent=h.name;
      const stat=(ic,label,v)=>`<div class="st-stat ${ic} ${v<50?'low':''}" role="img" aria-label="${label} ${v} / 100">${icon(ic)}<b>${label}</b>${bar(v)}</div>`;   // the icon and its colour are the same wherever this is said (the pick card, the race cover: .fit)   // icon + bar (the number only for screen readers); yellow: it needs care
      card.innerHTML=`<button class="st-grow-open" data-grow aria-label="${h.name} 的成長"><span class="ui-card-head"><b>${h.name}</b><span>${AGE[shownLv(h)-1]}${pips(shownLv(h))}${icon('arrow','chev')}</span></span><span class="st-next">${bar(lvPart(cr)*100)}<small>${nextUp(h)}</small></span></button><div class="st-stats">${stat('fork','飽足',cr.hunger)+(MVP.mood?stat('smile','心情',cr.clean):'')}</div>`;
      // The heads: the buddies owned; a tap shows that one here (and the ranch opens on it next time).
      const tray=el.querySelector('.st-tray');
      tray.innerHTML=ROSTER.filter(x=>owns(prog,x.id)).map(x=>`<button class="ui-marker ${x.id===h.id?'is-selected':''}" role="listitem" data-see="${x.id}" aria-label="${x.name}"><img src="${buddyImg(x)}" alt=""></button>`).join('')+`<button class="ui-marker locked" data-more aria-label="我的夥伴">${icon('plus','')}</button>`;
      tray.querySelectorAll('[data-see]').forEach(b=>b.onclick=()=>{if(view?.busy)return;index=ROSTER.findIndex(x=>x.id===+b.dataset.see);profile.horse=ROSTER[index].id;saveProfile();if(part==='mane'&&!maned())part=GEAR[0].mat;paint();});
      tray.querySelector('[data-more]').onclick=()=>go('horses');
      // Items: the foods in the bag; a tap picks the one Feed gives (wheat unless a treat is picked).
      const have=ITEMS.filter(it=>bag[it.id]>0&&it.kind==='food'),tile=it=>`<button class="ui-card" data-item="${it.id}" ${it.kind==='food'?`aria-pressed="${it.id===food}"`:''} aria-label="${it.name}${it.kind==='tool'?'':' '+bag[it.id]}"><img src="assets/stable/item_${it.id}.webp" alt="">${it.kind==='tool'?'':`<b>×${bag[it.id]}</b>`}</button>`;
      // A new buddy, once it has walked in (2026-10-11, spec C2): its name, asked this once; left as it is, it keeps the one it came with.
      if(pane==='name'){pop.innerHTML=`<header><h2>牠叫 ${h.name}。要改名嗎？</h2></header><input class="ui-input" style="width:100%" maxlength="12" value="${h.name}" aria-label="名字"><button class="ui-btn primary block" data-name>就叫這個</button>`;
        pop.querySelector('[data-name]').onclick=()=>{const v=cleanName(pop.querySelector('input').value);if(v&&v!==h.name){profile.names={...profile.names,[h.id]:v};saveProfile();h.name=v;}pane=null;paint();};}
      card.querySelector('[data-grow]').onclick=()=>{pane='grow';paint();};
      if(pane==='grow')pop.innerHTML=`<header><h2>${h.name} 的成長</h2><button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header>${growCard(h)}<p class="st-hint ui-label">${nextUp(h)}。比賽和餵食都會成長。</p>`;
      if(pane==='items')pop.innerHTML=`<header><h2>Items</h2><button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header>
        <div class="st-grid items">${have.map(tile).join('')}</div><p class="st-hint ui-label">${have.length?'選一個，「餵食」就餵它':'沒有食物：去麥田收成'}</p>
        <button class="ui-btn block" data-go="shop">去商店買更多${icon('arrow','')}</button>`;
      const g=GEAR.find(x=>x.mat===part),mane=maneOf(h.id),riderShut=x=>false,gears=GEAR.filter(x=>MVP.perks||!x.mat.startsWith('Rider_'));   // MVP: the rider's clothes stay as they are
      if(gear)sheet.innerHTML=`<header><b>造型</b><button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header><div class="parts" role="tablist" ${maned()?'':'style="grid-template-columns:repeat(6,1fr)"'}>
          ${maned()?`<button role="tab" aria-selected="${part==='mane'}" data-part="mane"><i class="mane" style="background-image:url(assets/ui/hair_${mane}.webp?v=1)"></i>鬃毛</button>`:''}${gears.map(x=>`<button role="tab" aria-selected="${x.mat===part}" data-part="${x.mat}"><i style="background:${shown(x,worn(x))}"></i>${x.name}</button>`).join('')}</div>
        ${g?`<div class="swatches" role="radiogroup" aria-label="${g.name}顏色">${g.colors.filter(c=>hasLook(g.mat,c)).map((c,i)=>`<button role="radio" aria-label="${i?c:'原色'}" aria-checked="${worn(g)===c}" data-color="${c}" style="background:${shown(g,c)}"></button>`).join('')}</div>${patternRow(g.mat)}<button class="ui-btn block looks-more" data-looks="buddy">去商店買更多${icon('arrow','')}</button>${riderShut(g)?`<p class="look-note ui-label">${icon('lock')}破第 ${PERKS.rider.stage} 關開放</p>`:''}`
          :`<div class="manes" role="radiogroup" aria-label="鬃毛造型">${HAIR.map(x=>`<button role="radio" aria-checked="${x.id===mane}" data-mane="${x.id}" ${maneOpen(prog,x.id)?'':'disabled'}><img src="assets/ui/hair_${x.id}.webp?v=1" alt=""><span>${maneOpen(prog,x.id)?x.name:`破第 ${PERKS.mane.stage} 關開放`}</span></button>`).join('')}</div>`}`;
      for(const x of [pop,sheet])x.querySelector('[data-close]')?.addEventListener('click',()=>{pane=null;paint();});
      pop.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const it=ITEMS.find(x=>x.id===b.dataset.item);
        food=it.id;picked=true;toast(`餵食會用${it.name}`);paint();});
      pop.querySelector('[data-go]')?.addEventListener('click',()=>go('shop'));
      sheet.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{part=b.dataset.part;paint();});
      sheet.querySelector('[data-looks]')?.addEventListener('click',()=>{PAGES.looks.part=part;go('looks');});
      sheet.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{const c=b.dataset.color;
        if(c===g.colors[0])delete profile.gear[part];else profile.gear[part]=c;saveProfile();paint();});
      sheet.querySelectorAll('[data-shirt]').forEach(b=>b.onclick=()=>{wearPattern(part,b.dataset.shirt);paint();});
      sheet.querySelectorAll('[data-mane]').forEach(b=>b.onclick=()=>{profile.manes={...profile.manes,[h.id]:b.dataset.mane};saveProfile();paint();});   // this buddy's own
      const look=h.coat+mane+JSON.stringify(profile.gear)+JSON.stringify(profile.patterns||{})+shownLv(h);if(look!==paint.look){paint.look=look;applyLook(h,shownLv(h));const come=!came.has(h.id);came.add(h.id);view?.show(cr.hunger<40?'hungry':cr.hunger>80&&cr.clean>80?'happy':null,come);}   // how it greets you (stable-view ARRIVE)
    }
    el.querySelectorAll('[data-pane]').forEach(b=>b.onclick=()=>{pane=pane===b.dataset.pane?null:b.dataset.pane;paint();});
    el.querySelector('.st-scrim').onclick=()=>{pane=null;paint();};
    const esc=e=>{if(e.key==='Escape'&&pane){e.stopImmediatePropagation();pane=null;paint();}};   // Esc closes the pop-up before leaving the page
    window.addEventListener('keydown',esc,true);
    el.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
      if(view?.busy)return;   // let the brushing finish
      pane=null;
      const h=ROSTER[index],act=b.dataset.act,res=careAction(care[h.id],bag,act,b.dataset.food||food,undefined,COATS[h.coat]?.species||'horse');
      if(res.fail){toast(res.fail);paint();return;}
      const was=care[h.id];care[h.id]=res.care;bag=res.items;
      saveCare({setItem:store.set},care,bag);if(res.levelUp)grew.set(h.id,level(was));else toast(`${h.name} ${res.msg}`);
      view?.react(act,()=>alive&&heart(),`assets/stable/item_${food}.webp`);   // heart on the bite / once combing is under way
      paint();filled(was,res.care);
    });
    stableFocus=null;
    leave=()=>{alive=false;window.removeEventListener('keydown',esc,true);view?.dispose();applyLook();};
    el.querySelectorAll('[data-rtab]').forEach((b,i)=>b.onclick=()=>{const t=RANCH_TABS[i];if(t.house&&!view?.busy)return go('house');if(t.dorm||view?.busy)return;PAGES.ranch.shot=t.shot;go('ranch',{replace:true});});   // the other tabs: that shot of the 3D ranch (this page leaves no history entry behind: back from the ranch goes home)
    paint.look=null;paint();
    if(newBuddy!=null){const id=newBuddy;newBuddy=null;setTimeout(()=>{if(alive&&!pane&&ROSTER[index].id===id){pane='name';paint();}},2600);}   // after its walk in (stable-view ARRIVE)
    const t0=performance.now();mountStableView(el.querySelector('.view')).then(v=>{window.zbMark?.(`dorm shown (+${Math.round(performance.now()-t0)} ms)`);store.set('hoofbeat.loadtime.ranch',((performance.now()-t0)/1000).toFixed(1));if(!alive){v.dispose();return;}view=v;el.querySelector('.stage-loading')?.remove();paint.look=null;paint();})
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
        <p class="ui-sub">${it?itemEffect(it):'掛在牆上'}</p><p class="ui-label">${it?`擁有 ${bag[id]}`:''}${coins<cost?`${it?' · ':''}<span class="ui-no">金幣不夠，去比賽賺一點</span>`:''}</p>
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
      const tabs=[['food','Food'],['horses','夥伴'],['looks','造型']];   // 造型: its own page (PAGES.looks)   // MVP (2026-10-10): the care items and the decorations are hidden
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
        :ITEMS.filter(it=>(it.kind===tab||tab==='food'&&it.kind==='seed')&&it.price).sort((a,b)=>(b.kind==='seed')-(a.kind==='seed')).map(it=>card(`assets/stable/item_${it.id}.webp`,it.name,itemEffect(it)||it.note||'',`<span class="own">×${bag[it.id]}</span>${price(it.price,coins)}`,it.id)).join('')
          +(tab==='food'?`</div><h2 class="ui-section">賣出收成</h2><div class="shop-sell">${ITEMS.filter(it=>it.sell).map(it=>`<button class="ui-pillrow glass" data-sell="${it.id}" ${bag[it.id]>0?'':'disabled'}><img src="assets/stable/item_${it.id}.webp" alt=""><span><i>${it.name}</i> ×${bag[it.id]||0}</span><b>${bag[it.id]>0?`<i>全部賣掉</i> ${coin}+${bag[it.id]*it.sell}`:'沒有可以賣的'}</b></button>`).join('')}`:'');
      el.querySelector('.ui-tabs').innerHTML=tabs.map(([k,l])=>`<button role="tab" aria-selected="${k===tab}" data-tab="${k}">${l}</button>`).join('');   // outside the scroller: the tabs stay put while the goods scroll (2026-10-05, the user)
      el.querySelector('.shop').innerHTML=`<div class="shop-grid">${list}</div>`;
      el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.tab==='looks')return go('looks');tab=PAGES.shop.tab=b.dataset.tab;paint();el.querySelector('.shop').scrollTop=0;});
      el.querySelectorAll('[data-sell]').forEach(b=>b.onclick=()=>{const it=ITEMS.find(x=>x.id===b.dataset.sell),res=sellAll(bag,it.id);if(!res.coins)return;bag=res.items;saveCare({setItem:store.set},care,bag);addCoins(res.coins);toast(`賣掉${it.name}，拿到 ${res.coins} 金幣`);paint();});
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
          <span class="art"><img src="${buddyImg(h)}" alt=""></span><span class="name"><b>${h.name}</b><small>${[lv(h),leg].filter(Boolean).join(' · ')||'在牧場'}</small></span>${MVP.levels?bar(lvPart(cr)*100):''}</button>`;}).join('')}
        ${rest.map(h=>{const p=HORSE_PRICE[h.id];return `<button class="ui-card small to-unlock" data-unlock="${h.id}" aria-label="${h.name}，還沒解鎖，${p.coins} 金幣${MVP.gems?`或 ${p.gems} 鑽石`:''}">
          <span class="art"><img src="${buddyImg(h)}" alt="">${icon('lock')}</span><span class="name"><b>${h.name}</b><small>${coin}${p.coins}${p.stars?` · ${p.stars}★`:p.stage?` · 第 ${p.stage} 關送`:''}</small></span></button>`;}).join('')}</div></main>
      <div class="ui-scrim" hidden></div><section class="ui-modal ui-panel deep buy-sheet" role="dialog" aria-modal="true" hidden></section>${nav('home')}`);
    const sortBtn=el.querySelector('[data-sort]');if(sortBtn)sortBtn.onclick=()=>{PAGES.horses.desc=!desc;render();};
    el.querySelectorAll('[data-see]').forEach(b=>b.onclick=()=>{stableFocus=+b.dataset.see;profile.horse=stableFocus;saveProfile();go('stable');});
    el.querySelectorAll('[data-unlock]').forEach(b=>b.onclick=()=>horseSheet(el,horseById(+b.dataset.unlock),render));
  },

  looks(){
    // 造型, the shop's wardrobe (2026-10-13, the user: pick the part, the style, the colour; try it on; one total; bought, it is
    // in the dorm's and the house's lists). One picture: the rider on a buddy (the row of heads changes the buddy), over the
    // panel, never under it. The panel is made to grow (the user: 未來只會越來越多款式): a row of parts that slides, under it
    // cards in a grid that scrolls, each card one colour or one pattern with what it is to the player (worn, owned, a
    // price). What is tried and not owned is the basket, named item by item over the total; 買下 pays for all of it and puts
    // it on. Leaving without buying leaves everything as it was.
    const parts=GEAR;
    let see=profile.horse,part=PAGES.looks.part&&parts.some(g=>g.mat===PAGES.looks.part)?PAGES.looks.part:parts[0].mat,view=null,alive=true;
    const trial={gear:{...profile.gear},patterns:{...profile.patterns}},tried=g=>trial.gear[g.mat]??g.colors[0];
    const el=frame('page-looks ui-live',`<div class="st-bg" aria-hidden="true"></div><div class="view">${loadingCard('夥伴準備中…')}</div>${header('造型',readCoins())}
      <div class="looks-heads" role="list"></div><section class="ui-panel deep looks-panel"><div class="looks-parts" role="tablist"></div><div class="looks-grid"></div><div class="looks-pay"></div></section>`),toast=toaster(el),panel=el.querySelector('.looks-panel'),heads=el.querySelector('.looks-heads');
    leave=()=>{alive=false;view?.dispose();applyLook();};
    const dress=(come=false)=>{applyLook(horseById(see));PLAYER_LOOK.gear={...trial.gear};PLAYER_LOOK.patterns={...trial.patterns};view?.show(null,come);};
    const basket=()=>[...Object.entries(trial.gear),...Object.entries(trial.patterns)].filter(([m,v])=>v&&!hasLook(m,v)).map(([m,v])=>({m,v,price:lookPrice(v)}));
    const changed=()=>JSON.stringify([trial.gear,trial.patterns])!==JSON.stringify([profile.gear,profile.patterns||{}]);
    const keep=()=>{profile.gear={...trial.gear};profile.patterns={...trial.patterns};saveProfile();};
    const put=(m,v)=>{const g=GEAR.find(x=>x.mat===m),src=v&&v[0]!=='#'||v===''?trial.patterns:trial.gear;if(!v||v===g.colors[0])delete src[m];else src[m]=v;};   // v: a colour, a pattern id, or '' (no pattern)
    function paint(){
      const g=GEAR.find(x=>x.mat===part),list=basket(),total=list.reduce((a,x)=>a+x.price,0),coins=readCoins();
      const state=(m,v,on)=>on&&hasLook(m,v)?`<small class="on">${icon('check','')}穿著中</small>`:on?`<small class="on">${icon('check','')}試穿 ${lookPrice(v)}</small>`:hasLook(m,v)?'<small class="own">已擁有</small>':`<small class="buy">${coin}${lookPrice(v)}</small>`;
      el.querySelectorAll('[data-coins]').forEach(x=>x.textContent=coins.toLocaleString('en-US'));
      heads.innerHTML=owned().map(x=>`<button class="ui-marker ${x.id===see?'is-selected':''}" role="listitem" data-see="${x.id}" aria-label="${x.name}"><img src="${buddyImg(x)}" alt=""></button>`).join('');
      panel.querySelector('.looks-parts').innerHTML=parts.map(x=>`<button role="tab" aria-selected="${x.mat===part}" data-part="${x.mat}" class="${list.some(b=>b.m===x.mat)?'has-dot':''}">${x.name}</button>`).join('');
      panel.querySelector('.looks-grid').innerHTML=`<h3>顏色</h3>${g.colors.map((c,i)=>`<button class="looks-card" role="radio" aria-checked="${tried(g)===c}" data-pick="${c}" aria-label="${i?c:'原色'}"><i style="background:${c}"></i>${state(g.mat,c,tried(g)===c)}</button>`).join('')}`
        +(PATTERNED.includes(part)?`<h3>花紋</h3>${[{id:'',name:'素色'},...SHIRTS].map(x=>{const on=(trial.patterns[part]||'')===x.id;return `<button class="looks-card" role="radio" aria-checked="${on}" data-pick="${x.id}" data-pattern><i ${x.id?`style="background-image:url(assets/rider/thumb_${x.id}.webp)"`:'class="plain"'}></i><b>${x.name}</b>${state(part,x.id,on)}</button>`;}).join('')}`:'');
      panel.querySelector('.looks-parts [aria-selected=true]')?.scrollIntoView({inline:'center',block:'nearest'});
      const label=x=>{const pg=GEAR.find(p=>p.mat===x.m);return x.v[0]==='#'?`<i style="background:${x.v}"></i>${pg.name}`:`<i style="background-image:url(assets/rider/thumb_${x.v}.webp)"></i>${pg.name}·${SHIRTS.find(s=>s.id===x.v).name}`;};
      panel.querySelector('.looks-pay').innerHTML=list.length?`<div class="looks-basket">${list.map(x=>`<button data-drop="${x.m}" data-v="${x.v}" aria-label="拿掉">${label(x)}<b>${x.price}</b>${icon('close','')}</button>`).join('')}</div><button class="ui-btn primary" data-buy ${coins<total?'disabled':''}>買下 ${coin}${total.toLocaleString('en-US')}</button>${coins<total?`<p class="ui-no looks-short">金幣不夠，還差 ${(total-coins).toLocaleString('en-US')}</p>`:''}`
        :changed()?`<span>這些你都有了</span><button class="ui-btn primary" data-wear>穿上</button>`:`<span>點一個試穿，不用錢</span>`;
      heads.querySelectorAll('[data-see]').forEach(b=>b.onclick=()=>{if(view?.busy||+b.dataset.see===see)return;see=+b.dataset.see;paint();dress(true);});
      panel.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{part=PAGES.looks.part=b.dataset.part;paint();panel.querySelector('.looks-grid').scrollTop=0;});
      panel.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{put(part,b.dataset.pick);paint();dress();});
      panel.querySelectorAll('[data-drop]').forEach(b=>b.onclick=()=>{const m=b.dataset.drop,v=b.dataset.v,was=v[0]==='#'?profile.gear[m]:profile.patterns?.[m];put(m,was||(v[0]==='#'?GEAR.find(x=>x.mat===m).colors[0]:''));paint();dress();});   // back to what is worn
      panel.querySelector('[data-wear]')?.addEventListener('click',()=>{keep();toast('穿上了');paint();});
      panel.querySelector('[data-buy]')?.addEventListener('click',()=>{if(!spendCoins(total)){toast('金幣不夠，去比賽賺一點');return;}
        profile.wardrobe=[...new Set([...(profile.wardrobe||[]),...list.map(x=>lookKey(x.m,x.v))])];keep();toast(`買下 ${list.length} 件，已經穿上`);paint();});
    }
    paint();applyLook(horseById(see));PLAYER_LOOK.gear={...trial.gear};PLAYER_LOOK.patterns={...trial.patterns};
    mountStableView(el.querySelector('.view'),{rider:true,center:true}).then(v=>{el.querySelector('.stage-loading')?.remove();if(!alive){v.dispose();return;}view=v;dress(true);})   /* centred and fitted as on the picker (2026-10-14, the user: 馬走進來後沒置中) */.catch(e=>console.error(e));
  },
  house(){
    // The rider's house (2026-10-12, the user: 「騎士的家，按你的建議」; mock-up archive/mockups/rider-home.png): the
    // room's picture, her name on the plank, the stars on the cork board, her standing on the rug, and three rows:
    // her clothes' colours (GEAR's Rider_ parts, open from PERKS.rider.stage), the wall of results, Settings.
    const solo=readSolo(),bestOf=c=>{const t=Object.entries(solo).filter(([k])=>k.split(':')[0]===c).map(([,v])=>v/tempoOf(c));return t.length?Math.min(...t):0;};
    const done=SHOWN.filter(l=>prog.stars[l.city]>0).length,parts=GEAR.filter(g=>g.mat.startsWith('Rider_')),open=true;
    const el=frame('page-house',`<div class="room"><div class="plank"><b>${esc(profile.name)}</b></div>
      <div class="board"><b>★ ${Math.min(totalStars(prog),SHOWN.length*STAR_MAX)} / ${SHOWN.length*STAR_MAX}</b><small>過了 ${done} 關</small></div>${trophy(prog)?'<img class="trophy" src="assets/ui/award_trophy.webp?v=5" alt="冠軍獎盃">':''}<div class="view"></div></div>
      <header class="ui-header"><button class="ui-icon-btn" data-back aria-label="返回">${icon('back','')}</button></header>
      <ul class="ui-list ui-panel deep rows"><li><button data-pane="gear"><b>騎士服裝</b><small>換顏色 ›</small></button></li>
        <li><button data-pane="wall"><b>成績牆</b><small>十關的星星和最快時間 ›</small></button></li><li><button data-go="settings"><b>設定</b><small>›</small></button></li></ul>
      <section class="ui-panel deep pane" hidden></section>${loadingCard('騎士準備中…')}`);
    let view=null,gone=false,part=parts[0].mat;leave=()=>{gone=true;view?.dispose();};
    mountRiderView(el.querySelector('.view'),profile.gear,profile.patterns?.Rider_Shirt||null).then(v=>{el.querySelector('.stage-loading')?.remove();if(gone)v.dispose();else view=v;}).catch(()=>{el.querySelector('.stage-loading')?.remove();});
    const pane=el.querySelector('.pane'),rows=el.querySelector('.rows'),show=k=>{pane.hidden=!k;rows.hidden=!!k;if(!k)return;
      const g=parts.find(x=>x.mat===part),worn=x=>profile.gear[x.mat]??x.colors[0];
      pane.innerHTML=`<header><b>${k==='gear'?'騎士服裝':'成績牆'}</b><button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header>`+(k==='gear'
        ?`<div class="parts" role="tablist" style="grid-template-columns:repeat(${parts.length},1fr)">${parts.map(x=>`<button role="tab" aria-selected="${x.mat===part}" data-part="${x.mat}"><i style="background:${worn(x)}"></i>${x.name}</button>`).join('')}</div>
          <div class="swatches" role="radiogroup" aria-label="${g.name}顏色">${g.colors.filter(c=>hasLook(g.mat,c)).map((c,i)=>`<button role="radio" aria-label="${i?c:'原色'}" aria-checked="${worn(g)===c}" data-color="${c}" style="background:${c}"></button>`).join('')}</div>${patternRow(part)}<button class="ui-btn block looks-more" data-looks="rider">去商店買更多${icon('arrow','')}</button>${open?'':`<p class="look-note ui-label">${icon('lock')}破第 ${PERKS.rider.stage} 關開放</p>`}`
        :`<ol class="wall">${SHOWN.map((l,i)=>{const s=prog.stars[l.city]||0,t=bestOf(l.city);return `<li><span>${i+1}</span><i>${'★'.repeat(s)}<s>${'★'.repeat(3-s)}</s></i><em>${t?t.toFixed(1)+' 秒':'還沒跑'}</em></li>`;}).join('')}</ol>`);
      pane.querySelector('[data-close]').onclick=()=>show(null);
      pane.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>{part=b.dataset.part;show('gear');});
      pane.querySelector('[data-looks]')?.addEventListener('click',()=>{PAGES.looks.part=part;go('looks');});
      pane.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{const c=b.dataset.color;if(c===g.colors[0])delete profile.gear[part];else profile.gear[part]=c;saveProfile();applyLook();view?.paint(profile.gear);show('gear');});
      // the shirt's pattern (approved-assets SHIRTS): the colour worn tints it; a change costs what a colour does
      pane.querySelectorAll('[data-shirt]').forEach(b=>b.onclick=()=>{wearPattern(part,b.dataset.shirt);view?.paint(profile.gear,profile.patterns.Rider_Shirt||null);show('gear');});};
    el.querySelectorAll('[data-pane]').forEach(b=>b.onclick=()=>show(b.dataset.pane));
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
        <small class="ui-sub">夥伴 ${ranchLevel()} 隻</small>${bar(ranchLevel()/ROSTER.length*100)}</div></section>
      <div class="ui-tabs ui-panel" role="tablist" aria-label="權限" style="--n:2">${[['user','一般使用者'],['admin','最高管理者']].map(([k,l])=>`<button role="tab" aria-selected="${admin()===(k==='admin')}" data-role="${k}">${l}</button>`).join('')}</div>
      ${admin()?'<p class="ui-label role-note">金幣和鑽石無限 · 所有關卡開放</p>':''}
      <ul class="ui-list ui-panel">
        <li>${icon('sound')}<span>Sound</span><input class="ui-switch" id="sound" type="checkbox" role="switch" aria-label="音效" ${muted?'':'checked'}></li>
        <li data-i18n-off>${icon('info')}<span>English</span><input class="ui-switch" id="lang" type="checkbox" role="switch" aria-label="English" ${lang()==='en'?'checked':''}></li>
        <li>${icon('bolt')}<span>蓄力鈕在左手邊</span><input class="ui-switch" id="hand" type="checkbox" role="switch" aria-label="蓄力鈕在左手邊" ${store.get('hoofbeat.hand.v1')==='left'?'checked':''}></li>
        <li><button class="row" data-go="horses">${icon('horse')}<span>我的夥伴</span><small>${prog.owned.length} / ${ROSTER.length}</small>${icon('arrow','chev')}</button></li>
        <li><button class="row" data-help>${icon('info')}<span>Race controls</span>${icon('arrow','chev')}</button></li>
        <li><button class="row" data-log>${icon('info')}<span>測試紀錄</span><small>${summary().races} 場</small>${icon('arrow','chev')}</button></li>
        <li>${icon('horse')}<span style="white-space:nowrap">About ZOOMBUD</span><small style="text-align:right">${new URL(import.meta.url).searchParams.get('v')||''} · 模型 ${MODEL_VERSION} · ${innerWidth}×${Math.round(window.visualViewport?.height??innerHeight)}/${innerHeight} · 載入 ${store.get('hoofbeat.loadtime.ranch')||'–'}/${store.get('hoofbeat.loadtime.race')||'–'} s</small></li>
        <li><button class="row danger" id="reset">${icon('reset')}<span>清除紀錄，從頭開始</span>${icon('arrow','chev')}</button></li></ul></main>
      <div class="ui-scrim" hidden></div><section class="ui-modal ui-panel deep" role="dialog" aria-modal="true" hidden><header><h2>Race controls</h2>
        <button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header><ul class="ui-list controls">
        <li><span><b>按住圓球</b><small class="note">長到黃圈放開最快；早一點也可以，碰到紅圈會爆掉</small></span></li>
        <li><span><b>左右滑</b><small class="note">換道</small></span></li>
        <li><span><b>往上滑</b><small class="note">跳過障礙</small></span></li>
        <li><span><b>衝刺鈕 ⚡</b><small class="note">漂亮放開 3 次存一段，按一下衝刺（空白鍵）</small></span></li>
        <li><span><b>撞擊鈕</b><small class="note">用同一段；對手並排時按拳頭撞牠</small></span></li>
        <li><span><b>Ⅱ / Esc</b><small class="note">暫停：繼續、重新開始、音效、離開</small></span></li></ul></section>
      <section class="ui-modal ui-panel deep plog" role="dialog" aria-modal="true" aria-label="測試紀錄" hidden><header><h2>測試紀錄</h2>
        <button class="ui-icon-btn sm plain" data-close aria-label="關閉">${icon('close','')}</button></header>
        <p class="ui-muted">每一場比賽（跑完、中途離開、重來）和錯誤都記在這支手機上。測試結束請按「複製」貼給我們，或下載檔案傳過來。</p>
        <p class="plog-sum"></p><button class="ui-btn primary block" data-log-copy>複製紀錄</button><button class="ui-btn block" data-log-save>下載檔案</button>
        ${FEEDBACK_URL?`<a class="ui-btn block" href="${esc(FEEDBACK_URL)}" target="_blank" rel="noopener">填寫回饋問卷</a>`:''}<button class="ui-btn sm block danger" data-log-clear>清除紀錄</button></section>${nav('settings')}`);
    const help=el.querySelector('.ui-modal'),scrim=el.querySelector('.ui-scrim');
    let open=null;const show=m=>{if(open)open.hidden=true;open=m;scrim.hidden=!m;if(m)m.hidden=false;};
    el.querySelector('[data-help]').onclick=()=>show(help);
    scrim.onclick=()=>show(null);el.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>show(null));
    // Playtest log (playtest.js): summary, copy / download as JSON, clear.
    const plog=el.querySelector('.plog'),paintLog=()=>{const x=summary();plog.querySelector('.plog-sum').textContent=
      `正式比賽 ${x.races} 場（跑完 ${x.finished}、第 1 名 ${x.wins}）· 錯誤 ${x.errors} 筆`;
      el.querySelector('[data-log] small').textContent=`${x.races} 場`;};
    const logText=()=>JSON.stringify({app:'ZOOMBUD',build:MODEL_VERSION,exported:new Date().toISOString(),log:readLog()},null,1);
    el.querySelector('[data-log]').onclick=()=>{paintLog();show(plog);};
    plog.querySelector('[data-log-copy]').onclick=async e=>{try{await navigator.clipboard.writeText(logText());e.target.textContent='已複製';}catch{e.target.textContent='無法複製，請改用下載';}};
    plog.querySelector('[data-log-save]').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([logText()],{type:'application/json'}));
      a.download=`hoofbeat-playtest-${new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
    plog.querySelector('[data-log-clear]').onclick=()=>{if(confirm(translate('清除這支手機上的測試紀錄？'))){clearLog();paintLog();}};
    el.querySelector('#rider-name').onchange=e=>{profile.name=e.target.value.trim()||defaults.name;saveProfile();};
    el.querySelector('#sound').onchange=e=>store.set('hoofbeat.muted',String(!e.target.checked));
    el.querySelector('#lang').onchange=e=>setLang(e.target.checked?'en':'zh');
    el.querySelector('#hand').onchange=e=>store.set('hoofbeat.hand.v1',e.target.checked?'left':'right');
    el.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{store.set(ROLE,b.dataset.role);fixCity();saveProfile();go('settings');});
    // 2026-10-14 (the user: 把 Jordan 的歷史紀錄洗掉): everything this game keeps in the browser goes (the name, the wallet, the
    // buddies, the rivals' purses, the field, the tier, the test log), but the language and the sound; the page starts as on a
    // first opening. It listed keys one by one before and left a dozen behind.
    el.querySelector('#reset').onclick=()=>{if(!confirm(translate('確定要清除所有紀錄，從頭開始（名字、關卡、夥伴、金幣、牌位、測試紀錄）？')))return;
      try{Object.keys(localStorage).filter(k=>k.startsWith('hoofbeat.')&&!['hoofbeat.lang.v1','hoofbeat.muted'].includes(k)).forEach(k=>localStorage.removeItem(k));}catch{}
      location.hash='';location.reload();};
  },
};
PAGES.collection=PAGES.horses;   // old links


// The day's first opening gives seeds and bait (2026-10-12, the user: 「每天登入獲得小麥種子和魚餌」); home() says so once.
const LOGIN='hoofbeat.login.v1',LOGIN_GIFT={seed:3,fish:9};let loginGift=false;
export function startHome(){
  if(store.get(LOGIN)!==today()){addLog({kind:'open',stars:totalStars(prog),stage:levelOf(currentLevel(prog).city)+1,buddies:prog.owned.length});   // one row a day: day 1 and on is someone who came back (playtest.js)
    store.set(LOGIN,today());for(const [k,n] of Object.entries(LOGIN_GIFT))bag={...bag,[k]:(bag[k]||0)+n};saveCare({setItem:store.set},care,bag);loginGift=true;}
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./home.css?v=r766',import.meta.url);document.head.append(css);
  if(/[?&]fps\b/.test(location.search))import('./fps.js?v=r766');   // a frame counter in the corner (fps.js)
  // Opening the game always lands on the race menu (the home page) once the cover has gone (2026-10-12, the user:
  // 「封面圖跑完應該進比賽選單」): it opened on whatever page the address named, the ranch if that was where it was closed.
  // ?debug keeps the address's page (a dev link straight to a page).
  if(location.hash&&location.hash!=='#home'&&!/[?&]debug\b/.test(location.search))history.replaceState(null,'',location.pathname+location.search);
  applyLook();window.addEventListener('hashchange',render);
  // Esc = back on app pages (the race handles its own Esc = pause)
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!['#play','#solo'].includes(location.hash)&&!['','#home'].includes(location.hash))app().querySelector('[data-back]')?.click();});
  render();
}
