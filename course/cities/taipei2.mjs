// Taipei · After the Rain: stage 6 (2026-10-11). Taipei's pack again, two laps, under a wet grey sky: the stage where
// the puddles are (progress.mjs LEVELS hazards). Its own art is still to come: the pictures are Taipei's.
import base from './taipei.mjs?v=r577';
export default {...base,
  id:'taipei2', city:'Taipei', title:'After the Rain', brief:'雨後的河岸，到處是水窪', difficulty:3, mvp:false,
  tagline:'Wet riverside. Mind the puddles.',
  track:{...base.track,gameplay:h=>({...base.track.gameplay(h),soloLaps:2})},
  weather:{...base.weather,sun:{color:'#eef2f4',intensity:.85},cloud:.7,rain:.5},
};
