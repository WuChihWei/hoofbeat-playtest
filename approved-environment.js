import {fencePose} from './track-presentation.mjs?v=r304';
import {PRESENTATION as P,PHONE} from './presentation-config.mjs?v=r304';
import * as THREE from './vendor/three.module.min.js';
import {applyLook,LOOK,raceGrade} from './visual-style.js?v=r304';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {approvedAssets,scenePictures} from './approved-assets.js?v=r304';
import {HORSE_Z,roadPose} from './race-world.js?v=r304';
import {cityById,CITIES} from './course/cities/index.mjs?v=r304';
import {modelFor} from './course/assets.mjs?v=r304';
// The release tag the page loaded this module with (?v=…): the paintings and cards carry it too, so a picture replaced
// under the same name is fetched again instead of coming from the browser's cache.
const TAG=new URL(import.meta.url).search;
import {installFarBackground,sunDirection} from './far-background.js?v=r304';

// The race dressing comes from the city pack (course/cities/<id>.mjs): barrier, prop rows, treeline, weather, backdrop.
const packFor=id=>cityById(id)||cityById('stockholm')||CITIES[0];
// Every model file a city's dressing needs (slice-app preloads them with the fixed presentation set).
export function cityModels(id){
 const d=packFor(id).dressing,ids=[d.barrier.asset,d.barrier.far||'Fence_Wood',...d.rows.map(r=>r.asset),...d.treeline.assets];
 return [...new Set([lite(modelFor(d.barrier.asset)),...ids.map(modelFor).filter(Boolean).flatMap(m=>[near(m),m.far])].filter(Boolean))];
}

// Every picture a city's scene asks for as it is built: its far painting (or backdrop), the two ground tiles, and its
// painted cards and fence (course/assets.mjs C / F). home.js asks for them ahead of a race, so the scene finds them in
// the browser's cache: it is shown only once they are all in (approved-assets scenePictures).
export function cityPictures(id){
 const pack=packFor(id),D=pack.dressing,files=new Set(['textures/grass.webp','textures/dirt.webp']);
 const add=asset=>{const m=modelFor(asset);if(m?.variants)m.variants.forEach(add);else{const f=m?.card?.file||m?.fence?.file;if(f)files.add(f+TAG);}};
 [D.barrier.asset,...D.rows.map(r=>r.asset),...D.treeline.assets,...(D.skyline||[]).map(c=>c[0])].forEach(add);
 files.add(pack.background?`panoramas/${pack.background.panorama}${TAG}`:`backdrops/${pack.backdrop}`);
 return [...files].map(f=>new URL('./assets/'+f,import.meta.url).href);
}

// Phones draw the lighter copy of a model up close where there is one (course/assets.mjs lite).
const near=m=>PHONE&&m.lite||m.file,lite=m=>m.lite||m.file;   // lite: barriers, on every device (the full ones are ~3× the triangles for detail the grain now carries)
// Render-only instancing of existing static assets. No simulation or source asset edits.
export function installApprovedEnvironment(renderer){
 const r=renderer,pack=packFor(r.city),D=pack.dressing,W=pack.weather;
 r.road.width=P.track.width;r.verge.width=P.track.vergeWidth;r.finish.scale.x=P.track.width/r.finish.geometry.parameters.width;
 for(const mesh of [r.trunks,r.crowns,r.posts,r.rails,r.pathMarks,...r.hills])mesh.visible=false;
 function batch(key,count,tint=null){
  const source=approvedAssets.get(key).scene;source.updateMatrixWorld(true);
  const groups=new Map();source.traverse(o=>{
   if(!o.isMesh)return;
   const g=o.geometry.clone().applyMatrix4(o.matrixWorld);
   const list=groups.get(o.material)||[];list.push(g);groups.set(o.material,list);
  });
  return [...groups].map(([mat,list])=>{
   const geometry=mergeGeometries(list);list.forEach(g=>g.dispose());
   const m=r.own(mat.clone());if(tint?.[m.name])m.color.set(tint[m.name]);
   return r.instances(r.own(geometry),m,count);
  });
 }
 // Rows and barrier run the whole 400 m to the far end of the road; beyond LOD_Z models with a light LOD switch to it.
 // Phones: the simple models from 90 m in and every other prop / treeline tree left out (presentation-config PHONE).
 // Props with no light model (lamps ~5,900 triangles, planters ~3,000) stop at PHONE_END on phones: fogged and tiny there.
 const FAR_LOOP=400,LOD_Z=PHONE?-90:-170,PHONE_END=-200,thin=i=>PHONE&&i%2===1;
 const rnd=a=>{const x=Math.sin(a*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
 const native=new Map(),box=file=>{if(!native.has(file)){const b=new THREE.Box3().setFromObject(approvedAssets.get(file).scene);native.set(file,{h:b.max.y-b.min.y,w:b.max.x-b.min.x,y:b.min.y});}return native.get(file);};
 // A prop kind = one model (+ far LOD) with one tint (the pack's over the stand-in's); count everything first, then batch.
 const kinds=new Map();
 function kind(asset,count,tint,pick=near){
  const m=modelFor(asset);if(m.variants)return {variants:m.variants.map(a=>kind(a,count,tint,pick))};   // one of them per placed object
  const key=asset+JSON.stringify(tint||{}),k=kinds.get(key)||{file:pick(m),farFile:m.far,card:m.card,fence:m.fence,tint:{...m.tint,...tint},n:0};
  k.n+=count;kinds.set(key,k);return k;
 }
 const sidesOf=row=>row.side==='left'?[-1]:row.side==='right'?[1]:[-1,1];
 // Barrier bays: the model at its own proportions, stretched lengthwise by at most STRETCH (longer bays pulled the posts
 // and rails out of shape), never longer than 9.9 m.
 const STRETCH=1.25,FENCE=modelFor(D.barrier.asset).fence,FH=D.barrier.height*P.track.fenceHeight;   // FENCE: a built fence (course/assets.mjs F): its own proportions, no stretching
 const bn=FENCE?{w:FENCE.aspect,h:1,y:0}:box(lite(modelFor(D.barrier.asset))),BAY=FENCE?FENCE.aspect*FH:Math.min(9.9,bn.w*FH/bn.h*STRETCH),BAYS=Math.ceil(412/BAY);
 const TINT=new THREE.Color(),GT=pack.grassTint||[1,1,1];   // GT: the pack's tint on the shared grass
 // tree: trees and shrubs get a wide spread of sizes and a slight tint each; loose: natural things (anything with
 // variants, shrubs, rocks) stand unevenly, with gaps; row.reach: only this far ahead (small plants).
 const rows=D.rows.map((row,k)=>{const n=Math.ceil(FAR_LOOP/row.every),kd=kind(row.asset,n*sidesOf(row).length,row.tint);
  return {...row,k,n,kind:kd,tree:/^(Tree|Shrub)/.test(row.asset),loose:!!kd.variants||/^(Shrub|Rock)/.test(row.asset)};});
 const treeline=Array.from({length:D.treeline.count},(_,j)=>kind(D.treeline.assets[j%D.treeline.assets.length],1,D.treeline.tint));
 // Skyline cards (pack dressing.skyline: [asset, x, z, height] in metres, right of / ahead of the road's start): painted
 // buildings, a far bank, a bridge. They stand still beyond the treeline (Mid layer), in front of the far painting and
 // like it never slide with the road; fogged like everything else, so they read as further off than the trees.
 const skyline=(D.skyline||[]).map(([asset,x,z,h])=>({k:kind(asset,1),x,z,h}));
 const TL=D.treeline;   // spread (±m) / depth [m] / height [m]: the uneven mid treeline; without spread the original fixed row
 const barrier=kind(D.barrier.asset,BAYS*2,null,lite),barrierFar=FENCE?barrier:kind(D.barrier.far||D.barrier.asset,BAYS*2);
 // A card kind (course/assets.mjs C): its picture on an upright plane one unit tall, unlit (the light is painted in),
 // cut out by alpha test, with a soft shadow on the ground under it (the same matrix places both).
 const CARD={h:1,w:1,y:0};
 // The painted cards are unlit: LOOK.race.card (saturation) and cardValue (brightness) hold them back, so the track, the
 // horses and the controls stand out (2026-10-04).
 const cardLook=m=>{m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   {float cl=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(cl),diffuseColor.rgb,${LOOK.race.card.toFixed(3)})*${LOOK.race.cardValue.toFixed(3)};}`);};m.customProgramCacheKey=()=>'hoofbeat-card'+LOOK.race.card+'-'+LOOK.race.cardValue;return m;};
 function cardBatch(card,count){
  const tex=r.own(new THREE.TextureLoader(scenePictures).load(new URL(`./assets/${card.file}${TAG}`,import.meta.url).href));tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  const s=card.scale,plane=r.instances(r.own(new THREE.PlaneGeometry(card.aspect*s,s).translate((.5-card.anchor)*card.aspect*s,s/2,0)),cardLook(r.own(new THREE.MeshBasicMaterial({map:tex,alphaTest:.5,side:THREE.DoubleSide}))),count);
  if(card.shade===false)return [plane];
  const shade=r.own(r.shadowMaterial.clone()),[sw,sd]=(card.shade||[card.aspect*1.5,card.aspect*.8]).map(v=>v*s);shade.side=THREE.DoubleSide;
  return [plane,r.instances(r.own(new THREE.PlaneGeometry(sw,sd).rotateX(-Math.PI/2).translate(0,.003,0)),shade,count)];
 }
 // A built fence: the balustrade's picture on 12 triangles a bay. The post is a box (the post's picture on its four sides, a
 // plain stone texel on top), the span a flat panel beside it (rail, balusters and plinth cut out), the bay `aspect` long
 // and 1 high, centred, the post at its far end: bay after bay it is span, post, span, post. Unlit like the cards, a
 // little darker on the post's sides and lighter on top.
 function fenceBatch({file,aspect,post},count){
  const tex=r.own(new THREE.TextureLoader(scenePictures).load(new URL(`./assets/${file}${TAG}`,import.meta.url).href));tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  const pw=post*aspect,xp=aspect/2-pw,d=pw/2,pos=[],uv=[],col=[],idx=[];
  const quad=(c,u,shade)=>{const i=pos.length/3;for(const p of c)pos.push(...p);for(const q of u)uv.push(...q);for(let k=0;k<4;k++)col.push(shade,shade,shade);idx.push(i,i+1,i+2,i,i+2,i+3);};
  const POST=[[0,0],[post,0],[post,1],[0,1]],SPAN=[[post,0],[1,0],[1,1],[post,1]],TOP=Array(4).fill([post/2,.93]);
  quad([[-aspect/2,0,0],[xp,0,0],[xp,1,0],[-aspect/2,1,0]],SPAN,1);
  quad([[xp,0,d],[xp+pw,0,d],[xp+pw,1,d],[xp,1,d]],POST,1);quad([[xp+pw,0,-d],[xp,0,-d],[xp,1,-d],[xp+pw,1,-d]],POST,1);
  quad([[xp,0,-d],[xp,0,d],[xp,1,d],[xp,1,-d]],POST,.86);quad([[xp+pw,0,d],[xp+pw,0,-d],[xp+pw,1,-d],[xp+pw,1,d]],POST,.86);
  quad([[xp,1,d],[xp+pw,1,d],[xp+pw,1,-d],[xp,1,-d]],TOP,1.05);
  const g=r.own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);
  return [r.instances(g,r.own(new THREE.MeshBasicMaterial({map:tex,alphaTest:.5,side:THREE.DoubleSide,vertexColors:true})),count)];
 }
 for(const k of kinds.values()){k.near=k.card?cardBatch(k.card,k.n):k.fence?fenceBatch(k.fence,k.n):batch(k.file,k.n,k.tint);k.far=k.farFile?batch(k.farFile,k.n,k.tint):null;}
 // Painted look for a barrier model (no plastic sheen): fully matte, no reflections; shaded by height in the model (dark
 // at the foot, light at the top: grad), mottled with soft blotches, cooler in the darks and warmer in the lights (brush
 // dabs; `freq` blotches per model height, `amp` how strong), and a fine speckle (grain: rough stone, weathered wood).
 const paint=(m,n,{grad,freq,amp,grain})=>{m.roughness=1;m.metalness=0;m.envMapIntensity=.12;
  m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPaint;').replace('#include <begin_vertex>',`#include <begin_vertex>\nvPaint=(position-vec3(0.,${n.y.toFixed(3)},0.))/${n.h.toFixed(3)};`);
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vPaint;
float pH(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
float pN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(pH(i),pH(i+vec3(1,0,0)),f.x),mix(pH(i+vec3(0,1,0)),pH(i+vec3(1,1,0)),f.x),f.y),mix(mix(pH(i+vec3(0,0,1)),pH(i+vec3(1,0,1)),f.x),mix(pH(i+vec3(0,1,1)),pH(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
    .replace('#include <color_fragment>',`#include <color_fragment>
float pn=${PHONE?`pN(vPaint*${freq.toFixed(1)})`:`.65*pN(vPaint*${freq.toFixed(1)})+.35*pN(vPaint*${(freq*3.1).toFixed(1)})`};
diffuseColor.rgb*=mix(${grad[0].toFixed(2)},${grad[1].toFixed(2)},smoothstep(.15,1.,vPaint.y))*mix(vec3(1.)-${amp.toFixed(2)}*vec3(1.,.6,.1),vec3(1.)+${amp.toFixed(2)}*vec3(.7,.5,-.3),smoothstep(.3,.7,pn))*(1.+${grain.toFixed(2)}*(pN(vPaint*${(freq*14).toFixed(1)})+pN(vPaint*${(freq*37).toFixed(1)})-1.));`);};
  m.customProgramCacheKey=()=>'paint'+[n.y,n.h,grad,freq,amp,grain].join();};
 if(!FENCE)for(const k of new Set([barrier,barrierFar]))for(const mesh of k.near)paint(mesh.material,box(k.file),{grad:[.74,1.06],freq:5,amp:.12,grain:.16});
 // Ground bands that follow the road (like the lane lines): a ragged grass edge over the seam between dirt and verge,
 // and a soft dark band under each fence (it casts no shadow: without it the fence floats).
 const edgeTex=r.texture((c,w,h)=>{let seed=7;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  c.fillStyle='#84a65c';c.fillRect(w*.4,0,w*.6,h);
  for(let i=0;i<26;i++){const y=rnd()*h,rad=(.07+.16*rnd())*w;for(const dy of [-h,0,h]){c.beginPath();c.ellipse(w*.4,y+dy,rad,rad*(1+rnd()),0,0,Math.PI*2);c.fill();}}   // clumps: an uneven edge that reads from the saddle
  for(let i=0;i<700;i++){const y=rnd()*h,len=(.12+.3*rnd()*rnd())*w,half=2+rnd()*4,lean=(rnd()-.5)*14;c.fillStyle=['#84a65c','#72914c','#96b56b','#7a9c52'][i%4];
   for(const dy of [-h,0,h]){c.beginPath();c.moveTo(w*.36,y+dy-half);c.lineTo(w*.36-len,y+dy+lean);c.lineTo(w*.36,y+dy+half);c.fill();}}
  for(let i=0;i<500;i++){const x=w*(.4+.6*rnd()),y=rnd()*h;c.strokeStyle=rnd()>.5?'#68854566':'#aec67a55';c.beginPath();c.moveTo(x,y);c.lineTo(x-3-rnd()*4,y+(rnd()-.5)*5);c.stroke();}
 },128,256);
 const EDGE_TILE=5,bandTex=(t,flip,tile=EDGE_TILE)=>{const x=t.clone();x.wrapS=x.wrapT=THREE.RepeatWrapping;x.repeat.set(flip?-1:1,390/tile);x.offset.x=flip?1:0;x.needsUpdate=true;return r.own(x);};
 // Dappled tree shade (the mock-ups have it across the track): soft dark leaf-cluster blobs, thick toward the trees and
 // thinning out toward the middle of the track, from `inner` m off the centre line outward over `width` m, repeating
 // every `tile` m and moving with the ground. It lies over the road and the lawn; nothing casts it.
// The dirt is lit brighter and warmer than its tile (the reference's track: clean orange-tan).
 const CLEAN=[1.25,1.1,1.08];
 const DAPPLE={inner:P.track.width/2-4.7,width:8.4,tile:16.8,alpha:.35};   // inner: it starts 4.7 m inside the dirt's edge, whatever the track's width   // alpha: how dark the shade is (1 read as dirt on the track: the reference is clean and bright)
 const dappleTex=r.texture((c,w,h)=>{let seed=29;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const blob=(x,y,rx,a)=>{for(const dy of [-h,0,h]){const g=c.createRadialGradient(x,y+dy,0,x,y+dy,rx);g.addColorStop(0,`rgba(26,34,22,${a.toFixed(3)})`);g.addColorStop(.55,`rgba(26,34,22,${(a*.85).toFixed(3)})`);g.addColorStop(1,'rgba(26,34,22,0)');
   c.save();c.translate(x,y+dy);c.scale(1,.5);c.translate(-x,-(y+dy));c.fillStyle=g;c.beginPath();c.arc(x,y+dy,rx,0,Math.PI*2);c.fill();c.restore();}};
  // one body of shade, deepest by the trees…
  const g=c.createLinearGradient(0,0,w,0);g.addColorStop(.12,'rgba(26,34,22,0)');g.addColorStop(.4,'rgba(26,34,22,.2)');g.addColorStop(1,'rgba(26,34,22,.36)');c.fillStyle=g;c.fillRect(0,0,w,h);
  // …with sunlight coming through in patches (more of it toward the open track), and loose islands of shade beyond its edge
  c.globalCompositeOperation='destination-out';for(let i=0;i<120;i++){const u=rnd();blob(u*w,rnd()*h,(14+rnd()*40)*(1.35-.8*u),.5+.5*rnd());}
  c.globalCompositeOperation='source-over';for(let i=0;i<46;i++){const u=.08+.5*rnd();blob(u*w,rnd()*h,16+rnd()*40,.14+.16*rnd());}
 },512,512);
 const shadeTex=r.texture((c,w,h)=>{const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(24,34,20,0)');g.addColorStop(.5,'rgba(24,34,20,.34)');g.addColorStop(1,'rgba(24,34,20,0)');c.fillStyle=g;c.fillRect(0,0,w,h);},64,4);
 const bands=[-1,1].flatMap(side=>{
  const grass=r.own(new THREE.MeshStandardMaterial({map:bandTex(edgeTex,side<0),color:'#f2fff0',roughness:1,transparent:true,depthWrite:false}));grass.color.multiply(TINT.setRGB(...GT));
  const shade=r.own(new THREE.MeshBasicMaterial({map:shadeTex,transparent:true,depthWrite:false}));
  // Tree shade across the track's edge and the lawn behind the fence (DAPPLE): full on the left, where the sun is, lighter on the right.
  const dapple=r.own(new THREE.MeshBasicMaterial({map:bandTex(dappleTex,side<0,DAPPLE.tile),transparent:true,depthWrite:false,opacity:(side<0?1:.55)*DAPPLE.alpha}));
  return [{...r.strip(2.2,.012,grass),offset:side*(P.track.width/2+.05),map:grass.map,tile:EDGE_TILE},{...r.strip(1.5,.016,shade),offset:side*P.track.fenceX},
   {...r.strip(DAPPLE.width,.02,dapple),offset:side*(DAPPLE.inner+DAPPLE.width/2),map:dapple.map,tile:DAPPLE.tile}];});
 for(const b of bands){const mesh=r.scene.children.find(o=>o.geometry===b.geometry);mesh.receiveShadow=true;mesh.renderOrder=1;}
 const lod=[...kinds.values()].flatMap(k=>[k.near,k.far]).filter(Boolean);
 const relay=approvedAssets.get('relay').scene.clone(true);r.scene.add(relay);relay.scale.set(...P.relay.scale);
 relay.getObjectByName('HOOFBEAT_lettering').visible=false;
 // The reference's gate: royal-blue roof and sign board (the model's are forest teal), the sign reading RELAY / LAP n.
 relay.traverse(o=>{if(o.isMesh&&o.material.name==='Forest teal roof')o.material.color.set('#2e5cac');});
 const signMap=(text,ground='#1e4a96')=>r.texture((c,w,h)=>{c.fillStyle=ground;c.fillRect(0,0,w,h);c.fillStyle='#fff8e6';c.font='bold 62px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2);},512,128);
 const labelMap=signMap('RELAY'),lapMaps=[];
 const label=r.mesh(r.own(new THREE.PlaneGeometry(1.48,.37)),r.own(new THREE.MeshBasicMaterial({map:labelMap})),relay);label.position.set(0,1.8,.84);
 // Flat white clouds (lit spheres read as grey storm clouds from below).
 const cloudWhite=r.own(new THREE.MeshBasicMaterial({color:'#ffffff'}));
 // Placed where the reference has its clouds: screen ≈(280,225), (660,192) and the two top corners. [x, y, size]; 3 puffs each.
 const cloudSpots=[[-15.5,27,1],[15.4,30,.75],[-36,39,.5],[36,38,.4]];
 r.clouds.children.forEach((c,k)=>{
  const s=cloudSpots[Math.floor(k/3)],j=k%3;if(!s){c.visible=false;return;}
  c.material=cloudWhite;c.position.set(s[0]+(j-1)*5*s[2],s[1]+(j===1?1.3*s[2]:0),-154);c.scale.set(4.55*s[2],(j===1?2.9:1.95)*s[2],2.6*s[2]);
 });
 // Fence, banners, rocks, trees, jump, coin and relay carry their palette colours and baked AO (race_restyle.py).
 // The fence model has a post at both ends, so neighbouring segments doubled up into pickets. Keep only the +x post.
 for(const k of kinds.values())if(k.file==='fence/Fence.glb')for(const mesh of k.near){
  const g=mesh.geometry,p=g.attributes.position,idx=g.index?Array.from(g.index.array):[...Array(p.count).keys()],keep=[];
  const inLeftPost=i=>{const x=p.getX(i);return x>-1.235&&x<-.965;};
  for(let i=0;i<idx.length;i+=3)if(!(inLeftPost(idx[i])&&inLeftPost(idx[i+1])&&inLeftPost(idx[i+2])))keep.push(idx[i],idx[i+1],idx[i+2]);
  g.setIndex(keep);
 }
 // Unified look (visual-style.js / docs/VISUAL_STYLE.md): sky IBL, warm key with soft shadows, sky fill, warm rim.
 const sun=r.sun;sun.castShadow=true;
 Object.assign(sun.shadow.camera,{left:-26,right:26,top:30,bottom:-30,near:1,far:170});sun.shadow.camera.updateProjectionMatrix();
 sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;r.scene.add(sun.target);
 const hemi=r.scene.children.find(o=>o.isHemisphereLight);
 // Rim light from up the track (no shadows): picks out the riders' and horses' silhouettes against the dirt, like the reference.
 const rim=new THREE.DirectionalLight();rim.position.set(26,22,HORSE_Z-60);rim.target.position.set(0,1.5,HORSE_Z);r.scene.add(rim,rim.target);
 // Scene layers: Near (track, runners, fence, props by the fence) · Mid (existing trees/rocks further out: the moving mid
 // rows and the far treeline, softened by fog) · Far (the city's panorama, far-background.js; else the gradient sky
 // and the flat backdrop card below). With a panorama the key light comes from its painted sun.
 const BG=pack.background,SUN=BG?sunDirection(BG):new THREE.Vector3(-34,44,32).normalize();
 const aimSun=()=>{sun.target.position.set(0,0,HORSE_Z-10);sun.position.copy(sun.target.position).addScaledVector(SUN,60);sun.target.updateMatrixWorld();};
 aimSun();  // set before applyLook: the sky glow is baked toward the sun
 applyLook(r.r,r.scene,{sun,fill:hemi,rim,shadowMap:LOOK.shadow.raceMap});
 if(BG&&hemi)hemi.color.lerp(new THREE.Color(BG.ambientColor),LOOK.race.skyFill);   // the fill takes a little of the painted sky
 // Race look (LOOK.race): stronger key against less fill / sky light, stronger rim, the saturation grade.
 if(hemi)hemi.intensity=LOOK.race.fill;r.scene.environmentIntensity=LOOK.race.env;rim.intensity=LOOK.race.rim;
 r.r.toneMappingExposure=LOOK.race.exposure;raceGrade(r.r);
 // Far layer. Panorama city: far-background.js (sky, clouds, far land, skyline in one painting). Otherwise the
 // gradient dome (blue overhead to pale haze at the horizon = fog colour) with the backdrop card and mountains below.
 const far=BG?installFarBackground(r.scene,BG,new URL(`./assets/panoramas/${BG.panorama}${TAG}`,import.meta.url).href,x=>r.own(x),scenePictures):null;
 if(far)r.clouds.children.forEach(c=>c.visible=false);   // the painting has its own clouds
 const sky=far?null:r.mesh(r.own(new THREE.SphereGeometry(1000,32,16)),r.own(new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false,
  uniforms:{top:{value:new THREE.Color(W.sky.top)},hor:{value:new THREE.Color(W.sky.horizon)}},
  vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 top,hor;varying vec3 vP;void main(){gl_FragColor=vec4(mix(hor,top,pow(smoothstep(-.02,.32,vP.y),.8)),1.);\n#include <colorspace_fragment>\n}'})));
 if(sky){sky.renderOrder=-1;sky.frustumCulled=false;}
 const meshOf=geometry=>r.scene.children.find(o=>o.geometry===geometry);
 for(const m of [meshOf(r.road.geometry),meshOf(r.verge.geometry),r.ground])if(m)m.receiveShadow=true;
 // Only near, on-track casters get shadows: roadside scenery shadows land on grass nobody sees, and doubled their triangle cost.
 // Fence casts no shadow: its rail/post shadow read as a second fence beside it.
 for(const parts of lod)for(const m of parts){m.castShadow=false;m.receiveShadow=true;}
 // The road now runs ~390 m to a treeline, with mountains behind it: push the far plane out and the near plane up (depth precision at 400 m).
 r.camera.near=1;r.camera.far=1200;r.camera.updateProjectionMatrix();
 r.ground.scale.set(2.6,2.6,1);
 // Grass: a painted lawn tile (assets/textures/grass.webp, tools/grass.py: seamless, in the game's lawn colour), GRASS_M metres a
 // tile, repeated over the whole lawn and the verge (one load each: the browser serves the second from its cache).
 const GRASS_M=4,grassTile=(rx,ry)=>{const t=r.own(new THREE.TextureLoader(scenePictures).load(new URL('./assets/textures/grass.webp',import.meta.url).href));
  t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;t.repeat.set(rx,ry);return t;};
 const groundTex=grassTile(620*2.6/GRASS_M,620*2.6/GRASS_M);r.grassMaterial.map=groundTex;r.grassMaterial.needsUpdate=true;
 const vergeTex=grassTile(P.track.vergeWidth/GRASS_M,390/GRASS_M);r.vergeMaterial.map=vergeTex;r.vergeMaterial.needsUpdate=true;
 relay.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
 // The track: a painted dirt tile (assets/textures/dirt.webp, tools/tile.py: seamless, in the track's colour), DIRT_M metres a tile.
 const DIRT_M=4.2,dirt=r.own(new THREE.TextureLoader(scenePictures).load(new URL('./assets/textures/dirt.webp',import.meta.url).href));
 dirt.colorSpace=THREE.SRGBColorSpace;dirt.wrapS=dirt.wrapT=THREE.RepeatWrapping;dirt.repeat.set(P.track.width/DIRT_M,390/DIRT_M);dirt.anisotropy=8;r.roadMaterial.map=dirt;r.roadMaterial.needsUpdate=true;
 // City backdrop (assets/backdrops/<city>.webp: the painted skyline cropped at its lawn line, top and sides faded to alpha)
 // stands in for the mountains: a flat card far behind the treeline, lawn line on the ground, unlit and unfogged.
 const BACKDROP={z:-700,width:290};
 let card=null;
 if(pack.backdrop&&!far){
  const tex=r.own(new THREE.TextureLoader(scenePictures).load(new URL(`./assets/backdrops/${pack.backdrop}`,import.meta.url).href,t=>{
   card.scale.y=BACKDROP.width*t.image.height/t.image.width;card.position.y=card.scale.y/2-4;}));
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  card=r.mesh(r.own(new THREE.PlaneGeometry(1,1)),r.own(new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,fog:false,toneMapped:false})));
  card.scale.set(BACKDROP.width,0,1);card.position.set(0,0,BACKDROP.z);card.renderOrder=-.5;
  r.clouds.children.forEach(c=>c.visible=false);   // the painting has its own clouds
 }
 // Mountains: a faceted range centred behind the relay gate like the reference (peaks at y≈230-330), behind the far treeline.
 // Snow caps keep them reading as mountains, not rocks. [x, height, z]; the nearer ridge is the deeper blue.
 if(!pack.backdrop&&!far){const peakGeo=r.own(new THREE.ConeGeometry(1,1,6)),capGeo=r.own(new THREE.ConeGeometry(1,1,6));
 const snow=r.material('#f4f6ff'),range=r.material('#7d95c8'),haze=r.material('#a3b5d6');snow.fog=range.fog=haze.fog=false;
 for(const [x,h,z] of [[0,94,-675],[-40,85,-665],[36,82,-668],[-68,69,-700],[58,69,-700],[-97,59,-690],[86,62,-690],[-20,72,-720],[18,70,-720],[-130,52,-700],[125,50,-700]]){
  const w=h*.75,a=x*.05,m=z>-670?range:haze;
  const peak=r.mesh(peakGeo,m);peak.position.set(x,h/2-2,z);peak.scale.set(w,h,w*.8);peak.rotation.y=a;
  const cap=r.mesh(capGeo,snow);cap.position.set(x,h-2-h*.11,z);cap.scale.set(w*.22,h*.22,w*.22*.8);cap.rotation.y=a;
 }}
 // The active slice uses the same low bar/posts and the same hurdle state machine.
 const jumpSource=approvedAssets.get('jump').scene;
 for(const row of r.hurdleModels)row.forEach((entry,i)=>{
  entry.lane=[0,-2.2,2.2][i];const g=entry.group;g.scale.x=i===0?P.hurdle.span/2.1:1;g.scale.y=P.hurdle.visualHeight;
  // Swap the box posts/rails for the approved jump; it rides on the beam so a knocked rail still tips and drops.
  g.children.forEach(c=>{if(c!==entry.beam&&c!==entry.marker)c.visible=false});entry.beam.children.forEach(c=>c.visible=false);
  const jump=jumpSource.clone(),s=P.hurdle.visualWidth*.95;jump.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  jump.scale.set(s*P.hurdle.jumpScale[0]*(i===0?P.hurdle.span/P.hurdle.visualWidth:1)/g.scale.x,s*P.hurdle.jumpScale[1]/g.scale.y,s);jump.position.y=-entry.beam.position.y;entry.beam.add(jump);
 });
 // Weather: cloud greys the sky and softens the sun; rain adds the renderer's rain streaks and puddles on top.
 const wet=W.rain||0,grey=Math.max(W.cloud||0,wet),OVERCAST=new THREE.Color('#9aa8b2');
 if(sky){sky.material.uniforms.top.value.lerp(OVERCAST,grey*.6);sky.material.uniforms.hor.value.lerp(OVERCAST,grey*.45);}
 const fogColor=far?new THREE.Color(BG.fogColor):sky.material.uniforms.hor.value.clone(),fog=[W.fog[0]*(1-.4*wet)*LOOK.race.fog[0],W.fog[1]*(1-.5*wet)*LOOK.race.fog[1]],sunColor=new THREE.Color(BG?.keyLightColor??W.sun.color);
 if(card)card.material.color.set('#ffffff').lerp(OVERCAST,grey*.5);
 // One gate model serves every handoff and the finish (only one is ever in view): its sign swaps RELAY / FINISH.
 const finishMap=signMap('FINISH','#1d2622');
 // Every ground surface moves at the true race speed: texture offsets in tiles = metres travelled / metres per tile.
 const groundTile=620*r.ground.scale.y/groundTex.repeat.y,vergeTile=390/vergeTex.repeat.y;
 return {relay,update(distance,turn=0,race=null){
  groundTex.offset.y=distance/groundTile;vergeTex.offset.y=distance/vergeTile;
  // configure() re-applies the legacy palette every frame; the approved slice look wins here.
  r.roadMaterial.color.setRGB(...CLEAN);r.grassMaterial.color.setRGB(...GT);r.vergeMaterial.color.set('#f2fff0').multiply(TINT.setRGB(...GT));
  sky?.position.copy(r.camera.position);far?.update(r.camera);r.scene.fog.color.copy(fogColor);r.scene.fog.near=fog[0];r.scene.fog.far=fog[1];
  sun.intensity=LOOK.race.sun*W.sun.intensity*(1-.45*grey);sun.color.copy(sunColor);
  r.rain.visible=wet>0;r.rain.material.opacity=.55*wet;r.puddles.visible=wet>0;r.puddleMaterial.opacity=.25*wet;
  aimSun();  // default key from behind-left (lit backs and rumps facing the chase camera); a panorama city: from its sun
  // Props follow the barrier line and loop every FAR_LOOP metres; each row gets its own phase so rows don't stack.
  const loopZ=(i,spacing,phase)=>12-((i*spacing+phase-distance)%FAR_LOOP+FAR_LOOP)%FAR_LOOP;
  // Edges follow the (possibly bending) road: roadPose at the fence line.
  const fenceAt=(z,side)=>{if(!turn)return {...fencePose(z,side),z};const p=roadPose(z,turn,side*P.track.fenceX);return {x:p.x,z:p.z,heading:p.heading};};
  const used=new Map(),put=(parts,x,y,z,sx,sy,angle,tint=null)=>{const n=used.get(parts)||0;used.set(parts,n+1);for(const mesh of parts){r.place(mesh,n,x,y,z,sx,sy,sy,angle);if(tint)mesh.setColorAt(n,tint);}};
  const treeTint=seed=>TINT.setRGB(.88+.12*rnd(seed+11),.9+.1*rnd(seed+12),.84+.16*rnd(seed+13));   // each tree a little warmer, cooler, lighter or darker
  for(const b of bands){for(let i=0;i<=b.count;i++)for(let side=0;side<2;side++){const p=roadPose(14-i/b.count*390,turn,b.offset+(side?1:-1)*b.width/2),k=i*6+side*3;b.data[k]=p.x;b.data[k+1]=b.y;b.data[k+2]=p.z;}
   b.geometry.attributes.position.needsUpdate=true;if(b.map)b.map.offset.y=distance/b.tile;}
  (r.lampSpots??=[]).length=0;   // where the street lamps' heads are this frame (race-scene lights them with the streak)
  for(const row of rows)for(const side of sidesOf(row))for(let i=0;i<row.n;i++){
   // Loose rows stand unevenly: each up to 40% of the spacing off its spot, one in seven missing.
   const seed=row.k*97+i*7+(side>0?3:0),V=row.kind.variants,k=V?V[Math.floor(rnd(seed+21)*V.length)]:row.kind,tree=row.tree;
   if(thin(i)&&!k.card||row.loose&&rnd(seed+15)<.14)continue;   // cards are 2 triangles: phones keep them all
   const z=loopZ(i,row.every,row.k*3.1+(side>0?row.every*.37:0)+(row.loose?(rnd(seed+9)-.5)*row.every*.8:0)),edge=fenceAt(z,side);if(row.reach&&z<-row.reach)continue;
   const far=z<LOD_Z&&k.far,n=k.card?CARD:box(far?k.farFile:k.file),road=row.face==='road'||!!k.card;if(PHONE&&!k.far&&!k.card&&z<PHONE_END)continue;
   const shrink=row.shrink?1-.45*Math.min(1,Math.max(0,(-z-200)/200)):1;   // like the reference: smaller toward the road's end
   const size=(row.height[0]+(row.height[1]-row.height[0])*rnd(seed+1))/n.h*shrink*(tree?.66+.64*rnd(seed+5):1);   // trees: a wide spread of sizes
   // face 'road': unturned (flags hang over the track, lamps reach it), mirrored on the right (materials are double-sided).
   // Cards face down the road too, unmirrored (their painted light comes from the left on both sides, like the sun; banners
   // keep their lettering readable) unless the row says mirror.
   const out=side*(row.offset[0]+(row.offset[1]-row.offset[0])*rnd(seed+2)),h=edge.heading||0;
   if(row.asset.startsWith('Lamp_Banner')&&z>-420)r.lampSpots.push({x:edge.x+out*Math.cos(h),y:(n.h*.93-n.y)*size,z:edge.z-out*Math.sin(h)});
   put(far?k.far:k.near,edge.x+out*Math.cos(h),-n.y*size,edge.z-out*Math.sin(h),size*(k.card?(row.mirror?-side:1):road?-side:1),size,road?h:rnd(seed+3)*6.28,tree?treeTint(seed):null);
  }
  treeline.forEach((kk,j)=>{const k=kk.variants?kk.variants[Math.floor(rnd(j*7.7+3)*kk.variants.length)]:kk;if(thin(j)&&!k.card)return;const n=k.card?CARD:box(k.farFile||k.file),turnY=k.card?0:j*1.3;   // the forest edge where the road ends (Mid layer: it also hides where the 3D ground meets the Far layer)
   if(!TL.spread){const size=(7.6+(j%4)*.9)/n.h,tz=-386-(j%3)*10-(j*7)%6;put(k.far||k.near,-88+(j*37)%176+(j%2)*2.5+(turn?roadPose(tz,turn).x:0),-n.y*size,tz,size,size,turnY,treeTint(j));return;}
   // uneven: jittered spacing, a rolling crown line (clumps and dips), a few gaps, two to three rows deep
   const c=D.treeline.count,x=-TL.spread+2*TL.spread*(j+.5+(rnd(j*1.9+4)-.5)*1.4)/c,roll=.72+.28*Math.sin(x*.045+1.3)+.18*Math.sin(x*.13);
   if(Math.sin(j*2.39+.7)>.9)return;
   const tz=-(TL.depth[0]+(TL.depth[1]-TL.depth[0])*rnd(j*5.3+2)),size=(TL.height[0]+(TL.height[1]-TL.height[0])*rnd(j*3.7+1))*roll/n.h;
   put(k.far||k.near,x+(turn?roadPose(tz,turn).x:0),-n.y*size,tz,size,size,turnY,treeTint(j));});
  for(const c of skyline)put(c.k.near,c.x,0,-c.z,c.h,c.h,0);
  // Barrier: one bay per BAY metres a side, the model stretched lengthwise from this bay's near end to its far end on
  // the fence line (so on a bend each bay ends exactly where the next begins); heavy rails give way to `far` past LOD_Z.
  for(let i=0;i<BAYS;i++)for(let side=-1;side<=1;side+=2){
   const z=12-i*BAY+distance%BAY,a=fenceAt(z+BAY/2,side),b=fenceAt(z-BAY/2,side),dx=b.x-a.x,dz=b.z-a.z;
   const k=z<LOD_Z?barrierFar:barrier,n=FENCE?bn:box(k.file),sy=FENCE?FH:(k===barrier?D.barrier.height:3.5)*P.track.fenceHeight/n.h;
   put(k.near,(a.x+b.x)/2,-n.y*sy,(a.z+b.z)/2,Math.hypot(dx,dz)/n.w,sy,Math.atan2(-dz,dx));
  }
  for(const parts of lod)for(const mesh of parts)mesh.count=used.get(parts)||0;
  if(race?.marks){   // relay race: a gate at each handoff, then the finish
   const gates=[...race.marks.relays,race.marks.length],next=gates.find(g=>g-distance>-15)??gates.at(-1),ahead=next-distance,p=roadPose(HORSE_Z-ahead,turn);
   relay.position.set(p.x,0,p.z);relay.rotation.y=p.heading;relay.visible=ahead>-15&&ahead<170;
   const lap=gates.indexOf(next);label.material.map=next===race.marks.length?finishMap:lapMaps[lap]??=signMap('RELAY / LAP '+(lap+2));   // the gate into the next leg
  }else{relay.position.set(0,0,HORSE_Z-(P.relay.distance-distance));relay.visible=distance<P.relay.visibleUntil;}
  for(const parts of lod)for(const mesh of parts){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  r.canvas.dataset.scenery=`city-${pack.id}`;
  r.canvas.dataset.relayCanopy=String(relay.visible);
 }};
}
