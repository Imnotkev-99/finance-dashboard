// E2E del flujo completo del dashboard con la red de Supabase mockeada:
// login → KPIs (RPC) → tabla → moneda → filtros → editar → borrar.
// No usa credenciales reales ni toca la base de datos.
import { test, expect } from '@playwright/test';

const SUPA = 'https://lkndwsolpimmezdshgpx.supabase.co';
const USER_ID = 'e2e-user-0000-0000';
const EMAIL = 'e2e@apex.test';

// JWT falso pero bien formado (supabase-js sólo necesita expires_at coherente)
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const fakeJwt = () =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;

const authUser = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: EMAIL,
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z'
};

const session = () => ({
  access_token: fakeJwt(),
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'e2e-refresh-token',
  user: authUser
});

// Fechas del mes actual para que la serie del chart tenga sentido
const today = new Date();
const iso = (d) => d.toLocaleDateString('sv');
const TODAY = iso(today);

const initialExpenses = () => ([
  { id: 1, user_id: USER_ID, concept: 'Almuerzo con cliente', category: 'Alimentación', amount: '45.00', currency: 'PEN', date: TODAY, time: '13:00:00', image_url: null },
  { id: 2, user_id: USER_ID, concept: 'Taxi al aeropuerto', category: 'Transporte', amount: '60.00', currency: 'PEN', date: TODAY, time: '09:30:00', image_url: null },
  { id: 3, user_id: USER_ID, concept: 'Licencia software', category: 'Suscripciones', amount: '120.00', currency: 'USD', date: TODAY, time: '08:00:00', image_url: null }
]);

const summaryFixture = {
  daily: { PEN: 105, USD: 120 },
  weekly: { PEN: 205, USD: 120 },
  monthly: { PEN: 350, USD: 120 },
  by_date: [
    { date: TODAY, currency: 'PEN', total: 105 },
    { date: TODAY, currency: 'USD', total: 120 }
  ],
  by_category: [
    { category: 'Alimentación', currency: 'PEN', total: 245 },
    { category: 'Transporte', currency: 'PEN', total: 105 },
    { category: 'Suscripciones', currency: 'USD', total: 120 }
  ]
};

// Respuestas con CORS (la app corre en 127.0.0.1 y "Supabase" es otro origen)
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-expose-headers': '*'
};

const json = (route, body, status = 200) =>
  route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });

const preflight = (route) => route.fulfill({ status: 204, headers: CORS });

// Intercepta toda la superficie de Supabase que usa la app.
// Devuelve el estado mutable para que los tests inspecccionen los cambios.
async function mockSupabase(page) {
  const state = { rows: initialExpenses(), deletes: [], patches: [], inserts: [] };

  // El video de fondo no aporta al test y pesa: fuera.
  await page.route('https://d8j0ntlcm91z4.cloudfront.net/**', (route) => route.abort());

  await page.route(`${SUPA}/auth/v1/**`, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    const url = req.url();
    if (url.includes('/token')) return json(route, session());
    if (url.includes('/user')) return json(route, authUser);
    if (url.includes('/logout')) return json(route, {});
    return json(route, {});
  });

  await page.route(`${SUPA}/rest/v1/rpc/dashboard_summary**`, (route) => {
    if (route.request().method() === 'OPTIONS') return preflight(route);
    return json(route, summaryFixture);
  });

  await page.route(`${SUPA}/rest/v1/expenses**`, (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    if (method === 'OPTIONS') return preflight(route);

    if (method === 'GET') {
      let rows = [...state.rows];
      const ilike = url.searchParams.get('concept');
      const category = url.searchParams.get('category');
      const currency = url.searchParams.get('currency');
      if (ilike && ilike.startsWith('ilike.')) {
        const term = ilike.slice('ilike.'.length).replaceAll('%', '').toLowerCase();
        rows = rows.filter((r) => r.concept.toLowerCase().includes(term));
      }
      if (category && category.startsWith('eq.')) rows = rows.filter((r) => r.category === category.slice(3));
      if (currency && currency.startsWith('eq.')) rows = rows.filter((r) => r.currency === currency.slice(3));
      return json(route, rows);
    }

    if (method === 'POST') {
      const payload = JSON.parse(req.postData())[0];
      const row = { id: 100 + state.inserts.length, image_url: null, ...payload };
      state.inserts.push(row);
      state.rows = [row, ...state.rows];
      return json(route, [row], 201);
    }

    if (method === 'PATCH') {
      const id = Number(url.searchParams.get('id').slice(3)); // "eq.<id>"
      const payload = JSON.parse(req.postData());
      state.patches.push({ id, payload });
      state.rows = state.rows.map((r) => (r.id === id ? { ...r, ...payload } : r));
      return json(route, [state.rows.find((r) => r.id === id)]);
    }

    if (method === 'DELETE') {
      const id = Number(url.searchParams.get('id').slice(3));
      state.deletes.push(id);
      state.rows = state.rows.filter((r) => r.id !== id);
      return json(route, []);
    }

    return json(route, []);
  });

  await page.route(`${SUPA}/storage/v1/**`, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return preflight(route);
    if (req.url().includes('/object/sign/')) {
      return json(route, { signedURL: `/object/sign/vouchers/${USER_ID}/e2e.png?token=e2e` });
    }
    return json(route, {});
  });

  return state;
}

async function login(page) {
  await page.goto('/');
  await page.fill('#auth-email', EMAIL);
  await page.fill('#auth-password', 'contraseña-e2e');
  await page.click('#auth-submit-btn');
  await expect(page.locator('#main-dashboard')).toBeVisible();
  await expect(page.locator('#user-email-display')).toHaveText(EMAIL);
}

const dataRows = (page) => page.locator('#table-body tr:not(.skeleton-row)');

test.describe('APEX Finance Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  test('muestra el login y alterna a registro accesiblemente', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#auth-title')).toHaveText('Iniciar Sesión');
    // El toggle ahora es un <button>: operable con teclado
    await page.locator('#toggle-auth').press('Enter');
    await expect(page.locator('#auth-title')).toHaveText('Crear Cuenta');
    await expect(page.locator('#auth-submit-btn')).toHaveText('Registrarse');
  });

  test('login → dashboard con KPIs del RPC y tabla poblada', async ({ page }) => {
    await login(page);
    // KPIs en PEN (moneda por defecto), valores exactos del RPC
    await expect(page.locator('#monthly-total')).toHaveText('S/350.00');
    await expect(page.locator('#daily-total')).toHaveText('S/105.00');
    // Tabla con las 3 filas del fixture
    await expect(dataRows(page)).toHaveCount(3);
    await expect(page.locator('#table-body')).toContainText('Taxi al aeropuerto');
    // Presupuesto visible (350 de 3000 → 12%)
    await expect(page.locator('#monthly-budget-pct')).toHaveText('12% consumido');
  });

  test('el selector de moneda cambia KPIs y presupuesto', async ({ page }) => {
    await login(page);
    await expect(page.locator('#monthly-total')).toHaveText('S/350.00');
    await page.click('.currency-switch__btn[data-currency="USD"]');
    await expect(page.locator('#monthly-total')).toHaveText('$120.00');
    await expect(page.locator('.currency-switch__btn[data-currency="USD"]')).toHaveAttribute('aria-pressed', 'true');
    // Persistencia del selector
    expect(await page.evaluate(() => window.localStorage.getItem('apex-active-currency'))).toBe('USD');
  });

  test('búsqueda filtra en el servidor', async ({ page }) => {
    await login(page);
    await expect(dataRows(page)).toHaveCount(3);
    await page.fill('#filter-search', 'taxi');
    // Debounce de 300ms + round-trip: la tabla queda con la única coincidencia
    await expect(dataRows(page)).toHaveCount(1);
    await expect(page.locator('#table-body')).toContainText('Taxi al aeropuerto');
    await expect(page.locator('#clear-filters-btn')).toBeVisible();
    await page.click('#clear-filters-btn');
    await expect(dataRows(page)).toHaveCount(3);
  });

  test('registra un gasto nuevo desde el formulario', async ({ page }) => {
    await login(page);
    await page.fill('#concept', 'Café de reunión');
    await page.fill('#amount', '12.50');
    await page.selectOption('#currency', 'PEN');
    await page.click('#expense-form button[type="submit"]');
    await expect(page.locator('.toast--success, .toast')).toContainText('Gasto registrado.');
    await expect(page.locator('#table-body')).toContainText('Café de reunión');
  });

  test('edita un gasto desde el modal', async ({ page }) => {
    await login(page);
    await dataRows(page).first().locator('.edit-btn').click();
    await expect(page.locator('#edit-modal')).toBeVisible();
    // Prefilled con los datos de la fila
    await expect(page.locator('#edit-concept')).toHaveValue('Almuerzo con cliente');
    await page.fill('#edit-amount', '99.00');
    await page.click('#edit-save-btn');
    await expect(page.locator('#edit-modal')).toBeHidden();
    await expect(page.locator('.toast')).toContainText('Gasto actualizado.');
    await expect(page.locator('#table-body')).toContainText('99.00');
  });

  test('Escape cierra el modal de edición (a11y)', async ({ page }) => {
    await login(page);
    await dataRows(page).first().locator('.edit-btn').click();
    await expect(page.locator('#edit-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#edit-modal')).toBeHidden();
  });

  test('borra un gasto con el diálogo de confirmación', async ({ page }) => {
    await login(page);
    await expect(dataRows(page)).toHaveCount(3);
    await dataRows(page).first().locator('.delete-btn').click();
    await expect(page.locator('#confirm-dialog')).toBeVisible();
    // Cancelar no borra nada
    await page.click('#confirm-cancel');
    await expect(page.locator('#confirm-dialog')).toBeHidden();
    await expect(dataRows(page)).toHaveCount(3);
    // Confirmar sí borra
    await dataRows(page).first().locator('.delete-btn').click();
    await page.click('#confirm-accept');
    await expect(dataRows(page)).toHaveCount(2);
    await expect(page.locator('#table-body')).not.toContainText('Almuerzo con cliente');
  });
});
