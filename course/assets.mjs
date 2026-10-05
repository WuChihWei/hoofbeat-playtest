// Shared, city-agnostic environment assets (one set, recombined per city pack). `file` = shipped GLB under
// assets/models/ (backdrops: under assets/); `far` = its light LOD for the far half of the road; assets not modelled yet
// name a `standIn` (a shipped asset + per-material tint) so every pack renders today.
// layer: near/mid = 3D beside the track, far = 2.5D card kept at distance.
const A=(file,layer='near',standIn=null,far=null)=>Object.freeze({file,layer,standIn,far});
const S=(asset,tint=null)=>Object.freeze({asset,tint});
// A card: a painted picture (assets/cards/, cut out by tools/card.py; aspect = width / height) drawn on an upright plane,
// 2 triangles in place of a model. The roadside is only ever seen from ahead, so a flat picture reads as the object.
// shade: [width, depth] of the ground shadow in card heights (default: from the aspect; false: none); anchor: where its
// foot is across the picture (0 left … 1 right); scale: its height next to the others cut from the same sheet.
const C=(file,aspect,shade=null,anchor=.5,scale=1)=>Object.freeze({card:Object.freeze({file:'cards/'+file,aspect,shade,anchor,scale}),layer:'near'});
// Variants: every placed object is one of these cards (a different tree at every spot).
const V=(...ids)=>Object.freeze({variants:Object.freeze(ids),layer:'near'});
// A built fence: a picture of a balustrade (tools/fence.py: post body | one span, aspect = its width / height, post =
// the post's share of the width) on a post box and a flat span panel between posts: 12 triangles a bay, any city.
const F=(file,spec)=>Object.freeze({fence:Object.freeze({file:'cards/'+file,...spec}),layer:'near'});
export const ASSETS=Object.freeze({
  
  // Each city's banner on a post (tools/cards-derived.py): on the classic lamp, or on Stockholm's wooden pole.
  Lamp_Banner_Taipei:C('Lamp_Banner_Taipei.webp',.369,[.14,.08],.26), Lamp_Banner_Tokyo:C('Lamp_Banner_Tokyo.webp',.369,[.14,.08],.26),
  Lamp_Banner_Paris:C('Lamp_Banner_Paris.webp',.372,[.14,.08],.26), Lamp_Banner_Seoul:C('Lamp_Banner_Seoul.webp',.366,[.14,.08],.26),
  Banner_Pole_Stockholm:C('Banner_Pole_Stockholm.webp',.452,[.12,.07],.17),
  // _R: the same post for the right of the track, mirrored so its banner hangs toward the track too (the picture flipped,
  // the cloth flipped back so the lettering reads). The left row uses the plain one.
  Lamp_Banner_Taipei_R:C('Lamp_Banner_Taipei_R.webp',.369,[.14,.08],.74), Lamp_Banner_Tokyo_R:C('Lamp_Banner_Tokyo_R.webp',.369,[.14,.08],.74),
  Lamp_Banner_Paris_R:C('Lamp_Banner_Paris_R.webp',.372,[.14,.08],.74), Lamp_Banner_Seoul_R:C('Lamp_Banner_Seoul_R.webp',.366,[.14,.08],.74),
  Banner_Pole_Stockholm_R:C('Banner_Pole_Stockholm_R.webp',.452,[.12,.07],.83),
  Fence_Wood:A('fence/Fence.glb'), 
  
  Topiary_Cone:C('Topiary_Cone.webp',.492), Urn_Planter:C('Urn_Planter.webp',.516),   // Paris garden: cards from references/style/paris_garden_pieces.webp
  Balustrade:F('Balustrade.webp',{aspect:3.125,post:.107}),
    // (tools/garden.py; the cone and the urn it also makes are not used: the cards replaced them)
  // Park pieces (card-sources/park_props.png) and plants at the fence's foot (plant_tufts.png).
  Planter_Long:C('Planter_Long.webp',1.838,[2,.5]), Bench_Simple:C('Bench_Simple.webp',1.406,[1.5,.45]), Rock_Large:C('Rock_Large.webp',1.489,[1.6,.5]), Shrub_Round:C('Shrub_Round.webp',1.185,[1.3,.5]),
  Grass_Clump:V('Tuft_Grass','Tuft_Yellow','Tuft_Weed','Tuft_Daisy'),
  Tuft_Grass:C('Tuft_Grass.webp',.914,false), Tuft_Yellow:C('Tuft_Yellow.webp',1.008,false,.5,.89), Tuft_Weed:C('Tuft_Weed.webp',1.246,false,.5,.73), Tuft_Daisy:C('Tuft_Daisy.webp',1.055,false,.5,.89),
  // Trees (card-sources/trees_round.png, trees_pine.png, trees_cherry.png): three of each kind.
  Tree_Round:V('Tree_Round_A','Tree_Round_B','Tree_Round_C'), Tree_Pine:V('Tree_Pine_A','Tree_Pine_B','Tree_Pine_C'), Tree_Cherry:V('Tree_Cherry_A','Tree_Cherry_B','Tree_Cherry_C'),
  Tree_Round_A:C('Tree_Round_A.webp',.822,[.8,.42],.53), Tree_Round_B:C('Tree_Round_B.webp',1.202,[1.1,.5]), Tree_Round_C:C('Tree_Round_C.webp',1.282,[.95,.45],.5,.77),
  Tree_Pine_A:C('Tree_Pine_A.webp',.395,[.42,.24],.49), Tree_Pine_B:C('Tree_Pine_B.webp',.562,[.55,.3],.49), Tree_Pine_C:C('Tree_Pine_C.webp',.682,[.55,.3],.49,.82),
  Tree_Cherry_A:C('Tree_Cherry_A.webp',1.28,[1,.48],.51,.85), Tree_Cherry_B:C('Tree_Cherry_B.webp',.855,[.8,.42],.49), Tree_Cherry_C:C('Tree_Cherry_C.webp',1.334,[.9,.42],.49,.72),

  

  
  // City skylines (card-sources/mid_<city>.webp, tools/cards-mid.py): per city three groups of buildings, a strip of the far
  // riverbank and a bridge. The pack's dressing.skyline places them beyond the treeline, heights in metres; no ground shadow.
  // Left out: the groups that repeat the far painting's landmark (Taipei A: 101, Tokyo A: Skytree, Paris B: Eiffel, Seoul A and B:
  // N Seoul Tower and Lotte World Tower); tools/cards-mid.py still cuts them.
  Mid_Taipei_B:C('Mid_Taipei_B.webp',1.843,false), Mid_Taipei_C:C('Mid_Taipei_C.webp',1.975,false), Bank_Taipei:C('Bank_Taipei.webp',8.719,false), Bridge_Taipei:C('Bridge_Taipei.webp',11.557,false),
  Mid_Tokyo_B:C('Mid_Tokyo_B.webp',1.539,false), Mid_Tokyo_C:C('Mid_Tokyo_C.webp',1.003,false), Bank_Tokyo:C('Bank_Tokyo.webp',7.722,false), Bridge_Tokyo:C('Bridge_Tokyo.webp',11.325,false),
  Mid_Paris_A:C('Mid_Paris_A.webp',1.425,false), Mid_Paris_C:C('Mid_Paris_C.webp',1.478,false), Bank_Paris:C('Bank_Paris.webp',5.927,false), Bridge_Paris:C('Bridge_Paris.webp',8.935,false),
  Mid_Seoul_C:C('Mid_Seoul_C.webp',2.023,false), Bank_Seoul:C('Bank_Seoul.webp',8.981,false), Bridge_Seoul:C('Bridge_Seoul.webp',13.046,false),
  Mid_Stockholm_A:C('Mid_Stockholm_A.webp',1.167,false), Mid_Stockholm_B:C('Mid_Stockholm_B.webp',2.632,false), Mid_Stockholm_C:C('Mid_Stockholm_C.webp',1.554,false), Bank_Stockholm:C('Bank_Stockholm.webp',7.205,false), Bridge_Stockholm:C('Bridge_Stockholm.webp',11.708,false),
  // Far layer: one 2.5D card per city (panorama / skyline silhouette), not 3D.
  
});
// The shipped model (and its far LOD) that renders `id`, with the stand-in's tint when it has no model yet.
// `lite`: the same model with fewer triangles (tools/lod.py, Blender decimate; *_Lite.glb beside it): phones use it up close.
const LITE=new Set();   // no model has a light copy now (the roadside is cards; the only model the packs load is the wooden fence)
export function modelFor(id){
  const a=ASSETS[id];if(!a)throw new Error('Unknown asset '+id);
  if(a.card)return {card:a.card,file:null,far:null,lite:null,tint:null};
  if(a.fence)return {fence:a.fence,file:null,far:null,lite:null,tint:null};
  if(a.variants)return {variants:a.variants,file:null,far:null,lite:null,tint:null};
  if(a.file)return {file:a.file,far:a.far,lite:LITE.has(a.file)?a.file.replace('.glb','_Lite.glb'):null,tint:null};
  if(!a.standIn)return null;
  const m=modelFor(a.standIn.asset);return m&&{...m,tint:{...m.tint,...a.standIn.tint}};
}
export const missingAssets=()=>Object.entries(ASSETS).filter(([,a])=>!a.file&&!a.card&&!a.fence&&!a.variants).map(([id,a])=>({id,layer:a.layer,standIn:a.standIn?.asset??null}));
