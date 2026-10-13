// City packs: everything one city needs, in one file each (see taipei.mjs for the annotated format).
// Add a city: copy a pack to cities/<id>.mjs and edit its four parts (1 track · 2 weather · 3 dressing · 4 backdrop),
// put the backdrop at assets/backdrops/<id>.webp, and list the pack below. `node dist/course/check.mjs` validates it.
import taipei from './taipei.mjs?v=r658';
import tokyo from './tokyo.mjs?v=r658';
import paris from './paris.mjs?v=r658';
import stockholm from './stockholm.mjs?v=r658';
import seoul from './seoul.mjs?v=r658';
import taipei2 from './taipei2.mjs?v=r658';
import paris2 from './paris2.mjs?v=r658';
import tokyo2 from './tokyo2.mjs?v=r658';
import stockholm2 from './stockholm2.mjs?v=r658';
import seoul2 from './seoul2.mjs?v=r658';

export const CITIES=Object.freeze([taipei,tokyo,paris,stockholm,seoul,taipei2,tokyo2,stockholm2,paris2,seoul2]);
// A run's weather (2026-10-12, the user: a city's track and its surroundings are fixed, the weather is drawn): three
// kinds. A city asked for as 'id~rain' or 'id~snow' is that city under that sky; 'id' or 'id~sun' is the pack as written.
export const WEATHERS=Object.freeze({
  sun:w=>w,
  rain:w=>({...w,sun:{color:'#eef2f4',intensity:w.sun.intensity*.85},cloud:Math.max(w.cloud||0,.7),rain:.5,snow:0}),
  snow:w=>({...w,sun:{color:'#f4f7fb',intensity:w.sun.intensity*.9},cloud:Math.max(w.cloud||0,.55),rain:0,snow:1}),
});
export const cityById=id=>{const [name,sky]=String(id).split('~'),c=CITIES.find(x=>x.id===name);return c&&WEATHERS[sky]&&sky!=='sun'?{...c,weather:WEATHERS[sky](c.weather)}:c;};
