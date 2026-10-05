// Stable stage (stable page mock): a flat painted barn plate behind (CSS, .st-bg), in front of it a 3D close-up
// of the rider standing at the horse's head, the horse lowering its head to them. Fixed camera so the 3D pair
// keeps matching the plate's perspective; a shadow-only floor grounds them on it.
// One fixed shot holds both (the rider at the left edge): react('brush' | 'feed') plays in place, the rider crouches
// for the brush / carrot and stands; brush: combs the forelock and mane while the horse bows; feed: holds the carrot
// out, the horse stretches down and eats it in one bite. show() rebuilds the horse so PLAYER_LOOK changes apply.
// Between acts the horse has moods (MOOD below): it lies down when left alone, gets up on wake(), rears on cheer().
import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {clone} from '../vendor/SkeletonUtils.js';
import {preloadPresentation,preloadBuddies,createApprovedHorse,livingEyes,MODEL_VERSION,PLAYER_LOOK,GEAR} from '../approved-assets.js?v=r267';
import {applyLook,LOOK} from '../visual-style.js?v=r267';

// Stable-only models, loaded on first visit: the rigged standing rider (rider_showcase_rig.py: Stand / Pickup / Comb /
// Offer) and what it picks up.
const url=f=>new URL(`../assets/models/${f}?v=${MODEL_VERSION}`,import.meta.url).href,load=f=>new GLTFLoader().loadAsync(url(f));
let pending;
const loadStable=()=>pending??=Promise.all([load('rider_part/rider_main/Rider_Showcase.glb'),load('stable/Scrub_Brush.glb'),load('stable/Carrot.glb')])
  .then(([rider,brush,carrot])=>({rider,brush:brush.scene,carrot:carrot.scene}));

// Horse faces -X (toward the rider), turned a little to camera; rider in front of its muzzle facing back at it.
const HORSE={x:2.1,z:-.9,yaw:Math.PI/2+.45},RIDER={x:-.08,z:.27,yaw:Math.PI/2-.6};   // in front of the bowed face: brush at the forehead, carrot at the mouth
// Horse neck/head poses, absolute from the rig's rest: pitch (radians about each bone's X, + = down) and `turn`
// (NeckLower .6 / NeckUpper .4, bent toward the rider). The toy rider's hands top out ~1.8 m, so the horse lowers its
// whole neck like grazing and lets the head hang with it. Never lift the head against the bowed neck (negative Head):
// that crushes the poll, and the mane strands behind the ears fold inside out (sheen flares them pale grey).
const POSE={idle:{NeckLower:.12,NeckUpper:.07,Head:.04,turn:0},
  brush:{NeckLower:.75,NeckUpper:.35,Head:0,turn:0},    // bowed in one arch (not all at the neck root, which folded the
  feed:{NeckLower:.75,NeckUpper:.35,Head:0,turn:0}};     // breast in), the head just hanging: forehead to the brush, mouth to the carrot
// A llama or a rhino (createApprovedHorse species) at the brush and the carrot: its own bow, and how much further back
// it stands (x). The llama bows like the horse, but its neck starts low on its chest and carries its head a long way
// forward: it stands back, or its forehead is in her helmet. The rhino's head hangs below her hands: it lifts its chin to them
// (negative angles; its short neck takes that, the horse's does not).
const BUDDY={llama:{x:.25},rhino:{x:.45,bow:{NeckLower:-.3,NeckUpper:-.15,Head:-.1,turn:0}}};
const NECK=['NeckLower','NeckUpper','Head'],TURN={NeckLower:-.6,NeckUpper:-.4};   // turn sign: -Z bends toward the rider
// Carrot (Carrot.glb local): gripped at the leaf base, its tip swung toward the horse's mouth every frame.
const CARROT={grip:[.1,.14,0],tip:[-.25,.03,0],scale:.85};   // Carrot.glb local: leaf base, tip; .85: tip reaches the mouth
const GRIP=[.017,.204,.007];   // the glove's centre in the HandL bone's frame (rider_showcase_rig.py prints it)
const BRUSH={scale:.55,strap:.3,face:.55,settle:.3};   // Scrub_Brush.glb: strap at +Y .3, bristles down; face: aim 55% muzzle → poll;
// settle: s into Comb (the crossfade from Pickup) after which the brush stays fixed in the hand
// The plate is flat and height-fit (cover), so the camera keeps a fixed vertical fov: the painted floor stays under
// the hooves on every screen shape. tilt: deg down; bg: plate x (0..1).
// Width-fit: the camera's distance to the horse is fill / aspect (clamped to dist), so the rider's helmet to the
// horse's tail spans ~3–97% of the width on every screen (a 390×844 phone: 18.3 m; 9:16: 15 m). x centres the pair;
// height = floor × distance keeps the hooves on the painted floor line.
const CAM={x:1.466,fill:8.44,dist:[12,22],floor:.1393,tilt:1.4,fov:30,bg:.82};
// After the 1 s Pickup: the rider clip, how long it runs, and the horse's extra neck/head pose meanwhile (radians).
// Brush: the horse bows its forelock to the brush. Feed: neck down, head stretched out so its mouth meets the carrot.
const PICKUP=1.0,ACTS={
  brush:{clip:'Comb',prop:'brush',hold:2.6,peak:.9},
  feed:{clip:'Offer',prop:'carrot',hold:1.8,bite:1.0,peak:1.0},   // bite / peak: s after Pickup
};

// Moods, as bone poses over the Idle clip (the horse GLB has no clips for them). A pose entry is one of:
//   [x, y, z]      radians about the bone's own axes, from rest (spine, neck, head, tail; on a leg +x swings it back);
//   {dir:[x,y,z]}  a leg segment pointed that way, or {to:[x,y,z]} at that point, in the horse's own space (x its
//                  left = the side the camera sees, y up from the hooves' ground, z forward; hip ~0.3 wide), solved
//                  against the skeleton once per horse (solve());
//                  s: the leg segment's own size (1 = as modelled), whatever the segments above it are scaled to
//   Pelvis {y, x, roll}: its height (share of rest), tip (+ nose down) and roll (+ left side up).
// Left alone restAfter s (10), the horse lies down (front first, like a horse), eyes open and blinking; any touch (wake) gets it up,
// hind end first. cheer: a full bar → it rears for joy, forelegs pawing, then drops back.
// Leg segments: fore = upper arm · forearm · (knee) cannon · pastern; hind = thigh · gaskin · (hock) cannon · pastern.
// Lying, like a horse resting awake (sternal, the reference photo): hips low on the straw, rolled a little onto the
// right, the chest a little higher, neck up, the head level and turned to look at the rider (watch). Forearms flat on the straw pointing
// forward, cannons folded back under them. Hind legs, laid over the reference photo (same body length, buttock and
// ground; its joints as shares of the body length from the buttock): stifle 15% forward and high in the haunch, the
// gaskin straight down and back to the hock on the straw under the buttock, the cannon 15% forward along the ground,
// the hoof down under the fetlock. The rump stays on the pelvis (HAUNCH), so the thigh turns under a round haunch
// instead of dragging it; the thigh points level and forward (no more, or its skin folds out as a flap under the
// saddle). The photo's gaskin is twice its cannon, this model's the other way round, so the segments are resized (s:
// thigh 0.55, gaskin 1.35, cannon 0.45, hoof 0.8). lieFix smooths what creases are left.
const LIE={Pelvis:{y:.28,x:-.15,roll:.15},Spine:[0,-.1,0],Chest:[0,-.12,0],
  NeckLower:[-.05],Head:[.15],Tail02:{dir:[1,-.1,.3]},   // the tail falls behind the rump to the floor, then lies on it swept round to the near side, along the hind leg (onFloor keeps it on the floor; further back it would leave the screen)
  ForeUpperL:{dir:[.05,-1,-.15]},ForeLowerL:{dir:[0,-.05,1]},ForeCannonL:{dir:[0,-.08,-1]},ForeHoofL:{dir:[0,-.35,-.9]},
  ForeUpperR:{dir:[-.05,-1,-.1]},ForeLowerR:{dir:[.05,-.03,1]},ForeCannonR:{dir:[0,-.1,-1]},ForeHoofR:{dir:[0,-.35,-.9]},
  HindUpperL:{s:.55,to:[.45,.45,-.3]},HindLowerL:{s:1.35,to:[.5,.11,-.8]},HindCannonL:{s:.45,to:[.5,.13,-.55]},HindHoofL:{s:.8,to:[.5,-.05,-.4]},
  HindUpperR:{s:.55,to:[-.2,.45,-.3]},HindLowerR:{s:1.35,to:[0,.11,-.82]},HindCannonR:{s:.45,to:[.15,.12,-.6]},HindHoofR:{s:.8,to:[.2,-.05,-.46]}};
// Rearing (the body up ~40°): hind legs slanted under the hips, hocks bent, hooves planted; forearms forward and up with
// the knees sharply bent, cannons hanging, hooves curled; the neck up and forward, the face down toward the nose.
const REAR={Pelvis:{y:.95,x:-.72},
  HindUpperL:{dir:[0,-.96,.28]},HindLowerL:{dir:[0,-.85,-.52]},HindCannonL:{dir:[0,-.97,.25]},HindHoofL:{dir:[0,-.6,.8]},
  HindUpperR:{dir:[0,-.96,.28]},HindLowerR:{dir:[0,-.85,-.52]},HindCannonR:{dir:[0,-.97,.25]},HindHoofR:{dir:[0,-.6,.8]},
  ForeUpperL:[0],ForeLowerL:[-.94],ForeCannonL:[2],ForeHoofL:[1.1],ForeUpperR:[.15],ForeLowerR:[-.8],ForeCannonR:[1.9],ForeHoofR:[1.1],
  NeckLower:[.8],NeckUpper:[.1],Head:[.45],Tail02:[.5]};
const MOOD={restAfter:[10,10],down:1.6,up:.9,rear:[.45,1.1,.55]};   // s: lying down / getting up (each end), rear up / paw / down

// Leg joints (the rig's rest heights, model units, ground 0): fore — shoulder 1.48 (ForeUpper) · elbow 1.10 (ForeLower) ·
// knee 0.73 (ForeCannon) · fetlock 0.24 (ForeHoof) · hoof; hind — hip 1.53 (HindUpper) · stifle 1.01 (HindLower) · hock
// 0.62 (HindCannon) · fetlock 0.24 (HindHoof) · hoof. The GLB's automatic weights blend each joint over a long stretch
// (the hock over 0.46–0.93, the fetlock from the ground to 0.37), so a folded leg bends like a hose and the hoof squashes.
// sharpLegs re-splits each vertex's leg share by height, with a short blend at each joint (JOINT_BLEND: elbow / stifle,
// knee / hock, fetlock), and keeps its body share: the leg bends at its joints. Stable only (the race keeps the GLB's).
export const LEG_CHAINS=[['ForeUpperL','ForeLowerL','ForeCannonL','ForeHoofL'],['ForeUpperR','ForeLowerR','ForeCannonR','ForeHoofR'],
  ['HindUpperL','HindLowerL','HindCannonL','HindHoofL'],['HindUpperR','HindLowerR','HindCannonR','HindHoofR']];
const JOINT_BLEND=[.08,.05,.04],sharp=new WeakMap();
// The haunch: the GLB hangs the whole rump (1.03–1.96 high) on the thigh bone, so swinging the thigh forward to fold the
// leg dragged the rump forward and down and flattened it. As on a horse, the rump mass goes with the pelvis: the thigh's
// share above HAUNCH[0] fades to the pelvis by HAUNCH[1], and the thigh bone keeps only the lower thigh and stifle.
const HAUNCH=[1.12,1.38],FLANK=[-.5,-.36];   // FLANK (z, forward): the skin fold in front of the stifle goes to the pelvis too (on the thigh it swung out as a flap)
export function sharpLegs(mesh){
  const g0=mesh.geometry;if(!sharp.has(g0))sharp.set(g0,reweight(g0,mesh));mesh.geometry=sharp.get(g0);
}
function reweight(g0,mesh){
  const g=g0.clone(),si=g.attributes.skinIndex,sw=g.attributes.skinWeight,pos=g.attributes.position,sk=mesh.skeleton;
  const at=k=>new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[k].clone().multiply(mesh.bindMatrix).invert());   // a bone's rest point, geometry space
  const chains=LEG_CHAINS.map(c=>{const ids=c.map(n=>sk.bones.findIndex(b=>b.name===n));return {ids,ys:ids.slice(1).map(k=>at(k).y),hind:c[0].startsWith('Hind')};}).filter(c=>c.ids.every(k=>k>=0));
  const pelvis=sk.bones.findIndex(b=>b.name==='Pelvis');
  const step=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  for(let v=0;v<pos.count;v++){
    let list=[0,1,2,3].map(k=>[si.getComponent(v,k),sw.getComponent(v,k)]).filter(([,w])=>w>0);const y=pos.getY(v);
    // Every leg the vertex hangs on (the rump's middle and the groin hang on both hind legs: each share is re-split, or
    // the one left as it was drags that skin along with its thigh).
    for(const c of chains){
      const leg=list.reduce((s,[j,w])=>s+(c.ids.includes(j)?w:0),0);if(!leg)continue;
      const s=c.ys.map((jy,k)=>step(jy+JOINT_BLEND[k],jy-JOINT_BLEND[k],y));   // 1 below the joint, 0 above
      const share=[1-s[0],s[0]-s[1],s[1]-s[2],s[2]];
      const rump=c.hind&&pelvis>=0?leg*share[0]*Math.max(step(HAUNCH[0],HAUNCH[1],y),step(FLANK[0],FLANK[1],pos.getZ(v))):0;share[0]-=rump/leg;   // the rump to the pelvis
      list=[...list.filter(([j])=>!c.ids.includes(j)),...c.ids.map((j,k)=>[j,leg*share[k]]),[pelvis,rump]];
    }
    const out=list.filter(([,w])=>w>1e-4).reduce((a,[j,w])=>{const e=a.find(x=>x[0]===j);if(e)e[1]+=w;else a.push([j,w]);return a;},[]).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const sum=out.reduce((t,[,w])=>t+w,0);if(!sum)continue;
    for(let k=0;k<4;k++){si.setComponent(v,k,out[k]?.[0]??0);sw.setComponent(v,k,out[k]?out[k][1]/sum:0);}
  }
  si.needsUpdate=sw.needsUpdate=true;return g;
}

// Hind leg joints, moved onto the model's own leg (_joint-plan.html: the GLB's hind bones run 0.15–0.22 in front of the
// leg and its hock sits 0.16 below the hock bulge, so a bent hind leg folded mid-cannon). HIND_JOINTS: [y, z] of the hip,
// stifle, hock, fetlock and toe (left leg; x ±HIND_X, the leg's own centre line: horse_new3's hind legs stand 0.21 off
// the middle, the first horse's stood 0.31), measured from the leg's cross-sections and checked against real
// horses (hock a little above the knee, hind cannon longer than the fore, stifle ~135°, hock ~140°). Each bone is moved
// to its joint and turned to point at the next (a turn about its X, like the rest of the rig), then every skinned part
// is re-bound (its own new inverse bind matrices; the shared ones stay as they are for the race). Stable only.
export const HIND_JOINTS=[[1.53,-.73],[1.05,-.62],[.78,-.86],[.20,-.79],[0,-.62]],HIND_X=.25;   // horse_new4: fetlock a little further forward, legs .25 off the middle (horse_new3: -.87, .21)
function fixHind(content){
  // World matrices from the top down first: the parents' are stale here (createApprovedHorse sets the fit scale last),
  // and moving a hind bone refreshes its own parents only. Left stale, Root, Pelvis and the hind legs were re-bound at
  // the fit scale and the rest without it: the hindquarters drew 13% small (rump low, a gap under the tail).
  const R=content.getObjectByName('Root'),meshes=[];content.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});content.updateWorldMatrix(true,true);
  const bind=meshes.map(m=>{const sk=m.skeleton;return R.matrixWorld.clone().multiply(sk.boneInverses[sk.bones.findIndex(b=>b.name==='Root')]);});
  const rq=R.getWorldQuaternion(new THREE.Quaternion()),pq=new THREE.Quaternion(),x=new THREE.Vector3(1,0,0),w=new THREE.Vector3();
  for(const [side,sx] of [['L',HIND_X],['R',-HIND_X]])['HindUpper','HindLower','HindCannon','HindHoof'].forEach((n,k)=>{
    const b=content.getObjectByName(n+side),[y,z]=HIND_JOINTS[k],[ny,nz]=HIND_JOINTS[k+1];if(!b)return;
    b.parent.updateWorldMatrix(true,false);b.position.copy(b.parent.worldToLocal(w.set(sx,y,z).applyMatrix4(R.matrixWorld)));
    b.parent.getWorldQuaternion(pq);b.quaternion.copy(pq.invert().multiply(rq)).multiply(new THREE.Quaternion().setFromAxisAngle(x,Math.atan2(nz-z,ny-y)));
    b.updateMatrixWorld(true);});
  meshes.forEach((m,i)=>{const sk=m.skeleton;sk.boneInverses=sk.bones.map(b=>b.matrixWorld.clone().invert().multiply(bind[i]));});
}

// Corrective shape for lying: folded this far, the low-poly hind legs crumple (creases at the stifle, shards at the
// hock). Once per geometry the skin is posed fully lying on the CPU, smoothed where the hind legs fold (Taubin, so
// the tubes keep their girth; strength by the vertex's thigh / gaskin / cannon weight, hooves and body pinned), and the
// difference stored as a morph target in bind space (through each vertex's inverse skin matrix): lieFix.k fades it in.
const FIX={rounds:24,lambda:.5,mu:-.53,bones:/^Hind(Upper|Lower|Cannon)/};
function lieFix(mesh){
  const g=mesh.geometry;
  if(!g.morphAttributes.position){
    const pos=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,n=pos.count,sk=mesh.skeleton;
    sk.update();mesh.updateMatrixWorld(true);
    const S=sk.bones.map((b,i)=>new THREE.Matrix4().multiplyMatrices(b.matrixWorld,sk.boneInverses[i]));
    const fold=sk.bones.map(b=>FIX.bones.test(b.name)),M=new THREE.Matrix4(),T=new THREE.Matrix4(),v=new THREE.Vector3();
    const P=new Float32Array(n*3),mats=[],mask=new Float32Array(n);
    for(let i=0;i<n;i++){M.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);
      for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(!w)continue;const j=si.getComponent(i,k);
        for(let e=0;e<16;e++)M.elements[e]+=w*S[j].elements[e];if(fold[j])mask[i]+=w;}
      T.multiplyMatrices(mesh.bindMatrixInverse,M).multiply(mesh.bindMatrix);mats.push(T.clone());
      v.fromBufferAttribute(pos,i).applyMatrix4(T);P.set([v.x,v.y,v.z],i*3);}
    // Weld the seams (same rest point = one vertex), then neighbours from the triangles.
    const key=i=>`${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`,weld=new Map(),id=new Int32Array(n);
    for(let i=0;i<n;i++){const k=key(i);if(!weld.has(k))weld.set(k,weld.size);id[i]=weld.get(k);}
    const m=weld.size,nb=Array.from({length:m},()=>new Set()),idx=g.index.array;
    for(let t=0;t<idx.length;t+=3)for(const [a,c] of [[0,1],[1,2],[2,0]]){const A=id[idx[t+a]],B=id[idx[t+c]];if(A!==B){nb[A].add(B);nb[B].add(A);}}
    const Q=new Float32Array(m*3),str=new Float32Array(m),cnt=new Float32Array(m);
    for(let i=0;i<n;i++){const k=id[i];for(let c=0;c<3;c++)Q[k*3+c]+=P[i*3+c];cnt[k]++;str[k]=Math.max(str[k],Math.min(1,mask[i]*1.5));}
    for(let k=0;k<m;k++)for(let c=0;c<3;c++)Q[k*3+c]/=cnt[k];
    const nbs=nb.map(x=>[...x]),tmp=new Float32Array(m*3);
    for(let r=0;r<FIX.rounds*2;r++){const f=r%2?FIX.mu:FIX.lambda;
      for(let k=0;k<m;k++){const L=nbs[k];if(!str[k]||!L.length){tmp.set(Q.subarray(k*3,k*3+3),k*3);continue;}
        for(let c=0;c<3;c++){let a=0;for(const o of L)a+=Q[o*3+c];tmp[k*3+c]=Q[k*3+c]+f*str[k]*(a/L.length-Q[k*3+c]);}}
      Q.set(tmp);}
    // Girth: the segments are resized (s) by scaling their bones, which scales their thickness too (the cannon went to
    // half), and the smoothing presses the gaskin oval. Each hind leg vertex goes back to its standing distance from its
    // bone's axis (by its weight on that bone): the segments change length only and stay round.
    const loc=m4=>new THREE.Matrix4().multiplyMatrices(mesh.bindMatrixInverse,m4),axis=m4=>[new THREE.Vector3().setFromMatrixPosition(m4),new THREE.Vector3().setFromMatrixColumn(m4,1).normalize()];
    const leg=sk.bones.map(b=>/^Hind(Upper|Lower|Cannon|Hoof)/.test(b.name)),ax0=[],ax1=[],done=new Uint8Array(m),r=new THREE.Vector3();
    sk.bones.forEach((b,j)=>{if(leg[j]){ax0[j]=axis(sk.boneInverses[j].clone().multiply(mesh.bindMatrix).invert());ax1[j]=axis(loc(b.matrixWorld));}});
    for(let i=0;i<n;i++){const k=id[i];if(done[k])continue;done[k]=1;let j=-1,w=0;
      for(let c=0;c<4;c++){const x=sw.getComponent(i,c),b=si.getComponent(i,c);if(leg[b]&&x>w){w=x;j=b;}}if(j<0)continue;
      const [o0,d0]=ax0[j],[o1,d1]=ax1[j];v.fromBufferAttribute(pos,i).sub(o0);const r0=v.addScaledVector(d0,-v.dot(d0)).length();
      v.set(Q[k*3],Q[k*3+1],Q[k*3+2]).sub(o1);r.copy(d1).multiplyScalar(v.dot(d1));v.sub(r);const r1=v.length();if(r1<1e-5)continue;
      v.multiplyScalar(1+w*(r0/r1-1)).add(r).add(o1);Q.set([v.x,v.y,v.z],k*3);}
    const D=new Float32Array(n*3);
    for(let i=0;i<n;i++){v.set(Q[id[i]*3],Q[id[i]*3+1],Q[id[i]*3+2]).applyMatrix4(mats[i].invert());
      D.set([v.x-pos.getX(i),v.y-pos.getY(i),v.z-pos.getZ(i)],i*3);}
    g.morphAttributes.position=[new THREE.Float32BufferAttribute(D,3)];g.morphTargetsRelative=true;
  }
  mesh.updateMorphTargets();
}

// The muzzle tip: the body vertex (HorseBody, LlamaBody, RhinoBody), mostly bound to Head, farthest from the Head bone (rest pose).
function findMuzzle(root){
  let mesh;root.traverse(o=>{if(o.isSkinnedMesh&&/Body$/.test(o.name))mesh=o;});if(!mesh)return null;
  const head=mesh.skeleton.bones.findIndex(b=>b.name==='Head'),g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,pos=g.attributes.position;
  const hp=mesh.skeleton.boneInverses[head].clone().invert(),o=new THREE.Vector3().setFromMatrixPosition(hp),v=new THREE.Vector3();let i=-1,far=0;
  for(let k=0;k<pos.count;k++){let w=0;for(let j=0;j<4;j++)if(si.getComponent(k,j)===head)w+=sw.getComponent(k,j);
    if(w>.6&&v.fromBufferAttribute(pos,k).distanceTo(o)>far){far=v.distanceTo(o);i=k;}}
  return i<0?null:{mesh,i};
}

export async function mountStableView(host){
  const [assets]=await Promise.all([loadStable(),preloadPresentation(),preloadBuddies([PLAYER_LOOK.coat])]);   // the buddy on show (home.js applyLook, set before the page mounts this)
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true});
  r.setPixelRatio(Math.min(devicePixelRatio,2));r.setClearColor(0,0);r.outputColorSpace=THREE.SRGBColorSpace;
  r.domElement.setAttribute('aria-hidden','true');host.append(r.domElement);
  const scene=new THREE.Scene();
  // Unified look (visual-style.js), aimed like the plate: warm key from the open door up right, rim from behind.
  const sun=new THREE.DirectionalLight();sun.position.set(6,9,7);sun.castShadow=true;sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:40});scene.add(sun,sun.target);
  const rim=new THREE.DirectionalLight();rim.position.set(5,6,-8);scene.add(rim);
  applyLook(r,scene,{sun,rim,shadowMap:LOOK.shadow.stableMap});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({opacity:.28}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);

  const rider=clone(assets.rider.scene);rider.position.set(RIDER.x,0,RIDER.z);rider.rotation.y=RIDER.yaw;
  const gearMats=new Set(GEAR.map(g=>g.mat));   // own copies of the recolourable parts (the clone shares materials)
  rider.traverse(o=>{if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;o.frustumCulled=false;
    if(gearMats.has(o.material.name)){o.material=o.material.clone();o.material.userData.base=o.material.color.getHex();}});scene.add(rider);
  const riderMixer=new THREE.AnimationMixer(rider),clip=n=>riderMixer.clipAction(assets.rider.animations.find(a=>a.name===n));
  const stand=clip('Stand').play(),pickup=clip('Pickup');pickup.setLoop(THREE.LoopOnce);pickup.clampWhenFinished=true;
  // Props ride in the left hand (bone Hand.L, +Y runs out past the fingers).
  const hand=rider.getObjectByName('HandL'),shadow=o=>{o.traverse(m=>{if(m.isMesh)m.castShadow=true;});return o;};
  const brush=shadow(assets.brush.clone());brush.scale.setScalar(BRUSH.scale);
  const carrot=shadow(assets.carrot.clone());carrot.scale.setScalar(CARROT.scale);
  const props={brush,carrot};for(const p of Object.values(props)){p.visible=false;hand?.add(p);}
  // Eyes: she blinks (a skin-coloured lid over her eye parts, her lash arc closing with it) and turns her head to the
  // horse's eyes; the horse's pupils follow her (or look into the camera while it has the frame to itself).
  let skin='#f2c9a6';rider.traverse(o=>{if(o.isMesh&&o.material.name==='Rider_Skin')skin=o.material.color.getHexString();});
  const riderEyes=livingEyes(rider,{measure:['Rider_Sclera'],paint:['Rider_Sclera','Rider_Iris','Rider_Pupil'],arc:'Rider_Eye',lights:'Rider_EyeLight',
    lidColor:'#'+skin,open:1.3,from:.9,curve:1.4,arcStop:-.35});
  const gaze=['Neck','Head'].map(n=>rider.getObjectByName(n)).filter(Boolean).map(b=>[b,b.quaternion.clone()]);
  const LOOK_MAX=.4,I=new THREE.Quaternion(),hq=new THREE.Quaternion(),pq=new THREE.Quaternion(),tq=new THREE.Quaternion(),sq=new THREE.Quaternion();
  const fwd=new THREE.Vector3(),hp=new THREE.Vector3(),vA=new THREE.Vector3(),vB=new THREE.Vector3(),eyeAt=new THREE.Vector3();
  let lookW=0;rider.updateMatrixWorld(true);   // her face looks down +Z at rest: that direction in the Head bone's frame
  if(gaze.length)fwd.set(0,0,1).applyQuaternion(rider.quaternion).applyQuaternion(gaze.at(-1)[0].getWorldQuaternion(hq).invert());
  function lookAt(target,k){   // swing Neck then Head (half each) so her face points at target, at most LOOK_MAX rad
    if(!gaze.length||k<.001)return;const head=gaze.at(-1)[0];head.getWorldQuaternion(hq);head.getWorldPosition(hp);
    tq.setFromUnitVectors(vA.copy(fwd).applyQuaternion(hq),vB.subVectors(target,hp).normalize());
    const a=2*Math.acos(Math.min(1,Math.abs(tq.w)));sq.copy(I).slerp(tq,k*Math.min(1,LOOK_MAX/Math.max(a,1e-4))/gaze.length);
    for(const [b] of gaze){b.parent.getWorldQuaternion(pq);b.quaternion.premultiply(tq.copy(pq).invert().multiply(sq).multiply(pq));}
  }

  const cam=new THREE.PerspectiveCamera(CAM.fov,1,.3,60),page=host.closest('.page-stable');
  let model=null,bones=[],muzzle=null,raf=0,last=performance.now(),nod=0,job=null,w=0;   // w: act's neck pose weight
  // Mood state: fore / hind: how far each end is down (0 standing … 1 lying); still: s since the last touch; rear: s into
  // a rear (-1: none); queued: an act (or a rear) waiting for the horse to be up.
  let resting=false,fore=0,hind=0,still=0,restAfter=0,rear=-1,queued=null,joy=false,rig={},poses={},body=null;
  const soon=()=>MOOD.restAfter[0]+Math.random()*(MOOD.restAfter[1]-MOOD.restAfter[0]);restAfter=soon();
  if(new URLSearchParams(location.search).has('debug'))window.__stable={r,scene,cam,get model(){return model;},BUDDY};   // dev (?debug): the scene, to look at a pose from other angles; BUDDY, to try another bow live
  cam.rotation.set(-CAM.tilt*Math.PI/180,0,0);
  page?.style.setProperty('--bg-x',`${CAM.bg*100}%`);page?.style.setProperty('--bg-f',CAM.bg);   // --bg-f: the decor layer
  // The tail never dips under the stall floor (y 0): lying or rearing, whatever of it would hang lower is laid on the
  // floor (the hair's vertex shader lifts those vertices, in world space; its shadow is not redrawn: it has none there).
  function onFloor(m){const base=m.onBeforeCompile,key=m.customProgramCacheKey();
    m.onBeforeCompile=function(sh,r){base.call(this,sh,r);sh.vertexShader=sh.vertexShader.replace('#include <project_vertex>',`{vec4 gw=modelMatrix*vec4(transformed,1.);float gd=.015-gw.y;
      if(gd>0.)transformed+=(vec3(0.,gd,0.)*mat3(modelMatrix))/dot(modelMatrix[0].xyz,modelMatrix[0].xyz);}
      #include <project_vertex>`);};
    m.customProgramCacheKey=()=>key+'-floor';m.needsUpdate=true;}
  function show(){
    if(model)scene.remove(model.root);
    model=createApprovedHorse(0);model.seat.visible=false;
    if(!model.species){fixHind(model.content);sharpLegs(model.content.getObjectByName('HorseBody'));}   // a llama or a rhino keeps its own leg rig: it only stands (moods)
    model.mixer.clipAction(model.clips.idle).play();
    model.content.traverse(o=>{if(o.material?.name==='Horse_ManeTail')onFloor(o.material);});
    model.root.position.set(HORSE.x+(BUDDY[model.species]?.x??0),0,HORSE.z);model.root.rotation.y=HORSE.yaw;scene.add(model.root);
    bones=NECK.map(n=>model.content.getObjectByName(n)).filter(Boolean).map(b=>[b,b.quaternion.clone()]);
    muzzle=findMuzzle(model.content);
    rig={};model.content.updateMatrixWorld(true);headUp.set(0,1,0).applyQuaternion(model.content.getObjectByName('Head').getWorldQuaternion(hq2).invert());   // the head's up, standing
    for(const n of new Set([...Object.keys(LIE),...Object.keys(REAR)])){const b=model.content.getObjectByName(n);if(b)rig[n]={b,q:b.quaternion.clone(),p:b.position.clone(),y:b.position.y,s:b.scale.x};}
    poses={lie:solve(LIE),rear:solve(REAR)};
    body=model.content.getObjectByName('HorseBody');
    if(body&&!body.geometry.morphAttributes.position){pose(poses.lie,1);model.content.updateMatrixWorld(true);lieFix(body);
      for(const r of Object.values(rig)){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);r.b.scale.setScalar(r.s);}}else body?.updateMorphTargets();
    // Nothing on the stable horse's head: the reins and bit rings are for racing (nobody holds them here).
    {const o=model.content.getObjectByName('BitRings');if(o)o.visible=false;}
    rider.traverse(o=>{const m=o.material;if(o.isMesh&&gearMats.has(m.name))m.color.set(PLAYER_LOOK.gear[m.name]??m.userData.base);});
  }
  // Crouch (the prop appears as the hand reaches the floor), stand, act; the horse leans in meanwhile, then all back.
  function acting(dt){
    const a=ACTS[job.kind],prop=props[a.prop],t=job.t+=dt,end=PICKUP+a.hold;
    if(job.t===dt)stand.crossFadeTo(pickup.reset().play(),.15,false);
    if(!job.peaked&&t>PICKUP+a.peak){job.peaked=true;job.onPeak?.();}
    if(!prop.visible&&t>.42&&t<end&&!job.ate)prop.visible=true;
    if(job.step===0&&t>PICKUP){job.step=1;pickup.crossFadeTo(job.act.reset().play(),.25,false);}
    if(job.step===1&&t>end){job.step=2;job.act.crossFadeTo(stand.reset().play(),.35,false);}
    if(a.bite&&!job.ate&&t>PICKUP+a.bite){job.ate=true;nod=.9;prop.visible=false;}   // one bite: gone, and a nod
    if(t>end+.2)prop.visible=false;
    w=Math.min(1,Math.max(0,(t-PICKUP+.5)/.6),Math.max(0,(end+.5-t)/.6));
    if(t>end+.6){job=null;w=0;}
  }
  // The mood poses as local rotations (solve), and blending toward them by weight k (fore / hind / body eased separately).
  const pq2=new THREE.Quaternion(),e2=new THREE.Euler(),smooth=x=>x*x*(3-2*x),part=n=>/^Fore|^Neck|^Head/.test(n)?'fore':/^Hind|^Tail/.test(n)?'hind':'body';
  const up=new THREE.Vector3(0,1,0),cur=new THREE.Vector3(),want=new THREE.Vector3(),at2=new THREE.Vector3(),wq=new THREE.Quaternion(),rq=new THREE.Quaternion(),rm=new THREE.Matrix4(),bm=new THREE.Matrix4();
  // A leg segment's scale is its own size over the sizes of the leg segments above it (each scales its children too).
  const LEG=/^(Hind|Fore)/,chainS=b=>{let c=1;for(let o=b.parent;o&&LEG.test(o.name);o=o.parent)c*=o.scale.x;return c;};
  function solve(P){   // → {bone: {q, y?}} from the rest skeleton: rotations first, then each dir segment down its chain
    const out={};for(const r of Object.values(rig)){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);r.b.scale.setScalar(r.s);}
    for(const [n,o] of Object.entries(P)){const r=rig[n];if(!r||o.dir||o.to)continue;
      if(Array.isArray(o))r.b.quaternion.copy(r.q).multiply(q.setFromEuler(e2.set(o[0]||0,o[1]||0,o[2]||0)));
      else{r.b.quaternion.copy(r.q).multiply(q.setFromEuler(e2.set(o.x||0,o.roll||0,0)));r.b.position.y=r.y*o.y;}
      out[n]={q:r.b.quaternion.clone(),y:o.y&&r.b.position.y};}
    const root=model.content.getObjectByName('Root');root.getWorldQuaternion(rq);rm.copy(root.matrixWorld);   // the horse's own space
    for(const [n,o] of Object.entries(P)){const r=rig[n];if(!r||!(o.dir||o.to))continue;
      if(LEG.test(n))r.b.scale.setScalar((o.s??1)/chainS(r.b));r.b.getWorldQuaternion(wq);cur.copy(up).applyQuaternion(wq);   // a bone runs along its +Y
      if(o.to)want.set(...o.to).applyMatrix4(rm).sub(r.b.getWorldPosition(at2)).normalize();else want.set(...o.dir).normalize().applyQuaternion(rq);
      // Hind bones keep their side (X, the flat of the gaskin and cannon) facing out: the shortest turn from a thigh
      // swung forward rolls the gaskin a quarter turn and shows its thin edge, like a blade.
      if(/^Hind/.test(n)){at2.set(1,0,0).applyQuaternion(rq);at2.addScaledVector(want,-at2.dot(want)).normalize();wq.setFromRotationMatrix(bm.makeBasis(at2,want,cur.crossVectors(at2,want)));}
      else wq.premultiply(pq2.setFromUnitVectors(cur,want));r.b.parent.getWorldQuaternion(pq2);r.b.quaternion.copy(pq2.invert().multiply(wq));
      out[n]={q:r.b.quaternion.clone(),s:o.s};}
    for(const r of Object.values(rig)){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);r.b.scale.setScalar(r.s);}
    return out;
  }
  function pose(T,k){if(!k)return;for(const [n,t] of Object.entries(T)){const r=rig[n],w=typeof k==='number'?k:k[part(n)];if(!w)continue;
    r.b.quaternion.slerp(t.q,w);if(t.y)r.b.position.y+=(t.y-r.b.position.y)*w;if(LEG.test(n))r.b.scale.setScalar((1+((t.s??1)-1)*w)/chainS(r.b));}}
  function moods(dt){
    if(model.species){still=0;joy=false;}   // LIE and REAR are the horse's joints: the other animals stay standing
    if(!resting&&!job&&!queued&&rear<0&&(still+=dt)>restAfter)resting=true;
    // Down: forelegs first, the hind end follows past halfway; up: the hind end first, then the front.
    const step=(v,to,t)=>to>v?Math.min(to,v+dt/t):Math.max(to,v-dt/t);
    if(resting){fore=step(fore,1,MOOD.down/2);if(fore>.5)hind=step(hind,1,MOOD.down/2);}
    else{hind=step(hind,0,MOOD.up/2);if(hind<.5)fore=step(fore,0,MOOD.up/2);}
    if(!fore&&!hind&&queued){const a=queued;queued=null;a();}
    if(!fore&&!hind&&!job&&!queued&&joy&&rear<0){joy=false;rear=0;}
    if(rear>=0&&(rear+=dt)>MOOD.rear[0]+MOOD.rear[1]+MOOD.rear[2]){rear=-1;still=0;}
  }
  function moodPose(){
    // The Idle clip is constant, and the mixer only writes a value when it changes: start every frame from rest (the
    // neck and head were already set from rest above).
    for(const [n,r] of Object.entries(rig))if(!NECK.includes(n)){r.b.quaternion.copy(r.q);r.b.position.copy(r.p);r.b.scale.setScalar(r.s);}
    const F=smooth(fore),H=smooth(hind);
    if(F||H){pose(poses.lie,{fore:F,hind:H,body:H});const tip=rig.Pelvis;if(tip)tip.b.quaternion.multiply(q.setFromEuler(e2.set((F-H)*.35,0,0)));}   // the hips sink with the hind legs; front lower than the hind: nose down
    if(rear>=0){const [a,b,c]=MOOD.rear,k=smooth(Math.min(1,rear/a,Math.max(0,(a+b+c-rear)/c)));pose(poses.rear,k);
      const paw=Math.sin(Math.max(0,rear-a)*14)*.35*k;for(const [n,s] of [['ForeLowerL',1],['ForeLowerR',-1]])rig[n]?.b.quaternion.multiply(q.setFromEuler(e2.set(paw*s,0,0)));
      rig.Head?.b.quaternion.multiply(q.setFromEuler(e2.set(Math.sin(rear*9)*.12*k,0,0)));}
  }
  // Lying, the horse looks at the rider: the neck and head turn about the vertical (the head stays level), then the head
  // is rolled about its muzzle line until its standing "up" is upright again (the body's roll and twist tilt it).
  const Y=new THREE.Vector3(0,1,0),headUp=new THREE.Vector3(),hp2=new THREE.Vector3(),mz=new THREE.Vector3(),f=new THREE.Vector3(),tv=new THREE.Vector3(),u=new THREE.Vector3(),hq2=new THREE.Quaternion(),pq3=new THREE.Quaternion(),yq=new THREE.Quaternion();
  function watch(target,k){
    const head=rig.Head?.b;if(k<.001||!head||!muzzle)return;
    model.content.updateMatrixWorld(true);head.getWorldPosition(hp2);muzzle.mesh.getVertexPosition(muzzle.i,mz).applyMatrix4(muzzle.mesh.matrixWorld);
    f.subVectors(mz,hp2);tv.subVectors(target,hp2);
    const a=Math.max(-.9,Math.min(.9,Math.atan2(f.z*tv.x-f.x*tv.z,f.x*tv.x+f.z*tv.z)))*k;
    const turn=(b,wq)=>{b.parent.getWorldQuaternion(pq3);b.quaternion.premultiply(pq3.clone().invert().multiply(wq).multiply(pq3));};
    for(const [n,s] of [['NeckLower',.4],['NeckUpper',.35],['Head',.25]]){const b=model.content.getObjectByName(n);if(b)turn(b,yq.setFromAxisAngle(Y,a*s));}
    f.applyAxisAngle(Y,a).normalize();head.getWorldQuaternion(hq2);u.copy(headUp).applyQuaternion(hq2).addScaledVector(f,-u.dot(f)).normalize();
    tv.copy(Y).addScaledVector(f,-f.y).normalize();turn(head,yq.setFromAxisAngle(f,Math.atan2(f.dot(mz.crossVectors(u,tv)),u.dot(tv))*k));
  }
  function fit(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;r.setSize(w,h,false);r.domElement.style.cssText='width:100%;height:100%;display:block';
    const d=Math.min(CAM.dist[1],Math.max(CAM.dist[0],CAM.fill*h/w));cam.position.set(CAM.x,CAM.floor*d,HORSE.z+d);
    cam.fov=CAM.fov;cam.aspect=w/h;cam.updateProjectionMatrix();}
  const ro=new ResizeObserver(fit);ro.observe(host);
  const q=new THREE.Quaternion(),e=new THREE.Euler();
  function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;nod=Math.max(0,nod-dt);
    moods(dt);if(job)acting(dt);
    for(const [b,base] of gaze)b.quaternion.copy(base);   // from rest, in case a clip doesn't key them
    model.mixer.update(dt);riderMixer.update(dt);
    const bob=Math.sin((1-nod/.9)*Math.PI*2)*.08*(nod>0),to=job?BUDDY[model.species]?.bow??POSE[job.kind]:POSE.idle;   // a soft chew-nod (the bite)
    for(const [b,base] of bones){const n=b.name,p=POSE.idle[n]+(to[n]-POSE.idle[n])*w+bob*(n==='Head'?1:.3),t=(to.turn||0)*w*(TURN[n]||0);
      b.quaternion.copy(base).multiply(q.setFromEuler(e.set(p,0,t)));}   // from rest every frame: the idle clip doesn't key these
    moodPose();watch(riderEyes.center(hp2.clone()),smooth(fore));if(body?.morphTargetInfluences)body.morphTargetInfluences[0]=smooth(hind);model.updateAttachment();
    lookW+=((job?.step===0?0:1)-lookW)*(1-Math.exp(-dt*5));   // not while crouching for the prop
    lookAt(model.eyes.center(eyeAt),lookW);rider.updateMatrixWorld(true);riderEyes.update(dt);   // she looks the buddy in the eyes (every buddy has them: approved-assets EYES)
    model.eyes.update(dt,riderEyes.center(eyeAt));   // and it looks at her
    if((carrot.visible||brush.visible)&&muzzle)aimProps();
    r.render(scene,cam);raf=requestAnimationFrame(frame);}
  // Props sit in the mitten (it has no fingers to close) and point at the horse every frame, whatever the neck pose and
  // hand bob do: the carrot is held at its leaf base with the tip to the mouth; the brush has the hand through its strap
  // and the bristles (its −Y) to the face, between the poll and the muzzle.
  const grip=new THREE.Vector3(...CARROT.grip),axis=new THREE.Vector3(...CARROT.tip).sub(grip).normalize(),at=new THREE.Vector3(),dir=new THREE.Vector3();
  const palm=new THREE.Vector3(...GRIP),down=new THREE.Vector3(0,-1,0),strap=new THREE.Vector3(0,BRUSH.strap,0),poll=new THREE.Vector3();
  function aimProps(){
    scene.updateMatrixWorld();muzzle.mesh.getVertexPosition(muzzle.i,at).applyMatrix4(muzzle.mesh.matrixWorld);
    // The brush is aimed while the arm comes up, then held in the hand (Comb only rocks the wrist, which turns it).
    const aimBrush=brush.visible&&!(job?.kind==='brush'&&job.step===1&&job.t>PICKUP+BRUSH.settle);
    if(aimBrush){model.content.getObjectByName('Head')?.getWorldPosition(poll);at.lerp(poll,BRUSH.face);}
    hand.worldToLocal(at);dir.subVectors(at,palm).normalize();
    if(carrot.visible){carrot.quaternion.setFromUnitVectors(axis,dir);carrot.position.copy(palm).sub(grip.clone().applyQuaternion(carrot.quaternion).multiply(carrot.scale));}
    if(aimBrush){brush.quaternion.setFromUnitVectors(down,dir);brush.position.copy(palm).sub(strap.clone().applyQuaternion(brush.quaternion).multiply(brush.scale));}}
  show();fit();raf=requestAnimationFrame(frame);
  // show: the ranch page can change the buddy without leaving (its row of heads, 2026-10-05), so the model of the one
  // asked for is loaded first; a later request wins, and nothing is shown once the view is gone.
  let gone=false;
  const api={show:()=>{const c=PLAYER_LOOK.coat;preloadBuddies([c]).then(()=>{if(gone||c!==PLAYER_LOOK.coat)return;show();fit();});},
    react(kind,onPeak){if(job||queued||!ACTS[kind])return;api.wake();const go=()=>{job={kind,t:0,step:0,ate:false,peaked:false,onPeak,act:clip(ACTS[kind].clip)};};
      if(fore||hind)queued=go;else go();},
    wake(){still=0;restAfter=soon();resting=false;},   // any touch: stand up (if lying) and start the rest timer over
    cheer(){api.wake();joy=true;},                // a bar just filled: rear for joy once it is up and done
    get busy(){return !!(job||queued);},
    dispose(){gone=true;cancelAnimationFrame(raf);ro.disconnect();r.dispose();r.domElement.remove();page?.style.removeProperty('--bg-x');page?.style.removeProperty('--bg-f');}};
  return api;
}
