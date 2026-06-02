# Prompt del proyecto — Automatización n8n para Barbería

> Copia el bloque de abajo y pásalo a `/ultraplan <prompt>` o a una nueva sesión de Claude Code.

---

Construye una **automatización completa en n8n para una barbería** que gestione toda la
comunicación con los clientes. El proyecto vive en `/Users/kevinsantos/claudeproject`
y debe seguir el MISMO estilo del workflow existente `workflow/🤖 AI Weekly Newsletter.json`
(un JSON por workflow, documentado con sticky notes `📋 ¿Qué hace?` / `⚙️ Setup` / `✏️ Personaliza`,
nodo central `⚙️ Config`, y Ollama como LLM).

## Objetivos (4 workflows independientes y autocontenidos)

1. **Confirmación de reserva** — al crear una cita, enviar confirmación con fecha, hora, barbero y servicio.
2. **Recordatorio de cita** — recordar al cliente su cita 24 h antes (reduce ausencias).
3. **Reseña post-visita** — tras la cita, pedir al cliente que deje una reseña en Google.
4. **Reactivación de clientes** — detectar clientes inactivos hace más de 6 semanas y enviarles una promo.

## Canales

- El canal se elige según el campo `canal_preferido` de cada cliente (`whatsapp` / `sms` / `email`).
- **WhatsApp y SMS** vía **Twilio** (una sola credencial, nodo nativo de n8n).
- **Email** vía **Gmail** (credencial OAuth2 ya existente en n8n).
- Implementar con un nodo `🔀 Switch` que enruta al nodo de envío correcto.

## Mensajes

- **Todos** los mensajes se redactan con **IA usando Ollama** (mismo proveedor que el newsletter,
  credencial Ollama ya existente). Mensajes en español, tono cercano y profesional, adaptados al
  canal (SMS corto; email más completo). La promo de reactivación debe ser persuasiva y personalizada.

## Datos — Supabase

No existe ningún proyecto Supabase todavía: créalo desde cero con esta estructura
(entrega también la migración SQL):

- `barberos` (id, nombre, activo)
- `servicios` (id, nombre, duracion_min, precio)
- `clientes` (id, nombre, telefono [E.164], email, canal_preferido enum, ultima_visita, created_at)
- `citas` (id, cliente_id, barbero_id, servicio_id, fecha_hora, estado enum[nueva|confirmada|completada|cancelada|no_show],
  confirmacion_enviada, recordatorio_enviado, resena_enviada, created_at)
- Trigger que actualiza `clientes.ultima_visita` cuando una cita pasa a `completada`.
- Datos de ejemplo (barberos, servicios, 1 cliente y 1 cita de prueba).

La información de la tienda (nombre, dirección, link de reseña de Google, texto de promo) NO va en la BD:
vive en el nodo `⚙️ Config` de cada workflow.

## Detalle de cada workflow

- **WF1 Confirmación:** trigger Webhook (lo dispara un *Database Webhook* de Supabase al INSERT en `citas`)
  + Manual Trigger para probar → consulta la cita con datos del cliente/barbero/servicio (Postgres) →
  Ollama redacta → Switch canal → envío → `UPDATE citas SET confirmacion_enviada=true`.
- **WF2 Recordatorio:** Schedule cada hora → SELECT citas con `fecha_hora` entre ahora y +24 h,
  `estado='confirmada'`, `recordatorio_enviado=false` → Ollama → Switch → envío → marca `recordatorio_enviado=true`.
- **WF3 Reseña:** Schedule diario 20:00 → SELECT citas `estado='completada'`, `resena_enviada=false`, de hoy →
  Ollama (incluye link de reseña del Config) → Switch → envío → marca `resena_enviada=true`.
- **WF4 Reactivación:** Schedule semanal (lunes 10:00) → SELECT clientes con `ultima_visita < now() - 6 semanas` →
  Ollama redacta promo → Switch → envío.

Usa el nodo **Postgres** con SQL crudo para las consultas/updates (Supabase entrega la cadena de conexión),
por las condiciones de fecha y los joins.

## Entregables

1. `supabase/migrations/0001_barberia.sql` — esquema + datos de ejemplo.
2. `workflow/01 Confirmación de reserva.json`
3. `workflow/02 Recordatorio de cita.json`
4. `workflow/03 Reseña post-visita.json`
5. `workflow/04 Reactivar clientes.json`
6. `README.md` — guía de credenciales (Supabase/Twilio/Gmail/Ollama), cómo importar los JSON,
   configurar el Database Webhook de Supabase y probar end-to-end.

## Verificación

Importar los JSON en n8n, asignar credenciales, insertar la cita de prueba, ejecutar el manual trigger de WF1
y confirmar que llega el mensaje por el canal del cliente y que el flag en Supabase pasa a `true`. Para WF2/WF3/WF4,
ajustar `fecha_hora`/`estado`/`ultima_visita` del registro de prueba y verificar envío + actualización.
