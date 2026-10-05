// Registers every sprite. To add art for something new, create a module
// exporting { id: definition } (see heroes.js) and add it here.

import { defineSprites } from '../pixelart.js';
import heroes from './heroes.js';
import vanguard from './vanguard.js';
import pyromancer from './pyromancer.js';
import warlord from './warlord.js';
import stalker from './stalker.js';
import oracle from './oracle.js';
import shade from './shade.js';

defineSprites(heroes);
defineSprites(vanguard);
defineSprites(pyromancer);
defineSprites(warlord);
defineSprites(stalker);
defineSprites(oracle);
defineSprites(shade);
