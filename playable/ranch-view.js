// The ranch in 3D (2026-10-09). One strip of ground as wide as the phone, growing away from the gate (the user: 「幫我規劃
// 一下格局…現在未來擴充性有問題」; it was one 34 × 41 m site made to fit one picture, with nowhere to grow). From the
// gate back: the lawn where the buddies stroll, the wheat in a few fenced pens, the dormitory (the layout can stand
// more behind it), trees behind the last. layout() says where everything
// is for a list of pens and a number of dormitories; nothing else holds a position.
// The camera looks up the strip from the gate, 38° down (it was 50°: more of a map than a place; the user: 「該角度先」),
// and a drag up or down slides it along the strip. The field has a shot of its own. The page's tabs or a sideways
// swipe change between them; the dormitory's tab is the close-up page (#stable), opened like a shot.
// A tap on a buddy picks it; a tap on a bed of the field tends it.
// The barn and its props are assets/models/ranch/Ranch.glb (models/ranch/build_ranch.py, from the 青禾馬廄 scene, in
// metres); the beds, the fence, the earth and the trees' places are made here. The buddies are their ranch models
// (models/ranch/build_buddies.py: ~1.5k triangles, the same rig and clips). Nothing here knows who is owned: the page
// says who is out and how many dormitories and beds there are (home.js).
import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';
import {approvedAssets,createApprovedHorse,preloadRanchBuddies,ranchFile,MODEL_VERSION} from '../approved-assets.js?v=r383';
import {applyLook,LOOK} from '../visual-style.js?v=r383';

// The scene's own numbers are Blender's (x right, y away from the gate, metres): at(x, y) is that spot on the ground here.
const at=(x,y)=>new THREE.Vector3(x,0,-y);
export const RANCH={
  size:.85,                                   // a buddy is 3.3 units tall in the race's scale: 2.05 m to the ears here
  walk:1.5,turn:3.2,trot:.75,                 // m/s, rad/s, the Trot clip's rate at a walk
  rest:[4,14],hop:7,                          // s standing at a spot before the next stroll; a stroll goes no farther than this (m)
  fov:45,ease:4.5,                            // the camera's lens; how fast it glides to a shot (1/s)
  // The camera: `all` looks up the strip (el: how steeply down; az: a little from the right, so the barn shows a side;
  // dist: the field's width fills the picture); `field` looks at the beds from the front, steeper.
  cam:{all:{dist:39,az:20,el:38},field:{el:48},near:{h:3.4,fov:60}},   // near: the low shot, from the lane beside the first pen, h m up, across the second pen and the lawn to the far country, a wider lens (layout() places it)   // az: from the right, like a farm game's view (the user's reference): the barn shows its front and a side, the plots are diamonds
  // Where a buddy may stand is also where the opening view shows it: inside this part of the picture (-1…1 across and
  // up, on the tallest phone: `aspect`), clear of the header and tabs above and the nav below.
  seen:{aspect:390/844,x:[-.95,.95],y:[-.74,.56]},
  // The ground plan (m, the scene's axes: everything stands square to the barn, the camera is what is turned; a phone's
  // picture is narrow, so the pieces follow one another up it, each a step to the side of the last, like a farm game's
  // plots on their grid). The barn is where the model has it (its walk begins at y .6, its back wall is at 12.5); a
  // dirt street runs along its front; the wheat pens stand one under the other down the picture, `pens` m under the
  // door and then apart (2026-10-09, the user: 「稻子不用全部集中在一個柵欄裡，可以四個一欄或有兩個一欄」「馬殿和農場的距離不要
  // 那麼近」); a lane leaves the street and steps down past them to the lawn at the bottom, where the buddies are.
  // bed: a bed's soil [across, along], pitch: bed to bed, pad: the outer beds to the fence. front: the opening view looks
  // this far up the picture from the lawn's middle (a long strip's barn is out of the top: a drag brings it in). Any
  // more dormitories `dorm` m behind the first.
  strip:{bed:[3.5,3.2],pitch:[4.1,4.1],pad:1,pens:[7.3,4.2],street:[-5.6,-1.6],lane:3.6,lawn:[26,10],front:20.7,below:1,top:.31,dorm:17,
    walk:.6,barn:[-10.6,3.1,10.5,13.4],shed:[10.3,.3,14.6,13.1],trough:[11.1,-1.2,13.3,-.1]},
  stalks:{rows:8,cols:11,size:[3.1,2.8],fat:1.55},
  stalls:{x:[-7.5,-4.5,-1.5,1.5,4.5,7.5],hinge:-1.29,y:3.66,open:-1.2,stand:6},   // the dormitory's stalls (the model's): their middles, the door's hinge from a middle and its y, how far a door swings (rad), where a buddy in stands (y)   // a bed is sown with rows × cols stalks (Ranch_Wheat.glb: one stalk per stage), drawn fatter than modelled (the ears are what is seen from above)
  // The field's look (the user's reference: a farm game's fields: crops standing thick, brown rail fences, dark soil,
  // worn earth round the plots, warm greens). fill: a block under the stalks so a bed reads as one thick crop, [colour,
  // height just sown, height ripe]; a bed not opened yet is `shut`.
  field:{rail:'#b8834c',post:'#8c5c34',frame:'#7a5030',soil:'#553620',shut:'#b7a184',
    fill:{green:['#4f8f32',.16,.36],ripe:['#bf8a17',.44,.44]},
    earth:{color:'#c8a071',light:'#d6b184',dark:'#b58c5d',round:1.1}},
  meadow:{tufts:900,flowers:120},              // grass tufts and small flowers sown on the lawns, not on the blocks, the earth or the barn's walk
  far:420,                                    // m of grass round the strip, so no view shows where the ground ends
  // The far country behind the low shot (2026-10-10, the user: 「遠景可以補2D圖」, their painting: sky, hills, a line of
  // pines, 3:1, its bottom edge the trees' feet): one picture standing `off` m beyond what the shot looks at, `wide` m
  // across, the painting at its foot and its sky colour carried on up to `tall` m.
  backdrop:{file:'ranch/far.webp',off:200,wide:180,tall:110},
  // Props on the ground (2026-10-10, the user's reference: hay bales, barrels, logs, rocks about the yard): kind, x, y, turn.
  props:[['bales',12.6,-3.2,.2],['barrel',-11.6,1.6,0],['barrel',-12.4,.6,0],['logs',-11,-6.5,.5],['rocks',-9.5,-9,0],['rocks',22,-14,.6],['logs',21.5,-9.5,-.4]],
  grid:2.1,room:.9,                           // waypoints every `grid` m, `room` m clear of everything
  lawn:{color:'#84bd4a',light:'#9ad05a',dark:'#72aa40',tile:28},   // the ground: a warm, full green, soft patches a few metres across
};
// Where everything is, for these pens ([beds across, beds along] each, from the barn towards the gate) and `dorms`
// dormitories (all in the scene's metres):
//   beds [[x, y]…] pen by pen (in the order of farm.mjs's beds) · pens [[x0, y0, x1, y1]…] their fences · field: the
//   box round all of them · lawn (the same) · site: where waypoints are looked for · blocks: what a buddy walks
//   round · barns: how far back each dormitory stands · earth: the worn ground · trees [[x, y, height]…] · open: the
//   camera's opening view · slide: how far along the strip its middle may go [from, to] · fieldShot · back: the far end.
export function layout({pens=[[2,2],[2,1]],dorms=1}={}){
  const S=RANCH.strip,A=RANCH.cam.all,az=A.az*Math.PI/180,R=[Math.cos(az),Math.sin(az)],U=[-Math.sin(az),Math.cos(az)];   // across and up the picture, on the ground
  const seen=(u,v)=>[u*R[0]+v*U[0],S.walk+u*R[1]+v*U[1]];   // the spot u m across, v m up the picture from the barn's door
  const beds=[],fences=[],xs=[];let v=S.pens[0];   // how far below the door the next piece begins
  pens.forEach(([cols,rows])=>{const w=(cols-1)*S.pitch[0]+S.bed[0]+2*S.pad,d=(rows-1)*S.pitch[1]+S.bed[1]+2*S.pad,[cx,cy]=seen(0,-v-d/2);
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)beds.push([cx+(c-(cols-1)/2)*S.pitch[0],cy+((rows-1)/2-r)*S.pitch[1]]);
    const f=[cx-w/2,cy-d/2,cx+w/2,cy+d/2];fences.push(f);xs.push(f[2]+.8);v+=d+S.pens[1];});
  const field=[Math.min(...fences.map(f=>f[0])),Math.min(...fences.map(f=>f[1])),Math.max(...fences.map(f=>f[2])),Math.max(...fences.map(f=>f[3]))];
  const vl=-v-S.lawn[1]/2+1,[lx,ly]=seen(0,vl),look=seen(0,vl+S.front),lawn=[lx-S.lawn[0]/2,ly-S.lawn[1]/2,lx+S.lawn[0]/2,ly+S.lawn[1]/2],xl=lawn[2]-S.lane-1;
  // The worn ground: under each pen; the barn's door to the street; the street, to the lane; the lane, down each
  // pen's right side and a step across under it to the next, the last down the lawn's right side and out.
  const earth=[...fences.map(([a,b,c,d])=>[a-.9,b-.9,c+.9,d+.6]),[-1.9,S.street[1]-.5,1.9,S.walk+.2],[field[0]-1,S.street[0],xs[0]+S.lane,S.street[1]]];
  fences.forEach((f,i)=>{const x0=xs[i],yb=f[1]-S.lane-.6,xn=i+1<xs.length?xs[i+1]:xl;earth.push([x0,yb,x0+S.lane,i?fences[i-1][1]-.6:S.street[0]],[x0,yb,xn+S.lane,f[1]-.6]);});
  earth.push([xl,lawn[1]-6,xl+S.lane,fences.at(-1)[1]-.6]);
  const barns=Array.from({length:dorms},(_,k)=>k*S.dorm),back=S.barn[3]+(dorms-1)*S.dorm;
  const blocks=[...barns.map(d=>[S.barn[0],S.barn[1]+d,S.barn[2],S.barn[3]+d]),S.shed,S.trough,...fences,...RANCH.props.map(([,x,y])=>[x-1.4,y-1.2,x+1.4,y+1.2])];   // a prop takes about a 3 × 2.5 m patch
  // Trees: clumps along both edges of the picture (the picture is narrower nearer the camera), beside each dormitory, a row behind the last.
  let n=0;const rnd=()=>(n=(n*9301+49297)%233280)/233280,trees=[],edge=v=>Math.max(8.4,8.6+v*.13);
  for(let k=0;k<2;k++)for(let v=vl-S.lawn[1]/2-12;v<6;v+=5.5+rnd()*2)trees.push([...seen((k?1:-1)*(edge(v)+rnd()*2.5),v+rnd()*2),5.2+rnd()*1.4]);
  barns.forEach(d=>trees.push([-15.8,8+d,5],[19.6,10+d,6]));
  for(let x=-20;x<=24;x+=7.2)trees.push([x+rnd()*2-1,back+6+rnd()*4,6+rnd()*1.4]);
  const near=([x,y,h])=>blocks.some(([a,b,c,d])=>Math.hypot(Math.max(a-x,0,x-c),Math.max(b-y,0,y-d))<h*.41+.3),kept=trees.filter(t=>!near(t));   // a tree that would stand in a pen or a building is left out
  const open={at:look,dist:A.dist,az:A.az,el:A.el},asp=RANCH.seen.aspect;
  // The field's shot: the same way round, steeper, just far enough for every pen's corners to fit between the tabs and the nav.
  const corners=fences.flatMap(([a,b,c,d])=>[[a,b],[c,b],[a,d],[c,d]]),fieldShot={at:[(field[0]+field[2])/2,(field[1]+field[3])/2],dist:40,az:A.az,el:RANCH.cam.field.el};
  for(let k=0;k<4;k++){const p=corners.map(([x,y])=>inShot(fieldShot,x,y,asp));fieldShot.dist*=Math.max(...p.map(([u])=>Math.abs(u)/.96),...p.map(([,v])=>v/.55),...p.map(([,v])=>-v/.7));}
  const N=RANCH.cam.near,from=[xs[0]+S.lane/2,fences[0][1]+4],to=[field[0]+6,lawn[3]-6],dx=from[0]-to[0],dy=from[1]-to[1],flat=Math.hypot(dx,dy);
  const nearShot={at:to,dist:Math.hypot(flat,N.h),az:Math.atan2(dx,-dy)*180/Math.PI,el:Math.atan2(N.h,flat)*180/Math.PI,fov:N.fov};
  return {pens:fences,dorms,beds,field,lawn,site:{x:[field[0]-9,field[2]+9],y:[lawn[3]-S.below,S.street[1]]},blocks,barns,earth,trees:kept,props:RANCH.props,open,back,up:U,
    slide:[0,Math.max(0,(back-6-look[1])/U[1]-6)],fieldShot,nearShot};   // slide: how far up the picture the view's middle may go
}
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
const loadScene=()=>pending??=Promise.all([new GLTFLoader().loadAsync(url('models/ranch/Ranch.glb')),new GLTFLoader().loadAsync(url('models/ranch/Ranch_Wheat.glb')),new THREE.ImageLoader().loadAsync(url(RANCH.backdrop.file))])
  .then(([g,wheat,far])=>({scene:g.scene,grass:lawn(),wheat:wheat.scene,far:farCountry(far)}),e=>{pending=null;throw e;});
// The backdrop's picture, its sky carried on up: the painting at the foot of a taller canvas, the rest its own top row.
function farCountry(img){const B=RANCH.backdrop,w=1024,h=Math.round(w*B.tall/B.wide),ih=Math.round(w*img.height/img.width),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  g.drawImage(img,0,h-ih,w,ih);const top=g.getImageData(0,h-ih+1,w,1);g.putImageData(top,0,0);for(let y=1;y<h-ih;y++)g.drawImage(c,0,0,w,1,0,y,w,1);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
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
// The ground pieces' pictures (the lawn, the field's earth), laid by the metre (they carry no UVs).
function textured(o,map,size){
  const p=o.geometry.attributes.position,uv=new Float32Array(p.count*2);o.updateMatrixWorld(true);const v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);uv[i*2]=v.x/size;uv[i*2+1]=v.z/size;}
  o.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  o.material=new THREE.MeshStandardMaterial({map,roughness:1,metalness:0});o.receiveShadow=true;return o;
}

// Where a spot on the ground (x, y: the scene's metres) lands in a shot's picture: [across, up], each -1…1 inside it.
export function inShot(shot,x,y,aspect,fov=RANCH.fov){
  const az=shot.az*Math.PI/180,el=shot.el*Math.PI/180,d=[Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)];   // from what it looks at, to the camera
  const v=[x-shot.at[0]-d[0]*shot.dist,-d[1]*shot.dist,-y+shot.at[1]-d[2]*shot.dist],f=d.map(n=>-n);                           // camera → the spot; the way it looks
  const r=[-f[2],0,f[0]].map(n=>n/Math.hypot(f[0],f[2])),u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],dot=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2];
  const t=Math.tan(fov*Math.PI/360),z=dot(v,f);return [dot(v,r)/z/(t*aspect),dot(v,u)/z/t];
}
// Where a buddy may stand: a grid over the site, the spots clear of the blocks; two spots are joined when the straight
// walk between them is clear too. A stroll is the shortest chain of joined spots to a spot picked at random.
// ponytail: a grid and a breadth-first search, no steering round one another (two buddies may brush past); a navmesh
// if the ranch ever gets gates or narrow lanes.
export function waypoints(trees=[],R=layout()){
  const S=RANCH.seen,shown=(x,y)=>{const [u,v]=inShot(R.open,x,y,S.aspect);return u>S.x[0]&&u<S.x[1]&&v>S.y[0]&&v<S.y[1];};
  const clear=(x,y,m=RANCH.room)=>shown(x,y)&&x>R.site.x[0]+m&&x<R.site.x[1]-m&&y>R.site.y[0]+m&&y<R.site.y[1]-m&&
    R.blocks.every(([a,b,c,d])=>x<a-m||x>c+m||y<b-m||y>d+m)&&trees.every(t=>Math.hypot(x-t.x,y-t.y)>t.r+m*.5);
  const spots=[];
  for(let x=R.site.x[0]+.5;x<R.site.x[1];x+=RANCH.grid)for(let y=R.site.y[0]+.5;y<R.site.y[1];y+=RANCH.grid)if(clear(x,y))spots.push({x,y,next:[]});
  const open=(p,q)=>{const n=Math.ceil(Math.hypot(q.x-p.x,q.y-p.y)/.4);for(let i=1;i<n;i++)if(!clear(p.x+(q.x-p.x)*i/n,p.y+(q.y-p.y)*i/n,RANCH.room*.8))return false;return true;};
  spots.forEach((p,i)=>spots.forEach((q,j)=>{if(j>i&&Math.hypot(q.x-p.x,q.y-p.y)<RANCH.grid*1.5&&open(p,q)){p.next.push(j);q.next.push(i);}}));
  // A spot with no neighbour is left out (a buddy there could never stroll). The spots need not all be joined: the
  // pens cut the ground into a few patches, and a buddy keeps to the patch it is on (route() finds no way out of it).
  const ix=new Map();spots.forEach((p,i)=>{if(p.next.length)ix.set(i,ix.size);});
  return [...ix.keys()].map(old=>({x:spots[old].x,y:spots[old].y,next:spots[old].next.map(n=>ix.get(n))}));
}
export function route(spots,from,to){
  const back=new Map([[from,-1]]),queue=[from];
  for(let k=0;k<queue.length&&!back.has(to);k++)for(const n of spots[queue[k]].next)if(!back.has(n)){back.set(n,queue[k]);queue.push(n);}
  if(!back.has(to))return [];
  const path=[];for(let n=to;n!==from;n=back.get(n))path.unshift(n);return path;
}

// buddies: [{id, coat, hair}], everyone out; inside: the dormitory's stalls, six a dormitory, each a buddy that is in
// ({id, coat, hair}) or null: its door is shut when a buddy is in, open when not (2026-10-10, the user: 「把一些動物放在
// 宿舍裡，若有動物則房門關若沒動物則房門開」). pens, dorms: the pens of beds and how many dormitories there are
// (layout); open: how many of the beds can be used (the rest are shown shut). shot: 'all' or 'field', what to open on.
// onPick(id): a buddy was tapped. onBed(i, x, y): a bed that can be used was tapped, at (x, y) on the screen.
// onSwipe(±1): a sideways swipe. → {shot(name), field(grown), dispose}; resolves with the first frame drawn, and only
// then is the canvas put on the page (nothing is seen being put together).
export async function mountRanchView(host,{buddies=[],inside=[],pens,dorms=1,open,onPick,onBed,onSwipe,shot='all'}={}){
  const [assets]=await Promise.all([loadScene(),preloadRanchBuddies([...buddies,...inside.filter(Boolean)].map(b=>b.coat))]),L=layout({pens,dorms}),S=RANCH.strip,F=RANCH.field;open??=L.beds.length;
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  r.setPixelRatio(Math.min(devicePixelRatio,1.5));r.setClearColor(0,0);r.outputColorSpace=THREE.SRGBColorSpace;r.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene(),midY=(L.lawn[1]+L.back)/2,span=(L.back-L.lawn[1])/2+30,rad0=Math.PI/180;
  const sun=new THREE.DirectionalLight();sun.position.copy(at(-14,midY-6)).setY(30);sun.target.position.copy(at(0,midY));sun.castShadow=true;sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;
  Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:1,far:120});scene.add(sun,sun.target);
  const rim=new THREE.DirectionalLight();rim.position.copy(at(10,midY+20)).setY(12);scene.add(rim);
  applyLook(r,scene,{sun,rim,shadowMap:LOOK.shadow.stableMap});
  const made=[],keep=o=>{made.push(o);return o;};assets.scene.updateMatrixWorld(true);

  // The model: the yard's things and the hay shed once; the barn once for every dormitory, each `dorm` m behind the last.
  for(const g of assets.scene.children){if(!['BARN','SHED','YARD'].includes(g.name))continue;
    const flat=new THREE.Group();flat.name=g.name;g.children.forEach(o=>flat.add(o.clone()));const m=merged(flat);keep(m.geometry);
    if(g.name==='BARN')L.barns.forEach(d=>{const b=d?m.clone():m;b.position.z=-d;scene.add(b);});else scene.add(m);}
  // The stall doors: the model's one door (DOOR: hung at its hinge, the hinge on the stall's left), one on every stall of
  // every dormitory, shut when a buddy is in, else swung out onto the walk.
  const D=RANCH.stalls,doorGroup=assets.scene.getObjectByName('DOOR');
  if(doorGroup){const flat=new THREE.Group();doorGroup.children.forEach(o=>flat.add(o.clone()));const one=merged(flat);keep(one.geometry);
    L.barns.forEach((d,k)=>D.x.forEach((cx,i)=>{const door=one.clone();door.position.copy(at(cx+D.hinge,D.y+d));door.rotation.y=inside[k*D.x.length+i]?0:D.open;scene.add(door);}));}
  // Made here, one mesh of plain boxes coloured on their vertices: the beds (a frame and its soil; a bed not opened is
  // only pale soil) and the rail fence round each pen, a post every 2.4 m or so.
  {const parts=[],c=new THREE.Color(),box=(x,y,z,w,h,d,col)=>{const g=new THREE.BoxGeometry(w,h,d).toNonIndexed();g.deleteAttribute('uv');g.translate(x,z,-y);c.set(col);
      const n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++)a.set([c.r,c.g,c.b],i*3);g.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(g);};
    L.beds.forEach(([x,y],i)=>{if(i<open){box(x,y,S.top-.17,S.bed[0]+.3,.22,S.bed[1]+.3,F.frame);box(x,y,S.top-.11,S.bed[0],.22,S.bed[1],F.soil);}else box(x,y,S.top-.2,S.bed[0],.16,S.bed[1],F.shut);});
    const run=(ax,ay,bx,by)=>{const len=Math.hypot(bx-ax,by-ay),n=Math.max(1,Math.round(len/2.4)),along=bx!==ax;
      for(let k=0;k<=n;k++)box(ax+(bx-ax)*k/n,ay+(by-ay)*k/n,.66,.17,1.32,.17,F.post);
      for(const h of [.42,.78,1.12])box((ax+bx)/2,(ay+by)/2,h,along?len:.07,.12,along?.07:len,F.rail);};
    for(const [x0,y0,x1,y1] of L.pens){run(x0,y0,x1,y0);run(x0,y1,x1,y1);run(x0,y0,x0,y1);run(x1,y0,x1,y1);}
    const m=new THREE.Mesh(keep(mergeGeometries(parts)),SOLID);m.castShadow=m.receiveShadow=true;parts.forEach(g=>g.dispose());scene.add(m);}
  // The ground: grass as far as the camera can see; the worn earth under the field and the track from its gate out
  // through the lawn, drawn like the lawn in earth colours, round-cornered.
  {const plane=new THREE.Mesh(keep(new THREE.PlaneGeometry(RANCH.far,RANCH.far).rotateX(-Math.PI/2)));plane.position.copy(at(0,midY)).setY(.04);textured(plane,assets.grass.clone(),RANCH.lawn.tile);keep(plane.material);keep(plane.material.map);scene.add(plane);
    const R=F.earth.round;for(const [x0,y0,x1,y1] of L.earth){const sh=new THREE.Shape();sh.moveTo(x0+R,-y1);sh.lineTo(x1-R,-y1);sh.quadraticCurveTo(x1,-y1,x1,-y1+R);sh.lineTo(x1,-y0-R);sh.quadraticCurveTo(x1,-y0,x1-R,-y0);sh.lineTo(x0+R,-y0);sh.quadraticCurveTo(x0,-y0,x0,-y0-R);sh.lineTo(x0,-y1+R);sh.quadraticCurveTo(x0,-y1,x0+R,-y1);
      const m=textured(new THREE.Mesh(keep(new THREE.ShapeGeometry(sh,5).rotateX(Math.PI/2))),lawn(F.earth),14);m.position.y=.05;m.material.side=THREE.DoubleSide;keep(m.material);keep(m.material.map);scene.add(m);}}
  // The far country: the painting stands beyond the low shot's middle, square to it, its foot on the ground (the steep
  // shots never see that far up; drawn without the light, as painted).
  {const B=RANCH.backdrop,N=L.nearShot,az=N.az*rad0;const m=new THREE.Mesh(keep(new THREE.PlaneGeometry(B.wide,B.tall)),keep(new THREE.MeshBasicMaterial({map:assets.far,toneMapped:false})));
    m.position.copy(at(N.at[0]-Math.sin(az)*B.off,N.at[1]+Math.cos(az)*B.off)).setY(B.tall/2-.5);m.rotation.y=az;scene.add(m);}
  // The props: plain shapes coloured on their vertices, one mesh.
  {const parts=[],c=new THREE.Color(),m4=new THREE.Matrix4(),add=(g,x,y,z,col,turn=0,sx=1,sy=1,sz=1)=>{g=g.toNonIndexed();g.deleteAttribute('uv');c.set(col);const n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++)a.set([c.r,c.g,c.b],i*3);g.setAttribute('color',new THREE.BufferAttribute(a,3));
      g.applyMatrix4(m4.compose(at(x,y).setY(z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),turn),new THREE.Vector3(sx,sy,sz)));parts.push(g);};
    const HAY='#e9c75a',BAND='#c99a3a',WOOD='#8c5c34',CUT='#d9b27a',STONE='#b9b6a8';
    for(const [kind,x,y,turn] of L.props){
      if(kind==='bales'){for(const [dx,dy,dz] of [[-.7,0,.45],[.7,0,.45],[0,.95,.45],[0,.45,1.35]]){const cx=x+dx*Math.cos(turn)-dy*Math.sin(turn),cy=y+dx*Math.sin(turn)+dy*Math.cos(turn);add(new THREE.BoxGeometry(1.3,.9,.9),cx,cy,dz,HAY,turn);add(new THREE.BoxGeometry(1.32,.14,.92),cx,cy,dz,BAND,turn);}}
      if(kind==='barrel'){add(new THREE.CylinderGeometry(.42,.38,1.05,10),x,y,.52,WOOD,turn);add(new THREE.CylinderGeometry(.44,.44,.08,10),x,y,.3,'#4a4a50',turn);add(new THREE.CylinderGeometry(.44,.44,.08,10),x,y,.78,'#4a4a50',turn);}
      if(kind==='logs'){for(const [dx,dz] of [[-.4,.3],[.4,.3],[0,.82]]){const cx=x+dx*Math.cos(turn),cy=y+dx*Math.sin(turn);add(new THREE.CylinderGeometry(.32,.32,2.6,9).rotateX(Math.PI/2),cx,cy,dz,WOOD,turn);add(new THREE.CylinderGeometry(.26,.26,2.62,9).rotateX(Math.PI/2),cx,cy,dz,CUT,turn);}}
      if(kind==='rocks'){add(new THREE.IcosahedronGeometry(.7,0),x,y,.25,STONE,turn,1,.6,1);add(new THREE.IcosahedronGeometry(.45,0),x+.9,y-.3,.18,STONE,turn+.8,1,.6,1);add(new THREE.IcosahedronGeometry(.3,0),x-.6,y+.7,.12,STONE,turn+2,1,.6,1);}}
    if(parts.length){const m=new THREE.Mesh(keep(mergeGeometries(parts)),SOLID);m.castShadow=m.receiveShadow=true;parts.forEach(g=>g.dispose());scene.add(m);}}
  // The trees: the model's round tree, and every third one a pine made here (three cones on a trunk, coloured on its
  // vertices: the user's reference mixes the two; 2026-10-10, 「最低mvp驗證就好」: no pine model), each kind drawn once.
  const one=assets.scene.getObjectByName('TREES')?.children[0],trees=[];
  if(one){const g=one.geometry,b=g.boundingBox??(g.computeBoundingBox(),g.boundingBox),tall=b.max.y-b.min.y,wide=(b.max.x-b.min.x)/2/tall;
    const pine=(()=>{const parts=[],c=new THREE.Color(),tint=(geo,col)=>{geo=geo.toNonIndexed();geo.deleteAttribute('uv');c.set(col);const n=geo.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++)a.set([c.r,c.g,c.b],i*3);geo.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(geo);};
      tint(new THREE.CylinderGeometry(.09,.12,.3,7).translate(0,.15,0),'#8a5a32');
      [[.46,.5,.2,'#4f8f3a'],[.38,.45,.5,'#5a9c3e'],[.28,.42,.78,'#6aae44']].forEach(([r,h,y,col])=>tint(new THREE.ConeGeometry(r,h,8).translate(0,y+h/2,0),col));
      const geo=mergeGeometries(parts);parts.forEach(x=>x.dispose());return keep(geo);})();   // 1.2 units tall, the crown .46 wide
    const isPine=i=>i%3===2,round=new THREE.InstancedMesh(g,SOLID,L.trees.filter((_,i)=>!isPine(i)).length),pines=new THREE.InstancedMesh(pine,SOLID,L.trees.filter((_,i)=>isPine(i)).length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),n=[0,0];
    L.trees.forEach(([x,y,h],i)=>{if(isPine(i)){pines.setMatrixAt(n[1]++,m.compose(at(x,y).setY(.04),q.setFromAxisAngle(up,i*2.4),new THREE.Vector3(h/1.2,h/1.2,h/1.2)));trees.push({x,y,r:.46*h/1.2});}
      else{round.setMatrixAt(n[0]++,m.compose(at(x,y).setY(.04-b.min.y*h/tall),q.setFromAxisAngle(up,i*2.4),new THREE.Vector3(h/tall,h/tall,h/tall)));trees.push({x,y,r:wide*h});}});
    for(const t of [round,pines]){t.castShadow=true;t.frustumCulled=false;scene.add(t);}}
  // The lawns: tufts of three blades and small flowers, each kind drawn once (unlit: a blade seen from behind went
  // dark), anywhere on the strip that is not a block, the earth or the barn's walk.
  {let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,walks=L.barns.map(d=>[-10.4,.5+d,10.5,4.2+d]),off=(x,y)=>[...L.blocks,...L.earth,...walks].some(([a,b,c,d])=>x>a-.3&&x<c+.3&&y>b-.3&&y<d+.3);
    const sow=(geo,count,colours,size)=>{const X=[Math.min(-20,L.lawn[0]),Math.max(20,L.lawn[2])];const mat=keep(new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),mesh=new THREE.InstancedMesh(keep(geo),mat,count),m=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),c=new THREE.Color();
      for(let i=0;i<count;i++){let x,y;do{x=X[0]+rnd()*(X[1]-X[0]);y=L.lawn[1]-2+rnd()*(L.back+3-L.lawn[1]);}while(off(x,y));const k=size[0]+rnd()*(size[1]-size[0]);
        mesh.setMatrixAt(i,m.compose(at(x,y).setY(.04),q.setFromAxisAngle(up,rnd()*6.28),new THREE.Vector3(k,k,k)));mesh.setColorAt(i,c.set(colours[i%colours.length]));}
      mesh.frustumCulled=false;scene.add(mesh);};
    const blades=new THREE.BufferGeometry();blades.setAttribute('position',new THREE.Float32BufferAttribute([-.09,0,0,.0,0,.03,-.13,.42,.02, .02,0,-.03,.11,0,0,.07,.5,-.03, -.03,0,.06,.05,0,.08,.16,.36,.1],3));
    sow(blades,Math.round(RANCH.meadow.tufts*(L.back-L.lawn[1])/42*1.3),['#72aa40','#84bd4a','#a3d660','#b6e26e'],[.55,1.1]);
    sow(new THREE.CircleGeometry(.075,6).rotateX(-Math.PI/2.6).translate(0,.2,0),Math.round(RANCH.meadow.flowers*(L.back-L.lawn[1])/42*1.3),['#ffffff','#f6e27a','#c9b6f2','#ffffff'],[.8,1.4]);}
  // The wheat: every stalk of every bed that can be used has its place (a little off its row, turned its own way); a
  // stage's mesh is drawn once, with the stalks of the beds at that stage; under them a block, so a bed reads as one
  // thick crop. field(grown): one number a bed, null (empty) or how far along it is, 0–1 (farm.mjs growth): sprouts to
  // a third, then the green stalk, the ripe one at 1; within a stage the stalks stand taller as it goes.
  const K=RANCH.stalks,stalks=[],crops=[1,2,3].map(s=>{const src=assets.wheat.getObjectByName(`Wheat_${s-1}`),m=new THREE.InstancedMesh(src.geometry,SOLID,Math.max(1,open)*K.rows*K.cols);m.count=0;m.frustumCulled=false;scene.add(m);return m;});
  {let seed=5;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,m=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
    for(const [bx,by] of L.beds.slice(0,open)){const bed=[];for(let rr=0;rr<K.rows;rr++)for(let c=0;c<K.cols;c++){const k=.85+rnd()*.3;
      bed.push(m.compose(at(bx-K.size[0]/2+K.size[0]*c/(K.cols-1)+(rnd()-.5)*.1,by-K.size[1]/2+K.size[1]*rr/(K.rows-1)).setY(S.top),q.setFromAxisAngle(up,rnd()*6.28),new THREE.Vector3(K.fat,k,K.fat)).clone());}stalks.push(bed);}}
  const fillGeo=keep(new THREE.BoxGeometry(S.bed[0]-.15,1,S.bed[1]-.15).translate(0,.5,0)),fillMat={green:keep(new THREE.MeshStandardMaterial({color:F.fill.green[0],roughness:1})),ripe:keep(new THREE.MeshStandardMaterial({color:F.fill.ripe[0],roughness:1}))};
  const fills=stalks.map((_,i)=>{const m=new THREE.Mesh(fillGeo,fillMat.green);m.position.copy(at(...L.beds[i])).setY(S.top-.02);m.visible=false;scene.add(m);return m;}),tall=new THREE.Matrix4(),lift=new THREE.Matrix4();
  function field(grown){const n=[0,0,0];fills.forEach((m,i)=>{const g=grown[i];m.visible=g!=null&&g>=1/3;if(m.visible){const kind=g>=1?'ripe':'green',[,h0,h1]=F.fill[kind];m.material=fillMat[kind];m.scale.y=g>=1?h1:h0+(h1-h0)*(g-1/3)*1.5;}});
    grown.forEach((g,i)=>{if(g==null||!stalks[i])return;const s=g>=1?2:g>=1/3?1:0,k=s===2?1:s===1?.5+.5*(g-1/3)*1.5:.5+1.5*g;lift.makeScale(1,k,1);
      for(const mat of stalks[i])crops[s].setMatrixAt(n[s]++,tall.multiplyMatrices(mat,lift));});crops.forEach((m,i)=>{m.count=n[i];m.instanceMatrix.needsUpdate=true;});}
  r.shadowMap.autoUpdate=false;   // the scene never moves: its shadows are drawn once (the buddies stand on a soft spot instead)

  // The buddies out on the lawn: each on a spot, a round shadow under it.
  const spots=waypoints(trees,L),spot=new THREE.Mesh(keep(new THREE.CircleGeometry(.62,20)),keep(new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.2,depthWrite:false})));
  const dress=b=>{const model=createApprovedHorse(0,b.coat,false,b.hair,true,true);model.seat.visible=false;
    model.root.scale.setScalar(RANCH.size);model.root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});return model;};
  // The buddies in: each in its stall, looking out over its door, standing (the idle clip), nowhere to go.
  const stalled=[];
  inside.forEach((b,k)=>{if(!b)return;const d=L.barns[Math.floor(k/D.x.length)],cx=D.x[k%D.x.length];if(d==null)return;
    const model=dress(b),idle=model.mixer.clipAction(model.clips.idle).play();model.mixer.update(Math.random()*3);
    model.root.position.copy(at(cx,D.stand+d));model.root.rotation.y=Math.PI;scene.add(model.root);stalled.push({id:b.id,model,idle,pos:model.root.position});});
  const free=(want=()=>true)=>{const taken=new Set(herd.flatMap(b=>[b.on,b.path.at(-1)]));const ok=spots.map((_,i)=>i).filter(i=>!taken.has(i)&&spots[i].next.length&&want(spots[i]));return ok[Math.floor(Math.random()*ok.length)];};
  const herd=[];
  for(const b of buddies){
    const on=free();if(on==null)break;   // more buddies than spots: the rest stay in
    const model=dress(b);
    const trot=approvedAssets.get(ranchFile(b.coat)).animations.find(a=>a.name==='Trot'),idle=model.mixer.clipAction(model.clips.idle).play(),step=model.mixer.clipAction(trot).play();
    step.setEffectiveWeight(0);step.timeScale=RANCH.trot;model.mixer.update(Math.random()*3);
    const p=spots[on],under=spot.clone();under.rotation.x=-Math.PI/2;
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

  // The camera: the view up the strip (its middle slides along it, where a drag left it) or the field's shot; it
  // glides to whichever is asked for (every number eased on its own).
  const cam=new THREE.PerspectiveCamera(RANCH.fov,1,2,500),rad=Math.PI/180,mid=new THREE.Vector3(),dir=new THREE.Vector3();
  const SHOTS={field:'fieldShot',near:'nearShot'};let now=SHOTS[shot]?shot:'all',slide=L.slide[0],W=1,H=1;
  const view=()=>{const s=SHOTS[now]?L[SHOTS[now]]:{...L.open,at:[L.open.at[0]+slide*L.up[0],L.open.at[1]+slide*L.up[1]]};return {x:s.at[0],y:s.at[1],dist:s.dist,az:s.az,el:s.el,fov:s.fov??RANCH.fov};},cur=view();
  function aim(dt=0){const to=view(),k=dt?1-Math.exp(-dt*RANCH.ease):0;for(const n in cur)cur[n]+=(to[n]-cur[n])*k;
    if(cam.fov!==cur.fov){cam.fov=cur.fov;cam.updateProjectionMatrix();}
    const az=cur.az*rad,el=cur.el*rad;dir.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el));
    mid.copy(at(cur.x,cur.y));cam.position.copy(mid).addScaledVector(dir,cur.dist);cam.lookAt(mid);}
  function fit(){W=host.clientWidth||1;H=host.clientHeight||1;r.setSize(W,H,false);cam.aspect=W/H;cam.updateProjectionMatrix();aim();r.render(scene,cam);}   // drawn at once: a resize clears the canvas
  const ro=new ResizeObserver(fit);ro.observe(host);
  const go=name=>{now=SHOTS[name]?name:'all';};

  // Touch: in the view up the strip a drag up or down slides it along; a sideways swipe asks the page for the next
  // or the last tab; a tap that did not move picks the buddy under it, or else the bed.
  const el$=r.domElement;let from=null,last2=null,moved=0;el$.style.touchAction='none';
  el$.addEventListener('pointerdown',e=>{try{el$.setPointerCapture(e.pointerId);}catch{}from=last2=[e.clientX,e.clientY];moved=0;});
  el$.addEventListener('pointermove',e=>{if(!from)return;const dy=e.clientY-last2[1];moved+=Math.abs(e.clientX-last2[0])+Math.abs(dy);last2=[e.clientX,e.clientY];
    if(now==='all'&&Math.abs(e.clientY-from[1])>Math.abs(e.clientX-from[0]))slide=Math.max(L.slide[0],Math.min(L.slide[1],slide+dy*2*cur.dist*Math.tan(RANCH.fov*rad/2)/H/Math.sin(cur.el*rad)));});   // the ground under the finger follows it
  el$.addEventListener('pointercancel',()=>{from=null;});
  el$.addEventListener('pointerup',e=>{if(!from)return;const dx=e.clientX-from[0],dy=e.clientY-from[1];from=null;
    if(Math.abs(dx)>44&&Math.abs(dx)>Math.abs(dy)*1.5){onSwipe?.(dx<0?1:-1);return;}
    if(moved>=10)return;
    const box=el$.getBoundingClientRect(),v=new THREE.Vector3(),far=p=>Math.hypot((v.x+1)/2*box.width-(e.clientX-box.left),(1-v.y)/2*box.height-(e.clientY-box.top));let best=null,near=48;
    for(const b of [...herd,...stalled]){v.copy(b.pos);v.y+=1;v.project(cam);const d=far();if(d<near){near=d;best=b;}}
    if(best&&onPick)return onPick(best.id);
    if(onBed){let bed=-1;near=64;L.beds.slice(0,open).forEach(([x,y],i)=>{v.copy(at(x,y)).setY(S.top).project(cam);const d=far();if(d<near){near=d;bed=i;}});if(bed>=0)onBed(bed,e.clientX,e.clientY);}});

  let raf=0,last=performance.now();
  const tick=dt=>{herd.forEach(b=>stroll(b,dt));stalled.forEach(b=>b.model.mixer.update(dt));aim(dt);r.render(scene,cam);};
  function frame(t){raf=requestAnimationFrame(frame);const dt=Math.min(.05,(t-last)/1000);last=t;tick(dt);}
  herd.forEach(b=>stroll(b,0));r.shadowMap.needsUpdate=true;fit();
  host.append(el$);raf=requestAnimationFrame(frame);
  if(new URLSearchParams(location.search).has('debug'))window.__ranch={r,scene,cam,herd,spots,cur,L,go,set slide(v){slide=v;},get slide(){return slide;},step:tick};   // dev (?debug): step, to move things on in a tab that draws one frame a second
  return {shot:go,field,dispose(){cancelAnimationFrame(raf);ro.disconnect();[...herd,...stalled].forEach(b=>b.model.materials.forEach(m=>m.dispose()));made.forEach(x=>x.dispose());r.dispose();el$.remove();}};
}
