// Expone las utilidades puras en window.APEX antes de que corra app.js.
// Vive en un archivo propio (no inline) para que el CSP pueda prohibir
// scripts inline (`script-src` sin 'unsafe-inline', ver vercel.json).
import * as APEX from './utils.js';

window.APEX = APEX;
