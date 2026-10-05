// Registers every sprite. To add art for something new, create a module
// exporting { id: definition } (see heroes.js) and add it here.

import { defineSprites } from '../pixelart.js';
import heroes from './heroes.js';
import vanguard from './vanguard.js';

defineSprites(heroes);
defineSprites(vanguard);
