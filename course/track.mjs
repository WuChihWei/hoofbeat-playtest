// TRACK GEOMETRY layer: named pieces -> one centerline. Knows nothing about rhythm, coins, jumps, relays or city art.
// Frame: start at the origin heading down -Z (the race camera's forward); +heading turns left; lane +1 is to the right.
export const LANES=Object.freeze({count:3,width:2.6,index:[-1,0,1]});
// One radius for every bend: 15/30/45° differ only in arc length, so the chase camera always turns at one rate.
// 45 m keeps a closed lap (360° of bends = 283 m) near 450–520 m; yaw at race speed ≈ 20°/s.
const R=25;
export const PIECES=Object.freeze({
  Straight_S:{length:40,turn:0},Straight_M:{length:80,turn:0},Straight_L:{length:140,turn:0},
  ...Object.fromEntries([15,30,45].flatMap(a=>[['Curve_L'+a,{length:R*a*Math.PI/180,turn:a}],['Curve_R'+a,{length:R*a*Math.PI/180,turn:-a}]])),
});

// Point `t` metres along a piece starting at (x,z) with heading h and curvature k (rad/m).
function along(x,z,h,k,t){
  if(!k)return {x:x-Math.sin(h)*t,z:z-Math.cos(h)*t,heading:h};
  const e=h+k*t;return {x:x+(Math.cos(e)-Math.cos(h))/k,z:z-(Math.sin(e)-Math.sin(h))/k,heading:e};
}

// A lap entry is a piece name, or {name:'Straight_Fill',length} (a straight whose length closeLoop solved).
export function buildTrack(names){
  const pieces=[];let x=0,z=0,h=0,s=0;
  for(const item of names){
    const name=item.name??item,p=name==='Straight_Fill'?{length:item.length??0,turn:0}:PIECES[name];
    if(!p)throw new Error('Unknown track piece: '+name);
    const k=p.turn*Math.PI/180/p.length;pieces.push({name,s0:s,x,z,heading:h,k,length:p.length,straight:!p.turn});
    ({x,z,heading:h}=along(x,z,h,k,p.length));s+=p.length;
  }
  const at=s1=>{let lo=0,hi=pieces.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(pieces[m].s0<=s1)lo=m;else hi=m-1;}return pieces[lo];};
  return {pieces,length:s,end:{x,z,heading:h},
    pieceAt:at,
    // Centerline pose at distance s, shifted `lane` lanes to the right: the one source for road mesh, runners, camera,
    // rhythm path, fences, coins, jumps and relay placement.
    pose(s1,lane=0){
      const p=at(Math.max(0,Math.min(s,s1))),q=along(p.x,p.z,p.heading,p.k,Math.max(0,Math.min(s,s1))-p.s0),o=lane*LANES.width;
      return {x:q.x+Math.cos(q.heading)*o,z:q.z-Math.sin(q.heading)*o,heading:q.heading,curvature:p.k};
    },
    // Metres of straight around s (before, after); 0 when s is on a bend.
    straightRun(s1){const p=at(s1);return p.straight?[s1-p.s0,p.s0+p.length-s1]:[0,0];},
  };
}

// Closes a hand-drawn lap: the recipe turns a net ±360° and holds exactly two 'Straight_Fill' pieces at different
// headings; their lengths enter the end point linearly, so solving a 2×2 system puts the end back on the start.
export function closeLoop(names){
  const fills=names.flatMap((n,i)=>n==='Straight_Fill'?[i]:[]);
  if(fills.length!==2)throw new Error('closeLoop needs exactly two Straight_Fill pieces');
  const open=buildTrack(names.map(n=>n==='Straight_Fill'?{name:n,length:0}:n));
  if(Math.abs(Math.abs(open.end.heading)-2*Math.PI)>1e-9)throw new Error('closeLoop: bends must add up to 360°');
  const [ax,az,bx,bz]=fills.flatMap(i=>{const h=open.pieces[i].heading;return [-Math.sin(h),-Math.cos(h)];});
  const det=ax*bz-az*bx,ex=-open.end.x,ez=-open.end.z;
  if(Math.abs(det)<1e-6)throw new Error('closeLoop: the two fills are parallel');
  const len=[(ex*bz-ez*bx)/det,(ax*ez-az*ex)/det];
  if(len.some(l=>l<0))throw new Error(`closeLoop: fill lengths ${len.map(l=>l.toFixed(1))} m — recipe cannot close with these pieces`);
  return names.map((n,i)=>fills.includes(i)?{name:n,length:len[fills.indexOf(i)]}:n);
}
