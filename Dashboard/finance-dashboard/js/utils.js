// APEX — Funciones puras reutilizables y testeables.
// Se cargan en el navegador vía un <script type="module"> que las expone en
// window.APEX, y se importan directamente en los tests (Vitest).

// Escapa caracteres especiales para insertar texto de usuario en innerHTML sin XSS.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// Fecha local en formato AAAA-MM-DD (evita el desfase de UTC de toISOString).
export function getLocalDateString(d = new Date()) {
  return d.toLocaleDateString('sv');
}

// Inicio de la semana (domingo) como cadena de fecha local.
export function getStartOfWeek(d = new Date()) {
  const temp = new Date(d);
  temp.setDate(temp.getDate() - temp.getDay());
  return getLocalDateString(temp);
}

// Agrega montos por fecha y por moneda. Devuelve { USD: {fecha: monto}, PEN: {...} }.
// `currencies` define qué códigos son válidos (los demás caen a USD).
// `monthPrefix` (AAAA-MM) opcional filtra a ese mes.
export function aggregateByDate(expenses, currencies, monthPrefix) {
  const result = {};
  Object.keys(currencies).forEach((code) => { result[code] = {}; });

  (expenses || []).forEach((exp) => {
    if (monthPrefix && !String(exp.date).startsWith(monthPrefix)) return;
    const code = currencies[exp.currency] ? exp.currency : 'USD';
    const amt = parseFloat(exp.amount) || 0;
    result[code][exp.date] = (result[code][exp.date] || 0) + amt;
  });

  return result;
}

// Convierte { USD, PEN } en texto, mostrando sólo las monedas con monto.
export function formatTotals(totals, currencies) {
  const parts = Object.keys(totals)
    .filter((code) => totals[code] > 0)
    .map((code) => `${currencies[code].symbol}${totals[code].toFixed(2)}`);
  return parts.length ? parts.join('  ·  ') : '$0.00';
}

const MAX_AMOUNT = 1_000_000;
const MAX_CONCEPT_LENGTH = 200;

// Valida la entrada del formulario de gasto antes de enviarla a la base de datos.
// Devuelve { valid: boolean, error: string|null }.
export function validateExpenseInput({ concept, amount } = {}) {
  const trimmed = String(concept ?? '').trim();
  if (!trimmed) {
    return { valid: false, error: 'El concepto no puede estar vacío.' };
  }
  if (trimmed.length > MAX_CONCEPT_LENGTH) {
    return { valid: false, error: `El concepto no puede superar ${MAX_CONCEPT_LENGTH} caracteres.` };
  }
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    return { valid: false, error: 'El monto debe ser un número mayor que 0.' };
  }
  if (num > MAX_AMOUNT) {
    return { valid: false, error: `El monto no puede superar ${MAX_AMOUNT.toLocaleString()}.` };
  }
  return { valid: true, error: null };
}

// Acepta sólo URLs https del dominio de Supabase del proyecto (anti URL injection en el modal).
export function isValidVoucherUrl(url, supabaseUrl) {
  try {
    const parsed = new URL(url);
    const allowed = new URL(supabaseUrl);
    return parsed.protocol === 'https:' && parsed.host === allowed.host;
  } catch {
    return false;
  }
}
