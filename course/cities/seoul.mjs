// Seoul · Han River Sprint (format: taipei.mjs).
export default {
  id:'seoul', city:'Seoul', title:'Han River Sprint', brief:'河岸直線接連續小彎、高速', difficulty:3,
  tagline:'Long river straight. Full speed.', surface:'Dirt', scenery:'river',   // Tracks page copy
  track:{
    lap:'S L45 L45 M R30 L30 R30 L30 R30 L30 L45 L45 F R30 L30 R30 L30 L45 L45 L30 R30 R30 L30 F L30 R30 R30 L30 L45 L45',   // 2026-10-05 (the user: more bends): the river straight, then steps and wiggles all the way round
    gameplay:({at,trail})=>({mud:[[.70,.92]],laps:2,tempo:1.4,speed:1.1,relay:at(3,30),jumps:[{s:at(3,15)},{s:at(23,30)}],
      coins:[...trail(at(5,2),1),...trail(at(8,2),-1),...trail(at(14,2),0),...trail(at(20,2),1),...trail(at(25,2),-1,2)]}),
  },
  weather:{sky:{top:'#5aa9e6',horizon:'#dcecf4'},sun:{color:'#fff0d8',intensity:1},fog:[260,1100],cloud:0,rain:0},
  ground:{road:'#c48b5b',verge:'#83b25a',grass:'#6a9c49'},
  dressing:{
    // The reference (the Seoul race mock-up): a white fence, classic lamps with the city's banner on the post, green
    // trees with cherry trees in blossom on the left, benches, planters along the fence.
    barrier:{asset:'Fence_Wood',height:2.6},
    rows:[
      {asset:'Lamp_Banner_Seoul',every:50,offset:[1.3,1.3],height:[9,9],side:'left'},{asset:'Lamp_Banner_Seoul_R',every:50,offset:[1.3,1.3],height:[9,9],side:'right'},   // both banners hang toward the track; 2026-10-04: half as many (every 24 → 50 m; Stockholm 40 → 80), on the user's word
      {asset:'Tree_Round',every:15,offset:[5,9],height:[11,14],shrink:true},
      {asset:'Tree_Cherry',every:30,offset:[7,12],height:[10,13],side:'left',shrink:true},
      {asset:'Tree_Round',every:13,offset:[10,17],height:[9,13],shrink:true},   // a second, lower rank behind: depth
      {asset:'Planter_Long',every:30,offset:[1.5,1.9],height:[1.9,1.9]},
      {asset:'Bench_Simple',every:54,offset:[2.6,3.2],height:[1.5,1.5],side:'left'},
      // Plants at the fence's foot, on both sides of it (only the nearest stretch: beyond it they are a pixel or two)
      {asset:'Grass_Clump',every:2.4,offset:[-.7,-.2],height:[.6,1],reach:85},
      {asset:'Grass_Clump',every:3.6,offset:[.35,1.5],height:[.6,1],reach:60},
      // Mid layer: sparse trees further out, slower parallax than the fence line
      {asset:'Tree_Round',every:26,offset:[22,60],height:[10,14],shrink:true},
    ],
    treeline:{assets:['Tree_Round'],count:60,spread:190,depth:[330,420],height:[6.5,13]},
    // Skyline cards just beyond the treeline (course/assets.mjs; approved-environment.js): [asset, x m right of the road,
    // z m ahead, height m]. The far bank and its water across the view, the bridge over that water to one side, groups
    // of buildings behind them; the landmark is the far painting's, in the middle.
    skyline:[['Bank_Seoul',0,455,20],['Bridge_Seoul',-112,440,16],['Mid_Seoul_C',-37,500,26]],
  },
  backdrop:'seoul.webp',

  // 5. FAR BACKGROUND (far-background.js, SPEC 5.6): the 2026-10-04 painting (2:1, a level horizon, the landmark in the
  //    middle; source in references/style/panorama-sources/), projection 'strip'. 44° across (× far-background's FAR):
  //    Lotte World Tower stands straight ahead, about 5.5° tall (12% of the screen). The far bank's waterline (row 0.676) is on the
  //    true horizon, so the painted trees there merge with the 3D treeline and the city rises above it. No sun in the
  //    picture: u, v (outside it) keep the key light where it was (38° left, 42° up). Colours sampled from the painting.
  background:{panorama:'seoul.webp',projection:'strip',span:44,yaw:0,horizon:0.676,sun:{u:-0.361,v:-1.249},
    fogColor:'#c3e3fc',horizonColor:'#c3e3fc',topColor:'#3da0fd',ambientColor:'#65b7fc',keyLightColor:'#fff0d8',
    far:{saturation:1,contrast:1,haze:.04,deep:0}},
};
