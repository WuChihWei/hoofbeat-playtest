import * as THREE from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone} from './vendor/SkeletonUtils.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
// Runtime model library (dist/assets/models/<category>/); categories mirror the source library in /models.
// horseFar / riderFar: the same rigs, names and animations with every mesh decimated in Blender (tools/lod.py: horse
// 11.6k → 5.2k triangles, rider 8.9k → 3.6k): the rivals' models on phones (createApprovedHorse far).
export const PRESENTATION_ASSETS=Object.freeze({horse:'animal_part/horse_main/HOOFBEAT_Horse_Mobile.glb',rider:'rider_part/rider_main/HOOFBEAT_Rider_Mobile.glb',
  horseFar:'animal_part/horse_main/HOOFBEAT_Horse_Mobile_Far.glb',riderFar:'rider_part/rider_main/HOOFBEAT_Rider_Mobile_Far.glb',
  coin:'environment/Coin.glb',relay:'environment/Relay_Canopy.glb',jump:'jump/Jump.glb'});   // a city's own dressing models: approved-environment cityModels
export const MODEL_VERSION='lib-64';  // bump when any runtime GLB is re-exported (browser cache)
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
const fetchModel=file=>{loadState.total++;return new GLTFLoader().loadAsync(new URL(`./assets/models/${file}?v=${MODEL_VERSION}`,import.meta.url).href).then(g=>{loadState.done++;return g;},e=>{loadState.total--;throw e;});};
const keyLoads={};
// One presentation model by its key, once (the ranch asks for the two it needs; a race for all of them).
const loadKey=key=>keyLoads[key]??=fetchModel(PRESENTATION_ASSETS[key]).then(gltf=>{approvedAssets.set(key,gltf);approvedAssets.set(PRESENTATION_ASSETS[key],gltf);},e=>{delete keyLoads[key];throw e;});   // by key, and by file for city dressing (preloadModels)
export const preloadKeys=keys=>Promise.all(keys.map(loadKey));
// far: the light models rivals wear (and ?lod=far): a race with nobody else in it does not wait for them.
export function preloadPresentation(far=true){return preloadKeys(Object.keys(PRESENTATION_ASSETS).filter(k=>far||!k.endsWith('Far')));}
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
]);
// Their models load only for a player who rides or looks at one (0.9 MB each; rivals are horses, so the _Far files stay unused).
export const preloadBuddies=coats=>preloadModels(coats.map(c=>COATS[c]?.model).filter(Boolean));
// Ranch models (models/ranch/build_buddies.py): the same buddy at about 1.5k triangles, no tack, lashes or brows, same
// rig and clips: what walks about in the ranch overview, where a buddy is 40–60 px tall (ranch-view.js). One file per
// kind of animal, beside its full model.
export const ranchFile=coat=>(COATS[coat]?.model??PRESENTATION_ASSETS.horse).replace('_Mobile.glb','_Ranch.glb');
export const preloadRanchBuddies=coats=>preloadModels([...new Set(coats.map(ranchFile))]);
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
  llama:{lidColor:'#f1dfcb',open:.95,shut:-.55,curve:.45,lash:.9,iris:{color:['#17110f','#0a0707'],size:[.84,.4],aim:[.9,-.14],turn:.1}},   // black: its pupil does not show
  rhino:{lidColor:'#a09089',open:.95,shut:-.62,curve:.25,lash:.9,iris:{color:['#4a2c1c','#2a170e'],size:[.86,.58],aim:[.72,-.18],turn:.1,white:1}}};   // white: its lids are folds with gaps between them
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
export const GEAR=Object.freeze([
  {mat:'Tack_Saddle',name:'鞍座',colors:['#6b3f26','#2b2522','#26407a','#9a6a3e','#7a2e2e']},
  {mat:'Tack_Pad',name:'鞍墊',colors:['#3d3a3a','#f4f1ea','#2b3d8f','#c23b66','#3c9a5a']},
  {mat:'Tack_Bridle',name:'皮具',colors:['#4a2c1e','#2b2522','#8a5a36','#26407a','#7a2e2e']},
  {mat:'Rider_Helmet',name:'頭盔',colors:['#3a3a3f','#2b3d8f','#c23b66','#f4f1ea','#3c9a5a']},
  {mat:'Rider_Shirt',name:'上衣',colors:['#f6f5f1','#2f6fd6','#d2455f','#3c9a5a','#f2b705']},
  {mat:'Rider_Pants',name:'褲子',colors:['#dccab2','#f4f1ea','#2b2522','#8a6a4a','#26407a']},
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
export function createApprovedHorse(variant=0,coatOverride=null,far=false,hair=null,bare=false,ranch=false){   // ranch: its ranch model (ranchFile)   // bare: the buddy with nobody on it (the ranch: it does not wait for the rider's model)   // coatOverride, hair: a relay leg's own coat and mane style (else the look's)
  const player=variant===0,coatIx=coatOverride??(player?PLAYER_LOOK.coat:variant===PLAYER_LOOK.coat?0:variant),look=COATS[coatIx]??COATS[0];
  const horse=approvedAssets.get(ranch?ranchFile(coatIx):look.model??(far?'horseFar':'horse')),rider=bare?{scene:new THREE.Group(),animations:[]}:approvedAssets.get(far?'riderFar':'rider');
  if(!horse||!rider)throw new Error('Approved horse/rider assets not loaded');
  const root=new THREE.Group(),scene=new THREE.Group(),fit=new THREE.Group(),orientation=new THREE.Group();
  root.add(scene);scene.add(fit);fit.add(orientation);orientation.rotation.y=Math.PI;
  const content=clone(horse.scene),riderContent=clone(rider.scene),seat=new THREE.Group();
  const wears=(HAIR.find(h=>h.id===(player?hair??PLAYER_LOOK.hair:'classic'))??HAIR[0]).mesh;{const spare=[];content.traverse(o=>{if(/^ManeTail/.test(o.name)&&o.name!==wears)spare.push(o);});spare.forEach(o=>o.removeFromParent());}   // one hair style a horse: every other mane mesh in the file goes, listed in HAIR or not (two on one horse share a material and its shader is patched twice: it fails to compile)
  orientation.add(content,seat);seat.add(riderContent);
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
      if(player&&PLAYER_LOOK.gear[m.name])m.color.set(PLAYER_LOOK.gear[m.name]);
      if(m.name==='Tack_Pad')quilt(m);
      // Toy rider (rider_clean.py): every part carries its sheet colour; the player's gear comes from the Stable,
      // the rivals wear team shirts (Willow green, Luna pink, Hazel orange, Rio blue).
      if(m.name==='Rider_Shirt'&&!player)m.color.set(['#ffffff','#4d9a58','#c23b66','#e08a2e','#4467c4'][variant]);
      // Matte vinyl (palette roughness): broad soft highlight from the sky light, no small hot spot.
      if(m.name==='Horse_Coat')m.roughness=.9;if(m.name==='Horse_ManeTail')m.roughness=.9;   // clay: was .62
      if(FUR[m.name])m.sheenColor.copy(m.color).lerp(WHITE,FUR[m.name].lift);
      // Lash lines and brows (the model's own parts): the upper lash keeps its near-black on every coat, the lower one
      // and the brow are the coat darkened.
      if(m.name==='Horse_LashLow')m.color.set(look.head??look.body).multiplyScalar(.5);
      if(m.name==='Horse_Brow')m.color.set(look.head??look.body).multiplyScalar(.3);
    }
  });
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
  fit.scale.setScalar(3.3/(look.species?2.885:size.y));fit.position.y=-bounds.min.y*fit.scale.y;   // 2.885: the horse's height, so the other animals keep their own size beside it (the rhino is 61% as tall)
  // Authored Gallop has no root displacement. Existing runner controls own all movement.
  const mixer=new THREE.AnimationMixer(content),clips={run:horse.animations.find(a=>a.name==='Gallop'),idle:horse.animations.find(a=>a.name==='Idle')};
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
const OWN_SHADER=new Set(['Horse_Coat','Horse_ManeTail','Horse_Eye','Buddy_Eye']),RACE_GLOSS=1;   // clay: the race no longer shines the parts up (was .78)
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
  for(const asset of [model.content,model.riderContent])asset.traverse(o=>{if(o.isSkinnedMesh)(OWN_SHADER.has(o.material.name)?own:plain).push(o);});
  const skin=own[0]?.skeleton,made=[],blaze=model.blaze={value:0};   // blaze: RACE_FUR blaze, 0–1 (race-scene sets it)
  const add=(g,material,skeleton,bindMatrix,parent,cast)=>{const m=new THREE.SkinnedMesh(g,material);m.bind(skeleton,bindMatrix);
    m.frustumCulled=false;m.castShadow=cast;m.receiveShadow=true;parent.add(m);made.push(g);return m;};
  const eyes=own.filter(o=>/_Eye$/.test(o.material.name));
  if(eyes.length>1){add(mergeGeometries(eyes.map(o=>o.geometry)),eyes[0].material,skin,eyes[0].bindMatrix,eyes[0].parent,false);eyes.forEach(o=>o.removeFromParent());}
  for(const o of own.filter(o=>!eyes.includes(o)||eyes.length<2)){o.bind(skin,o.bindMatrix);o.castShadow=!eyes.includes(o);}
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
