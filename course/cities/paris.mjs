// Paris · Garden Ride (format: taipei.mjs).
export default {
  id:'paris', city:'Paris', title:'Garden Ride', brief:'大 S 彎接小彎，繞著花園走', difficulty:2,
  tagline:'Formal gardens. Gentle arcs.', surface:'Sand', scenery:'garden',   // Tracks page copy
  track:{
    lap:'S L45 R45 R45 L45 L45 L45 L30 R30 F R30 L30 L45 L45 F R45 L45 L45 R45 L45 L45 S R30 L30 L30 R30 L45 L45',   // 2026-10-05 (the user: more bends): a wide S on two sides, a step and a wiggle on the others
    gameplay:({at,trail})=>({mud:[[.38,.62]],laps:2,tempo:1.25,speed:1.0,relay:at(9,0),jumps:[{s:at(14,20)},{s:at(21,20)}],
      coins:[...trail(at(2,2),-1),...trail(at(6,2),1),...trail(at(12,2),-1),...trail(at(17,2),1),...trail(at(23,2),0)]}),
  },
  weather:{sky:{top:'#7cbde8',horizon:'#f1e6d6'},sun:{color:'#ffe6bf',intensity:1},fog:[260,1100],cloud:0,rain:0},
  ground:{road:'#d3a574',verge:'#8fb85e',grass:'#7aa552'},
  dressing:{
    // The baseline garden (references/style/paris_baseline.webp, city_paris.webp): the stone balustrade, classic lamps
    // with the city's banner on the post, cone topiaries, urns on pedestals and flowering shrubs behind it, then the trees.
    barrier:{asset:'Balustrade',height:2.8},
    rows:[
      {asset:'Lamp_Banner_Paris',every:50,offset:[1.3,1.3],height:[9,9],side:'left'},{asset:'Lamp_Banner_Paris_R',every:50,offset:[1.3,1.3],height:[9,9],side:'right'},   // both banners hang toward the track; 2026-10-04: half as many (every 24 → 50 m; Stockholm 40 → 80), on the user's word
      {asset:'Topiary_Cone',every:12,offset:[2.6,3],height:[5.5,6.5]},
      {asset:'Urn_Planter',every:24,offset:[1.5,1.5],height:[3.6,3.6]},
      {asset:'Shrub_Round',every:24,offset:[2.2,3.2],height:[1.6,2.1]},
      {asset:'Tree_Round',every:14,offset:[7,11],height:[11,14]},
      {asset:'Tree_Round',every:13,offset:[11,18],height:[10,13]},   // a second rank behind: depth
      // Plants at the fence's foot, on both sides of it (only the nearest stretch: beyond it they are a pixel or two)
      {asset:'Grass_Clump',every:2.4,offset:[-.7,-.2],height:[.6,1],reach:85},
      {asset:'Grass_Clump',every:3.6,offset:[.35,1.5],height:[.6,1],reach:60},
      // Mid layer: sparse trees further out, slower parallax than the fence line
      {asset:'Tree_Round',every:24,offset:[24,60],height:[9,13]},
    ],
    treeline:{assets:['Tree_Round'],count:60,spread:190,depth:[330,420],height:[6.5,13]},
    // Skyline cards just beyond the treeline (course/assets.mjs; approved-environment.js): [asset, x m right of the road,
    // z m ahead, height m]. The far bank and its water across the view, the bridge over that water to one side, groups
    // of buildings behind them; the landmark is the far painting's, in the middle.
    skyline:[['Bank_Paris',0,455,26],['Bridge_Paris',97,440,20],['Mid_Paris_A',-37,500,34],['Mid_Paris_C',40,520,31]],
  },
  backdrop:'paris.webp',

  // 5. FAR BACKGROUND (far-background.js, SPEC 5.6): the 2026-10-04 painting (2:1, a level horizon, the landmark in the
  //    middle; source in references/style/panorama-sources/), projection 'strip'. 44° across (× far-background's FAR):
  //    the Eiffel Tower stands straight ahead, about 5.7° tall (12% of the screen). The far edge of the lawn (row 0.660) is on the
  //    true horizon, so the painted trees there merge with the 3D treeline and the city rises above it. No sun in the
  //    picture: u, v (outside it) keep the key light where it was (140° left, 45° up). Colours sampled from the painting.
  background:{panorama:'paris.webp',projection:'strip',span:44,yaw:0,horizon:0.660,sun:{u:-2.674,v:-1.388},
    fogColor:'#bce0fc',horizonColor:'#bce0fc',topColor:'#39a0fd',ambientColor:'#63b8fd',keyLightColor:'#fff3dc',
    far:{saturation:1,contrast:1,haze:.04,deep:0}},
  grassTint:[1.2,1.1,.92],   // × the shared grass (lawn, verge, edge): the baseline's light yellow-green
};
