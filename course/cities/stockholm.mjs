// Stockholm · Nordic Trail (format: taipei.mjs). The approved reference look: pines, boulders, banners, white fence.
export default {
  id:'stockholm', city:'Stockholm', title:'Nordic Trail', brief:'S 形折返＋U 彎，彎最多', difficulty:3, mvp:true,
  tagline:'Pine forests. Open horizons.', surface:'Dirt', scenery:'forest',   // Tracks page copy
  track:{
    // 2026-10-05 (the user: a solo run, one lap, should take 30–40 s): 711 m, it was 791. The last 40 m straight is gone
    // (the first fill closes 40 m shorter with it); both switchbacks stay: any shorter would take one of them out.
    lap:'S M L45 L45 S F L45 L45 L45 L45 R45 R45 R45 R45 L45 L45 F L45 L45 L45 L45 R45 R45 R45 R45 L45 L45 L45 L45',   // switchback + dent
    gameplay:({at,trail})=>({mud:[[.40,.52],[.80,.92]],laps:2,soloLaps:2,tempo:1.3,speed:1.0,relay:at(4,0),jumps:[{s:at(1,20)},{s:at(1,60)},{s:at(5,35)}],
      coins:[...trail(at(6,2),1),...trail(at(10,2),-1),...trail(at(19,2),0),...trail(at(21,2),1),...trail(at(16,2),-1)]}),
  },
  weather:{sky:{top:'#5fb2ee',horizon:'#cfe6f2'},sun:{color:'#fff0d4',intensity:1},fog:[260,1100],cloud:0,rain:0},
  ground:{road:'#b98a63',verge:'#7fae57',grass:'#5f9444'},
  dressing:{
    // The reference (references/style/city_stockholm.webp): a white wooden fence, the city's banner on wooden poles, a
    // spruce forest right behind it with boulders between the trunks.
    barrier:{asset:'Fence_Wood',height:2.6},
    rows:[
      {asset:'Banner_Pole_Stockholm',every:80,offset:[1.2,1.2],height:[8,8],side:'left'},{asset:'Banner_Pole_Stockholm_R',every:80,offset:[1.2,1.2],height:[8,8],side:'right'},   // both banners hang toward the track; 2026-10-04: half as many (every 24 → 50 m; Stockholm 40 → 80), on the user's word
      {asset:'Tree_Pine',every:10,offset:[5,11],height:[15,20],shrink:true},
      {asset:'Tree_Pine',every:9,offset:[11,19],height:[14,19],shrink:true},   // a second rank behind: a forest, not a row
      {asset:'Tree_Round',every:40,offset:[8,13],height:[9,12],side:'right',shrink:true},
      {asset:'Rock_Large',every:27,offset:[3.4,5.4],height:[2.6,3.8]},
      // Plants at the fence's foot, on both sides of it (only the nearest stretch: beyond it they are a pixel or two)
      {asset:'Grass_Clump',every:2.4,offset:[-.7,-.2],height:[.6,1],reach:85},
      {asset:'Grass_Clump',every:3.6,offset:[.35,1.5],height:[.6,1],reach:60},
      // Mid layer: sparse spruces and boulders further out, slower parallax than the fence line
      {asset:'Tree_Pine',every:16,offset:[20,62],height:[13,20],shrink:true},
      {asset:'Rock_Large',every:58,offset:[15,32],height:[3,5]},
    ],
    treeline:{assets:['Tree_Pine','Tree_Pine','Tree_Round'],count:60,spread:190,depth:[330,420],height:[6.5,13]},
    // Skyline cards just beyond the treeline (course/assets.mjs; approved-environment.js): [asset, x m right of the road,
    // z m ahead, height m]. The far bank and its water across the view, the bridge over that water to one side, groups
    // of buildings behind them; the landmark is the far painting's, in the middle.
    skyline:[['Bank_Stockholm',0,455,20],['Bridge_Stockholm',102,440,16],['Mid_Stockholm_A',-37,500,34],['Mid_Stockholm_B',40,520,20],['Mid_Stockholm_C',-92,540,26]],
  },
  backdrop:'stockholm.webp',   // the flat card, used only without a panorama

  // 5. FAR BACKGROUND (far-background.js, SPEC 5.6): the 2026-10-04 painting (2:1, a level horizon, the landmark in the
  //    middle; source in references/style/panorama-sources/), projection 'strip'. 54° across (× far-background's FAR):
  //    the City Hall tower stands straight ahead, about 4.6° tall (10% of the screen). The quay's waterline (row 0.638) is on the
  //    true horizon, so the painted trees there merge with the 3D treeline and the city rises above it. No sun in the
  //    picture: u, v (outside it) keep the key light where it was (73° left, 38° up). Colours sampled from the painting.
  background:{panorama:'stockholm.webp',projection:'strip',span:54,yaw:0,horizon:0.752,sun:{u:-0.847,v:-0.753},
    fogColor:'#9dd2fc',horizonColor:'#9dd2fc',topColor:'#4da4fd',ambientColor:'#60b4fc',keyLightColor:'#fff3dc',
    far:{saturation:1,contrast:1,haze:.04,deep:0}},
};
