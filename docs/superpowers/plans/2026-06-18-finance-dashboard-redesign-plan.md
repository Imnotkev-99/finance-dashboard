# Plan de Implementación: Rediseño de Apex Finance - Categorías y Presupuestos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar categorización de gastos con un gráfico interactivo de dona y un sistema de presupuestos mensuales por moneda sincronizado en Supabase con barras de progreso animadas.

**Architecture:** Modificación del formulario HTML para capturar la categoría, inserción en Supabase con la nueva columna, agrupación en JS para renderizar gráficos separados por pestañas y almacenamiento de límites en la base de datos de Supabase para alimentar el control visual de KPI.

**Tech Stack:** HTML5, CSS3, Vanilla JS, Chart.js, Supabase Database y Storage.

## Global Constraints
- Utilizar CSS nativo y mantener las micro-animaciones del sistema de diseño actual.
- Asegurar que el sitio siga siendo responsivo y conserve el tema oscuro glassmorphic.
- No romper las integraciones existentes de Supabase Auth ni el flujo de subida de imágenes.

---

### Task 1: Actualización de Base de Datos en Supabase (Esquema y RLS)

**Files:**
- Modify: `supabase/schema.sql` (Si existe) o ejecutar vía consola de Supabase.

**Interfaces:**
- Consumes: Ninguna.
- Produces: Columna `category` en la tabla `expenses` y una nueva tabla `budgets` con RLS habilitada.

- [ ] **Step 1: Crear e informar las sentencias SQL de migración**
  Asegurarse de tener las consultas listas para que el usuario o el agente las ejecuten en el editor SQL de Supabase:
  ```sql
  -- Actualizar gastos existentes con la categoría predeterminada
  ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'Otros' NOT NULL;

  -- Crear tabla de presupuestos
  CREATE TABLE budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    currency TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_currency UNIQUE (user_id, currency)
  );

  -- Habilitar RLS en presupuestos
  ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

  -- Políticas de seguridad para la tabla budgets
  CREATE POLICY "Users can manage their own budgets" ON budgets
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ```

- [ ] **Step 2: Ejecutar las consultas SQL de migración en la base de datos**
  (Si hay conexión o CLI, ejecutar, o reportar el éxito tras la validación manual).

---

### Task 2: Actualización de la Interfaz de Usuario (HTML)

**Files:**
- Modify: [index.html](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/index.html)

**Interfaces:**
- Consumes: Ninguna.
- Produces: Elementos DOM de categorías (`#category`), pestañas del gráfico (`.chart-tabs`), canvas secundario (`#categoryChart`), y modal de presupuesto (`#budget-modal`).

- [ ] **Step 1: Modificar el formulario de gastos en `index.html`**
  Agregar el selector de categorías debajo del campo de concepto.
  ```html
  <div class="form-group-row">
    <div class="form-group">
      <label for="category">Categoría</label>
      <select id="category" required>
        <option value="Alimentación">🍔 Alimentación</option>
        <option value="Transporte">🚗 Transporte</option>
        <option value="Servicios">💡 Servicios</option>
        <option value="Suscripciones">💻 Suscripciones</option>
        <option value="Oficina">📦 Oficina</option>
        <option value="Otros" selected>🏷️ Otros</option>
      </select>
    </div>
  </div>
  ```

- [ ] **Step 2: Modificar la sección del gráfico para agregar pestañas y canvas de dona**
  Reemplazar el título y canvas de la sección `.chart-section` para añadir pestañas y el gráfico de dona.
  ```html
  <section class="chart-section card">
    <div class="chart-header">
      <h2>Análisis Mensual</h2>
      <div class="chart-tabs">
        <button class="chart-tab active" data-tab="trend">📈 Evolución</button>
        <button class="chart-tab" data-tab="categories">🍩 Categorías</button>
      </div>
    </div>
    <div class="chart-container">
      <canvas id="expenseChart"></canvas>
      <canvas id="categoryChart" class="hidden"></canvas>
    </div>
  </section>
  ```

- [ ] **Step 3: Agregar la barra de progreso de presupuesto en el KPI de Gasto Mensual**
  Modificar la tarjeta `kpi--monthly` para agregar el engranaje de configuración y el contenedor de la barra de progreso.
  ```html
  <div class="card kpi kpi--monthly" style="position: relative;">
    <button id="open-budget-btn" class="kpi__config-btn" title="Configurar Presupuesto">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
    <div class="kpi__icon">
      <!-- Icon SVG existente -->
    </div>
    <div class="kpi__body">
      <h3>Gasto Mensual</h3>
      <p id="monthly-total">$0.00</p>
      <div id="monthly-budget-container" class="budget-container hidden">
        <div class="budget-bar">
          <div id="monthly-budget-progress" class="budget-progress"></div>
        </div>
        <div class="budget-text">
          <span id="monthly-budget-pct">0% consumido</span>
          <span id="monthly-budget-rem">$0.00 restante</span>
        </div>
      </div>
    </div>
  </div>
  ```

- [ ] **Step 4: Agregar el modal de edición de presupuestos**
  Añadir el modal `#budget-modal` antes de la etiqueta de cierre del body.
  ```html
  <!-- Modal para configuración de presupuestos -->
  <div id="budget-modal" class="modal hidden">
    <div class="modal-box glass" style="max-width: 400px; width: 90%; position: relative;">
      <button class="close-budget-modal close-modal" aria-label="Cerrar modal">&times;</button>
      <h3 style="margin-top: 0;">Presupuesto Mensual</h3>
      <p class="subtitle" style="margin-bottom: 20px;">Establece los límites mensuales para controlar tus gastos</p>
      <form id="budget-form">
        <div class="form-group">
          <label for="budget-usd">Presupuesto USD ($)</label>
          <input type="number" id="budget-usd" step="0.01" min="0" placeholder="1000.00" required>
        </div>
        <div class="form-group">
          <label for="budget-pen">Presupuesto PEN (S/)</label>
          <input type="number" id="budget-pen" step="0.01" min="0" placeholder="3000.00" required>
        </div>
        <button type="submit" class="btn-primary" id="budget-save-btn">Guardar Límites</button>
      </form>
    </div>
  </div>
  ```

- [ ] **Step 5: Guardar cambios y validar HTML**

---

### Task 3: Estilización CSS del Presupuesto y las Pestañas

**Files:**
- Modify: [css/styles.css](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/css/styles.css)

**Interfaces:**
- Consumes: Nuevas clases HTML añadidas en index.html.
- Produces: Visualización estilizada de la barra de progreso, engranaje, modales y pestañas activas.

- [ ] **Step 1: Añadir reglas CSS para pestañas de gráficos y barra de progreso**
  Insertar al final del archivo `css/styles.css` las siguientes clases:
  ```css
  /* Pestañas de gráficos */
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .chart-header h2 {
    margin: 0;
  }
  .chart-tabs {
    display: flex;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 2px;
  }
  .chart-tab {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 12px;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s ease;
  }
  .chart-tab:hover {
    color: var(--text-normal);
  }
  .chart-tab.active {
    background: var(--bg-card);
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  .chart-container {
    position: relative;
    min-height: 280px;
  }

  /* Botón de presupuesto en KPI */
  .kpi__config-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    color: var(--text-faint);
    cursor: pointer;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    padding: 0;
  }
  .kpi__config-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-normal);
    transform: rotate(30deg);
  }
  .kpi__config-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Contenedor y barra de presupuesto */
  .budget-container {
    margin-top: 12px;
    width: 100%;
  }
  .budget-bar {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .budget-progress {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #10b981, #3b82f6);
    border-radius: 3px;
    transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease;
  }
  .budget-progress.warning {
    background: linear-gradient(90deg, #f59e0b, #ef4444);
  }
  .budget-progress.danger {
    background: #ef4444;
  }
  .budget-text {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-faint);
  }
  ```

- [ ] **Step 2: Guardar los cambios y recargar el archivo CSS en la aplicación**

---

### Task 4: Inserción de Categorías en Supabase y Renderizado de Dona (Chart.js)

**Files:**
- Modify: [js/app.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/app.js)

**Interfaces:**
- Consumes: Campo de selección `#category` e inyección en `insert` de Supabase.
- Produces: Renderización de los gráficos lineal y circular alternables por pestañas, y visualización de categorías en la tabla de transacciones.

- [ ] **Step 1: Actualizar la obtención e inserción de gastos con la nueva columna `category`**
  Modificar el evento `form.addEventListener('submit', ...)` para capturar `#category` e incluirlo en la consulta de inserción de Supabase.
  ```javascript
  const category = document.getElementById('category').value;
  // ...
  const { data: newExpense, error: dbError } = await supabase
    .from('expenses')
    .insert([{
      concept,
      amount,
      currency,
      date,
      time,
      image_url: imageUrl,
      user_id: currentUser.id,
      category // Agregar categoría
    }])
    .select();
  ```
  Reiniciar también el formulario al limpiar:
  ```javascript
  document.getElementById('category').value = 'Otros';
  ```

- [ ] **Step 2: Incluir etiquetas de categorías en la tabla de historial**
  Modificar la función `renderTable()` para incluir la categoría o su emoji respectivo en la tabla.
  ```javascript
  const categoryEmojis = {
    Alimentación: '🍔',
    Transporte: '🚗',
    Servicios: '💡',
    Suscripciones: '💻',
    Oficina: '📦',
    Otros: '🏷️'
  };
  // En renderTable:
  const catEmoji = categoryEmojis[exp.category] || '🏷️';
  // Agregar columna de categoría en la fila de la tabla
  ```

- [ ] **Step 3: Agregar lógica para cambiar entre pestañas de gráficos**
  Implementar el cambio de pestañas en `js/app.js`:
  ```javascript
  const tabs = document.querySelectorAll('.chart-tab');
  const lineCanvas = document.getElementById('expenseChart');
  const donutCanvas = document.getElementById('categoryChart');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (tab.getAttribute('data-tab') === 'trend') {
        lineCanvas.classList.remove('hidden');
        donutCanvas.classList.add('hidden');
      } else {
        lineCanvas.classList.add('hidden');
        donutCanvas.classList.remove('hidden');
        renderCategoryChart();
      }
    });
  });
  ```

- [ ] **Step 4: Implementar la función `renderCategoryChart()` con Dona de Chart.js**
  Agregar una función que calcule y agrupe los gastos del mes actual por categoría y renderice el gráfico Doughnut.
  ```javascript
  let categoryChartInstance = null;

  function renderCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Obtener gastos del mes actual
    const currentMonth = getLocalDateString().slice(0, 7);
    const monthData = expenses.filter(exp => exp.date.startsWith(currentMonth));
    
    // Agrupar gastos por categoría
    const aggregated = {};
    monthData.forEach(exp => {
      // Filtrar según moneda activa si se desea, o combinar unificando
      // Para consistencia con el KPI principal, mostramos los totales por categoría sumando según la moneda del primer registro o separadas por tabs de moneda si el usuario las cambia
      // Aquí agrupamos por categoría sumando el valor directo o filtrando por USD por defecto
      // (Para hacerlo dinámico, podemos tomar la última moneda elegida o mostrar ambos)
      // Agrupemos por categoría filtrando por la moneda que tenga más registros, o acumulando dólares y soles por separado.
      // Proponemos agrupar según la moneda que esté visualizando actualmente el KPI (USD por defecto, o PEN si hay transacciones activas)
      const currencyToShow = 'USD'; // o dinámico
      if (exp.currency === currencyToShow) {
        aggregated[exp.category] = (aggregated[exp.category] || 0) + parseFloat(exp.amount);
      }
    });

    const labels = Object.keys(aggregated);
    const dataPoints = Object.values(aggregated);

    const colors = {
      Alimentación: '#10b981',
      Transporte: '#3b82f6',
      Servicios: '#f59e0b',
      Suscripciones: '#8b5cf6',
      Oficina: '#ef4444',
      Otros: '#9ca3af'
    };

    const bgColors = labels.map(label => colors[label] || '#9ca3af');

    if (categoryChartInstance) {
      categoryChartInstance.destroy();
    }

    categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataPoints,
          backgroundColor: bgColors,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#9da3ae', font: { family: 'Inter' } }
          }
        }
      }
    });
  }
  ```

---

### Task 5: Gestión de Presupuestos en Supabase y Sincronización en la Tarjeta KPI

**Files:**
- Modify: [js/app.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/app.js)

**Interfaces:**
- Consumes: Presupuestos desde la tabla `budgets` de Supabase.
- Produces: Barra de progreso actualizada dinámicamente y modal interactivo para guardar nuevos límites.

- [ ] **Step 1: Agregar variables de estado y la función para cargar presupuestos**
  Definir límites de presupuesto predeterminados en `js/app.js`:
  ```javascript
  let userBudgets = { USD: 1000, PEN: 3000 };
  ```
  Implementar la función `fetchBudgets()`:
  ```javascript
  async function fetchBudgets() {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('Error fetching budgets:', error);
      return;
    }

    if (data && data.length > 0) {
      data.forEach(b => {
        userBudgets[b.currency] = parseFloat(b.amount);
      });
    }
    updateBudgetUI();
  }
  ```

- [ ] **Step 2: Implementar la actualización visual de la barra de progreso**
  Calcular el gasto total del mes actual contra el presupuesto cargado y reflejarlo en la tarjeta KPI:
  ```javascript
  function updateBudgetUI() {
    const currentMonth = getLocalDateString().slice(0, 7);
    const monthData = expenses.filter(exp => exp.date.startsWith(currentMonth));
    
    // Determinar la moneda activa
    const hasPEN = monthData.some(exp => exp.currency === 'PEN');
    const activeCurrency = hasPEN ? 'PEN' : 'USD';
    const limit = userBudgets[activeCurrency] || (activeCurrency === 'USD' ? 1000 : 3000);

    let currentSpent = 0;
    monthData.forEach(exp => {
      if (exp.currency === activeCurrency) {
        currentSpent += parseFloat(exp.amount);
      }
    });

    const pct = Math.min((currentSpent / limit) * 100, 100);
    const remaining = Math.max(limit - currentSpent, 0);

    const container = document.getElementById('monthly-budget-container');
    const progressBar = document.getElementById('monthly-budget-progress');
    const pctLabel = document.getElementById('monthly-budget-pct');
    const remLabel = document.getElementById('monthly-budget-rem');

    if (container && progressBar && pctLabel && remLabel) {
      container.classList.remove('hidden');
      progressBar.style.width = `${pct}%`;

      // Clases de color según el porcentaje de consumo
      progressBar.className = 'budget-progress';
      if (pct >= 90) {
        progressBar.classList.add('danger');
      } else if (pct >= 70) {
        progressBar.classList.add('warning');
      }

      const symbol = activeCurrency === 'USD' ? '$' : 'S/';
      pctLabel.innerText = `${pct.toFixed(0)}% consumido`;
      remLabel.innerText = `${symbol}${remaining.toFixed(2)} restante`;
    }
  }
  ```

- [ ] **Step 3: Manejar la apertura, cierre y guardado en el Modal de Presupuesto**
  Agregar manejadores de eventos para interactuar con `#budget-modal` y subir los límites a Supabase:
  ```javascript
  const openBudgetBtn = document.getElementById('open-budget-btn');
  const budgetModal = document.getElementById('budget-modal');
  const closeBudgetBtn = document.querySelector('.close-budget-modal');
  const budgetForm = document.getElementById('budget-form');

  if (openBudgetBtn && budgetModal && closeBudgetBtn && budgetForm) {
    openBudgetBtn.addEventListener('click', () => {
      document.getElementById('budget-usd').value = userBudgets.USD;
      document.getElementById('budget-pen').value = userBudgets.PEN;
      budgetModal.classList.remove('hidden');
    });

    closeBudgetBtn.addEventListener('click', () => budgetModal.classList.add('hidden'));

    budgetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newUSD = parseFloat(document.getElementById('budget-usd').value);
      const newPEN = parseFloat(document.getElementById('budget-pen').value);

      const saveBtn = document.getElementById('budget-save-btn');
      saveBtn.disabled = true;
      saveBtn.innerText = 'Guardando...';

      try {
        // Guardar presupuesto de USD en Supabase
        const { error: errorUSD } = await supabase
          .from('budgets')
          .upsert({ user_id: currentUser.id, currency: 'USD', amount: newUSD }, { onConflict: 'user_id,currency' });
        
        if (errorUSD) throw errorUSD;

        // Guardar presupuesto de PEN en Supabase
        const { error: errorPEN } = await supabase
          .from('budgets')
          .upsert({ user_id: currentUser.id, currency: 'PEN', amount: newPEN }, { onConflict: 'user_id,currency' });

        if (errorPEN) throw errorPEN;

        // Actualizar localmente
        userBudgets.USD = newUSD;
        userBudgets.PEN = newPEN;

        budgetModal.classList.add('hidden');
        updateBudgetUI();
      } catch (err) {
        console.error('Error saving budgets:', err);
        alert('Fallo al guardar límites: ' + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Guardar Límites';
      }
    });
  }
  ```

- [ ] **Step 4: Integrar las llamadas de carga en el flujo de inicialización del dashboard**
  Llamar a `fetchBudgets()` dentro de `showDashboard()` o `initDashboard()`, y llamar a `updateBudgetUI()` en la función global `updateUI()`.
  ```javascript
  // En initDashboard():
  await fetchBudgets();

  // En updateUI():
  updateBudgetUI();
  ```

- [ ] **Step 5: Probar y validar todo el flujo de inicio a fin**
