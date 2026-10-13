import * as THREE from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone} from './vendor/SkeletonUtils.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
// Runtime model library (dist/assets/models/<category>/); categories mirror the source library in /models.
// horseFar / riderFar: the same rigs, names and animations with every mesh decimated in Blender (tools/lod.py: horse
// 11.6k → 5.2k triangles, rider 8.9k → 3.6k): the rivals' models on phones (createApprovedHorse far).
export const PRESENTATION_ASSETS=Object.freeze({horse:'animal_part/horse_main/HOOFBEAT_Horse_Mobile.glb',rider:'rider_part/rider_main/HOOFBEAT_Rider_Mobile.glb',
  horseFar:'animal_part/horse_main/HOOFBEAT_Horse_Mobile_Far.glb',riderFar:'rider_part/rider_main/HOOFBEAT_Rider_Mobile_Far.glb',
  horseLow:'animal_part/horse_main/HOOFBEAT_Horse_Mobile_Low.glb',riderLow:'rider_part/rider_main/HOOFBEAT_Rider_Mobile_Low.glb',riderRace:'rider_part/rider_main/HOOFBEAT_Rider_Mobile_Race.glb',   // 2026-10-11, a phone's race: Low for the rivals (seen from behind, metres off: tools/lod.py at .2 and .22), Race for the player's rider (.6: its back and helmet are all the race shows)
  coin:'environment/Coin.glb',poop:'environment/Poop.glb',relay:'environment/Relay_Canopy.glb',jump:'jump/Jump.glb'});   // a city's own dressing models: approved-environment cityModels
export const MODEL_VERSION='lib-104';  // bump when any runtime GLB is re-exported (browser cache)
export const approvedAssets=new Map();
// The pictures a scene asks for as it is built (its sky, ground and painted cards: approved-environment, far-background)
// come through this manager. They arrive after the scene itself, each one popping in, so a scene is shown only once they
// are all in (slice-app sceneReady). A manager of their own: the default one also carries the models still downloading
// in the background (home.js), which a race must not wait for.
export const scenePictures=new THREE.LoadingManager();
let loading=false;const settled=[];
scenePictures.onStart=()=>{loading=true;};
scenePictures.onLoad=()=>{loading=false;settled.splice(0).forEach(f=>f());};
export const loadsSettled=()=>loading?new Promise(r=>settled.push(r)):Promise.resolve();
let pending;
// How many model files have been asked for and how many have arrived (the start card shows it while it waits).
export const loadState={done:0,total:0};
// (lib-104, 2026-10-13: the shirt's and the saddle pads' UVs, shirt_uv.py; the two young models' own version went with it)
//   // ponytail: the two young models redone on 2026-10-12 (unprint_saddle.py) get a version of their own, so no phone fetches every other model again; drop this at the next MODEL_VERSION bump
const fetchModel=file=>{loadState.total++;return new GLTFLoader().loadAsync(new URL(`./assets/models/${file}?v=${MODEL_VERSION}`,import.meta.url).href).then(g=>{loadState.done++;return g;},e=>{loadState.total--;throw e;});};
const keyLoads={};
// One presentation model by its key, once (the ranch asks for the two it needs; a race for all of them).
const loadKey=key=>keyLoads[key]??=fetchModel(PRESENTATION_ASSETS[key]).then(gltf=>{approvedAssets.set(key,gltf);approvedAssets.set(PRESENTATION_ASSETS[key],gltf);},e=>{delete keyLoads[key];throw e;});   // by key, and by file for city dressing (preloadModels)
export const preloadKeys=keys=>Promise.all(keys.map(loadKey));
// far: the light models rivals wear: a race with nobody else in it does not wait for them.
// far=false (a race with nobody else in it): without the rivals' models. The player's Race rider is always wanted
// (2026-10-11: left out with them, stage 1 on a phone could not start: "Reload models").
export function preloadPresentation(far=true){return preloadKeys(Object.keys(PRESENTATION_ASSETS).filter(k=>far||!/(Far|Low)$/.test(k)));}
// Extra models by file (a city's dressing), kept under their file name next to the presentation set.
export const preloadModels=files=>Promise.all(files.filter(f=>!approvedAssets.has(f)).map(async f=>
  approvedAssets.set(f,await fetchModel(f))));
// Coat looks (horse coat sheet 01–09, plus the cream "Appaloosa"): the index is a horse's `coat` everywhere (buddy_<i>.webp
// portraits, home.js ROSTER). body / mane (tail: when it differs), and the markings coat() paints:
//   patches pinto white patches · socks white to the knee · blaze white face stripe · points darker lower legs ·
//   head a head colour (leopard) · spots leopard spots · roan fine white hairs · flecks small dapples.
// Pinto, Midnight and Palomino keep indexes 0–2 (saved profiles, the first three horses).
export const COATS=Object.freeze([
  {name:'Pinto',body:'#a86a4c',mane:'#4a2f24',socks:1,blaze:1,patches:1},
  {name:'Midnight',body:'#46434b',mane:'#26242a'},
  {name:'Palomino',body:'#e2b47e',mane:'#f3eadb'},
  {name:'Chestnut',body:'#bd6c43',mane:'#9e5635'},
  {name:'Snowflake',body:'#ece6e2',mane:'#e7dfda',flecks:'#b5aeb2'},
  {name:'Buckskin',body:'#d6a674',mane:'#2b2426',points:'#2f292b'},
  {name:'Buckloosa',body:'#f1e9e3',mane:'#6d3528',tail:'#4b2b25',head:'#a95b3c',spots:'#9e4c31',points:'#7e3f2b',blaze:1},
  {name:'Appaloosa',body:'#e8cba1',mane:'#2d2627',tail:'#efe3cf'},
  {name:'Roan',body:'#b2644b',mane:'#4d2c25',tail:'#3b2521',roan:'#ecd6c8',points:'#7c4533'},
  {name:'Storm',body:'#9e9aa4',mane:'#3b3740',points:'#86818c'},
  // Buddies that are not horses (2026-10-05): a GLB of their own built to the horse's contract (the 28 bones, the ten
  // clips, RiderSocket, Tack_* materials: artifacts/tripo-retarget/build_animal.py), listed here so a buddy's `coat` still
  // names its look and its portrait everywhere. Their body materials have their own names: no coat shader, no mane
  // styles; their eyes are every buddy's (EYES). forward: how much of the rider's forward lean it takes (the jump fold here, the
  // racing crouch in race-scene racePosture): the llama's neck stands straight up in front of the saddle, and from .5 up
  // her face is in its wool (seen from the side at a jump's top, in a gallop and in a sprint).
  {name:'Llama',species:'llama',model:'animal_part/llama/HOOFBEAT_Llama_Mobile.glb',forward:.3},
  {name:'Rhino',species:'rhino',model:'animal_part/rhino/HOOFBEAT_Rhino_Mobile.glb'},
  {name:'Bear',species:'bear',model:'animal_part/bear/HOOFBEAT_Bear_Mobile.glb'},
  {name:'Zebra',species:'zebra',model:'animal_part/zebra/HOOFBEAT_Zebra_Mobile.glb'},   // modelled plain: its stripes, the bear's muzzle and the cow's patches are drawn (MARKS)
  {name:'Cow',species:'cow',model:'animal_part/cow/HOOFBEAT_Cow_Mobile.glb'},
  {name:'Wolf',species:'wolf',model:'animal_part/wolf/HOOFBEAT_Wolf_Mobile.glb'},
]);
// Their models load only for a player who rides or looks at one (0.9 MB each; rivals are horses, so the _Far files stay unused).
const DEV_GROW=typeof location==='undefined'?0:+(/[?&]grow=([123])/.exec(location.search)?.[1]??0);
// stages: each coat's stage (GROW); a young model of its own is fetched only for a buddy at stage 1 (all of them when not given: dev pages).
const youngs=(coats,stages)=>coats.map((c,i)=>!stages||(stages[i]??1)===1||DEV_GROW===1?youngOf(c):null);
export const preloadBuddies=(coats,stages)=>preloadModels([...coats.map(c=>COATS[c]?.model),...youngs(coats,stages)].filter(Boolean));
// Ranch models (models/ranch/build_buddies.py): the same buddy at about 1.5k triangles, no tack, lashes or brows, same
// rig and clips: what walks about in the ranch overview, where a buddy is 40–60 px tall (ranch-view.js). One file per
// kind of animal, beside its full model.
export const ranchFile=coat=>(COATS[coat]?.model??PRESENTATION_ASSETS.horse).replace('_Mobile.glb','_Ranch.glb');
export const preloadRanchBuddies=(coats,stages)=>preloadModels([...new Set([...coats.map(ranchFile),...youngs(coats,stages).filter(Boolean)])]);   // and a young model of its own (GROW: the foal, the rhino calf): r576 left them out and the ranch of anyone with a young rhino did not load
// Eyes, set up the same way on every buddy. The model's side (artifacts/tripo-retarget/build_animal.py): a mesh `Eyes`,
// its two eyeballs where the model has them, material Buddy_Eye (the horse keeps its own three names: export_final.py
// add_eyes); the socket, lids, lash lines and brows are the model's own parts and are drawn as modelled. On the
// eyeballs livingEyes draws a dark iris and pupil with a catch-light, the white of the eye left showing in a corner,
// and a lid that blinks. EYES: one row per kind of animal (COATS `species`), any livingEyes option; angles are rad on
// the eyeball, measured round `aim`:
//   lidColor      the skin round the eye (the horse's: its coat, per COATS row)
//   open / shut   the lid's edge with the eye open (above the opening) and at the bottom of a blink (on the lower lid)
//   curve         how far that edge sags toward the corners · lash  its dark rim
//   iris.color    [middle, rim] · size  [iris, pupil]: the iris about as wide as the opening, so white shows only in a corner
//   iris.aim      where the eye looks at rest, from straight out sideways [toward the nose, up]: the middle of the
//                 opening or a little in front of it (the white then shows in the rear corner)
//   iris.turn     how far the eye swings toward what it looks at (its rider, on the ranch): .1 when the iris is no wider
//                 than the opening (more, and looking at her shows mostly white); the horse's iris is wider than its opening
//   iris.white    how far round the ball from `aim` it is white: just past the opening's far corner, when the model's
//                 lids have gaps the ball shows through (past it the ball is skin in shade); left out, the whole ball is white
const EYE_MATS=['Buddy_Eye','Horse_Eye','Horse_Iris','Horse_Pupil'];
const EYES={
  horse:{open:.95,shut:-.72,curve:.45,lash:.9,iris:{color:['#5e3822','#26140c'],size:[1,.47],aim:[.48591,-.19938],turn:.25}},   // aim: where its pupil faces point + [.2,-.1], to the digit (the horse looks as it did before EYES)
  llama:{lidColor:'#e6cfae',open:.95,shut:-.55,curve:.4,lash:.9,iris:{color:['#2a1a12','#0a0707'],size:[.9,.55],aim:[.9,-.14],turn:.1,white:.98}},   // the sheet: a small almond eye, lids above and below   // black: its pupil does not show
  rhino:{lidColor:'#a09089',open:.95,shut:-.62,curve:.25,lash:.9,iris:{color:['#4a2c1c','#2a170e'],size:[.86,.58],aim:[.72,-.18],turn:.1,white:1}},
  bear:{lidColor:'#8f5433',open:.95,shut:-.62,curve:.3,lash:.6,iris:{color:['#2a1810','#0d0705'],size:[.9,.55],aim:[.9,-.1],turn:.1,white:.98}},   // the sheet: a dark bead, no white
  cow:{lidColor:'#8a4a2a',open:.95,shut:-.62,curve:.35,lash:.9,iris:{color:['#4a2c1c','#2a170e'],size:[.9,.52],aim:[.75,-.12],turn:.1,white:1.05}},
  wolf:{lidColor:'#4f4846',open:.95,shut:-.62,curve:.3,lash:.8,iris:{color:['#3a2418','#0b0807'],size:[.92,.5],aim:[.9,-.1],turn:.1,white:.9}},   // the sheet: big dark oval eyes, almost no white (aim 1.2 looked cross-eyed: white on the outer side)
  foal:{lidColor:'#a8603c',open:.95,shut:-.62,curve:.4,lash:.9,iris:{color:['#3a2214','#140c08'],size:[.92,.52],aim:[.6,-.15],turn:.1,white:1}},   // the user's foal (GROW): a big dark eye
  rhino_calf:{lidColor:'#a8958f',open:.95,shut:-.62,curve:.25,lash:.9,iris:{color:['#4a2c1c','#2a170e'],size:[.9,.55],aim:[.72,-.18],turn:.1,white:1}},
  zebra:{lidColor:'#d9d2c8',open:.95,shut:-.62,curve:.4,lash:.9,iris:{color:['#2a1a12','#140c08'],size:[.9,.55],aim:[.6,-.15],turn:.1,white:1}}};   // white: its lids are folds with gaps between them
// Coat markings from rest-pose position/normal, so they stay painted on while the skin deforms (concept sheet):
// dark hooves, soft muzzle and the coat's markings above. Soft-toy shading like the sheet: coat lighter along the back,
// deeper toward belly and legs. The markings are drawn before <color_fragment> so the baked AO (vertex colour)
// darkens white patches and hooves too.
function coat(m,c){
  const col=k=>new THREE.Color(c[k]??'#ffffff'),key=['patches','socks','blaze','points','head','spots','roan','flecks'].filter(k=>c[k]).join('+');
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,{whiteC:{value:new THREE.Color('#f4ece2')},hoof:{value:new THREE.Color('#4a403c')},muzzle:{value:new THREE.Color('#6e5a52')},
      pointsC:{value:col('points')},headC:{value:col('head')},spotC:{value:col('spots')},roanC:{value:col('roan')},fleckC:{value:col('flecks')}});
    sh.vertexShader='varying vec3 vRest;varying vec3 vRestN;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRest=position;vRestN=normal;');
    sh.fragmentShader=`varying vec3 vRest;varying vec3 vRestN;uniform vec3 whiteC,hoof,muzzle,pointsC,headC,spotC,roanC,fleckC;
      float hP(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float nP(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hP(i),hP(i+vec3(1,0,0)),f.x),mix(hP(i+vec3(0,1,0)),hP(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hP(i+vec3(0,0,1)),hP(i+vec3(1,0,1)),f.x),mix(hP(i+vec3(0,1,1)),hP(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float crisp(float v){return smoothstep(-1.,1.,v/max(fwidth(v)*1.5,1e-4));}   // anti-aliased hard edge at v = 0
      vec2 cell(vec3 p){vec3 i=floor(p),f=fract(p);float d=9.,h=0.;   // round spots: distance to the nearest cell point, its hash
        for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=vec3(x,y,z),c=i+g,o=vec3(hP(c),hP(c+17.3),hP(c+41.7));
          float e=length(g+o-f);if(e<d){d=e;h=hP(c+3.1);}}
        return vec2(d,h);}
      `+sh.fragmentShader.replace('#include <color_fragment>',`
      vec3 p=vRest;float n=nP(p*1.9+vec3(3.1,.2,1.7))*.75+nP(p*4.6)*.25;
      float lit=smoothstep(-.7,.9,normalize(vRestN).y)*smoothstep(.7,1.6,p.y);
      diffuseColor.rgb*=mix(.84,1.1,lit);
      float legs=1.-smoothstep(.58,.66,p.y+(n-.5)*.18);            // below the knee, a ragged line
      float head=smoothstep(.95,1.1,p.z)*smoothstep(1.75,1.9,p.y);
      float face=smoothstep(.8,1.,p.z)*smoothstep(1.55,1.75,p.y);  // head and throat latch (leopard's coloured head)
      ${c.head?`diffuseColor.rgb=mix(diffuseColor.rgb,headC*mix(.9,1.05,lit),face);`:''}
      ${c.spots?`// leopard: round spots over neck, barrel and rump, none on the coloured head and legs
      vec2 sc=cell(p*4.3+vec3(1.3,4.1,2.7));
      diffuseColor.rgb=mix(diffuseColor.rgb,spotC*mix(.9,1.05,lit),crisp(mix(.2,.33,sc.y)-sc.x)*step(.3,sc.y)*(1.-legs)*(1.-face));`:''}
      ${c.roan?`// roan: fine white hairs through the body (head and legs stay solid); a flat tint once they are sub-pixel
      float rn=nP(p*30.+vec3(4.,2.,7.))*.6+nP(p*70.)*.4,fine=1.-smoothstep(.2,.45,length(fwidth(p*30.)));
      diffuseColor.rgb=mix(diffuseColor.rgb,roanC,(1.-legs)*(1.-face)*mix(.14,smoothstep(.52,.75,rn)*.42,fine));`:''}
      ${c.flecks?`// flecks: small, sparse grey dapples, most over the hindquarters (rear is −Z)
      vec2 fc=cell(p*12.+vec3(2.,5.,1.));
      diffuseColor.rgb=mix(diffuseColor.rgb,fleckC,crisp(mix(.12,.24,fc.y)-fc.x)*step(.45,fc.y)*.7*(1.-legs)*(1.-head)*mix(.3,1.,smoothstep(.5,-.5,p.z)));`:''}
      ${c.points?`diffuseColor.rgb=mix(diffuseColor.rgb,pointsC*mix(.92,1.,lit),1.-smoothstep(.5,.72,p.y+(n-.5)*.12));   // dark lower legs`:''}
      float w=0.;
      ${c.socks?`w=max(w,legs);`:''}
      float blaze=${c.blaze?`head*(1.-smoothstep(.03+.02*smoothstep(1.1,1.55,p.z),.05+.02*smoothstep(1.1,1.55,p.z),abs(p.x)))*smoothstep(.15,.45,dot(normalize(vRestN),vec3(0.,.55,.83)))`:'0.'};
      w=max(w,blaze);
      ${c.patches?`// few big patches on neck, barrel and rump (legs keep their socks), whiter toward the belly, chestnut back and rump (the chase camera's view); crisp, anti-aliased edge
      float pt=nP(p*1.15+vec3(3.1,.2,1.7))*.85+nP(p*2.3+vec3(7.,1.,4.))*.15-.1*smoothstep(1.9,2.2,p.y)+.12*smoothstep(-.2,-.8,normalize(vRestN).y)-.06*smoothstep(.3,.8,normalize(vRestN).y)-.14*smoothstep(-.4,-1.,p.z)-.5-.6*head-.6*smoothstep(1.15,.95,p.y);
      w=max(w,crisp(pt));  // head/leg fade shifts the threshold, so the edge stays crisp and rounded`:''}
      diffuseColor.rgb=mix(diffuseColor.rgb,whiteC*mix(.93,1.,lit),w);
      diffuseColor.rgb=mix(diffuseColor.rgb,muzzle,smoothstep(1.38,1.62,p.z)*(1.-blaze*.15*(1.-smoothstep(1.6,1.7,p.z))));   // horse_new4's nose ends at z 1.58 (horse_new3's: 1.68)
      {vec3 hd=normalize(vec3(0.,-.35,-1.));float al=dot(p,hd);vec3 hq=(p-hd*al)*90.+hd*al*9.;   // fine hairs: lighter and darker streaks along the lie of the coat
       diffuseColor.rgb*=1.+${FUR.Horse_Coat.streak.toFixed(3)}*(nP(hq)-.5)*2.*(1.-smoothstep(.25,.5,length(fwidth(hq))))*smoothstep(.14,.2,p.y);}
      diffuseColor.rgb=mix(diffuseColor.rgb,hoof,1.-smoothstep(.11,.14,p.y));
      #include <color_fragment>
`).replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n      material.sheenColor*=1.-.6*w;   // sheen (FUR) lifts the coloured coat, not the already-white patches')
      // Hair grain (FUR.hair): a faint bump of value noise stretched along the lie of the coat (back and down), in rest
      // space so it stays put while the skin moves. ~60 streaks per model unit (≈1.2 cm); it fades out once a streak is
      // under ~3 px, so it shows only in close-ups (stable) and never shimmers at race distance.
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      {vec3 hd=normalize(vec3(0.,-.35,-1.));float along=dot(vRest,hd);vec3 q=(vRest-hd*along)*60.+hd*along*7.;
       float h=nP(q)*.6+nP(q*2.03+7.1)*.4,fade=1.-smoothstep(.2,.35,length(fwidth(q)));
       vec2 dh=vec2(dFdx(h),dFdy(h))*${FUR.Horse_Coat.hair.toFixed(4)}*fade;
       vec3 sx=normalize(dFdx(-vViewPosition)),sy=normalize(dFdy(-vViewPosition)),r1=cross(sy,normal),r2=cross(normal,sx);
       float det=dot(sx,r1)*faceDirection;normal=normalize(abs(det)*normal-sign(det)*(dh.x*r1+dh.y*r2));}`);
  };
  m.customProgramCacheKey=()=>`hoofbeat-coat-${key}-${FUR.Horse_Coat.hair}-${FUR.Horse_Coat.streak}`;
}
// Mane and tail: one material; a coat with its own tail colour blends to it along the rest-pose length (tail is −Z).
function maneTail(m,c){
  if(!c.tail)return;
  m.onBeforeCompile=sh=>{
    sh.uniforms.tailC={value:new THREE.Color(c.tail)};
    sh.vertexShader='varying float vTailZ;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTailZ=position.z;');
    sh.fragmentShader='varying float vTailZ;uniform vec3 tailC;\n'+sh.fragmentShader.replace('#include <color_fragment>','diffuseColor.rgb=mix(diffuseColor.rgb,tailC,smoothstep(-.3,-.6,vTailZ));\n#include <color_fragment>');
  };
  m.customProgramCacheKey=()=>'hoofbeat-tail';
}
// Saddle pad (fit_tack.py): diamond quilting like the sheet, drawn from rest position so it stays put while skinned.
// Markings of the other animals, from rest position (model units: y up, z toward the nose), so they stay painted on
// while the skin deforms; drawn before <color_fragment> so the baked AO darkens them too. MARKS: material → [cache key,
// GLSL that sets diffuseColor.rgb from p]; colours linear. The portraits paint the same (animal_portrait.py).
const NOISE=`float segM(vec3 p,vec3 a,vec3 b){vec3 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
float hM(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float nM(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hM(i),hM(i+vec3(1,0,0)),f.x),mix(hM(i+vec3(0,1,0)),hM(i+vec3(1,1,0)),f.x),f.y),mix(mix(hM(i+vec3(0,0,1)),hM(i+vec3(1,0,1)),f.x),mix(hM(i+vec3(0,1,1)),hM(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float cM(float v){return smoothstep(-1.,1.,v/max(fwidth(v)*1.5,1e-4));}`;
function markings(m,[key,glsl]){m.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec3 vRest;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRest=position;');
    sh.fragmentShader='varying vec3 vRest;\n'+NOISE+'\n'+sh.fragmentShader.replace('#include <color_fragment>',`{vec3 p=vRest;${glsl}}\n#include <color_fragment>`);};
  m.customProgramCacheKey=()=>'hoofbeat-'+key;m.needsUpdate=true;}
const MARKS={};   // none since 2026-10-11: every buddy but the horse wears a skin map carried over from Tripo's textured copy of its model (build_animal.py A['skin'], tools/skin_map.py). A buddy without one can still be painted here: {Material_Name:[key, GLSL on p, the rest position]}
function quilt(m){
  m.onBeforeCompile=sh=>{
    sh.vertexShader='varying vec3 vQ;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvQ=position;');
    sh.fragmentShader='varying vec3 vQ;\n'+sh.fragmentShader.replace('#include <color_fragment>',`
      vec2 q=vec2(vQ.z+vQ.y,vQ.z-vQ.y)*13.;vec2 g=abs(fract(q)-.5)/max(fwidth(q),1e-4);
      diffuseColor.rgb*=1.-.35*(1.-clamp(min(g.x,g.y)-.6,0.,1.));
      #include <color_fragment>`);
  };
  m.customProgramCacheKey=()=>'hoofbeat-quilt';
}
// Living eyes (stable close-ups): a lid painted over the eye parts that blinks every few seconds, and on a buddy an
// iris and pupil drawn on the eyeball that turn toward something (update's target, world space). All in rest (bind)
// space like the coat markings, so it rides the Head bone. The two eyes are told apart by rest x (either side of their
// middle); lid heights are in each eye's half size, from `measure`'s rest bounds (1 = top of the eye, -1 = bottom).
//   paint    material names that get the lid (and on a buddy the iris: `iris` merges them into one material)
//   open     lid height, open · from / shut  where a blink's lid starts (the rider's: at her lash arc) and stops (the
//            horse's just above its lower lid: the dark rim left between them is the closed eye's line) · curve  how far the lid edge sags toward the corners · low  lower lid · lash  dark rim
//   arc      the rider's own upper-lash arc (a mesh): slides down with the lid (no lower than arcStop) and flattens into
//            the closed eye's line
//   lights   the catch-light material, hidden while the lid is down (it's geometry standing off the eye)
//   iris     a buddy's (EYES): {color: [middle, rim], size: [iris, pupil] (rad), aim: where the eye looks at rest, from
//            straight out sideways [toward the nose, up] (rad), turn: max gaze swing (rad), white: how far round the
//            ball from `aim` it is white (rad; past that it is the lid's colour in shade, like the socket it sits in)}. Its eyeball sits in the
//            model's own socket (lids, lash lines and brows are meshes), so only the iris, pupil, catch-light and the
//            blinking lid are drawn here; open / shut / curve are then angles (rad) round the aimed axis.
const EYE_UNI=`
varying vec3 vEye;uniform float eyeMid,lidAt,lidCurve,lidLow,lash,blink,arcStop,whiteTo;uniform vec2 irisR;uniform vec3 eyeA0,eyeA1,eyeC0,eyeC1,eyeS0,eyeS1,lidColor,look0,look1,irisIn,irisOut,pupilC,ballC;\n`;
export function livingEyes(root,{measure,paint,arc,lights,lidColor,open,from=open,shut=-1.15,curve=0,low=-9,lash=0,arcStop=-9,iris}){
  const parts=[],glow=[];root.traverse(o=>{if(!o.isSkinnedMesh)return;if([...paint,arc].includes(o.material.name))parts.push(o);if(o.material.name===lights)glow.push(o);});
  if(!parts.length)return {update(){}};
  const rest=names=>parts.filter(o=>names.includes(o.material.name)).flatMap(o=>{const p=o.geometry.attributes.position;return Array.from({length:p.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,i));});
  const pts=rest(measure),all=new THREE.Box3().setFromPoints(pts),mid=(all.min.x+all.max.x)/2,side=v=>v.x>mid?0:1;
  const box=[new THREE.Box3(),new THREE.Box3()];for(const v of pts)box[side(v)].expandByPoint(v);
  const C=box.map(b=>b.getCenter(new THREE.Vector3())),S=box.map(b=>b.getSize(new THREE.Vector3()).multiplyScalar(.5));
  // A buddy's eye meshes are balls, whole or with the hidden inner side cut off (the horse's, the rhino's): a ball's
  // centre is its radius in from its outer pole (a cut ball's box centre sits further out, which would stretch every
  // angle measured from it).
  if(iris)for(const k of [0,1]){const R=(S[k].y+S[k].z)/2;C[k].x=k?box[k].min.x+R:box[k].max.x-R;S[k].x=R;}
  // Where each eye looks at rest: iris.aim, from straight out sideways (z is toward the nose).
  const rest0=iris?[1,-1].map(s=>{const [yaw,pitch]=iris.aim;return new THREE.Vector3(s*Math.cos(pitch)*Math.cos(yaw),Math.sin(pitch),Math.cos(pitch)*Math.sin(yaw));}):[];
  const col=c=>new THREE.Color(c),u={eyeMid:{value:mid},eyeC0:{value:C[0]},eyeC1:{value:C[1]},eyeS0:{value:S[0]},eyeS1:{value:S[1]},
    eyeA0:{value:(rest0[0]||new THREE.Vector3(1,0,0)).clone()},eyeA1:{value:(rest0[1]||new THREE.Vector3(-1,0,0)).clone()},lidAt:{value:open},arcStop:{value:arcStop},lidCurve:{value:curve},lidLow:{value:low},lash:{value:lash},blink:{value:0},lidColor:{value:col(lidColor)},
    look0:{value:(rest0[0]||new THREE.Vector3()).clone()},look1:{value:(rest0[1]||new THREE.Vector3()).clone()},
    irisIn:{value:col(iris?.color[0])},irisOut:{value:col(iris?.color[1])},irisR:{value:new THREE.Vector2(...iris?.size??[])},whiteTo:{value:iris?.white??9},pupilC:{value:col('#070404')},ballC:{value:col('#ffffff')}};
  const hook=(m,isArc)=>{m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
    sh.vertexShader=EYE_UNI+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vEye=position;${isArc?`{bool r=position.x>eyeMid;vec3 c=r?eyeC0:eyeC1,s=r?eyeS0:eyeS1;float yn=(position.y-c.y)/s.y;
        transformed.y=mix(transformed.y,c.y+s.y*(max(lidAt,arcStop)+(yn-.9)*max(1.-blink,.2)),step(.001,blink));}`:''}`);
    if(isArc)return;
    sh.fragmentShader=EYE_UNI+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float eyeLid;{bool r=vEye.x>eyeMid;vec3 c=r?eyeC0:eyeC1,s=r?eyeS0:eyeS1,q=(vEye-c)/s;
      vec2 e=q.xy;float bend=1.,deep=0.;                                                          // across and up from the eye's middle
      ${iris?`// iris and a round pupil round the look axis, the white of the eye (ballC) outside it, lighter and warmer low in the iris
      vec3 n=normalize(vEye-c),L=normalize(r?look0:look1),rt=normalize(cross(vec3(0.,1.,0.),L)),up=cross(L,rt);
      float cz=dot(n,L),a=acos(clamp(cz,-1.,1.)),ax=atan(dot(n,rt),cz),ay=atan(dot(n,up),cz),fa=fwidth(a)+.01;
      float irisM=1.-smoothstep(irisR.x-fa,irisR.x+fa,a),pr=a/irisR.y,pupM=1.-smoothstep(1.-fwidth(pr)-.04,1.+fwidth(pr)+.04,pr);
      vec3 ir=mix(irisIn,irisOut,smoothstep(irisR.x*.3,irisR.x,a))*mix(1.35,.7,smoothstep(-.4,.4,ay/irisR.x));
      diffuseColor.rgb=mix(mix(ballC,ir,irisM),pupilC,pupM);
      float shine=1.-smoothstep(.8,1.,length(vec2(ax-(r?1.:-1.)*.25,ay-.35))/.11);   // catch-light, up and behind the pupil (rt runs backward on the first eye)
      {vec3 A=r?eyeA0:eyeA1,ar=normalize(cross(vec3(0.,1.,0.),A));float az=dot(n,A);             // the lid's frame: angles from the aimed axis (rad), x toward the nose
       e=vec2(atan(dot(n,ar),az)*(r?-1.:1.),atan(dot(n,cross(A,ar)),az));deep=smoothstep(whiteTo-.1,whiteTo+.1,acos(clamp(az,-1.,1.)));}
      bend=1.-1.35*blink;   // the lid edge turns up a little at the corners as it shuts, to lie along the lower lid`:''}
      float y=e.y+lidCurve*bend*e.x*e.x,aa=fwidth(y)*1.5+.02;
      diffuseColor.rgb*=1.-.5*smoothstep(lidAt-.8,lidAt,y);                                       // the lid's shadow
      diffuseColor.rgb*=1.-lash*max(smoothstep(lidAt-.22,lidAt-.08,y),smoothstep(.7,1.,blink));   // dark lid rim; shut, whatever still shows under the lid is the closed eye's dark line
      eyeLid=clamp(smoothstep(lidAt-aa,lidAt+aa,y)+1.-smoothstep(lidLow-aa,lidLow+aa,e.y),0.,1.);
      diffuseColor.rgb=mix(diffuseColor.rgb,lidColor,eyeLid);${iris?'diffuseColor.rgb=mix(mix(diffuseColor.rgb,vec3(1.),shine*(1.-eyeLid)),lidColor*.4,deep);eyeLid=max(eyeLid,deep);':''}}`)   // deep: past iris.white the ball is skin in shade, and matt, whatever the lid does
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n      roughnessFactor=mix(roughnessFactor,.7,eyeLid);')
      .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n      totalEmissiveRadiance*=1.-eyeLid;');};
    m.customProgramCacheKey=()=>`hoofbeat-eye-${isArc?'arc':iris?'iris':'lid'}`;return m;};
  const mats=new Map();
  for(const o of parts){const n=o.material.name,key=iris&&n!==arc?'iris':n;
    if(!mats.has(key))mats.set(key,hook(o.material.clone(),n===arc));o.material=mats.get(key);}
  const eye=parts[0],head=eye.skeleton.bones.find(b=>b.name==='Head');
  const headInv=eye.skeleton.boneInverses[eye.skeleton.bones.indexOf(head)];
  const M=new THREE.Matrix4(),t=new THREE.Vector3(),q=new THREE.Quaternion(),I=new THREE.Quaternion(),want=new THREE.Vector3();
  let clock=0,next=1+Math.random()*2,again=false;
  return {uniforms:u,update(dt,target){
    // Blink: .07 s down, a beat, .12 s up; every 2.5–5.5 s, one in four a quick double.
    clock+=dt;let b=0;const k=clock-next;
    if(k>.22){clock=0;again=!again&&Math.random()<.25;next=again?.1:2.5+Math.random()*3;}
    else if(k>0)b=k<.07?k/.07:k<.1?1:1-(k-.1)/.12;
    u.blink.value=b;u.lidAt.value=b?from+(shut-from)*b:open;for(const o of glow)o.visible=b<.35;
    if(!iris)return;
    // Gaze: the target in rest space (world = mesh · bind⁻¹ · head · boneInverse · bind · rest), each eye swung toward
    // it by at most iris.turn, eased so the eyes glide.
    if(target)M.copy(eye.matrixWorld).multiply(eye.bindMatrixInverse).multiply(head.matrixWorld).multiply(headInv).multiply(eye.bindMatrix).invert();
    for(const e of [0,1]){want.copy(rest0[e]);
      if(target){t.copy(target).applyMatrix4(M).sub(C[e]).normalize();q.setFromUnitVectors(rest0[e],t);
        const a=2*Math.acos(Math.min(1,Math.abs(q.w)));want.applyQuaternion(I.identity().slerp(q,Math.min(1,iris.turn/Math.max(a,1e-4))));}
      u['look'+e].value.lerp(want,1-Math.exp(-dt*10)).normalize();}
  },
  center(out){   // world point between the eyes (matrices current)
    M.copy(eye.matrixWorld).multiply(eye.bindMatrixInverse).multiply(head.matrixWorld).multiply(headInv).multiply(eye.bindMatrix);
    return out.copy(C[0]).add(C[1]).multiplyScalar(.5).applyMatrix4(M);}};
}
// The player's look, chosen in the Stable: coat 0 chestnut pinto · 1 black · 2 palomino, and gear colours.
// Rivals (variants 1, 2) keep their coats unless the player took one, in which case that rival gets the pinto.
// GEAR: the recolourable parts (material names shared by the race horse/rider and the stable rider); each list starts
// with the authored palette colour (models/style/palette.json), so a missing entry in PLAYER_LOOK.gear means "as built".
// The shirt's patterns (2026-10-13, the user's five tiles, references/shirts/sheet.png; 同一個花紋可以換五種顏色): each tile
// is kept as a mask, not as colours (assets/rider/shirt_<id>.png: red = how dark the shirt's colour is there, green = how
// much of the accent), so the colour worn (GEAR Rider_Shirt) tints any of them; the accent is white, or navy on a light
// shirt. size: one tile on the shirt, m [across, up] (the shirt's UVs are metres: artifacts/hoofbeat-rider/shirt_uv.py).
// Later the same day the user sent the five in black and white (references/shirts/bw_*.png: thin stripes, stars, wide stripes,
// dots, plaid), which replaced the coloured sheet: black is the accent, grey part of it, white the shirt's own colour.
export const SHIRTS=Object.freeze([{id:'pin',name:'細條紋',size:[.3,.3]},{id:'stars',name:'星星',size:[.2,.178]},{id:'stripes',name:'條紋',size:[.22,.22]},{id:'dots',name:'點點',size:[.18,.18]},{id:'plaid',name:'格紋',size:[.2,.2]}]);
const shirtMaps={};export const PATTERNED=Object.freeze(['Rider_Shirt','Tack_Pad']),PAD_TILE=1.6;
// (Leather pressed with the same patterns, a bump and a darker shade, was made and dropped the same day: the user, 壓花不要.
// The seat's and the straps' UVs are still in the files.)   // PATTERNED: the parts that can wear one (PLAYER_LOOK.patterns {material: id})
export function shirtPattern(m,id,scale=1){const s=SHIRTS.find(x=>x.id===id);   // scale: the tile's size on this part (PAD_TILE on the saddle pad, a bigger cloth)
  if(!s){if(m.map){m.map=null;m.needsUpdate=true;}return;}
  const t=shirtMaps[id+scale]??=new THREE.TextureLoader().load(new URL(`./assets/rider/shirt_${id}.png?v=2`,import.meta.url).href);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.NoColorSpace;t.repeat.set(1/s.size[0]/scale,1/s.size[1]/scale);
  m.map=t;m.needsUpdate=true;if(m.userData.shirt)return;m.userData.shirt=true;const before=m.onBeforeCompile;
  m.onBeforeCompile=(sh,r)=>{before?.call(m,sh,r);sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
    vec4 shirtMask=texture2D(map,vMapUv);vec3 shirtTint=diffuseColor.rgb;float shirtLight=step(.55,dot(shirtTint,vec3(.2126,.7152,.0722)));
    diffuseColor.rgb=mix(shirtTint*shirtMask.r,mix(vec3(1.),vec3(.03,.05,.14),shirtLight),shirtMask.g);
  #endif`);};const key=m.customProgramCacheKey?.bind(m);m.customProgramCacheKey=()=>(key?.()??'')+'|shirt';}
// 2026-10-13 (the user: 動物的配件顏色只留黑白灰咖啡色，騎士配件顏色只留 UI guideline 黃綠黑白紅): a buddy's tack in black, white, grey
// and brown; the rider's clothes were the interface's five colours for an hour, then (the user: 騎士改成橄欖綠，棕色，米色，黑色，白色，酒紅) six of riding wear: olive, brown, beige, black, white, wine. A part's first
// colour is the one it is built in, but for GEAR_BASE: the pants are built beige, which is none of the five, so their first
// (white) is painted on when nothing is chosen.
export const GEAR_BASE=Object.freeze({});   // (none now: every part's first colour is the one it is built in)
export const GEAR=Object.freeze([
  {mat:'Tack_Saddle',name:'鞍座',colors:['#6b3f26','#1f1c1a','#f4f1ea','#8a8a8a']},
  {mat:'Tack_Pad',name:'鞍墊',colors:['#3d3a3a','#f4f1ea','#111010','#6b3f26']},
  {mat:'Tack_Bridle',name:'皮具',colors:['#4a2c1e','#1f1c1a','#f4f1ea','#8a8a8a']},
  {mat:'Rider_Helmet',name:'頭盔',colors:['#3a3a3f','#f6f5f1','#dccab2','#6b4a2e','#6b7a3a','#7a2334']},
  {mat:'Rider_Shirt',name:'上衣',colors:['#f6f5f1','#1c1c1e','#dccab2','#6b4a2e','#6b7a3a','#7a2334']},
  {mat:'Rider_Pants',name:'褲子',colors:['#dccab2','#f6f5f1','#1c1c1e','#6b4a2e','#6b7a3a','#7a2334']},
]);
export const PLAYER_LOOK={coat:0,gear:{},hair:'classic'};
// Mane and tail styles: the meshes ride in the horse GLB (build_horse_from_frame.py HAIRS); a horse shows one. Each of
// the player's buddies wears its own (set on its card in the stable: home.js profile.manes; not sold), passed as
// `hair` per relay leg or through PLAYER_LOOK.hair; every other horse wears the classic one.
export const HAIR=Object.freeze([{id:'classic',mesh:'ManeTail',name:'經典鬃毛'},{id:'long',mesh:'ManeTailLong',name:'長鬃毛與長尾'},{id:'short',mesh:'ManeTailShort',name:'短鬃毛與短尾'}]);
// Short coat: the physical material's sheen (a soft velvet lobe) lights the fine hair along the silhouette and over the
// neck, shoulder and quarter curves, without adding any texture. sheenColor = the coat/mane colour lifted `lift` toward
// white, so every coat keeps its own tone. Knobs: sheen (strength), sheenRoughness (spread), lift; hair = the coat's
// hair-grain bump strength (coat(); keep it faint, 0 turns it off).
//   gloss: [strength, tightness, lie] the groomed band of light across the lie of the hair (gloss()); lie: the hair's
//   direction in rest space (the coat runs back and down, mane and tail hang).   streak: fine light and dark hairs in
//   the coat's colour (coat(); close-ups only, like the grain).
// 2026-10-06 (the user, with the concept sheets: the buddies and the rider should read as soft matte clay, as drawn): the
// groomed-coat look is taken down: a faint sheen only, no hair grain, no streaks, no band of gloss (was sheen 1 / .7,
// hair .3, streak .1, gloss .1).
export const FUR={Horse_Coat:{sheen:.3,sheenRoughness:.8,lift:.5,hair:0,streak:0,gloss:[0,56,'0.,-.35,-1.']},Horse_ManeTail:{sheen:.25,sheenRoughness:.8,lift:.4,gloss:[0,60,'0.,-1.,-.25']}};
// Groomed gloss: a brushed coat shows a soft band of light running across the lie of its hair, and combed hair a
// bright one (Kajiya–Kay: brightest where the hair lies square to the half-way between sun and eye). Added to the
// material's own shader (after coat() / maneTail()), from the scene's first directional light; the hair's lie follows
// the skin (skinMatrix).
function gloss(m){
  const [strength,tight,lie]=FUR[m.name].gloss;
  also(m,'gloss'+FUR[m.name].gloss.join(),sh=>{
    sh.vertexShader='varying vec3 vHairT;\n'+sh.vertexShader.replace('#include <skinnormal_vertex>',`#include <skinnormal_vertex>
      {vec3 hT=vec3(${lie});
      #ifdef USE_SKINNING
        hT=(skinMatrix*vec4(hT,0.)).xyz;
      #endif
      vHairT=(modelViewMatrix*vec4(hT,0.)).xyz;}`);
    sh.fragmentShader='varying vec3 vHairT;\n'+sh.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS>0
      {vec3 gL=directionalLights[0].direction,gT=normalize(vHairT-normal*dot(vHairT,normal)),gH=normalize(gL+normalize(vViewPosition));
       float gt=dot(gT,gH),band=pow(max(0.,1.-gt*gt),${tight.toFixed(1)})*smoothstep(-.1,.55,dot(normal,gL));
       reflectedLight.directSpecular+=directionalLights[0].color*band*${strength.toFixed(3)}*mix(vec3(1.),diffuseColor.rgb,.4);}
      #endif`);
  });
}
const WHITE=new THREE.Color('#ffffff');
function fur(m){   // MeshStandardMaterial → MeshPhysicalMaterial with the same settings (and the coat shader hook)
  const p=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(p,m);
  p.defines={STANDARD:'',PHYSICAL:''};p.sheen=FUR[m.name].sheen;p.sheenRoughness=FUR[m.name].sheenRoughness;return p;
}   // gear: {material name: '#rrggbb'}
// Galloping seat: RacePose (the authored half-seat crouch) blended with RidePose (sitting up, reins by the saddle,
// elbows out): this much of the crouch unless the caller says (the race: more the harder the horse runs).
const RACE_SEAT=.4;
// GROW (2026-10-12, the user: a buddy has three stages, 「小時候到長大會換毛」, the model as it is): what each stage does to
// the look of a buddy. Stage 2 is the buddy as it was made. ?grow=1|2|3 (dev) shows the player's buddy at that stage.
//   scale  its size (the whole buddy, rider and all) · head / chest  those bones' scale: a young one's head is big for its
//   body, a grown one is deep through the chest · thin  a young one's body is narrow (the whole buddy across)
//   fur  an animal's own fur multiplied by this tint · lift  an emissive share that lifts the darks: flat and downy
//   tint, by  a horse's body and mane pulled toward this colour · rough, sheen, coat  matt young, glossy grown
//   hair  a horse's mane and tail style
// A young one differs by animal (`by`, the user going through them one by one, 2026-10-12): the bear, the wolf and the
// llama have the big head and narrow body; the cow and the zebra are only small and pale, the cow without horns (buds: a
// round bump of its skin's colour where each stood); the horse and the rhino have a young model of their own (the user's
// foal and rhino calf, built to the same rig by build_animal.py): `model` the file, `as` its species (its EYES row), at
// the size it was built (scale 1) and in its own colours (plain). tone: the foal takes the grown horse's colours (the user:
// 「小馬的顏色要處理」): its map is multiplied by the coat's body colour over the map's own average there (coat), and its
// mane and tail (hair: those meshes, given a material of their own) by the coat's mane colour over theirs. The map's
// shading and darker legs stay; a coat's white markings are not on a foal.
export const GROW=Object.freeze({1:{scale:.8,fur:'#e2dbd2',lift:.14,rough:1,sheen:1,coat:0,
    by:{bear:{head:1.46,thin:.84},wolf:{head:1.46,thin:.84},llama:{head:1.46,thin:.84},cow:{buds:['CowHorns']},zebra:{lift:0,fur:'#f0ece6'},
      horse:{model:'animal_part/foal/HOOFBEAT_Foal_Mobile.glb',as:'foal',scale:1,plain:1,tone:{coat:'#af5e40',mane:'#573530',hair:['FoalMane','FoalTail']}},rhino:{model:'animal_part/rhino_calf/HOOFBEAT_Rhino_Calf_Mobile.glb',as:'rhino_calf',scale:1,plain:1}}},
  2:{scale:1,hair:'classic'},3:{scale:1.1,chest:1.08,tint:'#6b4a36',by:.12,fur:'#e4d9cc',rough:.4,sheen:.15,coat:.6,hair:'long'}});
// The young model a coat has (preloadBuddies youngs).  was: loaded with every buddy shown, whatever its stage;
// load by stage once levels drive the look (1.2 MB each).
const youngOf=coat=>GROW[1].by[COATS[coat]?.species??'horse']?.model;
// The separate pieces of a horn mesh (a rhino's two horns, a cow's): for each, its vertices, the way it points (from the
// body's middle), its foot (the fifth of it nearest the body: centre and width).
function pieces(o,bodyMesh){const p=o.geometry.attributes.position,ix=o.geometry.index,n=p.count,V=new THREE.Vector3();
  const par=Array.from({length:n},(_,i)=>i),find=x=>{while(par[x]!==x)x=par[x]=par[par[x]];return x;},seen=new Map();
  for(let i=0;i<n;i++){const k=`${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;if(seen.has(k))par[find(i)]=find(seen.get(k));else seen.set(k,i);}
  for(let t=0;t<(ix?ix.count:n);t+=3){const a=ix?ix.getX(t):t,b=ix?ix.getX(t+1):t+1,c=ix?ix.getX(t+2):t+2;par[find(a)]=find(b);par[find(b)]=find(c);}
  const parts=new Map();for(let i=0;i<n;i++){const k=find(i);(parts.get(k)||parts.set(k,[]).get(k)).push(i);}
  const centre=new THREE.Box3().setFromBufferAttribute(bodyMesh?.geometry.attributes.position||p).getCenter(new THREE.Vector3());
  return [...parts.values()].filter(l=>l.length>=12).map(list=>{const mid=new THREE.Vector3();for(const i of list)mid.add(V.fromBufferAttribute(p,i));mid.divideScalar(list.length);const d=mid.clone().sub(centre).normalize();
    let lo=Infinity,hi=-Infinity;for(const i of list){const a=V.fromBufferAttribute(p,i).dot(d);if(a<lo)lo=a;if(a>hi)hi=a;}
    const base=new THREE.Vector3();let c=0,wide=0;for(const i of list)if(V.fromBufferAttribute(p,i).dot(d)<lo+(hi-lo)*.2){base.add(V);c++;}base.divideScalar(c||1);
    for(const i of list)if(V.fromBufferAttribute(p,i).dot(d)<lo+(hi-lo)*.2){V.sub(base);V.addScaledVector(d,-V.dot(d));wide=Math.max(wide,V.length());}
    return {list,d,base,wide};});}
const bodyOf=(content,o)=>{let b=null;content.traverse(x=>{if(!b&&x.isMesh&&x!==o&&/Body/.test(x.name))b=x;});return b;};
// A horn made a bud (GROW buds): the horn goes, and a dome of the skin's colour sits where it stood, hung on the Head bone.
// The colour is the skin's map read where the body is nearest the horn's foot (a sphere's own UVs land anywhere on the
// map), times the material's tint; a plain material, since the body's shader paints its markings by rest position.
function nub(o,content){const bodyMesh=bodyOf(content,o),skin=bodyMesh?.material||o.material,V=new THREE.Vector3();
  const sample=at=>{const map=skin.map;if(!map?.image||!bodyMesh)return skin.color.clone();const bp=bodyMesh.geometry.attributes.position,uv=bodyMesh.geometry.attributes.uv;let best=Infinity,k=0;
    for(let i=0;i<bp.count;i++){const e=V.fromBufferAttribute(bp,i).distanceToSquared(at);if(e<best){best=e;k=i;}}
    try{const im=map.image,c=document.createElement('canvas');c.width=c.height=1;const g=c.getContext('2d'),u=uv.getX(k),v=uv.getY(k);
      g.drawImage(im,Math.floor(u*im.width),Math.floor((map.flipY?1-v:v)*im.height),1,1,0,0,1,1);const [r,gg,b]=g.getImageData(0,0,1,1).data;return new THREE.Color(r/255,gg/255,b/255).convertSRGBToLinear().multiply(skin.color);}catch{return skin.color.clone();}};
  const head=content.getObjectByName('Head')||o.parent;content.updateMatrixWorld(true);o.visible=false;
  for(const {d,base,wide} of pieces(o,bodyMesh)){const R=wide*1.25,mat=new THREE.MeshPhysicalMaterial({color:sample(base),roughness:skin.roughness,sheen:skin.sheen??0,sheenRoughness:skin.sheenRoughness??.8,sheenColor:skin.sheenColor?.clone()??new THREE.Color(0),emissive:skin.emissive?.clone()??new THREE.Color(0)}),m=new THREE.Mesh(new THREE.SphereGeometry(R,18,12),mat);m.castShadow=m.receiveShadow=true;
    const at=o.localToWorld(base.clone().addScaledVector(d,-R*.62));head.add(m);m.position.copy(head.worldToLocal(at));}}
export function createApprovedHorse(variant=0,coatOverride=null,far=false,hair=null,bare=false,ranch=false,stage=null){   // ranch: its ranch model (ranchFile)   // bare: the buddy with nobody on it (the ranch: it does not wait for the rider's model)   // coatOverride, hair: a relay leg's own coat and mane style (else the look's)
  const player=variant===0,coatIx=coatOverride??(player?PLAYER_LOOK.coat:variant===PLAYER_LOOK.coat?0:variant),base0=COATS[coatIx]??COATS[0],G0=GROW[stage??(player?DEV_GROW||PLAYER_LOOK.stage:0)]??GROW[2],G=G0.by?{...G0,...G0.by[base0.species??'horse']}:G0,base=G.model?{name:base0.name,species:G.as,model:G.model,forward:base0.forward}:base0;   // a young model of its own stands in for the buddy's
  const pull=(c,to,by)=>'#'+new THREE.Color(c).lerp(new THREE.Color(to),by).getHexString(),look=G.tint&&!base.species?{...base,body:pull(base.body,G.tint,G.by),mane:pull(base.mane,G.tint,G.by*.6),...(base.tail?{tail:pull(base.tail,G.tint,G.by*.6)}:null),}:base;   // a horse's coat at this stage
  const horse=approvedAssets.get(G.model??(ranch?ranchFile(coatIx):null)??look.model??(far==='low'?'horseLow':far===true?'horseFar':'horse')),rider=bare?{scene:new THREE.Group(),animations:[]}:approvedAssets.get(far==='low'?'riderLow':far==='race'?'riderRace':far?'riderFar':'rider');   // far: true (the Far pair) | 'low' (the Low pair) | 'race' (the full buddy, the Race rider)
  if(!horse||!rider)throw new Error('Approved horse/rider assets not loaded');
  const root=new THREE.Group(),scene=new THREE.Group(),fit=new THREE.Group(),orientation=new THREE.Group();
  root.add(scene);scene.add(fit);fit.add(orientation);orientation.rotation.y=Math.PI;
  const content=clone(horse.scene),riderContent=clone(rider.scene),seat=new THREE.Group();
  const wears=(HAIR.find(h=>h.id===(G!==GROW[2]&&G.hair?G.hair:player?hair??PLAYER_LOOK.hair:'classic'))??HAIR[0]).mesh;{const spare=[];content.traverse(o=>{if(/^ManeTail/.test(o.name)&&o.name!==wears)spare.push(o);});spare.forEach(o=>o.removeFromParent());}   // one hair style a horse: every other mane mesh in the file goes, listed in HAIR or not (two on one horse share a material and its shader is patched twice: it fails to compile)
  orientation.add(content,seat);seat.add(riderContent);if(ranch&&G.model)content.traverse(o=>{if(o.isMesh&&/^Tack_/.test([].concat(o.material)[0]?.name))o.visible=false;});   // out on the ranch nobody is saddled (the _Ranch models have no tack; a young model of its own is the race one)
  seat.scale.setScalar(1/G.scale);   // the rider is one size on every buddy at every stage (2026-10-12, the user: 不要縮小): the buddy's own scale is taken back out of her
  const materials=new Map();
  for(const asset of [content,riderContent])asset.traverse(o=>{
    if(!o.isMesh)return;
    const copy=m=>{if(!materials.has(m))materials.set(m,FUR[m.name]?fur(m):m.clone());return materials.get(m)};
    o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
    o.frustumCulled=!o.isSkinnedMesh;o.castShadow=true;o.receiveShadow=true;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      // Player: the sheet's chestnut pinto. Rivals: black and palomino with the same socks/blaze.
      if(m.name==='Horse_Coat'){m.map=null;m.color.set(look.body);coat(m,look);gloss(m);m.needsUpdate=true;}
      if(m.name==='Horse_ManeTail'){m.color.set(look.mane);maneTail(m,look);gloss(m);}
      if(player&&(PLAYER_LOOK.gear[m.name]??GEAR_BASE[m.name]))m.color.set(PLAYER_LOOK.gear[m.name]??GEAR_BASE[m.name]);
      if(player&&m.name==='Rider_Shirt')shirtPattern(m,PLAYER_LOOK.patterns?.Rider_Shirt);
      if(m.name==='Tack_Pad'){if(player&&PLAYER_LOOK.patterns?.Tack_Pad)shirtPattern(m,PLAYER_LOOK.patterns.Tack_Pad,PAD_TILE);else quilt(m);}   // a patterned pad has no stitching drawn over it
      if(MARKS[m.name])markings(m,MARKS[m.name]);
      // Toy rider (rider_clean.py): every part carries its sheet colour; the player's gear comes from the Stable,
      // the rivals wear team shirts (Willow green, Luna pink, Hazel orange, Rio blue).
      if(m.name==='Rider_Shirt'&&!player)m.color.set(['#ffffff','#4d9a58','#c23b66','#e08a2e','#4467c4'][variant]);
      // Matte vinyl (palette roughness): broad soft highlight from the sky light, no small hot spot.
      if(m.name==='Horse_Coat')m.roughness=.9;if(m.name==='Horse_ManeTail')m.roughness=.9;   // clay: was .62
      if(FUR[m.name])m.sheenColor.copy(m.color).lerp(WHITE,FUR[m.name].lift);
      // the stage (GROW): a horse's coat and mane take its finish; an animal's own fur (a textured material that is not tack, eye or rider) its tint too
      if(G!==GROW[2]&&!G.plain){const fur=FUR[m.name]||look.species&&!/^(Tack_|Rider_|Buddy_Eye|Horse_)/.test(m.name);
        if(fur){if(look.species&&G.fur){if(m.map)m.color.set(G.fur);else m.color.lerp(new THREE.Color(G.tint),G.by);}m.roughness=G.rough;if(G.lift)m.emissive.copy(m.color).multiplyScalar(G.lift);if('sheen' in m){m.sheen=G.sheen;m.clearcoat=G.coat;m.clearcoatRoughness=.45;}}}
      // Lash lines and brows (the model's own parts): the upper lash keeps its near-black on every coat, the lower one
      // and the brow are the coat darkened.
      if(m.name==='Horse_LashLow')m.color.set(look.head??look.body).multiplyScalar(.5);
      if(m.name==='Horse_Brow')m.color.set(look.head??look.body).multiplyScalar(.3);
    }
  });
  for(const [bone,k] of [['Head',G.head],['Chest',G.chest]])if(k)content.getObjectByName(bone)?.scale.setScalar(k);   // its proportions at this stage (the skin follows the bone)
  if(G.thin)content.scale.x*=G.thin;
  if(G.tone){   // the map gives only how light each place is (over its own average: `coat`, `mane`), the grown coat gives the colour
    const lum=c=>{const k=new THREE.Color(c);return .2126*k.r+.7152*k.g+.0722*k.b;},shade=(m,avg)=>{m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
      {vec4 tx=texture2D(map,vMapUv);diffuseColor.rgb*=min(pow(dot(tx.rgb,vec3(.2126,.7152,.0722))/${avg.toFixed(4)},.75),1.5);}
      #endif`);};m.customProgramCacheKey=()=>'hoofbeat-tone-'+avg.toFixed(4);m.needsUpdate=true;return m;},own=new Map();
    content.traverse(o=>{if(!o.isMesh||!o.material?.map||/^(Tack_|Buddy_Eye)/.test(o.material.name))return;const hair=G.tone.hair.includes(o.name),key=o.material.uuid+hair;
      if(!own.has(key)){const m=o.material.clone();m.color.set(hair?base0.tail??base0.mane:base0.body);own.set(key,shade(m,lum(hair?G.tone.mane:G.tone.coat)));}o.material=own.get(key);});}
  for(const n of G.buds||[]){const o=content.getObjectByName(n);if(o)nub(o,content);}
  // Eyes (EYES): iris, pupil and catch-light drawn on the eyeballs, a lid of the coat's (or the animal's own) colour that blinks.
  const eyes=livingEyes(content,{measure:EYE_MATS,paint:EYE_MATS,lidColor:look.head??look.body,...EYES[look.species??'horse']});
  // The rider GLB is authored seated on this horse (build_rider_seat.py): its origin is the RiderSocket rest point,
  // soles on the stirrups and hands on the reins. RidePose = standing/sheet seat, RacePose = galloping half-seat,
  // JumpPose = fold over the fence; each runs in its own mixer so same-named bones never bind to the horse.
  const riderMixer=new THREE.AnimationMixer(riderContent),poses={};
  for(const name of ['RidePose','RacePose','JumpPose']){
    const clip=rider.animations.find(a=>a.name===name);if(!clip){if(bare)continue;throw new Error('Approved rider lacks '+name);}
    clip.tracks=clip.tracks.filter(t=>!t.name.endsWith('.scale'));   // the poses scale no bone (the tracks are 1 ± 1e-5). Left in, the mixer wrote them over the race look's own bone scales (race-scene RIDER_HEAD, RIDER_WAIST) as soon as the pose weights moved: the head was small on the grid and full size once galloping (2026-10-05, the user)
    poses[name]=riderMixer.clipAction(clip).play();poses[name].setEffectiveWeight(name==='RidePose'?1:0);
  }
  riderMixer.update(0);
  let race=0;
  function riderPose(running,jump=0,seat=RACE_SEAT){  // eases into the half-seat once galloping; the jump fold follows the jump curve
    if(bare)return;jump*=look.forward??1;race+=((running?1:0)-race)*.12;const r=race*(1-jump)*seat;   // seat: how much half-seat (rest: the upright RidePose)
    poses.JumpPose.setEffectiveWeight(jump);poses.RacePose.setEffectiveWeight(r);poses.RidePose.setEffectiveWeight(1-jump-r);
    riderMixer.update(0);
  }
  const socket=content.getObjectByName('RiderSocket');
  if(!socket)throw new Error('Horse RiderSocket missing');
  root.updateMatrixWorld(true);
  const restSocket=new THREE.Quaternion();socket.getWorldQuaternion(restSocket);
  const restLocal=new THREE.Quaternion();orientation.getWorldQuaternion(restLocal);restLocal.invert().multiply(restSocket).invert();
  const inv=new THREE.Matrix4(),socketLocal=new THREE.Matrix4(),pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3();
  function updateAttachment(){  // the seat follows the socket's motion relative to its rest pose
    root.updateMatrixWorld(true);inv.copy(orientation.matrixWorld).invert();socketLocal.multiplyMatrices(inv,socket.matrixWorld);socketLocal.decompose(pos,rot,scale);
    seat.position.copy(pos);seat.quaternion.copy(rot).multiply(restLocal);
    root.updateMatrixWorld(true);
  }
  updateAttachment();
  const bounds=new THREE.Box3().setFromObject(content,true),size=bounds.getSize(new THREE.Vector3());
  fit.scale.setScalar(3.3/(look.species||G!==GROW[2]?2.885:size.y));fit.position.y=-bounds.min.y*fit.scale.y;scene.scale.setScalar(G.scale);   // G.scale: its size at this stage (GROW), the whole buddy (the rider is scaled back, seat above); set after the fit, which would measure it away on a horse   // 2.885: the horse's height, so the other animals keep their own size beside it (the rhino is 61% as tall)
  // Authored Gallop has no root displacement. Existing runner controls own all movement.
  // The clips key every bone's scale (always 1): on the bones GROW sizes, those tracks go, once per model file, or the clip
  // would put a young one's head back to the grown size on its first frame.
  if(!horse.sized){horse.sized=true;for(const a of horse.animations)a.tracks=a.tracks.filter(t=>!/^(Head|Chest)\.scale$/.test(t.name));}
  const mixer=new THREE.AnimationMixer(content),clips={run:horse.animations.find(a=>a.name==='Gallop'),idle:horse.animations.find(a=>a.name==='Idle'),walk:horse.animations.find(a=>a.name==='Walk'),trot:horse.animations.find(a=>a.name==='Trot')};   // walk: the stable's arrival (stable-view ARRIVE)
  if(!clips.run)throw new Error('Approved horse lacks Gallop');
  const bindings={Front_Upper:['ForeUpper.L','ForeUpper.R'],Front_Lower:['ForeLower.L','ForeLower.R'],Front_Hoof:['ForeHoof.L','ForeHoof.R'],Hind_Upper:['HindUpper.L','HindUpper.R'],Hind_Lower:['HindLower.L','HindLower.R'],Hind_Hoof:['HindHoof.L','HindHoof.R'],Neck:['NeckLower']};
  const poseBones=Object.entries(bindings).flatMap(([role,names])=>names.map(name=>({role,bone:content.getObjectByName(name.replaceAll('.','')),axis:new THREE.Vector3(1,0,0),sign:1}))).filter(b=>b.bone?.isBone);
  return {root,scene,content,mixer,materials,clips,poseBones,fromAsset:true,descriptor:{animation:{runSpeed:1}},animationRole:null,modelId:'approved-horse',species:look.species,forward:look.forward??1,updateAttachment,eyes,riderPose,riderMixer,riderContent,seat,fit,orientation};
}

// Race build (race-scene, never the stable): a horse + rider is 31 skinned parts, each its own draw, shadow draw and
// skeleton update. Here it becomes 5 meshes on 2 skeletons. The coat, mane/tail, eyes and eye catch-lights keep their
// own shaders (coat markings, tail colour, living eyes; the three eye parts share a material, so they become one mesh)
// and share one horse skeleton (a llama or a rhino has only the eyes of these: one mesh, like the horse's). Every other part (tack, saddle pad, the whole rider) becomes one mesh on one skeleton
// holding both rigs' bones: each part's colour × vertex colour, roughness, metalness, glow and the pad's quilting ride
// on its vertices, so it renders as before. Positions are baked through each part's bind matrix (the rider's differs
// from the horse's). Only the coat, mane/tail and the merged mesh cast shadows. → the new geometries and material, for
// the caller to dispose. The model's eyes.update no longer applies (the race never calls it).
const OWN_SHADER=new Set(['Horse_Coat','Horse_ManeTail','Horse_Eye','Buddy_Eye',...Object.keys(MARKS)]),RACE_GLOSS=1;   // clay: the race no longer shines the parts up (was .78)
// Race look, the horse and rider (the city mock-ups, references/style/city_*.webp: a soft velvet toy with a full,
// stranded tail), added to the coat / mane-tail / merged shaders in the race only (the stable keeps the plain ones):
//   fuzz     light caught along the silhouette, like a short nap ([coat, hair, rider and tack], × the surface colour)
//   lift     the shadow side lifted with a warm tone (soft bounce light, no hard dark side)
//   strands  mane and tail: light and dark locks along the hair's length, about 8 across the tail (they fade out once a lock is under ~3 px)
//   full     the tail's locks pushed out along their normals (model units): a slightly fuller tail (the first horse's
//            tail was a few flat strips and took .05; horse_new3's is a thick fall of locks already)
export const RACE_FUR={fuzz:[.55,.35,.22],lift:[.1,.08,.06],strands:0,full:.02};   // strands 0: plain hair (drawn strand lines were tried and dropped; real strands want a painted texture)
//   blaze    at full gallop (a sprint, an apple, the top gait) the lit rim turns gold and brighter: uBlaze 0–1, one
//            value per model (model.blaze, set by race-scene), so the eye sees who is flying without reading anything
const soft=i=>`{float fz=pow(1.-abs(dot(normal,normalize(vViewPosition))),2.5);totalEmissiveRadiance+=mix(diffuseColor.rgb,vec3(1.,.82,.45),.65*uBlaze)*(${RACE_FUR.fuzz[i].toFixed(3)}*fz*(1.+1.5*uBlaze))+diffuseColor.rgb*${RACE_FUR.lift[i].toFixed(3)}*vec3(1.,.86,.74);}`;
const also=(m,key,fn)=>{const base=m.onBeforeCompile,k=m.customProgramCacheKey();m.onBeforeCompile=function(sh,r){base.call(this,sh,r);fn(sh);};m.customProgramCacheKey=()=>k+key+JSON.stringify(RACE_FUR);m.needsUpdate=true;};
export function mergeForRace(model){
  const own=[],plain=[];
  for(const asset of [model.content,model.riderContent])asset.traverse(o=>{if(o.isSkinnedMesh)(OWN_SHADER.has(o.material.name)||o.material.map?own:plain).push(o);});   // a material with a skin map (build_animal A['skin']) keeps it: the merged mesh has one flat material
  const skin=own[0]?.skeleton,made=[],blaze=model.blaze={value:0};   // blaze: RACE_FUR blaze, 0–1 (race-scene sets it)
  const add=(g,material,skeleton,bindMatrix,parent,cast)=>{const m=new THREE.SkinnedMesh(g,material);m.bind(skeleton,bindMatrix);
    m.frustumCulled=false;m.castShadow=cast;m.receiveShadow=true;parent.add(m);made.push(g);return m;};
  const eyes=own.filter(o=>/_Eye$/.test(o.material.name));
  if(eyes.length>1){add(mergeGeometries(eyes.map(o=>o.geometry)),eyes[0].material,skin,eyes[0].bindMatrix,eyes[0].parent,false);eyes.forEach(o=>o.removeFromParent());}
  for(const o of own.filter(o=>!eyes.includes(o)||eyes.length<2)){if(o.skeleton.bones[0]===skin.bones[0])o.bind(skin,o.bindMatrix);o.castShadow=!eyes.includes(o);}   // one skeleton for the horse's own parts; a part of the rider's that keeps its material (the patterned shirt, 2026-10-13) stays on the rider's rig: bound to the horse's it was drawn under the horse
  // Race look (the race concept art): a glossier toy than the stable's matte vinyl. Coat and mane/tail are this model's
  // own materials; the merged parts get RACE_GLOSS × their roughness below.
  for(const o of own){const m=o.material;
    if(m.name==='Horse_Coat'){m.roughness=.88;also(m,'race-coat',sh=>{sh.uniforms.uBlaze=blaze;sh.fragmentShader='uniform float uBlaze;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+soft(0));});}
    if(m.name==='Horse_ManeTail'){m.roughness=.88;also(m,'race-hair',sh=>{
      sh.vertexShader='varying vec3 vHairP;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nvHairP=position;transformed+=normal*${RACE_FUR.full.toFixed(4)}*smoothstep(-.3,-.6,position.z);`);
      sh.uniforms.uBlaze=blaze;sh.fragmentShader=`uniform float uBlaze;varying vec3 vHairP;
      float tH(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float tN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(tH(i),tH(i+vec3(1,0,0)),f.x),mix(tH(i+vec3(0,1,0)),tH(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(tH(i+vec3(0,0,1)),tH(i+vec3(1,0,1)),f.x),mix(tH(i+vec3(0,1,1)),tH(i+vec3(1,1,1)),f.x),f.y),f.z);}
      `+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      {vec3 hd=vec3(.005,.986,.168);float along=dot(vHairP,hd);vec3 across=(vHairP-hd*along)*22.,q=across+hd*along*1.4;   // hd: the way the tail hangs in the rest pose (measured)
       float st=smoothstep(.3,.7,tN(q)*.65+tN(across*2.3+hd*along*1.4+5.3)*.35),fade=1.-smoothstep(.3,.6,length(fwidth(across)));
       diffuseColor.rgb*=1.+${(RACE_FUR.strands*2).toFixed(3)}*(st-.5)*fade;}`).replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+soft(1));});}}
  // One skeleton for both rigs: the horse's bones, then the rider's (each part's skinIndex offset by its rig's start).
  const rigs=[];for(const o of plain)if(!rigs.includes(o.skeleton.bones[0]))rigs.push(o.skeleton.bones[0]);
  const bones=[],inverses=[],start=new Map();
  for(const first of rigs){const sk=plain.find(o=>o.skeleton.bones[0]===first).skeleton;start.set(first,bones.length);bones.push(...sk.bones);inverses.push(...sk.boneInverses.map(m=>m.clone()));}
  const n=plain.reduce((a,o)=>a+o.geometry.attributes.position.count,0),at={position:3,normal:3,color:3,skinIndex:4,skinWeight:4,rm:2,glow:3,quilt:1,rest:3};
  const buf=Object.fromEntries(Object.entries(at).map(([k,w])=>[k,k==='skinIndex'?new Uint16Array(n*w):new Float32Array(n*w)])),index=[];
  const v=new THREE.Vector3(),nm=new THREE.Matrix3(),c=new THREE.Color();let base=0;
  for(const o of plain){
    const g=o.geometry,A=g.attributes,m=o.material,count=A.position.count,off=start.get(o.skeleton.bones[0]),glow=m.emissive.clone().multiplyScalar(m.emissiveIntensity);
    nm.getNormalMatrix(o.bindMatrix);
    for(let i=0;i<count;i++){const j=base+i;
      v.fromBufferAttribute(A.position,i);buf.rest.set([v.x,v.y,v.z],j*3);v.applyMatrix4(o.bindMatrix);buf.position.set([v.x,v.y,v.z],j*3);
      v.fromBufferAttribute(A.normal,i).applyMatrix3(nm).normalize();buf.normal.set([v.x,v.y,v.z],j*3);
      c.copy(m.color);if(A.color&&m.vertexColors)c.multiply({r:A.color.getX(i),g:A.color.getY(i),b:A.color.getZ(i)});buf.color.set([c.r,c.g,c.b],j*3);
      buf.skinIndex.set([0,1,2,3].map(k=>A.skinIndex.getComponent(i,k)+off),j*4);buf.skinWeight.set([0,1,2,3].map(k=>A.skinWeight.getComponent(i,k)),j*4);
      buf.rm.set([Math.max(.06,m.roughness*RACE_GLOSS),m.metalness],j*2);buf.glow.set([glow.r,glow.g,glow.b],j*3);buf.quilt[j]=m.name==='Tack_Pad'?1:0;
    }
    if(g.index)for(const k of g.index.array)index.push(k+base);else for(let i=0;i<count;i++)index.push(base+i);
    base+=count;o.removeFromParent();
  }
  const g=new THREE.BufferGeometry();for(const [k,w] of Object.entries(at))g.setAttribute(k,new THREE.BufferAttribute(buf[k],w));g.setIndex(index);
  const material=new THREE.MeshStandardMaterial({name:'Race_Merged',vertexColors:true,side:THREE.DoubleSide});
  material.onBeforeCompile=sh=>{
    sh.vertexShader='attribute vec2 rm;attribute vec3 glow,rest;attribute float quilt;varying vec2 vRM;varying vec3 vGlow,vQ;varying float vQuilt;\n'+
      sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRM=rm;vGlow=glow;vQ=rest;vQuilt=quilt;');
    sh.uniforms.uBlaze=blaze;sh.fragmentShader='uniform float uBlaze;varying vec2 vRM;varying vec3 vGlow,vQ;varying float vQuilt;\n'+sh.fragmentShader
      .replace('#include <roughnessmap_fragment>','float roughnessFactor=vRM.x;').replace('#include <metalnessmap_fragment>','float metalnessFactor=vRM.y;')
      .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=vGlow;\n'+soft(2))
      .replace('#include <color_fragment>',`vec2 q=vec2(vQ.z+vQ.y,vQ.z-vQ.y)*13.;vec2 w=abs(fract(q)-.5)/max(fwidth(q),1e-4);
        diffuseColor.rgb*=1.-vQuilt*.35*(1.-clamp(min(w.x,w.y)-.6,0.,1.));
        #include <color_fragment>`);   // quilt(): the saddle pad's diamond stitching, from rest position (no branch: fwidth)
  };
  material.customProgramCacheKey=()=>'hoofbeat-race-merged'+JSON.stringify(RACE_FUR);
  add(g,material,new THREE.Skeleton(bones,inverses),new THREE.Matrix4(),model.content,true);
  return [...made,material];
}
