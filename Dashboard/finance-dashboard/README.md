# APEX Finance Dashboard

Dashboard de finanzas personales: registro de gastos multi-moneda (USD/PEN), subida de vouchers, KPIs (diario/semanal/mensual), gráficos de evolución y por categoría, y gestión de presupuestos. Construido en **vanilla JS sin build**, con **Supabase** (auth + Postgres + Storage) y **Chart.js**.

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
│   ├── app.js          # Lógica de la app (corre dentro de DOMContentLoaded)
│   └── utils.js        # Funciones puras reutilizables y testeables (window.APEX)
├── supabase/           # schema.sql + README del esquema
└── tests/              # Tests unitarios (Vitest) de las funciones puras
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
npm install        # instala devDependencies (vitest, eslint, prettier)
npm test           # corre los tests unitarios
npm run lint       # ESLint sobre js/
npm run format     # Prettier sobre el proyecto
```

## Tests

Los tests (`tests/utils.test.js`) cubren la lógica sensible: formato de fechas locales
y cálculo del inicio de semana (bordes de mes/semana), agregación por fecha/moneda,
formateo de totales, validación de montos y validación de URLs de voucher (anti-XSS).
