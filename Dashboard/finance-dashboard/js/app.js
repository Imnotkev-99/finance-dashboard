// APEX Core Logic - Supabase Integration + Auth
document.addEventListener('DOMContentLoaded', () => {

  // 🔴 CLAVES DE SUPABASE 🔴
  const SUPABASE_URL = 'https://lkndwsolpimmezdshgpx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_616dQHKwWWKMRaXe7zcv3Q_L7Wd6Ek0';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Utilidades puras compartidas (definidas en js/utils.js, expuestas en window.APEX)
  const {
    escapeHtml,
    getLocalDateString,
    getStartOfWeek,
    aggregateByDate,
    formatTotals,
    validateExpenseInput,
    isValidVoucherUrl
  } = window.APEX;

  // Estado de sesión
  let currentUser = null;
  let isLoginMode = true; // true = Login, false = Register

  // Estado del dashboard
  let expenses = [];
  let userBudgets = { USD: 1000, PEN: 3000 };
  let expenseChartInstance = null;
  let categoryChartInstance = null;

  // Paginación de la tabla: cuántas filas renderizar al DOM
  const TABLE_PAGE_SIZE = 50;
  let tableVisibleCount = TABLE_PAGE_SIZE;

  // Catálogo de monedas soportadas
  const CURRENCIES = {
    USD: { label: 'Dólares', symbol: '$' },
    PEN: { label: 'Soles', symbol: 'S/' }
  };

  const categoryEmojis = {
    Alimentación: '🍔',
    Transporte: '🚗',
    Servicios: '💡',
    Suscripciones: '💻',
    Oficina: '📦',
    Otros: '🏷️'
  };

  // Elementos Auth
  const authScreen = document.getElementById('auth-screen');
  const mainDashboard = document.getElementById('main-dashboard');
  const authForm = document.getElementById('auth-form');
  const toggleAuthBtn = document.getElementById('toggle-auth');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userEmailDisplay = document.getElementById('user-email-display');

  // Elementos del Dashboard
  const form = document.getElementById('expense-form');
  const voucherInput = document.getElementById('voucher');
  const fileNameDisplay = document.getElementById('file-name');
  const tableBody = document.getElementById('table-body');
  const modal = document.getElementById('image-modal');
  const modalImg = document.getElementById('modal-image');
  const closeModal = document.querySelector('.close-modal');
  const submitBtn = form.querySelector('button[type="submit"]');
  const uploadZone = document.getElementById('upload-zone');

  // ============================================================
  //  NOTIFICACIONES IN-PAGE (reemplazan alert())
  // ============================================================

  let toastContainer = null;
  // Muestra un banner no bloqueante. type: 'error' | 'success' | 'info'
  function showToast(message, type = 'info') {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // Forzar reflow para activar la transición de entrada
    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    const remove = () => {
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    };
    toast.addEventListener('click', remove);
    setTimeout(remove, type === 'error' ? 6000 : 4000);
  }

  // ============================================================
  //  AYUDANTES DE ANIMACIÓN Y TRANSICIONES
  // ============================================================

  // Transición suave entre pantallas usando opacidad, escala y desenfoque
  async function transitionScreens(fromScreen, toScreen, callback) {
    // Definir transiciones temporales en JS
    fromScreen.style.transition = 'opacity 250ms cubic-bezier(0.16, 1, 0.3, 1), transform 250ms cubic-bezier(0.16, 1, 0.3, 1), filter 250ms cubic-bezier(0.16, 1, 0.3, 1)';
    toScreen.style.transition = 'opacity 250ms cubic-bezier(0.16, 1, 0.3, 1), transform 250ms cubic-bezier(0.16, 1, 0.3, 1), filter 250ms cubic-bezier(0.16, 1, 0.3, 1)';
    
    // 1. Desvanecer pantalla actual
    fromScreen.style.opacity = '0';
    fromScreen.style.transform = 'scale(0.98)';
    fromScreen.style.filter = 'blur(6px)';
    
    await new Promise(resolve => setTimeout(resolve, 250));
    
    fromScreen.classList.add('hidden');
    // Limpiar estilos inline
    fromScreen.style.opacity = '';
    fromScreen.style.transform = '';
    fromScreen.style.filter = '';
    fromScreen.style.transition = '';
    
    // Ejecutar lógica intermedia (ej. cargar datos)
    if (callback) callback();
    
    // 2. Preparar nueva pantalla invisible
    toScreen.style.opacity = '0';
    toScreen.style.transform = 'scale(1.02)';
    toScreen.style.filter = 'blur(6px)';
    toScreen.classList.remove('hidden');
    
    // Forzar reflow para que el navegador procese los estados iniciales
    toScreen.offsetHeight;
    
    // 3. Mostrar pantalla final
    toScreen.style.opacity = '1';
    toScreen.style.transform = 'scale(1)';
    toScreen.style.filter = 'none';
    
    await new Promise(resolve => setTimeout(resolve, 250));
    // Limpiar estilos inline finales
    toScreen.style.opacity = '';
    toScreen.style.transform = '';
    toScreen.style.filter = '';
    toScreen.style.transition = '';
  }

  // ============================================================
  //  AUTENTICACIÓN
  // ============================================================

  // Comprobar sesión activa al cargar
  checkSession();

  // Cambiar entre Login y Registro con micro-animación de desenfoque
  toggleAuthBtn.addEventListener('click', () => {
    const formFields = authForm.querySelectorAll('.form-group, #auth-submit-btn');
    const title = document.getElementById('auth-title');
    const elementsToAnimate = [...formFields, title];
    
    elementsToAnimate.forEach(el => {
      el.style.transition = 'opacity 150ms cubic-bezier(0.16, 1, 0.3, 1), filter 150ms cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.opacity = '0';
      el.style.filter = 'blur(4px)';
    });

    setTimeout(() => {
      isLoginMode = !isLoginMode;
      title.textContent = isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta';
      authSubmitBtn.textContent = isLoginMode ? 'Entrar' : 'Registrarse';
      
      const switchText = document.querySelector('.auth-switch');
      if (switchText) {
        switchText.childNodes[0].textContent = isLoginMode ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? ';
      }
      toggleAuthBtn.textContent = isLoginMode ? 'Regístrate aquí' : 'Inicia sesión aquí';
      
      elementsToAnimate.forEach(el => {
        el.style.opacity = '1';
        el.style.filter = 'none';
      });
      
      setTimeout(() => {
        elementsToAnimate.forEach(el => {
          el.style.transition = '';
          el.style.opacity = '';
          el.style.filter = '';
        });
      }, 150);
    }, 150);
  });

  // Procesar Formulario de Auth
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = 'Procesando...';

    try {
      if (isLoginMode) {
        // Iniciar Sesión
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Registro
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        showToast('Registro exitoso. Si Supabase requiere confirmación, revisa tu correo. Si no, ya puedes iniciar sesión.', 'success');
        isLoginMode = false;
        // Simular click para volver al login con la animación
        toggleAuthBtn.click();
      }
    } catch (error) {
      showToast('Error de autenticación: ' + error.message, 'error');
    } finally {
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = isLoginMode ? 'Entrar' : 'Registrarse';
    }
  });

  // Escuchar cambios en la sesión (Login/Logout)
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session) {
        currentUser = session.user;
        showDashboard();
      }
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      hideDashboard();
    }
  });

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      showDashboard();
    }
  }

  function showDashboard() {
    transitionScreens(authScreen, mainDashboard, () => {
      userEmailDisplay.textContent = currentUser.email;
      
      // Actualizar avatar con la primera letra del usuario actual
      const firstLetter = currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U';
      document.querySelectorAll('.avatar').forEach(avatar => {
        avatar.textContent = firstLetter;
      });

      initDashboard();
    });
  }

  function hideDashboard() {
    transitionScreens(mainDashboard, authScreen, () => {
      authForm.reset();
      form.reset();
      fileNameDisplay.textContent = 'Ningún archivo seleccionado';
      fileNameDisplay.classList.add('hidden');
      if (uploadZone) uploadZone.classList.remove('has-file');
      tableBody.innerHTML = '';
    });
  }

  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  // Actualizar nombre de archivo seleccionado en input
  voucherInput.addEventListener('change', () => {
    const file = voucherInput.files[0];
    if (file) {
      fileNameDisplay.textContent = file.name;
      fileNameDisplay.classList.remove('hidden');
      if (uploadZone) uploadZone.classList.add('has-file');
    } else {
      fileNameDisplay.textContent = 'Ningún archivo seleccionado';
      fileNameDisplay.classList.add('hidden');
      if (uploadZone) uploadZone.classList.remove('has-file');
    }
  });

  // Implementación de drag and drop en la zona de carga de voucher
  if (uploadZone && voucherInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
      }, false);
    });

    uploadZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length) {
        voucherInput.files = files;
        voucherInput.dispatchEvent(new Event('change'));
      }
    }, false);
  }

  // ============================================================
  //  DASHBOARD
  // ============================================================

  async function initDashboard() {
    initDateAndTime();
    // Son consultas independientes: cargarlas en paralelo reduce la latencia inicial.
    await Promise.all([fetchBudgets(), fetchExpenses()]);
  }

  function initDateAndTime() {
    const now = new Date();
    document.getElementById('date').value = getLocalDateString(now);
    document.getElementById('time').value = now.toTimeString().slice(0, 5);
  }

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

  function updateBudgetUI() {
    const currentMonth = getLocalDateString().slice(0, 7);
    const monthData = expenses.filter(exp => exp.date.startsWith(currentMonth));
    
    // Determinar la moneda activa
    const hasPEN = monthData.some(exp => exp.currency === 'PEN');
    const activeCurrency = hasPEN ? 'PEN' : 'USD';
    const limit = userBudgets[activeCurrency] ?? (activeCurrency === 'USD' ? 1000 : 3000);

    let currentSpent = 0;
    monthData.forEach(exp => {
      if (exp.currency === activeCurrency) {
        currentSpent += parseFloat(exp.amount);
      }
    });

    const pct = limit > 0 ? Math.min((currentSpent / limit) * 100, 100) : (currentSpent > 0 ? 100 : 0);
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

  // Obtener datos de Supabase
  async function fetchExpenses() {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px 0;">Cargando base de datos cloud... ⚡</td></tr>';

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching data:', error);
      tableBody.innerHTML = '<tr><td colspan="6" style="color:var(--danger); text-align:center; padding: 24px 0;">Error de conexión. Revisa tus claves.</td></tr>';
      return;
    }

    expenses = data;
    tableVisibleCount = TABLE_PAGE_SIZE;
    updateUI();
  }

  // Enviar formulario y subir a Cloud
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const concept = document.getElementById('concept').value;
    const category = document.getElementById('category').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const currency = document.getElementById('currency').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const file = voucherInput.files[0];

    // Validación en cliente antes de tocar la red
    const { valid, error: validationError } = validateExpenseInput({ concept, amount });
    if (!valid) {
      showToast(validationError, 'error');
      return;
    }

    submitBtn.textContent = 'Procesando en la Nube... ⚡';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';

    try {
      let imageUrl = null;
      let uploadedFilePath = null;

      // 1. Subir imagen a Supabase Storage si se adjuntó un archivo
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        uploadedFilePath = `${currentUser.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('vouchers')
          .upload(uploadedFilePath, file);

        if (uploadError) throw uploadError;

        // 2. Obtener URL pública
        const { data: urlData } = supabase.storage
          .from('vouchers')
          .getPublicUrl(uploadedFilePath);

        imageUrl = urlData.publicUrl;
      }

      // 3. Guardar registro en la base de datos relacional
      const { data: newExpense, error: dbError } = await supabase
        .from('expenses')
        .insert([{
          concept,
          category,
          amount,
          currency,
          date,
          time,
          image_url: imageUrl,
          user_id: currentUser.id
        }])
        .select();

      if (dbError) {
        // Rollback
        if (file && uploadedFilePath) {
          try {
            await supabase.storage.from('vouchers').remove([uploadedFilePath]);
          } catch (storageErr) {
            console.error('Failed to clean up uploaded voucher after DB insert failure:', storageErr);
          }
        }
        throw dbError;
      }

      // 4. Actualizar vista local
      expenses.unshift(newExpense[0]);
      form.reset();
      fileNameDisplay.textContent = 'Ningún archivo seleccionado';
      fileNameDisplay.classList.add('hidden');
      if (uploadZone) uploadZone.classList.remove('has-file');
      document.getElementById('category').value = 'Otros';
      
      updateUI();
      initDateAndTime();

    } catch (error) {
      console.error('Error procesando el gasto:', error);
      showToast('Fallo al guardar: ' + error.message, 'error');
    } finally {
      submitBtn.textContent = 'Guardar Registro';
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    }
  });

  // Delegación de eventos (Ver imagen y Eliminar en la Nube)
  tableBody.addEventListener('click', async (e) => {
    // Ver Imagen
    const viewImgBtn = e.target.closest('.view-img-btn');
    if (viewImgBtn) {
      const imgData = viewImgBtn.getAttribute('data-img');
      // Sólo abrir URLs https del dominio de Supabase (anti URL injection)
      if (isValidVoucherUrl(imgData, SUPABASE_URL)) {
        modalImg.src = imgData;
        modal.classList.remove('hidden');
      } else {
        showToast('No se pudo mostrar el voucher: URL no válida.', 'error');
      }
    }

    // Eliminar Registro
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const confirmDelete = confirm('¿Borrar registro de la base de datos permanentemente?');

      if (confirmDelete) {
        deleteBtn.innerHTML = '<span class="spinner-inline"></span>';
        deleteBtn.disabled = true;

        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', id);

        if (error) {
          showToast('Error al borrar: ' + error.message, 'error');
          updateUI();
        } else {
          // Buscar el gasto localmente
          const expToDelete = expenses.find(exp => String(exp.id) === id);

          // Si el gasto tiene imagen asociada en Storage, eliminarla
          if (expToDelete && expToDelete.image_url) {
            try {
              const urlParts = expToDelete.image_url.split('/storage/v1/object/public/vouchers/');
              if (urlParts.length > 1) {
                const filePath = urlParts[1];
                await supabase.storage.from('vouchers').remove([filePath]);
              }
            } catch (storageErr) {
              console.error('Error al borrar la imagen de storage:', storageErr);
            }
          }

          expenses = expenses.filter(exp => String(exp.id) !== id);
          updateUI();
        }
      }
    }
  });

  // Cerrar Modal
  closeModal.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  // Funciones de UI
  function updateUI() {
    renderTable();
    calculateKPIs();
    renderChart();
    updateBudgetUI();
    
    // Si la pestaña activa es la de categorías, volver a renderizar el gráfico de dona
    const activeTab = document.querySelector('.chart-tab.active');
    if (activeTab && activeTab.getAttribute('data-tab') === 'categories') {
      renderCategoryChart();
    }
  }

  function renderTable() {
    tableBody.innerHTML = '';

    if (expenses.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding: 32px 0;">No hay gastos registrados aún.</td></tr>';
      return;
    }

    const deleteIcon = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="delete-icon" style="width: 14px; height: 14px; display: block; margin: auto;">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    `;

    // Renderizar sólo las filas visibles (los gastos ya vienen ordenados, recientes primero)
    const visible = expenses.slice(0, tableVisibleCount);
    visible.forEach((exp, i) => {
      const cur = CURRENCIES[exp.currency] || CURRENCIES.USD;
      const tr = document.createElement('tr');
      tr.className = 'row-anim';
      tr.style.animationDelay = `${Math.min(i * 0.03, 0.3)}s`;

      const catEmoji = categoryEmojis[exp.category] || '🏷️';
      const catLabel = exp.category || 'Otros';

      tr.innerHTML = `
                <td>${escapeHtml(exp.date)} <br><small style="color: var(--text-faint)">${escapeHtml(exp.time)}</small></td>
                <td style="font-weight: 500;">
                  ${escapeHtml(exp.concept)} <br>
                  <span class="category-tag-mini">${catEmoji} ${escapeHtml(catLabel)}</span>
                </td>
                <td style="color: var(--accent-bright); font-weight: 600;">${cur.symbol}${parseFloat(exp.amount).toFixed(2)}</td>
                <td><span class="currency-tag">${escapeHtml(cur.label)}</span></td>
                <td>
                    ${exp.image_url
          ? `<button class="view-img-btn" data-img="${escapeHtml(exp.image_url)}">Ver Voucher</button>`
          : `<span class="no-voucher">Sin voucher</span>`}
                </td>
                <td>
                    <button class="delete-btn" data-id="${escapeHtml(String(exp.id))}" title="Eliminar registro" aria-label="Eliminar registro">${deleteIcon}</button>
                </td>
            `;
      tableBody.appendChild(tr);
    });

    // Fila "Ver más" si quedan gastos por mostrar
    if (expenses.length > tableVisibleCount) {
      const restantes = expenses.length - tableVisibleCount;
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.style.cssText = 'text-align:center; padding: 16px 0;';
      const btn = document.createElement('button');
      btn.className = 'load-more-btn';
      btn.textContent = `Ver más (${restantes} restantes)`;
      btn.addEventListener('click', () => {
        tableVisibleCount += TABLE_PAGE_SIZE;
        renderTable();
      });
      td.appendChild(btn);
      tr.appendChild(td);
      tableBody.appendChild(tr);
    }
  }

  function calculateKPIs() {
    const now = new Date();
    const today = getLocalDateString(now);
    const startOfWeek = getStartOfWeek(now);
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

  // Anima de 0 al valor (count-up)
  function animateTotals(elId, totals) {
    const el = document.getElementById(elId);
    if (!el) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.innerText = formatTotals(totals, CURRENCIES); return; }

    const duration = 900;
    const start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3); // easeOutCubic

    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const e = ease(p);
      const interp = {};
      Object.keys(totals).forEach(code => { interp[code] = totals[code] * e; });
      el.innerText = formatTotals(interp, CURRENCIES);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Construye etiquetas y datasets del gráfico de línea a partir de los gastos del mes.
  function buildChartDatasets(ctx) {
    const currentMonth = getLocalDateString().slice(0, 7);
    const byCurrency = aggregateByDate(expenses, CURRENCIES, currentMonth);
    const aggregatedUSD = byCurrency.USD;
    const aggregatedPEN = byCurrency.PEN;

    // Lista consolidada y ordenada de todas las fechas con datos
    const allDates = Array.from(new Set([...Object.keys(aggregatedUSD), ...Object.keys(aggregatedPEN)])).sort();

    // Relleno en gradiente esmeralda (USD) y azul (PEN)
    const fillUSD = ctx.createLinearGradient(0, 0, 0, 260);
    fillUSD.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
    fillUSD.addColorStop(1, 'rgba(16, 185, 129, 0)');
    const fillPEN = ctx.createLinearGradient(0, 0, 0, 260);
    fillPEN.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
    fillPEN.addColorStop(1, 'rgba(59, 130, 246, 0)');

    const pointBase = {
      borderWidth: 2,
      fill: true,
      tension: 0.35,
      pointBackgroundColor: '#121318',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointHoverBorderWidth: 3
    };

    return {
      allDates,
      labels: allDates.map(date => date.slice(8, 10)), // Mostrar solo el día
      datasets: [
        { label: 'Dólares ($)', data: allDates.map(d => aggregatedUSD[d] || 0), borderColor: '#10b981', backgroundColor: fillUSD, pointBorderColor: '#10b981', ...pointBase },
        { label: 'Soles (S/)', data: allDates.map(d => aggregatedPEN[d] || 0), borderColor: '#3b82f6', backgroundColor: fillPEN, pointBorderColor: '#3b82f6', ...pointBase }
      ]
    };
  }

  // Opciones de Chart.js para el gráfico de línea. `allDates` se usa en los tooltips.
  function chartOptions(allDates, reduce) {
    return {
      responsive: true,
      maintainAspectRatio: true,
      animation: reduce ? false : { duration: 1100, easing: 'easeOutQuart' },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 10,
            font: { size: 12, family: "'Inter', sans-serif", weight: '500' },
            color: '#9da3ae'
          }
        },
        tooltip: {
          backgroundColor: '#16171d',
          titleColor: '#ffffff',
          bodyColor: '#f5f6f8',
          padding: 12,
          cornerRadius: 10,
          displayColors: true,
          borderColor: 'rgba(255, 255, 255, 0.08)',
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
          grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
          ticks: { color: '#9da3ae', font: { size: 11 } }
        },
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: '#9da3ae', font: { size: 11 } }
        }
      }
    };
  }

  function renderChart() {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const { allDates, labels, datasets } = buildChartDatasets(ctx);

    if (expenseChartInstance) {
      expenseChartInstance.destroy();
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    expenseChartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: chartOptions(allDates, reduce)
    });
  }

  // Lógica de pestañas de gráficos (Evolución / Categorías)
  const chartTabs = document.querySelectorAll('.chart-tab');
  const lineCanvas = document.getElementById('expenseChart');
  const donutCanvas = document.getElementById('categoryChart');

  chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      chartTabs.forEach(t => t.classList.remove('active'));
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

  function renderCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Obtener gastos del mes actual
    const currentMonth = getLocalDateString().slice(0, 7);
    
    // Detectar moneda activa basándonos en si hay gastos PEN en el mes actual
    const activeCurrency = expenses.some(exp => exp.date.startsWith(currentMonth) && exp.currency === 'PEN') ? 'PEN' : 'USD';
    
    // Filtrar gastos del mes actual en la moneda activa
    const monthData = expenses.filter(exp => exp.date.startsWith(currentMonth) && exp.currency === activeCurrency);
    
    // Agrupar gastos por categoría
    const aggregated = {};
    monthData.forEach(exp => {
      const cat = exp.category || 'Otros';
      aggregated[cat] = (aggregated[cat] || 0) + parseFloat(exp.amount);
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

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        animation: reduce ? false : { duration: 1100, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#9da3ae',
              font: { family: "'Inter', sans-serif", size: 12, weight: '500' }
            }
          },
          tooltip: {
            backgroundColor: '#16171d',
            titleColor: '#ffffff',
            bodyColor: '#f5f6f8',
            padding: 12,
            cornerRadius: 10,
            displayColors: true,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const symbol = activeCurrency === 'USD' ? '$' : 'S/';
                return ` ${context.label}: ${symbol}${context.raw.toFixed(2)}`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // Manejo del Modal de Presupuestos
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

    budgetModal.addEventListener('click', (e) => {
      if (e.target === budgetModal) budgetModal.classList.add('hidden');
    });

    budgetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newUSD = parseFloat(document.getElementById('budget-usd').value);
      const newPEN = parseFloat(document.getElementById('budget-pen').value);

      const saveBtn = document.getElementById('budget-save-btn');
      saveBtn.disabled = true;
      saveBtn.innerText = 'Guardando...';

      try {
        const [resUSD, resPEN] = await Promise.all([
          supabase.from('budgets').upsert({ user_id: currentUser.id, currency: 'USD', amount: newUSD }, { onConflict: 'user_id,currency' }),
          supabase.from('budgets').upsert({ user_id: currentUser.id, currency: 'PEN', amount: newPEN }, { onConflict: 'user_id,currency' })
        ]);
        if (resUSD.error) throw resUSD.error;
        if (resPEN.error) throw resPEN.error;

        // Actualizar localmente
        userBudgets.USD = newUSD;
        userBudgets.PEN = newPEN;

        budgetModal.classList.add('hidden');
        updateBudgetUI();
      } catch (err) {
        console.error('Error saving budgets:', err);
        showToast('Fallo al guardar límites: ' + err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Guardar Límites';
      }
    });
  }
});
