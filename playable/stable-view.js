// Stable stage (stable page mock): a flat painted barn plate behind (CSS, .st-bg), in front of it a 3D close-up
// of the rider standing at the horse's head, the horse lowering its head to them. Fixed camera so the 3D pair
// keeps matching the plate's perspective; a shadow-only floor grounds them on it.
// One fixed shot holds both (the rider at the left edge): react('brush' | 'feed') plays in place, the rider crouches
// for the brush / carrot and stands; brush: combs the forelock and mane while the horse bows; feed: holds the carrot
// out, the horse stretches down and eats it in one bite. show() rebuilds the horse so PLAYER_LOOK changes apply.
// Between acts the horse has moods (MOOD below): it lies down when left alone, gets up on wake(), rears on cheer().
import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {preloadKeys,preloadBuddies,COATS,createApprovedHorse,livingEyes,MODEL_VERSION,PLAYER_LOOK} from '../approved-assets.js?v=r397';
import {applyLook,LOOK} from '../visual-style.js?v=r397';

// Stable-only models, loaded on first visit: the rigged standing rider (rider_showcase_rig.py: Stand / Pickup / Comb /
// Offer) and what it picks up.
const url=f=>new URL(`../assets/models/${f}?v=${MODEL_VERSION}`,import.meta.url).href,load=f=>new GLTFLoader().loadAsync(url(f));
let pending;
// 2026-10-05 (the user): no rider in the ranch (her model was the heaviest thing it loaded) and no carrot: a feed trough
// stands where she stood (Feed_Trough.glb, the user's model: five untextured parts, coloured here), the buddy lowers its
// head to it, and the food is its shop picture standing in the trough. The brush works by itself.
const loadStable=()=>pending??=Promise.all([load('stable/Scrub_Brush.glb'),load('stable/Feed_Trough.glb')]).then(([brush,trough])=>({brush:brush.scene,trough:trough.scene}));
// What the ranch waits for: the buddy on show, nothing else of the race's set (2026-10-05, the user: the ranch loaded
// slowly; the rider and the rest follow in the background, home.js).
const needs=()=>COATS[PLAYER_LOOK.coat]?.model?[]:['horse'];
const TROUGH={wood:'#c27a3e',metal:'#646a71',parts:{tripo_part_13:'metal',tripo_part_15:'metal',tripo_part_2:'metal'},rim:.40,k:1.9,at:[0,-.15],reach:.14,lift:{NeckLower:-.3,NeckUpper:-.15,Head:-.1},yaw:Math.PI/2,food:.55,top:1.0,fov:96,ground:'#a9783f'};   // rim: model height of the tray's edge; size: scale range (the rim is put just under the lowered mouth); yaw: end-on to the camera, its low front to the buddy (2026-10-05, the user's picture); food: the picture's size, m; top: how far above the tray the camera goes to look straight down while it eats; ground: the floor's colour in that shot

// Horse faces -X (toward the rider), turned a little to camera; rider in front of its muzzle facing back at it.
const HORSE={x:2.1,z:-.9,yaw:Math.PI/2+.45},RIDER={x:-.08,z:.27,yaw:Math.PI/2-.6};   // in front of the bowed face: brush at the forehead, carrot at the mouth
// Horse neck/head poses, absolute from the rig's rest: pitch (radians about each bone's X, + = down) and `turn`
// (NeckLower .6 / NeckUpper .4, bent toward the rider). The toy rider's hands top out ~1.8 m, so the horse lowers its
// whole neck like grazing and lets the head hang with it. Never lift the head against the bowed neck (negative Head):
// that crushes the poll, and the mane strands behind the ears fold inside out (sheen flares them pale grey).
const POSE={idle:{NeckLower:.12,NeckUpper:.07,Head:.04,turn:0},
  brush:{NeckLower:.75,NeckUpper:.35,Head:0,turn:0},    // bowed in one arch (not all at the neck root, which folded the
  feed:{NeckLower:.8,NeckUpper:.3,Head:-.3,turn:0}};     // breast in), the head just hanging: forehead to the brush, mouth to the carrot
// A llama or a rhino (createApprovedHorse species) at the brush and the carrot: its own bow, and how much further back
// it stands (x). The llama bows like the horse, but its neck starts low on its chest and carries its head a long way
// forward: it stands back, or its forehead is in her helmet. The rhino's head hangs below her hands: it lifts its chin to them
// (negative angles; its short neck takes that, the horse's does not).
const BUDDY={llama:{x:.25,wide:.2,feed:{NeckLower:.95,NeckUpper:.5,Head:-.15,turn:0}},rhino:{x:.45,wide:.3,bow:{NeckLower:-.3,NeckUpper:-.15,Head:-.1,turn:0},feed:{NeckLower:.12,NeckUpper:.1,Head:.12,turn:0}}};   // wide: how much further out than the horse's its flank is (the brush)
const NECK=['NeckLower','NeckUpper','Head'],TURN={NeckLower:-.6,NeckUpper:-.4};   // turn sign: -Z bends toward the rider
const BRUSH={scale:.8,strap:.3,bone:'Chest',at:[-.15,.1,.62],stroke:.3,dir:[0,-.35,-1]};   // 2026-10-05 (the user: nobody holds it now, it just brushes the body a few times): at: from the Spine bone to the flank the camera sees; stroke: how far along the body each way; dir: where the bristles point   // Scrub_Brush.glb: strap at +Y .3, bristles down; face: aim 55% muzzle → poll;
// settle: s into Comb (the crossfade from Pickup) after which the brush stays fixed in the hand
// The plate is flat and height-fit (cover), so the camera keeps a fixed vertical fov: the painted floor stays under
// the hooves on every screen shape. tilt: deg down; bg: plate x (0..1).
// Width-fit: the camera's distance to the horse is fill / aspect (clamped to dist), so the rider's helmet to the
// horse's tail spans ~3–97% of the width on every screen (a 390×844 phone: 18.3 m; 9:16: 15 m). x centres the pair;
// height = floor × distance keeps the hooves on the painted floor line.
// 2026-10-09 (the user: 「鏡頭要在高一點，可以看到飼料槽」: the stall's door now stands across the bottom of the page,
// home.css .st-door): the camera higher and looking down (it was floor .1393, tilt 1.4: level with the buddy's back), so
// the buddy and the trough stand clear above the door. The plate is barn-plate.webp, the user's painting for this
// camera (9:16, in the first plate's simple style; wall and floor meet at about 50% of its height, straw along the
// wall to 60%: the buddy stands on the boards just in front of it, its feet at about 60%).
// Later that day (the user, from a phone whose browser bars leave 655 pt of height: the row of heads lay over the
// buddy's ears): everything 7.5% of the page lower. The camera looks 2.25° less down (tilt was 9.3), the plate is drawn
// 115% tall from its top, the door stands lower (home.css).
const CAM={x:1.5,fill:8.44,dist:[12,22],floor:.22,tilt:7.05,fov:30,bg:.5};
// After the 1 s Pickup: the rider clip, how long it runs, and the horse's extra neck/head pose meanwhile (radians).
// Brush: the horse bows its forelock to the brush. Feed: neck down, head stretched out so its mouth meets the carrot.
const ACTS={
  brush:{hold:2.6,peak:.9},
  feed:{hold:2.2,bite:1.2,peak:1.2,cam:.6,down:[0,2.2]},   // the camera goes over the trough (cam s each way), the head comes down over the food (down: from, until), bite: it is gone under the head; the head lifts on an empty tray
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
    if(w>.3&&v.fromBufferAttribute(pos,k).distanceTo(o)>far){far=v.distanceTo(o);i=k;}}   // .3: the horse body's head weights top out at .54 (it was .6: no muzzle was found on the horse)
  return i<0?null:{mesh,i};
}

// What the ranch needs, asked for ahead of time (home.js: as soon as the game is open).
export const preloadStable=()=>Promise.all([loadStable(),preloadKeys(needs()),preloadBuddies([PLAYER_LOOK.coat])]);
export async function mountStableView(host){
  const [assets]=await Promise.all([loadStable(),preloadKeys(needs()),preloadBuddies([PLAYER_LOOK.coat])]);   // the buddy on show (home.js applyLook, set before the page mounts this)
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true});
  r.setPixelRatio(Math.min(devicePixelRatio,1.5));   // 2026-10-06: was 2 (the phone ran hot)r.setClearColor(0,0);r.outputColorSpace=THREE.SRGBColorSpace;
  r.domElement.setAttribute('aria-hidden','true');host.append(r.domElement);
  const scene=new THREE.Scene();
  // Unified look (visual-style.js), aimed like the plate: warm key from the open door up right, rim from behind.
  const sun=new THREE.DirectionalLight();sun.position.set(6,9,7);sun.castShadow=true;sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:40});scene.add(sun,sun.target);
  const rim=new THREE.DirectionalLight();rim.position.set(5,6,-8);scene.add(rim);
  applyLook(r,scene,{sun,rim,shadowMap:LOOK.shadow.stableMap});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({opacity:.28}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);

  const shadow=o=>{o.traverse(m=>{if(m.isMesh)m.castShadow=m.receiveShadow=true;});return o;};
  const brush=shadow(assets.brush.clone());brush.scale.setScalar(BRUSH.scale);brush.visible=false;scene.add(brush);
  // The trough, in the user's colours by part; the food: a picture standing in it, facing the camera.
  const trough=shadow(assets.trough.clone());trough.rotation.y=TROUGH.yaw;trough.scale.setScalar(TROUGH.k);trough.position.set(TROUGH.at[0],0,TROUGH.at[1]);scene.add(trough);let feedPose=POSE.feed;
  {const mats={wood:new THREE.MeshStandardMaterial({color:TROUGH.wood,roughness:.8}),metal:new THREE.MeshStandardMaterial({color:TROUGH.metal,roughness:.5,metalness:.2})};
    trough.traverse(o=>{if(o.isMesh)o.material=mats[TROUGH.parts[o.name]||'wood'];});}
  const foodMat=new THREE.MeshBasicMaterial({transparent:true,alphaTest:.05,toneMapped:false}),food=new THREE.Mesh(new THREE.PlaneGeometry(1,1),foodMat);food.visible=false;scene.add(food);
  // A food picture has its own empty margin: what is drawn in it (its opaque box, measured once on a small canvas) is
  // made TROUGH.food across and set with its middle on the tray's edge, so half of the food itself shows, whatever it is.
  const foodInfo=new Map(),foodBase=new THREE.Vector3(TROUGH.at[0],TROUGH.rim*TROUGH.k*.9,TROUGH.at[1]);let foodNow=null;
  function placeFood(){const [x0,y0,x1,y1]=foodNow?.box||[0,0,1,1],S=TROUGH.food/Math.max(x1-x0,y1-y0);
    food.scale.setScalar(S);food.position.set(foodBase.x+(.5-(x0+x1)/2)*S,foodBase.y-S/2+(y0+y1)/2*S,foodBase.z);}
  const setFood=src=>{if(!src)return;let f=foodInfo.get(src);
    if(!f){f={tex:new THREE.Texture(),box:null};f.tex.colorSpace=THREE.SRGBColorSpace;foodInfo.set(src,f);const img=new Image();
      img.onload=()=>{f.tex.image=img;f.tex.needsUpdate=true;const n=64,c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,n,n);
        const d=g.getImageData(0,0,n,n).data;let x0=n,x1=-1,y0=n,y1=-1;for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(d[(y*n+x)*4+3]>40){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
        f.box=x1<0?[0,0,1,1]:[x0/n,y0/n,(x1+1)/n,(y1+1)/n];if(foodNow===f)placeFood();};img.src=src;}
    foodNow=f;foodMat.map=f.tex;foodMat.needsUpdate=true;placeFood();};
  // The feeding shot: the camera rises over the trough and looks straight down (the floor, see-through in the stall shot
  // so the painted barn shows, is a plain ground there).
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:TROUGH.ground,roughness:1,transparent:true,opacity:0}));ground.rotation.x=-Math.PI/2;ground.position.y=.002;ground.receiveShadow=true;ground.visible=false;scene.add(ground);
  const basePos=new THREE.Vector3(),topPos=new THREE.Vector3(),baseQ=new THREE.Quaternion(),topQ=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,-1),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0)));let camW=0;   // topQ: straight down, the buddy's side (+x) at the bottom of the screen: the trough lies across it and the head comes up from below (2026-10-05, the user's sketch)
  const hp=new THREE.Vector3(),eyeAt=new THREE.Vector3(),hq=new THREE.Quaternion();

  const cam=new THREE.PerspectiveCamera(CAM.fov,1,.3,60),page=host.closest('.page-stable');
  let model=null,bones=[],muzzle=null,raf=0,last=performance.now(),nod=0,job=null,w=0;   // w: act's neck pose weight
  // Mood state: fore / hind: how far each end is down (0 standing … 1 lying); still: s since the last touch; rear: s into
  // a rear (-1: none); queued: an act (or a rear) waiting for the horse to be up.
  let resting=false,fore=0,hind=0,still=0,restAfter=0,rear=-1,queued=null,joy=false,rig={},poses={},body=null;
  const soon=()=>MOOD.restAfter[0]+Math.random()*(MOOD.restAfter[1]-MOOD.restAfter[0]);restAfter=soon();
  if(new URLSearchParams(location.search).has('debug'))window.__stable={r,scene,cam,get model(){return model;},BUDDY};   // dev (?debug): the scene, to look at a pose from other angles; BUDDY, to try another bow live
  cam.rotation.set(-CAM.tilt*Math.PI/180,0,0);baseQ.copy(cam.quaternion);
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
    model=createApprovedHorse(0,null,false,null,true);model.seat.visible=false;
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
    // The trough stands in one place for every buddy (2026-10-05, the user). The buddy is the one that fits it: how far
    // it lowers (or, a low head, lifts: BUDDY bow / TROUGH.lift) its head is the pose that puts its mouth just over the
    // tray's edge, and it stands where that mouth is over the tray.
    {const rimY=TROUGH.rim*TROUGH.k,sp=BUDDY[model.species],dn=sp?.feed??POSE.feed,up=sp?.bow??TROUGH.lift,m=new THREE.Vector3();
      const poseAt=t=>Object.fromEntries(NECK.map(n=>[n,POSE.idle[n]+((t<0?up:dn)[n]-POSE.idle[n])*Math.abs(t)]));
      const at=t=>{const p=poseAt(t);for(const [b,base] of bones)b.quaternion.copy(base).multiply(q.setFromEuler(e.set(p[b.name],0,0)));
        model.root.updateMatrixWorld(true);return muzzle.mesh.getVertexPosition(muzzle.i,m).applyMatrix4(muzzle.mesh.matrixWorld);};
      let best=1,err=1e9;for(let t=-1;t<=1.001;t+=.1){const d=Math.abs(at(t).y-(rimY+.1));if(d<err){err=d;best=t;}}
      feedPose={...poseAt(best),turn:0};at(best);model.root.position.x+=TROUGH.at[0]+TROUGH.reach-m.x;model.root.position.z+=TROUGH.at[1]-m.z;
      for(const [b,base] of bones)b.quaternion.copy(base);model.root.updateMatrixWorld(true);}
  }
  // Feed: the food is in the trough, the buddy lowers its head, one bite and it is gone. Brush: it bows, the brush combs.
  function acting(dt){
    const a=ACTS[job.kind],t=job.t+=dt,end=a.hold;
    if(!job.peaked&&t>a.peak){job.peaked=true;job.onPeak?.();}
    if(job.kind==='feed'){if(!job.ate&&!food.visible)food.visible=true;if(!job.ate&&t>a.bite){job.ate=true;nod=.9;food.visible=false;}
      w=Math.min(1,Math.max(0,(t-a.down[0])/.6),Math.max(0,(a.down[1]-t)/.6));}   // (the look-straight-down shot was tried and dropped the same day: TROUGH.top, topPos and camW stay 0)
    else{brush.visible=t>.2&&t<end;w=0;}   // the brush: the buddy stands as it is
    if(t>end+.6){job=null;w=camW=0;brush.visible=food.visible=false;}
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
    // 2026-10-08 (the user: 「14 砍掉」): the buddy no longer lies down when left alone (resting stays false; the LIE pose is unused).
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
    const d=Math.min(CAM.dist[1],Math.max(CAM.dist[0],CAM.fill*h/w));basePos.set(CAM.x,CAM.floor*d,HORSE.z+d);cam.position.copy(basePos);
    cam.fov=CAM.fov;cam.aspect=w/h;cam.updateProjectionMatrix();}
  const ro=new ResizeObserver(fit);ro.observe(host);
  const q=new THREE.Quaternion(),e=new THREE.Euler();
  function frame(now){if(now-last<(job?29:46)){raf=requestAnimationFrame(frame);return;}   // 30 pictures a second while it eats or is brushed, 20 standing
    const dt=Math.min(.1,(now-last)/1000);last=now;nod=Math.max(0,nod-dt);
    moods(dt);if(job)acting(dt);
    model.mixer.update(dt);
    const bob=Math.sin((1-nod/.9)*Math.PI*2)*.08*(nod>0),to=job?(job.kind==='feed'?feedPose:BUDDY[model.species]?.bow??POSE.brush):POSE.idle;   // a soft chew-nod (the bite)
    for(const [b,base] of bones){const n=b.name,p=POSE.idle[n]+(to[n]-POSE.idle[n])*w+bob*(n==='Head'?1:.3),t=(to.turn||0)*w*(TURN[n]||0);
      b.quaternion.copy(base).multiply(q.setFromEuler(e.set(p,0,t)));}   // from rest every frame: the idle clip doesn't key these
    moodPose();watch(cam.position,smooth(fore));if(body?.morphTargetInfluences)body.morphTargetInfluences[0]=smooth(hind);model.updateAttachment();
    model.eyes.update(dt,cam.position);   // it looks at whoever is looking at it
    if(brush.visible)aimProps();
    food.quaternion.copy(cam.quaternion);
    cam.position.lerpVectors(basePos,topPos,camW);cam.quaternion.slerpQuaternions(baseQ,topQ,camW);if(cam.fov!==(cam.fov=CAM.fov+(TROUGH.fov-CAM.fov)*camW)){cam.near=camW>0?.05:.3;cam.updateProjectionMatrix();}ground.visible=camW>0;ground.material.opacity=Math.min(1,camW*1.6);
    r.render(scene,cam);raf=requestAnimationFrame(frame);}
  // The brush works by itself on the flank the camera sees: back and forth along the body, bristles (its −Y) to the coat.
  const at=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0),strap=new THREE.Vector3(0,BRUSH.strap,0),bq=new THREE.Quaternion().setFromUnitVectors(down,new THREE.Vector3(...BRUSH.dir).normalize());
  function aimProps(){
    const b=model.content.getObjectByName(BRUSH.bone);if(!b)return;scene.updateMatrixWorld();b.getWorldPosition(at);
    const s=Math.sin((job?.t||0)*6.5);at.x+=BRUSH.at[0]+BRUSH.stroke*s;at.y+=BRUSH.at[1]+.06*Math.cos((job?.t||0)*13);at.z+=BRUSH.at[2]+(BUDDY[model.species]?.wide??0);
    brush.quaternion.copy(bq);brush.position.copy(at).sub(strap.clone().applyQuaternion(bq).multiply(brush.scale));}
  show();fit();raf=requestAnimationFrame(frame);
  // show: the ranch page can change the buddy without leaving (its row of heads, 2026-10-05), so the model of the one
  // asked for is loaded first; a later request wins, and nothing is shown once the view is gone.
  let gone=false;
  if(window.__stable)window.__stable.act=(kind,t=.7,img)=>{setFood(img);job={kind,t,ate:false,peaked:true};};   // dev (?debug): jump into an act at t s (a hidden tab draws one frame at a time)
  const api={show:()=>{const c=PLAYER_LOOK.coat;Promise.all([preloadKeys(needs()),preloadBuddies([c])]).then(()=>{if(gone||c!==PLAYER_LOOK.coat)return;show();fit();});},
    react(kind,onPeak,foodImg){if(job||queued||!ACTS[kind])return;api.wake();if(kind==='feed')setFood(foodImg);const go=()=>{job={kind,t:0,ate:false,peaked:false,onPeak};};
      if(fore||hind)queued=go;else go();},
    wake(){still=0;restAfter=soon();resting=false;},   // any touch: stand up (if lying) and start the rest timer over
    cheer(){api.wake();joy=true;},                // a bar just filled: rear for joy once it is up and done
    get busy(){return !!(job||queued);},
    dispose(){gone=true;cancelAnimationFrame(raf);ro.disconnect();r.dispose();r.domElement.remove();page?.style.removeProperty('--bg-x');page?.style.removeProperty('--bg-f');}};
  if(window.__stable)window.__stable.show=api.show;
  return api;
}
