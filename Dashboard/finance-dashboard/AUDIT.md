# Auditoría — APEX Finance Dashboard

**Fecha:** 2026-07-03 · **Rama:** `ui-redesign` · **Alcance:** código local completo + verificación en vivo del proyecto Supabase (`lkndwsolpimmezdshgpx`, solo lectura, advisors + `pg_policies` + `storage.buckets`).

## Resumen ejecutivo

La base del proyecto es sólida: RLS bien diseñada en las tablas, escape de HTML consistente, validación de input en cliente y rollback de storage ante fallos. Los problemas serios estaban concentrados en **Storage**: el bucket de vouchers era público (comprobantes financieros accesibles por URL sin autenticación) y, peor aún, **las políticas reales en producción no coincidían con `schema.sql`** — cualquier usuario autenticado podía borrar o listar los vouchers de otros. También había riesgo de supply-chain por CDNs sin versión fijada y una vulnerabilidad crítica en la cadena de dev-dependencies.

**Los 4 hallazgos de severidad alta ya están corregidos en el código.** El cambio de Storage requiere además **ejecutar `supabase/schema.sql` en el SQL Editor de Supabase** para aplicarse en producción (ver "Acción pendiente" abajo).

## Hallazgos de severidad ALTA — ✅ corregidos

### A1. Bucket `vouchers` público ✅
- **Evidencia (en vivo):** `storage.buckets` → `public: true`, sin `file_size_limit` ni `allowed_mime_types`. Política `vouchers_public_read` con `USING (bucket_id = 'vouchers')` para el rol `public`: cualquier persona con la URL podía ver cualquier comprobante. El advisor de Supabase también lo señala ([public_bucket_allows_listing](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing)).
- **Fix:** bucket privado con límite de 5MB y MIME types `png/jpeg/webp` (`supabase/schema.sql`), y la app ahora muestra vouchers con **URLs firmadas** de 1 hora (`js/app.js`, handler de `.view-img-btn` + `voucherPathFromUrl` en `js/utils.js`). Compatible con las URLs públicas históricas guardadas en `image_url`.

### A2. Drift entre `schema.sql` y producción: políticas de Storage inseguras ✅
- **Evidencia (en vivo):** las políticas reales difieren de las declaradas en el repo. En producción existen `vouchers_auth_insert 183bix1_0` (INSERT con solo `bucket_id = 'vouchers'` — **sin restricción de carpeta propia**) y `vouchers_auth_delete 183bix1_0/1` (DELETE y SELECT para *cualquier* authenticated sobre *todo* el bucket) → **un usuario autenticado podía borrar o listar los vouchers de todos los demás**.
- **Fix:** `schema.sql` ahora elimina todas las políticas previas del bucket (cualquier nombre `vouchers%`) y crea el set canónico por dueño: `vouchers_select_own` / `vouchers_insert_own` / `vouchers_delete_own` con `(storage.foldername(name))[1] = (select auth.uid())::text`.

### A3. CDNs sin versión fijada ni SRI ✅
- **Evidencia:** `index.html` cargaba `chart.js` (última versión, sin fijar) y `@supabase/supabase-js@2` (rango flotante) sin `integrity` → un compromiso del CDN o del paquete inyectaría código con acceso a la sesión.
- **Fix:** versiones exactas (Chart.js 4.5.1, supabase-js 2.110.0) con hash SRI `sha384` y `crossorigin="anonymous"`.

### A4. Subida de archivos sin validación de tipo/tamaño ✅
- **Evidencia:** la UI prometía "PNG, JPG, JPEG. Máx 5MB" pero no se validaba nada (`accept="image/*"` no restringe drag&drop): se podía subir SVG/HTML (ejecutables al servirse) o archivos enormes.
- **Fix:** `validateVoucherFile` en `js/utils.js` (solo `image/png|jpeg|webp`, máx 5MB) aplicada al seleccionar el archivo y otra vez antes de subir; además el propio bucket ahora rechaza otros MIME/tamaños en el servidor (defensa en profundidad). 7 tests nuevos.

### A5. Vulnerabilidad crítica en devDependencies ✅
- **Evidencia:** `npm audit` → 5 vulnerabilidades (1 crítica, 1 alta, 3 moderadas) en la cadena `vitest@2 → vite → esbuild` (solo afecta al servidor de desarrollo, no a producción).
- **Fix:** actualizado a `vitest@4.1.9`; `npm audit` queda en 0 y los 23 tests pasan.

## Severidad MEDIA — pendientes (recomendaciones)

| # | Hallazgo | Detalle y recomendación |
|---|----------|--------------------------|
| M1 | Protección de contraseñas filtradas desactivada | Advisor de Supabase: activar el chequeo contra HaveIBeenPwned en Auth → [docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Se activa desde el panel, no por SQL. |
| M2 | `fetchExpenses` trunca a 1000 filas en silencio (`js/app.js`) | Con más de 1000 gastos, KPIs y gráficos serían incorrectos sin aviso. Paginar con `range()` o al menos avisar al usuario. |
| M3 | Sin filtro `user_id` en las consultas del cliente | RLS lo cubre, pero añadir `.eq('user_id', currentUser.id)` en `fetchExpenses` es defensa en profundidad y permite usar el índice compuesto. |
| M4 | Doble inicialización del dashboard | `checkSession()` y el evento `INITIAL_SESSION` de `onAuthStateChange` disparan ambos `showDashboard()` → doble fetch/transición al cargar con sesión activa. Basta con el listener. |
| M5 | Sin Content-Security-Policy | Al ser deploy estático en Vercel, añadir headers CSP (p. ej. `default-src 'self'` + los CDN usados) vía `vercel.ts`. Mitigaría cualquier XSS residual. |
| M6 | `confirm()` bloqueante para borrar (`js/app.js`) | Inconsistente con los toasts; reemplazar por un modal propio con confirmación. |
| M7 | Índices declarados que no existen en producción | El advisor reporta la FK `expenses_user_id_fkey` sin índice, pese a que `schema.sql` los declara → señal de que el script no se ha ejecutado completo en producción. Se resuelve ejecutando el `schema.sql` actualizado. |

## Severidad BAJA — pendientes

- **Accesibilidad:** `#toggle-auth` es un `<span>` clickeable (sin rol ni foco de teclado); las tabs de gráfico no usan `role="tab"`/`aria-selected`; los modales no atrapan el foco ni cierran con Escape.
- **Performance:** los charts se destruyen y recrean en cada `updateUI()` (bastaría `chart.update()`); el video de fondo mp4 se sirve desde un CloudFront de terceros (dependencia externa no controlada, considerar hospedarlo en el propio proyecto o en Supabase Storage).
- **RLS initplan (advisor):** las políticas vivas usan `auth.uid()` por fila; el `schema.sql` actualizado ya usa `(select auth.uid())` — se corrige al ejecutarlo.
- **Higiene:** `@vercel/speed-insights` está en `dependencies` pero no se usa en `index.html` (integrarlo o quitarlo); tests solo cubren `js/utils.js` (no hay tests de integración ni CI).

## Lo que está bien

- **RLS de `expenses` y `budgets`** correcta en producción: cada usuario solo accede a sus filas (verificado en `pg_policies`).
- **Anti-XSS:** `escapeHtml` aplicado a todo dato de usuario en `renderTable`; `isValidVoucherUrl` impide URL injection en el modal (con tests).
- **Validación de input** en cliente (`validateExpenseInput`) + `CHECK` constraints en la base.
- **Rollback:** si falla el insert en la base, se elimina el archivo ya subido a Storage.
- **Anon key hardcodeada:** correcto — es la *publishable key*, pública por diseño; la seguridad la impone RLS (bien documentado en el README).
- `npm run lint` limpio y suite de tests (ahora 23) en verde.

## ⚠️ Acción pendiente (requiere tu confirmación)

El código local ya está corregido, pero **producción sigue expuesta** hasta ejecutar `supabase/schema.sql` (idempotente) en el SQL Editor del proyecto. Eso hará el bucket privado, recreará las políticas de Storage por dueño, creará los índices que faltan y aplicará el fix de `(select auth.uid())`. Si el bloque de políticas de Storage falla con `must be owner`, crearlas desde el panel siguiendo las instrucciones comentadas en el propio script.

Nota: al volverse privado el bucket, las URLs públicas antiguas dejarán de funcionar directamente — la app ya lo maneja firmando las URLs al momento de ver cada voucher.
