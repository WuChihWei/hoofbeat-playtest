// Ranch overview (2026-10-09, the user: every buddy seen at once, loose on the grounds; the dormitory is only their home):
// the 3D ranch seen in a few set shots (RANCH.shots: the pasture where the buddies are, the wheat field, the
// whole grounds), the camera gliding from one to the next: the page's tabs or a sideways swipe change the
// shot (2026-10-09, the user after playing it: 「應該是特寫的切換」; it was one far view to drag and pinch, the buddies
// 35 px tall). The buddies that are out keep to the pasture behind the barn (RANCH.zone: 「限定他們走在某一區」) and
// stroll a little at a time. A tap on a buddy picks it. The dormitory is not a shot here: it is the close-up page
// (#stable: the painted barn, the buddy, feed and brush), which the page's tabs open like a shot (2026-10-09, the user:
// a 3D room seen from the front was tried, then dropped: 「現在有宿舍背景圖、又有近景畫面，感覺步驟重複」).
// The scene is assets/models/ranch/Ranch.glb (models/ranch/build_ranch.py: the 青禾馬廄 scene cut down to 61k triangles,
// in metres, one node per group); the buddies are their ranch models (models/ranch/build_buddies.py: ~1.5k triangles,
// the same rig and clips). Nothing here knows who is owned or how many may be out: the page says (home.js mine()).
import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
import {approvedAssets,createApprovedHorse,preloadRanchBuddies,ranchFile,MODEL_VERSION} from '../approved-assets.js?v=r367';
import {applyLook,LOOK} from '../visual-style.js?v=r367';

// The scene's own numbers are Blender's (x right, y away from the gate, metres): at(x, y) is that spot on the ground here.
const at=(x,y)=>new THREE.Vector3(x,0,-y);
export const RANCH={
  size:.62,                                   // a buddy is 3.3 units tall in the race's scale: 2.05 m to the ears here
  walk:1.5,turn:3.2,trot:.75,                 // m/s, rad/s, the Trot clip's rate at a walk
  rest:[4,14],hop:7,                          // s standing at a spot before the next stroll; a stroll goes no farther than this (m)
  fov:30,ease:4.5,                            // the camera's lens; how fast it glides to a shot (1/s)
  // The shots, in the tabs' order (the first is what the ranch opens on): what the camera looks at on the ground
  // [x, y], from how far (m), from which side (az: 0 from the gate, 90 from the right) and how steeply (el).
  shots:[{id:'pasture',name:'活動場',at:[0,19.6],dist:33,az:96,el:30},
    {id:'field',name:'麥田',at:[0,-5.4],dist:43,az:90,el:40},   // along the field from the right: its 12 m across the screen, all six beds
    {id:'all',name:'全景',at:[2,6],dist:98,az:32,el:50}],
  // The pasture's ground (2026-10-09, the user: 「活動場應該要有草地」; the scene's sand ring, 3 m wide, filled the shot):
  // a worn path the ring's shape, [half-length, half-width] outside and inside, centred at y; grass tufts and flowers
  // sown over [x0, y0, x1, y1].
  path:{y:19.6,out:[8.4,4.5],in:[7.3,3.4]},meadow:{box:[-16,13,15.5,26.6],tufts:260,flowers:70},
  zone:{x:[-12,10],y:[15,24.4]},             // where the buddies keep: the pasture behind the barn, round the sand ring
  far:360,                                    // m of grass round the site, so no view shows where the ground ends
  // Trees outside the site, [x, y, height]: behind, to the left and to the right, a few far in front. None to the
  // right of the pasture (y 12–30): its shot looks in from there, and a tree hides what is behind it.
  belt:[[-22,31,6.4],[-15,35,7.2],[-8,31.5,5.8],[-1,36,7],[6,31,6.2],[13,35.5,7.4],[20,33,6],[24,39,6.8],
    [-22,-8,6],[-26,-1,7],[-21.5,5,5.6],[-27,11,7.2],[-22,17,6.2],[-26.5,23,6.8],[-21,27,5.8],
    [22,3,5.6],[30,-3,6.8],[24,-6,6],[29,-13,7],[-30,33,6.2],[-20,-19,5.4],[-8,-21,6],[6,-22,5.6],[18,-20,5.2]],
  site:{x:[-17,17],y:[-14.5,27]},grid:2.4,room:.9,          // waypoints every `grid` m, `room` m clear of everything
  // What a buddy walks round: [x0, y0, x1, y1] (the barn, the shed and its cart, the trough, the fenced wheat field:
  // build_ranch.py prints the fence's box); the trees are read from the scene.
  blocks:[[-10.6,3.1,10.5,12.5],[10.3,.3,14.6,13.1],[11.1,-1.2,13.3,-.1],[-10.4,-11.15,10.4,.8]],
  lawn:{color:'#7cb35a',light:'#8fc468',dark:'#6ba54c',tile:28},   // the ground: palette.json's grass, soft patches a few metres across
};
const url=f=>new URL(`../assets/${f}?v=${MODEL_VERSION}`,import.meta.url).href;
let pending;
// The lawn (2026-10-09, the user: 「這個草皮不適合」): the race's grass tile is painted to be seen along the ground, at the
// horizon; from above its round blobs read as cobbles and fight everything standing on it. Here the ground is the
// palette's grass with soft lighter and darker patches, drawn once on a canvas (seamless: each patch is drawn nine times).
function lawn({color,light,dark}=RANCH.lawn){
  const n=256,c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,n,n);
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<46;i++){const x=rnd()*n,y=rnd()*n,r=14+rnd()*34,col=i%2?light:dark,a=.16+rnd()*.14;
    for(const dx of [-n,0,n])for(const dy of [-n,0,n]){const p=g.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,r);p.addColorStop(0,col);p.addColorStop(1,col+'00');g.globalAlpha=a;g.fillStyle=p;g.fillRect(x+dx-r,y+dy-r,r*2,r*2);}}
  return new THREE.CanvasTexture(c);
}
const loadScene=()=>pending??=Promise.all([new GLTFLoader().loadAsync(url('models/ranch/Ranch.glb')),new THREE.TextureLoader().loadAsync(url('textures/dirt.webp'))])
  .then(([g,dirt])=>({scene:g.scene,grass:lawn(),dirt}),e=>{pending=null;throw e;});
// What the overview needs, asked for ahead of time (home.js: as soon as the game is open). coats: the buddies out.
export const preloadRanch=coats=>Promise.all([loadScene(),preloadRanchBuddies(coats)]);

// One group of the scene as one mesh: every part's colour (× its own vertex colours: the trees) rides on its vertices.
const SOLID=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});   // both sides: the scene's faces were kept by whether they can be seen, whichever way they face (the roof's big panes face in)
function merged(group){
  const parts=[],c=new THREE.Color();group.updateMatrixWorld(true);
  group.traverse(o=>{if(!o.isMesh)return;
    const src=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),n=src.attributes.position.count,g=new THREE.BufferGeometry();
    const plain=a=>{const out=new Float32Array(n*3);for(let i=0;i<n;i++){out[i*3]=a.getX(i);out[i*3+1]=a.getY(i);out[i*3+2]=a.getZ(i);}return new THREE.BufferAttribute(out,3);};
    g.setAttribute('position',plain(src.attributes.position));g.setAttribute('normal',plain(src.attributes.normal));
    const col=new Float32Array(n*3),own=src.attributes.color;
    for(let i=0;i<n;i++){c.copy(o.material.color);if(own)c.multiply({r:own.getX(i),g:own.getY(i),b:own.getZ(i)});col.set([c.r,c.g,c.b],i*3);}
    g.setAttribute('color',new THREE.BufferAttribute(col,3));g.applyMatrix4(o.matrixWorld);parts.push(g);});
  const mesh=new THREE.Mesh(mergeGeometries(parts),SOLID);mesh.name=group.name;mesh.castShadow=mesh.receiveShadow=true;parts.forEach(g=>g.dispose());return mesh;
}
// The ground pieces' pictures (the lawn; the race's dirt on the sand ring), laid by the metre (the scene's boxes carry no UVs).
function textured(o,map,size){
  const p=o.geometry.attributes.position,uv=new Float32Array(p.count*2);o.updateMatrixWorld(true);const v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);uv[i*2]=v.x/size;uv[i*2+1]=v.z/size;}
  o.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  o.material=new THREE.MeshStandardMaterial({map,roughness:1,metalness:0});o.receiveShadow=true;return o;
}

// Where a buddy may stand: a grid over the site, the spots clear of the blocks; two spots are joined when the straight
// walk between them is clear too. A stroll is the shortest chain of joined spots to a spot picked at random.
// ponytail: a grid and a breadth-first search, no steering round one another (two buddies may brush past); a navmesh
// if the ranch ever gets gates or narrow lanes.
export function waypoints(trees=[],R=RANCH){
  const clear=(x,y,m=R.room)=>x>R.zone.x[0]&&x<R.zone.x[1]&&y>R.zone.y[0]&&y<R.zone.y[1]&&x>R.site.x[0]+m&&x<R.site.x[1]-m&&y>R.site.y[0]+m&&y<R.site.y[1]-m&&
    R.blocks.every(([a,b,c,d])=>x<a-m||x>c+m||y<b-m||y>d+m)&&trees.every(t=>Math.hypot(x-t.x,y-t.y)>t.r+m*.5);
  const spots=[];
  for(let x=R.zone.x[0]+.5;x<R.zone.x[1];x+=R.grid)for(let y=R.zone.y[0]+.5;y<R.zone.y[1];y+=R.grid)if(clear(x,y))spots.push({x,y,next:[]});
  const open=(p,q)=>{const n=Math.ceil(Math.hypot(q.x-p.x,q.y-p.y)/.4);for(let i=1;i<n;i++)if(!clear(p.x+(q.x-p.x)*i/n,p.y+(q.y-p.y)*i/n,R.room*.8))return false;return true;};
  spots.forEach((p,i)=>spots.forEach((q,j)=>{if(j>i&&Math.hypot(q.x-p.x,q.y-p.y)<R.grid*1.5&&open(p,q)){p.next.push(j);q.next.push(i);}}));
  // Only the largest joined set is kept: a spot cut off from the rest (a pocket between two beds) would hold a buddy for good.
  const seen=new Set();let best=[];
  spots.forEach((_,i)=>{if(seen.has(i))return;const set=[i];seen.add(i);for(let k=0;k<set.length;k++)for(const n of spots[set[k]].next)if(!seen.has(n)){seen.add(n);set.push(n);}if(set.length>best.length)best=set;});
  const ix=new Map(best.sort((a,b)=>a-b).map((old,i)=>[old,i]));
  return best.map(old=>({x:spots[old].x,y:spots[old].y,next:spots[old].next.map(n=>ix.get(n))}));
}
export function route(spots,from,to){
  const back=new Map([[from,-1]]),queue=[from];
  for(let k=0;k<queue.length&&!back.has(to);k++)for(const n of spots[queue[k]].next)if(!back.has(n)){back.set(n,queue[k]);queue.push(n);}
  if(!back.has(to))return [];
  const path=[];for(let n=to;n!==from;n=back.get(n))path.unshift(n);return path;
}

// buddies: [{id, coat, hair}], everyone out. onPick(id): a buddy was tapped. shot: the shot to open on; onShot(i): it
// changed. onSwipe(±1): a sideways swipe (when given, the page decides what comes next). → {shot(i), dispose};
// resolves with the first frame drawn, and only then is the canvas put on the page (nothing is seen being put together).
export async function mountRanchView(host,{buddies=[],onPick,onShot,onSwipe,shot=0}={}){
  const [assets]=await Promise.all([loadScene(),preloadRanchBuddies(buddies.map(b=>b.coat))]);
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  r.setPixelRatio(Math.min(devicePixelRatio,1.5));r.setClearColor(0,0);r.outputColorSpace=THREE.SRGBColorSpace;r.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene();
  const sun=new THREE.DirectionalLight();sun.position.set(-14,26,6);sun.target.position.set(0,0,-6);sun.castShadow=true;sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;
  Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:80});scene.add(sun,sun.target);
  const rim=new THREE.DirectionalLight();rim.position.set(10,12,-20);scene.add(rim);
  applyLook(r,scene,{sun,rim,shadowMap:LOOK.shadow.stableMap});

  // The scene: each group one mesh.
  const made=[],trees=[];assets.scene.updateMatrixWorld(true);
  for(const g of assets.scene.children){
    if(g.name==='TREES')g.children.forEach(t=>{const b=new THREE.Box3().setFromObject(t);trees.push({x:(b.min.x+b.max.x)/2,y:-(b.min.z+b.max.z)/2,r:(b.max.x-b.min.x)/2});});
    const flat=new THREE.Group();flat.name=g.name;
    for(const o of [...g.children]){if(g.name==='GROUND'||g.name==='TRACK')continue;   // TRACK: the sand ring and its edge stones (the pasture's own path and meadow are made below)   // GROUND: the scene's turf slab and the earth under it (the lawn below is the ground here: the two met in a visible line)
      flat.add(o.clone());}
    if(flat.children.length){const m=merged(flat);made.push(m.geometry);scene.add(m);}
  }
  // Beyond the site: the same grass as far as the camera can see, and a loose belt of the scene's own tree round it
  // (2026-10-09, the user: 「背景不應該有空景」: the grounds had stood on a slab in an empty sky). One mesh, drawn once.
  {const plane=new THREE.Mesh(new THREE.PlaneGeometry(RANCH.far,RANCH.far).rotateX(-Math.PI/2));plane.position.y=.04;plane.receiveShadow=true;textured(plane,assets.grass.clone(),RANCH.lawn.tile);made.push(plane.geometry,plane.material,plane.material.map);scene.add(plane);
    const one=assets.scene.getObjectByName('TREES')?.children[0];
    if(one){const g=one.geometry,box=g.boundingBox??(g.computeBoundingBox(),g.boundingBox),tall=box.max.y-box.min.y,belt=new THREE.InstancedMesh(g,SOLID,RANCH.belt.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
      RANCH.belt.forEach(([x,y,h],i)=>{const k=h/tall;belt.setMatrixAt(i,m.compose(at(x,y).setY(.04-box.min.y*k),q.setFromAxisAngle(up,i*2.4),new THREE.Vector3(k,k,k)));});
      belt.castShadow=true;belt.frustumCulled=false;scene.add(belt);}}
  // The pasture: a worn path round it, and a meadow: tufts of three blades and small flowers, each kind drawn once.
  {const P=RANCH.path,n=56,pos=[],ix=[];for(let k=0;k<n;k++){const a=2*Math.PI*k/n,c=Math.cos(a),q=Math.sin(a);pos.push(P.out[0]*c,.06,-(P.y+P.out[1]*q),P.in[0]*c,.06,-(P.y+P.in[1]*q));const i=k*2,j=(k+1)%n*2;ix.push(i,j,i+1,j,j+1,i+1);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);g.computeVertexNormals();
    const ring=textured(new THREE.Mesh(g),assets.dirt.clone(),4);ring.material.side=THREE.DoubleSide;made.push(g,ring.material,ring.material.map);scene.add(ring);
    let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,[x0,y0,x1,y1]=RANCH.meadow.box,onPath=(x,y)=>{const e=(a,b)=>Math.hypot(x/a,(y-P.y)/b);return e(P.out[0]+.3,P.out[1]+.3)<1&&e(P.in[0]-.3,P.in[1]-.3)>1;};
    const sow=(geo,count,colours,size)=>{const mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide})   /* unlit: a blade seen from behind went dark */,mesh=new THREE.InstancedMesh(geo,mat,count),m=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),c=new THREE.Color();
      for(let i=0;i<count;i++){let x,y;do{x=x0+rnd()*(x1-x0);y=y0+rnd()*(y1-y0);}while(onPath(x,y));const k=size[0]+rnd()*(size[1]-size[0]);
        mesh.setMatrixAt(i,m.compose(at(x,y).setY(.04),q.setFromAxisAngle(up,rnd()*6.28),new THREE.Vector3(k,k,k)));mesh.setColorAt(i,c.set(colours[i%colours.length]));}
      mesh.frustumCulled=false;made.push(geo,mat);scene.add(mesh);};
    const blades=new THREE.BufferGeometry();blades.setAttribute('position',new THREE.Float32BufferAttribute([-.09,0,0,.0,0,.03,-.13,.42,.02, .02,0,-.03,.11,0,0,.07,.5,-.03, -.03,0,.06,.05,0,.08,.16,.36,.1],3));blades.setAttribute('normal',new THREE.Float32BufferAttribute(new Array(9).fill([0,1,0]).flat(),3));   // lit like the ground they stand on, whichever way a blade leans
    sow(blades,RANCH.meadow.tufts,['#6fae55','#7dbb5d','#9bd070','#aadb7c'],[.45,.85]);
    const bloom=new THREE.CircleGeometry(.075,6).rotateX(-Math.PI/2.6).translate(0,.2,0);bloom.setAttribute('normal',new THREE.Float32BufferAttribute(new Array(bloom.attributes.position.count).fill([0,1,0]).flat(),3));sow(bloom,RANCH.meadow.flowers,['#ffffff','#f6e27a','#c9b6f2','#ffffff'],[.8,1.4]);}
  r.shadowMap.autoUpdate=false;   // the scene never moves: its shadows are drawn once (the buddies stand on a soft spot instead)

  // The buddies out on the pasture: each on a spot, a round shadow under it.
  const spots=waypoints(trees),spot=new THREE.Mesh(new THREE.CircleGeometry(.62,20),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.2,depthWrite:false}));made.push(spot.geometry,spot.material);
  const free=(want=()=>true)=>{const taken=new Set(herd.flatMap(b=>[b.on,b.path.at(-1)]));const ok=spots.map((_,i)=>i).filter(i=>!taken.has(i)&&spots[i].next.length&&want(spots[i]));return ok[Math.floor(Math.random()*ok.length)];};
  const herd=[];
  for(const b of buddies){
    const model=createApprovedHorse(0,b.coat,false,b.hair,true,true);model.seat.visible=false;
    model.root.scale.setScalar(RANCH.size);model.root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
    const trot=approvedAssets.get(ranchFile(b.coat)).animations.find(a=>a.name==='Trot'),idle=model.mixer.clipAction(model.clips.idle).play(),step=model.mixer.clipAction(trot).play();
    step.setEffectiveWeight(0);step.timeScale=RANCH.trot;model.mixer.update(Math.random()*3);
    const on=free(),p=spots[on],under=spot.clone();under.rotation.x=-Math.PI/2;
    const me={id:b.id,model,idle,step,on,path:[],wait:Math.random()*RANCH.rest[1],go:0,yaw:Math.random()*6.28,pos:at(p.x,p.y),under};
    model.root.position.copy(me.pos);model.root.rotation.y=me.yaw;scene.add(model.root,under);herd.push(me);
  }
  function stroll(b,dt){
    if(!b.path.length){b.wait-=dt;if(b.wait<=0){const here=spots[b.on],to=free(s=>Math.hypot(s.x-here.x,s.y-here.y)<RANCH.hop);if(to!=null)b.path=route(spots,b.on,to);b.wait=RANCH.rest[0]+Math.random()*(RANCH.rest[1]-RANCH.rest[0]);}}
    let moving=0;
    if(b.path.length){const s=spots[b.path[0]],dx=s.x-b.pos.x,dz=-s.y-b.pos.z,d=Math.hypot(dx,dz),want=Math.atan2(-dx,-dz);   // a buddy faces -z at yaw 0
      const off=Math.atan2(Math.sin(want-b.yaw),Math.cos(want-b.yaw));b.yaw+=Math.sign(off)*Math.min(Math.abs(off),RANCH.turn*dt);
      moving=Math.max(0,Math.cos(off));const stepLen=Math.min(d,RANCH.walk*moving*dt);   // it turns on the spot first, then walks
      if(d>.05){b.pos.x+=dx/d*stepLen;b.pos.z+=dz/d*stepLen;}else{b.on=b.path.shift();}}
    b.go+=((moving>.3?1:0)-b.go)*Math.min(1,dt*6);b.step.setEffectiveWeight(b.go);b.idle.setEffectiveWeight(1-b.go);b.model.mixer.update(dt);
    b.model.root.position.copy(b.pos);b.model.root.rotation.y=b.yaw;b.under.position.set(b.pos.x,.11,b.pos.z);
  }

  // The camera: it holds a shot and glides to the next one asked for (every number of a shot eased on its own).
  const cam=new THREE.PerspectiveCamera(RANCH.fov,1,2,400),rad=Math.PI/180,mid=new THREE.Vector3(),dir=new THREE.Vector3();
  let now=Math.max(0,Math.min(RANCH.shots.length-1,shot)),W=1,H=1;const view=S=>({x:S.at[0],y:S.at[1],dist:S.dist,az:S.az,el:S.el}),cur=view(RANCH.shots[now]);
  function aim(dt=0){const to=view(RANCH.shots[now]),k=dt?1-Math.exp(-dt*RANCH.ease):0;for(const n in cur)cur[n]+=(to[n]-cur[n])*k;
    const az=cur.az*rad,el=cur.el*rad;dir.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el));
    mid.copy(at(cur.x,cur.y));cam.position.copy(mid).addScaledVector(dir,cur.dist);cam.lookAt(mid);}
  function fit(){W=host.clientWidth||1;H=host.clientHeight||1;r.setSize(W,H,false);cam.aspect=W/H;cam.updateProjectionMatrix();aim();r.render(scene,cam);}   // drawn at once: a resize clears the canvas
  const ro=new ResizeObserver(fit);ro.observe(host);
  const go=i=>{const n=Math.max(0,Math.min(RANCH.shots.length-1,i));if(n===now)return;now=n;onShot?.(now);};

  // Touch: a sideways swipe asks the page for the next or the last tab (onSwipe: the dormitory is one of them), a tap
  // that did not move picks the buddy under it.
  const el$=r.domElement;let from=null;el$.style.touchAction='none';
  el$.addEventListener('pointerdown',e=>{try{el$.setPointerCapture(e.pointerId);}catch{}from=[e.clientX,e.clientY];});
  el$.addEventListener('pointercancel',()=>{from=null;});
  el$.addEventListener('pointerup',e=>{if(!from)return;const dx=e.clientX-from[0],dy=e.clientY-from[1];from=null;
    if(Math.abs(dx)>44&&Math.abs(dx)>Math.abs(dy)*1.5){if(onSwipe)onSwipe(dx<0?1:-1);else go(now+(dx<0?1:-1));return;}
    if(Math.hypot(dx,dy)>=8||!onPick)return;
    const box=el$.getBoundingClientRect(),v=new THREE.Vector3();let best=null,near=48;
    for(const b of herd){v.copy(b.pos);v.y+=1;v.project(cam);const d=Math.hypot((v.x+1)/2*box.width-(e.clientX-box.left),(1-v.y)/2*box.height-(e.clientY-box.top));if(d<near){near=d;best=b;}}
    if(best)onPick(best.id);});

  let raf=0,last=performance.now();
  const tick=dt=>{herd.forEach(b=>stroll(b,dt));aim(dt);r.render(scene,cam);};
  function frame(t){raf=requestAnimationFrame(frame);const dt=Math.min(.05,(t-last)/1000);last=t;tick(dt);}
  herd.forEach(b=>stroll(b,0));r.shadowMap.needsUpdate=true;fit();
  host.append(el$);raf=requestAnimationFrame(frame);
  if(new URLSearchParams(location.search).has('debug'))window.__ranch={r,scene,cam,herd,spots,cur,go,step:tick};   // dev (?debug): step, to move things on in a tab that draws one frame a second
  return {shot:go,dispose(){cancelAnimationFrame(raf);ro.disconnect();herd.forEach(b=>b.model.materials.forEach(m=>m.dispose()));made.forEach(x=>x.dispose());r.dispose();el$.remove();}};
}
