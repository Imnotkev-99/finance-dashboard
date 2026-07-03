# APEX Finance Dashboard

[![CI](https://github.com/Imnotkev-99/finance-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Imnotkev-99/finance-dashboard/actions/workflows/ci.yml)

Dashboard de finanzas personales: registro de gastos multi-moneda (USD/PEN), subida de vouchers, KPIs (diario/semanal/mensual) calculados en SQL, gráficos de evolución y por categoría, filtros/búsqueda server-side, export a CSV y gestión de presupuestos. Construido en **vanilla JS sin build**, con **Supabase** (auth + Postgres con RLS + Storage privado) y **Chart.js**.

## Stack

- HTML5 / CSS3 (tema oscuro, glassmorphism)
- JavaScript (ES6+), sin framework ni bundler
- [Supabase](https://supabase.com) — Auth, base de datos Postgres con RLS, y Storage para vouchers
- [Chart.js](https://www.chartjs.org/) (vía CDN)
- Despliegue estático en Vercel

## Estructura

```
finance-dashboard/
├── index.html          # Markup principal
├── css/styles.css      # Estilos y design tokens
├── js/
│   ├── bootstrap.js    # Expone las utilidades en window.APEX (módulo ESM)
│   ├── app.js          # Lógica de la app (corre dentro de DOMContentLoaded)
│   └── utils.js        # Funciones puras reutilizables y testeables
├── supabase/           # schema.sql idempotente + README del esquema
├── tests/              # Tests unitarios (Vitest) de las funciones puras
├── e2e/                # Tests end-to-end (Playwright, Supabase mockeado)
├── vercel.json         # CSP y security headers
└── .github/workflows/  # CI: lint + unit + E2E en cada push/PR
```

`js/utils.js` es un módulo ESM con las funciones puras (escape HTML, fechas locales,
agregación, validación). En el navegador se carga vía un `<script type="module">` que
las expone en `window.APEX`; en los tests se importan directamente.

## Correr en local

No hay paso de build: basta servir los archivos estáticos.

```bash
# desde finance-dashboard/
python3 -m http.server 8000
# luego abrir http://localhost:8000
```

## Configuración de Supabase

Las claves del cliente viven en `js/app.js` (`SUPABASE_URL` y `SUPABASE_ANON_KEY`).
La `anon key` es pública por diseño; la seguridad real la imponen las políticas RLS
definidas en `supabase/schema.sql`. Para aplicar el esquema, ejecuta ese SQL en el
editor SQL de tu proyecto Supabase (es idempotente). Ver `supabase/README.md`.

## Desarrollo

```bash
npm install        # instala devDependencies (vitest, playwright, eslint, prettier)
npm test           # tests unitarios (Vitest)
npm run test:e2e   # tests end-to-end (Playwright; requiere npx playwright install chromium)
npm run verify     # lint + unit + e2e, todo junto
npm run lint       # ESLint sobre js/
npm run format     # Prettier sobre el proyecto
```

## Tests

- **Unitarios** (`tests/utils.test.js`, Vitest): lógica pura — fechas locales e inicio
  de semana, agregación por fecha/moneda, formateo, validación de montos, validación de
  archivos de voucher y de URLs (anti-XSS), y generación de CSV.
- **End-to-end** (`e2e/dashboard.spec.js`, Playwright): flujo completo en navegador real
  con la API de Supabase interceptada (sin credenciales ni datos reales): login, KPIs
  desde el RPC, selector de moneda, filtros server-side, crear/editar/borrar gasto con
  el diálogo de confirmación, y accesibilidad básica de modales (Escape, focus).

## CI/CD

Cada push y pull request corre lint + unit + E2E en GitHub Actions
(`.github/workflows/ci.yml`). El deploy a Vercel se dispara automáticamente
desde `main`; las ramas generan preview deployments.
