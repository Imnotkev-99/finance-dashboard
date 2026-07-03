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

const MAX_VOUCHER_BYTES = 5 * 1024 * 1024; // 5MB, como promete la UI
const ALLOWED_VOUCHER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Valida el archivo de voucher antes de subirlo a Storage: sólo imágenes
// rasterizadas (nada de SVG/HTML, que pueden ejecutar scripts) y máx 5MB.
// Devuelve { valid: boolean, error: string|null }.
export function validateVoucherFile(file) {
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo.' };
  }
  if (!ALLOWED_VOUCHER_TYPES.includes(file.type)) {
    return { valid: false, error: 'Formato no permitido. Usa PNG, JPG/JPEG o WebP.' };
  }
  if (file.size > MAX_VOUCHER_BYTES) {
    return { valid: false, error: 'El archivo supera el máximo de 5MB.' };
  }
  return { valid: true, error: null };
}

// Extrae el path dentro del bucket `vouchers` a partir del valor guardado en
// `image_url` (URL pública histórica, URL firmada, o un path directo).
// Devuelve null si no se puede derivar un path.
export function voucherPathFromUrl(value) {
  const str = String(value ?? '').trim();
  if (!str) return null;
  const marker = '/storage/v1/object/';
  const idx = str.indexOf(marker);
  if (idx !== -1) {
    // Formatos: .../object/public/vouchers/<path> o .../object/sign/vouchers/<path>?token=...
    const rest = str.slice(idx + marker.length).replace(/^(public|sign|authenticated)\//, '');
    if (!rest.startsWith('vouchers/')) return null;
    return rest.slice('vouchers/'.length).split('?')[0] || null;
  }
  // Valor guardado como path directo (sin URL)
  if (!str.includes('://')) return str.replace(/^vouchers\//, '') || null;
  return null;
}

// Convierte filas en CSV (RFC 4180): escapa comillas, comas y saltos de línea.
// `columns` es [{ key, label }] y define el orden y el encabezado.
export function toCsv(rows, columns) {
  const esc = (value) => {
    const str = String(value ?? '');
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const lines = (rows || []).map((row) => columns.map((c) => esc(row[c.key])).join(','));
  return [header, ...lines].join('\r\n');
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
