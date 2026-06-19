# APEX Finance Dashboard Fixes Implementation Plan

> **⚠️ OBSOLETO (2026-06-19):** Las tareas de este plan ya fueron implementadas en el código
> (timezone con `getLocalDateString`, gráfico multi-moneda, aislamiento de uploads por carpeta
> de usuario, rollback de storage en fallo de inserción, y feedback del selector de archivo).
> Se reemplaza por el plan de mejoras de seguridad/calidad/tooling/UX. Se conserva por historial.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct security, logic, user experience, and architectural issues in the APEX Finance Dashboard application, specifically resolving storage access control, timezone-shifted KPI calculations, multi-currency aggregation in graphs, and resource leaks.

**Architecture:** We will apply security policies directly in the Supabase schema using Row Level Security (RLS) check constraints on storage objects. The client-side logic will be updated to prefix files with the user's UUID, handle timezone-safe local date operations, implement dual-dataset rendering in Chart.js, clean up storage assets on deletion or DB insert failure, and resolve accessibility compliance issues.

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES6+), Supabase JS Client v2, Chart.js.

## Global Constraints

- Do not expose any administrative or secret Supabase service role keys.
- Preserve the existing UI structure, classes, and emerald/teal color scheme.
- Maintain support for `prefers-reduced-motion` media queries and reduced-motion JavaScript execution paths.
- Ensure all database changes are idempotent and safe to run repeatedly.

---

### Task 1: Database Schema Enhancements (Composite Index & Storage Bucket Security)

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: None
- Produces: Updated schema.sql execution paths for deployment.

- [ ] **Step 1: Update Supabase schema.sql file**
  Add the composite index for `user_id`, `date`, and `time` to improve sort query performance, and update the Storage policies to check folder ownership.

  Replace lines 44-46 in [supabase/schema.sql](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/supabase/schema.sql#L44-L46) with:
  ```sql
  create index if not exists expenses_user_id_idx on public.expenses (user_id);
  create index if not exists expenses_date_idx    on public.expenses (date desc);
  create index if not exists expenses_user_id_date_time_idx on public.expenses (user_id, date desc, time desc);
  ```

  Replace lines 109-130 in [supabase/schema.sql](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/supabase/schema.sql#L109-L130) with:
  ```sql
  do $$
  begin
    drop policy if exists "vouchers_public_read" on storage.objects;
    create policy "vouchers_public_read"
      on storage.objects for select
      using (bucket_id = 'vouchers');

    drop policy if exists "vouchers_auth_insert" on storage.objects;
    create policy "vouchers_auth_insert"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'vouchers' and (storage.foldername(name))[1] = auth.uid()::text);

    drop policy if exists "vouchers_auth_delete" on storage.objects;
    create policy "vouchers_auth_delete"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'vouchers' and (storage.foldername(name))[1] = auth.uid()::text);
  exception
    when insufficient_privilege then
      raise notice 'No se pudieron crear las políticas de storage por SQL (must be owner). Créalas desde el panel: Storage → vouchers → Policies.';
  end $$;
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add supabase/schema.sql
  git commit -m "db: update storage RLS policies and add composite index"
  ```

---

### Task 2: Secure File Storage Uploads & User UUID Folder Isolation

**Files:**
- Modify: `js/app.js:180-199`

**Interfaces:**
- Consumes: `currentUser` state from Task 1.
- Produces: Public image URLs generated within user-specific folders inside the `vouchers` bucket.

- [ ] **Step 1: Modify upload path logic in js/app.js**
  Pre-pend the user ID to the storage file path to isolate files per user folder.

  Replace lines 180-199 in [js/app.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/app.js#L180-L199) with:
  ```javascript
      try {
        let imageUrl = null;

        // 1. Subir imagen a Supabase Storage SOLO si se adjuntó un archivo
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${currentUser.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('vouchers')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // 2. Obtener URL pública de la imagen
          const { data: urlData } = supabase.storage
            .from('vouchers')
            .getPublicUrl(filePath);

          imageUrl = urlData.publicUrl;
        }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add js/app.js
  git commit -m "security: isolate uploads in user-specific storage folders"
  ```

---

### Task 3: Prevent Orphaned Storage Files & DB Fail Rollback

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: Storage path extraction from `image_url` dynamically.
- Produces: Automatic garbage collection of storage items upon row deletions or database insertion failures.

- [ ] **Step 1: Add DB Insert failure cleanup to form submission listener**
  Delete the uploaded image file if the relational database record fails to insert.

  Replace lines 200-235 in [js/app.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/app.js#L200-L235) with:
  ```javascript
        // 3. Guardar registro en la base de datos relacional
        const { data: newExpense, error: dbError } = await supabase
          .from('expenses')
          .insert([{
            concept,
            amount,
            currency,
            date,
            time,
            image_url: imageUrl,
            user_id: currentUser.id
          }])
          .select();

        if (dbError) {
          // Rollback: Si se subió la imagen pero falló la DB, eliminar archivo para evitar huérfanos
          if (file && imageUrl) {
            const filePath = `${currentUser.id}/${imageUrl.split('/').pop()}`;
            await supabase.storage.from('vouchers').remove([filePath]);
          }
          throw dbError;
        }

        // 4. Actualizar vista local
        expenses.unshift(newExpense[0]);
        form.reset();
        updateUI();

        // Resetear fecha y hora actual
        initDateAndTime();

      } catch (error) {
        console.error('Error procesando el gasto:', error);
        alert('Fallo al guardar: ' + error.message);
      } finally {
        // Restaurar botón
        submitBtn.textContent = 'Guardar Registro';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }
  ```

- [ ] **Step 2: Add image file deletion to the row delete click listener**
  Locate the associated storage image and call `remove()` before deleting from `expenses`.

  Replace lines 238-271 in [js/app.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/app.js#L238-L271) with:
  ```javascript
    // Delegación de eventos (Ver imagen y Eliminar en la Nube)
    tableBody.addEventListener('click', async (e) => {
      // Ver Imagen
      if (e.target.classList.contains('view-img-btn')) {
        const imgData = e.target.getAttribute('data-img');
        modalImg.src = imgData;
        modal.classList.remove('hidden');
      }

      // Eliminar Registro
      if (e.target.classList.contains('delete-btn')) {
        const id = e.target.getAttribute('data-id');
        const confirmDelete = confirm('¿Borrar registro de la base de datos permanentemente?');

        if (confirmDelete) {
          e.target.textContent = '...';
          e.target.disabled = true;

          // Buscar el gasto localmente para obtener su image_url
          const expToDelete = expenses.find(exp => String(exp.id) === id);

          // Si el gasto tiene imagen asociada en Storage, eliminarla
          if (expToDelete && expToDelete.image_url) {
            try {
              // Extrayendo el path de la URL del storage
              const urlParts = expToDelete.image_url.split('/storage/v1/object/public/vouchers/');
              if (urlParts.length > 1) {
                const filePath = urlParts[1];
                await supabase.storage.from('vouchers').remove([filePath]);
              }
            } catch (storageErr) {
              console.error('Error al borrar la imagen de storage:', storageErr);
            }
          }

          const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

          if (error) {
            alert('Error al borrar: ' + error.message);
            e.target.textContent = 'X';
            e.target.disabled = false;
          } else {
            expenses = expenses.filter(exp => String(exp.id) !== id);
            updateUI();
          }
        }
      }
    });
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add js/app.js
  git commit -m "fix: delete storage files upon deletion or DB insertion failure"
  ```

---

### Task 4: Resolve Timezone Mismatch & Format Date Pre-filling

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: JavaScript `new Date()` locally.
- Produces: Correctly aggregated localized date comparisons avoiding midnight UTC shifts.

- [ ] **Step 1: Refactor date/time initialization helper**
  Define a timezone-safe local date retrieval method formatting to Swedish locale ('sv') to populate inputs.

  Replace lines 130-137 in [js/app.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/app.js#L130-L137) with:
  ```javascript
    async function initDashboard() {
      initDateAndTime();

      // Cargar datos desde la nube
      await fetchExpenses();
    }

    function initDateAndTime() {
      const now = new Date();
      // Formato local AAAA-MM-DD
      document.getElementById('date').value = getLocalDateString(now);
      document.getElementById('time').value = now.toTimeString().slice(0, 5);
    }

    function getLocalDateString(d = new Date()) {
      return d.toLocaleDateString('sv');
    }
  ```

- [ ] **Step 2: Update local KPI calculations to use local date strings**
  Align the startOfWeek calculation and current date retrieval using the helper function.

  Replace lines 317-338 in [js/app.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/app.js#L317-L338) with:
  ```javascript
    function calculateKPIs() {
      const now = new Date();
      const today = getLocalDateString(now);
      
      const tempDate = new Date(now);
      const startOfWeek = getLocalDateString(new Date(tempDate.setDate(tempDate.getDate() - tempDate.getDay())));
      const currentMonth = today.slice(0, 7);

      // Acumular por moneda para no mezclar dólares y soles
      const empty = () => ({ USD: 0, PEN: 0 });
      const daily = empty(), weekly = empty(), monthly = empty();

      expenses.forEach(exp => {
        const amt = parseFloat(exp.amount);
        const code = CURRENCIES[exp.currency] ? exp.currency : 'USD';
        if (exp.date === today) daily[code] += amt;
        if (exp.date >= startOfWeek && exp.date <= today) weekly[code] += amt;
        if (exp.date.startsWith(currentMonth)) monthly[code] += amt;
      });

      animateTotals('daily-total', daily);
      animateTotals('weekly-total', weekly);
      animateTotals('monthly-total', monthly);
    }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add js/app.js
  git commit -m "fix: resolve timezone shifts by using local ISO dates instead of UTC"
  ```

---

### Task 5: Multi-Currency Line Chart Rendering

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: Agregated database results.
- Produces: Dual datasets rendered in a unified line chart displaying both USD and PEN separately.

- [ ] **Step 1: Modify renderChart logic in app.js**
  Separate currency calculations when aggregating month-to-date inputs, injecting both USD (Emerald) and PEN (Blue) lines.

  Replace lines 371-445 in [js/app.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/app.js#L371-L445) with:
  ```javascript
    function renderChart() {
      const ctx = document.getElementById('expenseChart').getContext('2d');
      const currentMonth = getLocalDateString().slice(0, 7);
      const monthData = expenses.filter(exp => exp.date.startsWith(currentMonth));

      // Agregar de forma separada por moneda
      const aggregatedUSD = {};
      const aggregatedPEN = {};

      monthData.forEach(exp => {
        const amt = parseFloat(exp.amount);
        if (exp.currency === 'PEN') {
          aggregatedPEN[exp.date] = (aggregatedPEN[exp.date] || 0) + amt;
        } else {
          aggregatedUSD[exp.date] = (aggregatedUSD[exp.date] || 0) + amt;
        }
      });

      // Obtener lista consolidada de todas las fechas que tienen datos (ordenada)
      const allDates = Array.from(new Set([...Object.keys(aggregatedUSD), ...Object.keys(aggregatedPEN)])).sort();

      const usdPoints = allDates.map(date => aggregatedUSD[date] || 0);
      const penPoints = allDates.map(date => aggregatedPEN[date] || 0);

      if (expenseChartInstance) {
        expenseChartInstance.destroy();
      }

      // Relleno en gradiente esmeralda (USD)
      const fillUSD = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height || 260);
      fillUSD.addColorStop(0, 'rgba(16, 185, 129, 0.20)');
      fillUSD.addColorStop(1, 'rgba(16, 185, 129, 0)');

      // Relleno en gradiente azul (PEN)
      const fillPEN = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height || 260);
      fillPEN.addColorStop(0, 'rgba(59, 130, 246, 0.20)');
      fillPEN.addColorStop(1, 'rgba(59, 130, 246, 0)');

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      expenseChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: allDates.map(date => date.slice(8, 10)), // Mostrar solo el día en el eje X para limpieza
          datasets: [
            {
              label: 'Dólares ($)',
              data: usdPoints,
              borderColor: '#10b981',
              backgroundColor: fillUSD,
              borderWidth: 2.5,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#059669',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointHoverBorderWidth: 3
            },
            {
              label: 'Soles (S/)',
              data: penPoints,
              borderColor: '#3b82f6',
              backgroundColor: fillPEN,
              borderWidth: 2.5,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#2563eb',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointHoverBorderWidth: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          animation: reduce ? false : { duration: 1100, easing: 'easeOutQuart' },
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { 
              display: true,
              position: 'top',
              labels: {
                boxWidth: 12,
                font: { size: 12, family: "'Inter', sans-serif" },
                color: '#5f6b7a'
              }
            },
            tooltip: {
              backgroundColor: '#14181f',
              titleColor: '#ffffff',
              bodyColor: '#d7dce2',
              padding: 12,
              cornerRadius: 10,
              displayColors: true,
              borderColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              callbacks: {
                title: (tooltipItems) => `Día: ${allDates[tooltipItems[0].dataIndex]}`,
                label: (context) => {
                  const symbol = context.datasetIndex === 0 ? '$' : 'S/';
                  return `${context.dataset.label}: ${symbol}${context.raw.toFixed(2)}`;
                }
              }
            }
          },
          scales: {
            y: {
              grid: { color: 'rgba(16, 24, 40, 0.06)', drawBorder: false },
              ticks: { color: '#5f6b7a', font: { size: 12 } }
            },
            x: {
              grid: { display: false, drawBorder: false },
              ticks: { color: '#5f6b7a', font: { size: 12 } }
            }
          }
        }
      });
    }
  ```

- [ ] **Step 2: Commit**
  ```bash
  git add js/app.js
  git commit -m "fix: render separate USD and PEN line chart lines to prevent mixed aggregation"
  ```

---

### Task 6: UX Form Inputs & File Picker Feedback

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: Input file selections and HTML5 form nodes.
- Produces: Correct file feedback strings, form validation controls, and accessible labels.

- [ ] **Step 1: Modify HTML file elements for accessibility and validation constraints**
  Add min validations to amount input, link labels explicitly, and change viewport zooming permissions.

  Replace lines 6-7 in [index.html](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/index.html#L6-L7) with:
  ```html
    <meta name="viewport"
      content="width=device-width, initial-scale=1.0">
  ```

  Replace lines 29-36 in [index.html](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/index.html#L29-L36) with:
  ```html
          <div class="form-group">
            <label for="auth-email">Correo Electrónico</label>
            <input type="email" id="auth-email" required>
          </div>
          <div class="form-group">
            <label for="auth-password">Contraseña</label>
            <input type="password" id="auth-password" required>
          </div>
  ```

  Replace line 178 in [index.html](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/index.html#L178) with:
  ```html
                <input type="number" id="amount" step="0.01" min="0" placeholder="0.00" required>
  ```

  Replace lines 240-244 in [index.html](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/index.html#L240-L244) with:
  ```html
    <!-- Modal for Image Preview -->
    <div id="image-modal" class="modal hidden">
      <button class="close-modal" aria-label="Cerrar vista previa">&times;</button>
      <img class="modal-content" id="modal-image" alt="Vista previa del voucher de pago">
    </div>
  ```

- [ ] **Step 2: Add dynamic file picker label updates and reset triggers in js/app.js**
  Register a change listener on the voucher file input element and clear labels when the form is cleared.

  Update variables in [js/app.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/app.js):
  Locate lines 34-41 and replace:
  ```javascript
    // Elementos del Dashboard
    const form = document.getElementById('expense-form');
    const voucherInput = document.getElementById('voucher');
    const fileNameDisplay = document.getElementById('file-name');
    const tableBody = document.getElementById('table-body');
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    const closeModal = document.querySelector('.close-modal');
    const submitBtn = form.querySelector('button[type="submit"]');
  ```

  And add this event listener right after checking session/DOM elements (around line 125):
  ```javascript
    // Actualizar nombre de archivo seleccionado en input
    voucherInput.addEventListener('change', () => {
      const file = voucherInput.files[0];
      if (file) {
        fileNameDisplay.textContent = file.name;
      } else {
        fileNameDisplay.textContent = 'Ningún archivo seleccionado';
      }
    });
  ```

  Update form submissions reset steps (around line 220, replace `form.reset(); updateUI();`):
  ```javascript
        form.reset();
        fileNameDisplay.textContent = 'Ningún archivo seleccionado';
        updateUI();
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add index.html js/app.js
  git commit -m "ux/a11y: implement file upload feedback, labels, zoom rules, and amount validation"
  ```
