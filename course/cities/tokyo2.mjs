// tokyo, a second time (stages 7–10, 2026-10-12): the city's own track and look; its weather is drawn for every run
// (progress.mjs LEVELS weather; course/cities/index.mjs cityById 'id~weather').
import base from './tokyo.mjs?v=r722';
export default {...base,id:'tokyo2',mvp:false,difficulty:3,track:{...base.track,gameplay:h=>({...base.track.gameplay(h),soloLaps:2})}};
