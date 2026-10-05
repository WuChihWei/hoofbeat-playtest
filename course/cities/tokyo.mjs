// Tokyo · Park Circuit (format: taipei.mjs).
export default {
  id:'tokyo', city:'Tokyo', title:'Park Circuit', brief:'深 U 彎繞進公園池塘', difficulty:2,
  tagline:'City park. Pond loops.', surface:'Dirt', scenery:'park',   // Tracks page copy
  track:{
    // 2026-10-05 (the user: one lap in 30–40 s, then: more bends): 599 m (734, then 654). A wiggle on the start side, a
    // step out and back on the next, the far straight, then the hairpin straight into the dent.
    lap:'S L30 R30 R30 L30 S L30 R30 R30 L30 L45 L45 R30 L30 F L30 R30 M L45 L45 L30 R30 R30 L30 F R30 L30 L30 R30 L45 L45 L45 L45 R45 R45 R45 R45 L45 L45 S L45 L45',   // deep U dent into the park
    gameplay:({at,trail})=>({mud:[[.06,.30]],laps:2,tempo:1.3,speed:1.0,relay:at(17,30),jumps:[{s:at(5,20)},{s:at(24,40)}],
      coins:[...trail(at(2,2),0),...trail(at(8,2),-1),...trail(at(12,2),1),...trail(at(21,2),-1),...trail(at(31,2),0),...trail(at(40,2),1)]}),
  },
  weather:{sky:{top:'#6db8ec',horizon:'#e3eef2'},sun:{color:'#fff4e2',intensity:1},fog:[260,1100],cloud:0,rain:0},
  ground:{road:'#c7956a',verge:'#8cc063',grass:'#72a84e'},
  dressing:{
    // The reference (references/style/city_tokyo.webp): a white fence, classic lamps with the city's banner on the post,
    // cherry trees in blossom with green trees between them, planters and flowers along the fence.
    barrier:{asset:'Fence_Wood',height:2.6},
    rows:[
      {asset:'Lamp_Banner_Tokyo',every:50,offset:[1.3,1.3],height:[9,9],side:'left'},{asset:'Lamp_Banner_Tokyo_R',every:50,offset:[1.3,1.3],height:[9,9],side:'right'},   // both banners hang toward the track; 2026-10-04: half as many (every 24 → 50 m; Stockholm 40 → 80), on the user's word
      {asset:'Tree_Cherry',every:15,offset:[5,9],height:[11,14],shrink:true},
      {asset:'Tree_Round',every:30,offset:[9,13],height:[11,14],shrink:true},
      {asset:'Tree_Cherry',every:13,offset:[10,17],height:[9,12],shrink:true},   // a second, lower rank behind: depth
      {asset:'Planter_Long',every:20,offset:[1.5,1.9],height:[1.9,1.9]},
      {asset:'Shrub_Round',every:26,offset:[2.6,4.2],height:[1.5,2.1]},
      // Plants at the fence's foot, on both sides of it (only the nearest stretch: beyond it they are a pixel or two)
      {asset:'Grass_Clump',every:2.4,offset:[-.7,-.2],height:[.6,1],reach:85},
      {asset:'Grass_Clump',every:3.6,offset:[.35,1.5],height:[.6,1],reach:60},
      // Mid layer: sparse trees further out, slower parallax than the fence line
      {asset:'Tree_Cherry',every:24,offset:[22,60],height:[10,14],shrink:true},
    ],
    treeline:{assets:['Tree_Cherry','Tree_Round'],count:60,spread:190,depth:[330,420],height:[6.5,13]},
    // Skyline cards just beyond the treeline (course/assets.mjs; approved-environment.js): [asset, x m right of the road,
    // z m ahead, height m]. The far bank and its water across the view, the bridge over that water to one side, groups
    // of buildings behind them; the landmark is the far painting's, in the middle.
    skyline:[['Bank_Tokyo',0,455,20],['Bridge_Tokyo',-99,440,16],['Mid_Tokyo_B',-37,500,26],['Mid_Tokyo_C',40,520,34]],
  },
  backdrop:'tokyo.webp',

  // 5. FAR BACKGROUND (far-background.js, SPEC 5.6): the 2026-10-04 painting (2:1, a level horizon, the landmark in the
  //    middle; source in references/style/panorama-sources/), projection 'strip'. 44° across (× far-background's FAR):
  //    the Skytree stands straight ahead, about 6.4° tall (14% of the screen). The far bank's waterline (row 0.679) is on the
  //    true horizon, so the painted trees there merge with the 3D treeline and the city rises above it. No sun in the
  //    picture: u, v (outside it) keep the key light where it was (80° left, 44° up). Colours sampled from the painting.
  background:{panorama:'tokyo.webp',projection:'strip',span:44,yaw:0,horizon:0.679,sun:{u:-1.316,v:-1.309},
    fogColor:'#bbe1fc',horizonColor:'#bbe1fc',topColor:'#389cfd',ambientColor:'#62b6fc',keyLightColor:'#fff4e2',
    far:{saturation:1,contrast:1,haze:.04,deep:0}},
};
