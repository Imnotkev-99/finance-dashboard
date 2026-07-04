// Expone las utilidades puras en window.APEX antes de que corra app.js.
// Vive en un archivo propio (no inline) para que el CSP pueda prohibir
// scripts inline (`script-src` sin 'unsafe-inline', ver vercel.json).
import * as APEX from './utils.js';

// Merge en vez de sobreescribir: i18n.js ya ha podido definir window.APEX.i18n.
Object.assign(window.APEX || (window.APEX = {}), APEX);
