// Taipei · Riverside Run. A city pack has four parts; everything else (race rules, shared models) is global.
export default {
  id:'taipei', city:'Taipei', title:'Riverside Run', brief:'左右連續彎，彎度小，新手型', difficulty:1, mvp:true,
  tagline:'Riverbank breeze. Easy bends.', surface:'Dirt', scenery:'riverside',   // Tracks page copy

  // 1. TRACK: the lap as shared pieces (course/track.mjs): S/M/L straights, L|R 15·30·45 bends, F = straight whose
  //    length closeLoop() solves so the lap closes. Gameplay sits on that lap: at(i,t) = t metres into piece i;
  //    trail(s,lane,n=3,gap=7) = a run of coins. Gameplay never names a model.
  track:{
    lap:'M L30 R30 R30 L30 S L45 L45 F L45 L45 F L45 R45 R45 L45 L45 L45 R30 L30 L30 R30 L45 L45',   // 2026-10-05 (the user: more bends): a wiggle on the start side and on the last, a wide S on the far side
    gameplay:({at,trail})=>({mud:[[.74,.95]],laps:2,soloLaps:1,tempo:1.2,speed:1.0,relay:at(8,5),jumps:[{s:at(11,25)}],
      coins:[...trail(at(2,2),0),...trail(at(5,10),-1),...trail(at(9,5),1),...trail(at(14,2),-1),...trail(at(19,2),0)]}),
  },

  // 2. WEATHER: sky gradient (horizon = fog colour), sun colour and strength (× the unified look), fog near/far,
  //    cloud 0–1 (greys the sky, softens the sun) and rain 0–1 (rain streaks, puddles, darker sky).
  weather:{sky:{top:'#63b3ea',horizon:'#d6ebf3'},sun:{color:'#fff0d4',intensity:1},fog:[260,1100],cloud:.25,rain:0},

  // 3. DRESSING: what lines the course (ids from course/assets.mjs; sizes in race units — the fence is 3.5 tall).
  //    barrier: the rail on both sides (height; `far` swaps to a light model beyond ~170 m for heavy rails).
  //    rows: repeating props — every (m per side), offset [min,max] beyond the barrier, height [min,max],
  //    side both|left|right, face 'road' (flags, lamps; otherwise a random turn), tint {material: colour},
  //    shrink (smaller toward the end of the road). treeline: the forest edge where the road ends.
  //    ground: the map colours (Race / Tracks pages).
  ground:{road:'#c98f5e',verge:'#86b957',grass:'#6fa04a'},
  dressing:{
    // The reference (references/style/city_taipei.webp): a white wooden fence, classic lamps with the city's banner on
    // the post right behind it, benches and shrubs, big leafy trees behind those, more trees further out.
    barrier:{asset:'Fence_Wood',height:2.6},
    rows:[
      {asset:'Lamp_Banner_Taipei',every:50,offset:[1.3,1.3],height:[9,9],side:'left'},{asset:'Lamp_Banner_Taipei_R',every:50,offset:[1.3,1.3],height:[9,9],side:'right'},   // both banners hang toward the track; 2026-10-04: half as many (every 24 → 50 m; Stockholm 40 → 80), on the user's word
      {asset:'Tree_Round',every:15,offset:[5,9],height:[12,15],shrink:true},
      {asset:'Tree_Round',every:13,offset:[10,17],height:[9,13],shrink:true},   // a second, lower rank behind: depth
      {asset:'Bench_Simple',every:48,offset:[2.6,3.2],height:[1.5,1.5],side:'left'},
      {asset:'Shrub_Round',every:7,offset:[2.4,5.2],height:[1.7,2.8]},
      // Plants at the fence's foot, on both sides of it (only the nearest stretch: beyond it they are a pixel or two)
      {asset:'Grass_Clump',every:2.4,offset:[-.7,-.2],height:[.6,1],reach:85},
      {asset:'Grass_Clump',every:3.6,offset:[.35,1.5],height:[.6,1],reach:60},
      // Mid layer: sparse trees further out, slower parallax than the fence line
      {asset:'Tree_Round',every:24,offset:[22,60],height:[10,15],shrink:true},
    ],
    treeline:{assets:['Tree_Round','Tree_Pine'],count:60,spread:190,depth:[330,420],height:[6.5,13]},
    // Skyline cards just beyond the treeline (course/assets.mjs; approved-environment.js): [asset, x m right of the road,
    // z m ahead, height m]. The far bank and its water across the view, the bridge over that water to one side, groups
    // of buildings behind them; the landmark is the far painting's, in the middle.
    skyline:[['Bank_Taipei',0,455,31],['Bridge_Taipei',100,440,16]],
  },

  // 4. BACKDROP: the painted far view, assets/backdrops/<file> (skyline cropped at its lawn line, top and sides faded).
  backdrop:'taipei.webp',

  // 5. FAR BACKGROUND (far-background.js, SPEC 5.6): the 2026-10-04 painting (2:1, a level horizon, the landmark in the
  //    middle; source in references/style/panorama-sources/), projection 'strip'. 44° across (× far-background's FAR):
  //    Taipei 101 stands straight ahead, about 5.9° tall (13% of the screen). The far bank's waterline (row 0.679) is on the
  //    true horizon, so the painted trees there merge with the 3D treeline and the city rises above it. No sun in the
  //    picture: u, v (outside it) keep the key light where it was (74° left, 36° up). Colours sampled from the painting.
  background:{panorama:'taipei.webp',projection:'strip',span:44,yaw:0,horizon:0.702,sun:{u:-1.180,v:-0.971},
    fogColor:'#87ccfd',horizonColor:'#87ccfd',topColor:'#4da7fd',ambientColor:'#64b6fc',keyLightColor:'#fff3dc',
    far:{saturation:1,contrast:1,haze:.04,deep:0}},
};
