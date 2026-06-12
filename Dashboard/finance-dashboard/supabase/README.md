# Esquema Supabase — APEX Finance Dashboard

Proyecto: `lkndwsolpimmezdshgpx.supabase.co`

Este directorio versiona la estructura de la base de datos que usa el dashboard.

## Contenido

- **`schema.sql`** — DDL de la tabla `expenses`, sus políticas RLS y el bucket de
  Storage `vouchers` con sus políticas.

## ⚠️ Origen del esquema

`schema.sql` fue **reconstruido a partir del código** (`js/app.js`), no exportado del
servidor. La `anon/publishable key` incluida en el repo no tiene permiso para
introspeccionar el esquema (la API responde `"Secret API key required"`), así que no fue
posible hacer un `db dump` automático.

La estructura es fiel a lo que el código lee/escribe:

| Columna     | Tipo            | Origen en `app.js`                          |
|-------------|-----------------|---------------------------------------------|
| `id`        | bigint identity | `.eq('id', id)`, `data-id`                  |
| `user_id`   | uuid            | auth + RLS (login/registro con Supabase)    |
| `concept`   | text            | `insert([{ concept }])`                     |
| `amount`    | numeric         | `parseFloat(exp.amount)`                    |
| `date`      | date            | `insert([{ date }])`                        |
| `time`      | time            | `insert([{ time }])`                        |
| `image_url` | text            | `insert([{ image_url }])` (Storage público) |
| `created_at`| timestamptz     | convención Supabase                         |

> Nota: el `user_id` y las políticas RLS reflejan el diseño seguro recomendado para la
> auth que ya implementa el código. Si tu tabla en producción aún **no** tiene `user_id`,
> revísalo: hoy el `select('*')` sin filtro depende de RLS para aislar datos por usuario.

## Obtener el DDL EXACTO del servidor

Cuando tengas acceso con clave secreta, cualquiera de estas opciones reemplaza este
archivo con la definición real:

**Opción A — SQL Editor (rápido):** pega y ejecuta en el SQL Editor de Supabase:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

**Opción B — Supabase CLI (dump completo):**

```bash
supabase link --project-ref lkndwsolpimmezdshgpx
supabase db dump --schema public -f supabase/schema.sql
```

## Aplicar este esquema en otro proyecto

Pega `schema.sql` en el SQL Editor de Supabase, o con el CLI:

```bash
supabase db execute -f supabase/schema.sql
```
