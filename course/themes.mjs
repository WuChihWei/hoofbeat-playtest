// CITY THEME layer: what a course looks like, read from its city pack (cities/<id>.mjs: weather, dressing, backdrop).
// References shared asset ids only; must never mention rhythm, coins, jumps or relays (check.mjs enforces this).
import {CITIES} from './cities/index.mjs?v=r268';
export const THEMES=Object.freeze(Object.fromEntries(CITIES.map(p=>[p.id,Object.freeze({
  name:`${p.city} · ${p.title}`,ground:p.ground,sky:p.weather.sky,weather:p.weather,
  barrier:p.dressing.barrier,rows:p.dressing.rows,treeline:p.dressing.treeline,skyline:p.dressing.skyline||[],backdrop:p.backdrop,background:p.background})])));
