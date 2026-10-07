// Registers every sprite. To add art for something new, create a module
// exporting { id: definition } (see heroes.js) and add it here.

import { defineSprites } from '../pixelart.js';
import heroes from './heroes.js';
import powers from './powers.js';
import vanguard from './vanguard.js';
import pyromancer from './pyromancer.js';
import warlord from './warlord.js';
import stalker from './stalker.js';
import oracle from './oracle.js';
import shade from './shade.js';
import neutral from './neutral.js';
import champions from './champions.js';
import celestial from './celestial.js';
import modes from './modes.js';
import riftkin from './riftkin.js';

defineSprites(heroes);
defineSprites(powers);
defineSprites(vanguard);
defineSprites(pyromancer);
defineSprites(warlord);
defineSprites(stalker);
defineSprites(oracle);
defineSprites(shade);
defineSprites(neutral);
defineSprites(champions);
defineSprites(celestial);
defineSprites(modes);
defineSprites(riftkin);
