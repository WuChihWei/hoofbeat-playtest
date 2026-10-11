// City packs: everything one city needs, in one file each (see taipei.mjs for the annotated format).
// Add a city: copy a pack to cities/<id>.mjs and edit its four parts (1 track · 2 weather · 3 dressing · 4 backdrop),
// put the backdrop at assets/backdrops/<id>.webp, and list the pack below. `node dist/course/check.mjs` validates it.
import taipei from './taipei.mjs?v=r462';
import tokyo from './tokyo.mjs?v=r462';
import paris from './paris.mjs?v=r462';
import stockholm from './stockholm.mjs?v=r462';
import seoul from './seoul.mjs?v=r462';

export const CITIES=Object.freeze([taipei,tokyo,paris,stockholm,seoul]);
export const cityById=id=>CITIES.find(c=>c.id===id);
