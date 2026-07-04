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
    validateExpenseInput,
    validateVoucherFile,
    voucherPathFromUrl,
    toCsv,
    isValidVoucherUrl
  } = window.APEX;

  // Estado de sesión
  let currentUser = null;
  let isLoginMode = true; // true = Login, false = Register
  let dashboardReady = false; // evita re-inicializar en SIGNED_IN repetidos (refresh de token, foco)

  // Estado del dashboard
  let expenses = []; // filas CARGADAS de la tabla (páginas traídas del servidor)
  let summary = null; // agregados exactos del RPC dashboard_summary
  let userBudgets = { USD: 1000, PEN: 3000 };
  let expenseChartInstance = null;
  let categoryChartInstance = null;
  let chartAllDates = []; // fechas completas del line chart (para tooltips)

  // Paginación y filtros: la tabla pide páginas al servidor (sin límite de 1000)
  const TABLE_PAGE_SIZE = 50;
  const EXPORT_CHUNK = 1000;
  const EXPORT_MAX_ROWS = 10000;
  let tableOffset = 0;
  let hasMoreRows = false;
  let isLoadingPage = false;

  const tableFilters = { q: '', category: '', currency: '', from: '', to: '' };
  const hasActiveFilters = () =>
    Boolean(tableFilters.q || tableFilters.category || tableFilters.currency || tableFilters.from || tableFilters.to);

  // Moneda activa de KPIs/presupuesto/dona (selector explícito, persistido)
  const CURRENCY_STORAGE_KEY = 'apex-active-currency';
  let activeCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY) === 'USD' ? 'USD' : 'PEN';

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
  const submitBtn = form.querySelector('button[type="submit"]');
  const uploadZone = document.getElementById('upload-zone');

  // Modales y toolbar
  const budgetModal = document.getElementById('budget-modal');
  const editModal = document.getElementById('edit-modal');
  const editForm = document.getElementById('edit-form');
  const confirmModal = document.getElementById('confirm-dialog');
  const filterSearch = document.getElementById('filter-search');
  const filterCategory = document.getElementById('filter-category');
  const filterCurrency = document.getElementById('filter-currency');
  const filterFrom = document.getElementById('filter-from');
  const filterTo = document.getElementById('filter-to');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const currencySwitchBtns = document.querySelectorAll('.currency-switch__btn');

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
  //  MODALES ACCESIBLES (focus trap + Escape + foco de retorno)
  // ============================================================

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let activeModal = null;
  let modalTrigger = null;
  let confirmResolve = null;

  function openModal(targetModal) {
    modalTrigger = document.activeElement;
    activeModal = targetModal;
    targetModal.classList.remove('hidden');
    // Foco inicial: primer campo de formulario, o primer elemento enfocable
    const preferred = targetModal.querySelector('input, select, textarea');
    const fallback = targetModal.querySelector(FOCUSABLE_SELECTOR);
    (preferred || fallback || targetModal).focus();
  }

  function closeActiveModal() {
    if (!activeModal) return;
    const wasConfirm = activeModal === confirmModal;
    activeModal.classList.add('hidden');
    activeModal = null;
    if (modalTrigger && typeof modalTrigger.focus === 'function') modalTrigger.focus();
    modalTrigger = null;
    // Cerrar el diálogo de confirmación sin decidir equivale a "Cancelar"
    if (wasConfirm && confirmResolve) {
      const resolve = confirmResolve;
      confirmResolve = null;
      resolve(false);
    }
  }

  document.addEventListener('keydown', (e) => {
    if (!activeModal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeActiveModal();
      return;
    }
    if (e.key !== 'Tab') return;
    // Focus trap: Tab circula sólo dentro del modal activo
    const focusables = Array.from(activeModal.querySelectorAll(FOCUSABLE_SELECTOR));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Reemplazo accesible y no bloqueante de window.confirm()
  function confirmDialog(message) {
    document.getElementById('confirm-message').textContent = message;
    openModal(confirmModal);
    // Foco en "Cancelar": la opción segura por defecto
    document.getElementById('confirm-cancel').focus();
    return new Promise((resolve) => {
      confirmResolve = resolve;
    });
  }

  document.getElementById('confirm-cancel').addEventListener('click', closeActiveModal);
  document.getElementById('confirm-accept').addEventListener('click', () => {
    const resolve = confirmResolve;
    confirmResolve = null;
    closeActiveModal();
    if (resolve) resolve(true);
  });

  // Cerrar cualquier modal al hacer click en el fondo
  [modal, budgetModal, editModal, confirmModal].forEach((m) => {
    if (!m) return;
    m.addEventListener('click', (e) => {
      if (e.target === m) closeActiveModal();
    });
  });
  document.querySelector('#image-modal .close-modal').addEventListener('click', closeActiveModal);
  document.querySelector('.close-budget-modal').addEventListener('click', closeActiveModal);
  document.querySelector('.close-edit-modal').addEventListener('click', closeActiveModal);

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

  // Iniciar sesión / registrarse con Google (OAuth)
  const googleSignInBtn = document.getElementById('google-signin-btn');
  if (googleSignInBtn) {
    const googleLabel = googleSignInBtn.innerHTML;
    const resetGoogleBtn = () => {
      googleSignInBtn.disabled = false;
      googleSignInBtn.innerHTML = googleLabel;
    };

    // Reactiva el botón al volver a la página (incluido el back/forward cache
    // de Safari, donde el DOM se restaura con el botón aún deshabilitado).
    window.addEventListener('pageshow', resetGoogleBtn);

    googleSignInBtn.addEventListener('click', async () => {
      googleSignInBtn.disabled = true;
      googleSignInBtn.innerHTML = '<span>Conectando…</span>';
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin }
        });
        // En éxito, el navegador redirige a Google; al volver,
        // onAuthStateChange (SIGNED_IN) muestra el dashboard.
        if (error) throw error;
        // Red de seguridad: si no redirigió en unos segundos, reactiva.
        setTimeout(resetGoogleBtn, 5000);
      } catch (error) {
        showToast('Error al entrar con Google: ' + error.message, 'error');
        resetGoogleBtn();
      }
    });
  }

  // Si Supabase/Google rebotó con un error en la URL (p. ej. el proveedor no
  // está habilitado), muéstralo en un toast en vez de quedarnos en silencio.
  (function handleOAuthRedirectError() {
    const hash = new window.URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new window.URLSearchParams(window.location.search);
    const desc = hash.get('error_description') || query.get('error_description');
    const code = hash.get('error') || query.get('error');
    if (desc || code) {
      const msg = decodeURIComponent(desc || code).replace(/\+/g, ' ');
      showToast('Google: ' + msg, 'error');
      // Limpia la URL para que el error no reaparezca al recargar.
      window.history.replaceState(null, '', window.location.pathname);
    }
  })();

  // Escuchar cambios en la sesión. INITIAL_SESSION cubre la sesión persistida
  // al cargar la página (no hace falta un getSession() aparte, que duplicaba
  // la inicialización del dashboard).
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (!session) return;
      // SIGNED_IN se re-emite al refrescar el token o recuperar el foco:
      // si es el mismo usuario y el dashboard ya está montado, no re-inicializar.
      if (dashboardReady && currentUser && currentUser.id === session.user.id) {
        currentUser = session.user;
        return;
      }
      currentUser = session.user;
      dashboardReady = true;
      showDashboard();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      dashboardReady = false;
      hideDashboard();
    }
  });

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
      // Limpiar estado del dashboard para el próximo usuario
      expenses = [];
      summary = null;
      tableOffset = 0;
      hasMoreRows = false;
      Object.assign(tableFilters, { q: '', category: '', currency: '', from: '', to: '' });
      [filterSearch, filterCategory, filterCurrency, filterFrom, filterTo].forEach((el) => {
        if (el) el.value = '';
      });
      if (clearFiltersBtn) clearFiltersBtn.classList.add('hidden');
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
      const { valid, error } = validateVoucherFile(file);
      if (!valid) {
        showToast(error, 'error');
        voucherInput.value = '';
        fileNameDisplay.textContent = 'Ningún archivo seleccionado';
        fileNameDisplay.classList.add('hidden');
        if (uploadZone) uploadZone.classList.remove('has-file');
        return;
      }
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
    await Promise.all([fetchBudgets(), fetchSummary(), fetchExpensesPage({ reset: true })]);
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

  // ============================================================
  //  RESUMEN (RPC dashboard_summary): KPIs, charts y presupuesto
  // ============================================================

  // Los agregados se calculan en Postgres: son exactos con cualquier volumen
  // de datos y no dependen de cuántas filas tenga cargadas la tabla.
  async function fetchSummary() {
    if (!currentUser) return;
    const { data, error } = await supabase.rpc('dashboard_summary', {
      p_today: getLocalDateString(),
      p_week_start: getStartOfWeek()
    });

    if (error) {
      console.error('Error fetching summary:', error);
      showToast('No se pudieron calcular los totales: ' + error.message, 'error');
      return;
    }

    summary = data;
    applySummary();
  }

  function applySummary() {
    if (!summary) return;
    renderKpis();
    renderChart();
    updateBudgetUI();
    renderInsights();

    // Si la pestaña activa es la de categorías, refrescar el gráfico de dona
    const activeTab = document.querySelector('.chart-tab.active');
    if (activeTab && activeTab.getAttribute('data-tab') === 'categories') {
      renderCategoryChart();
    }
  }

  // Total de un bucket del summary ({USD: n, PEN: n}) en la moneda activa
  function sumFor(bucket) {
    return parseFloat(bucket?.[activeCurrency] ?? 0) || 0;
  }

  function formatMoney(value) {
    const symbol = CURRENCIES[activeCurrency].symbol;
    return `${symbol}${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function renderKpis() {
    animateTotal('daily-total', sumFor(summary.daily));
    animateTotal('weekly-total', sumFor(summary.weekly));
    animateTotal('monthly-total', sumFor(summary.monthly));
  }

  // Anima de 0 al valor (count-up)
  function animateTotal(elId, value) {
    const el = document.getElementById(elId);
    if (!el) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.innerText = formatMoney(value); return; }

    const duration = 900;
    const start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3); // easeOutCubic

    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      el.innerText = formatMoney(value * ease(p));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function updateBudgetUI() {
    const limit = userBudgets[activeCurrency] ?? (activeCurrency === 'USD' ? 1000 : 3000);
    const currentSpent = summary ? sumFor(summary.monthly) : 0;

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

      pctLabel.innerText = `${pct.toFixed(0)}% consumido`;
      remLabel.innerText = `${formatMoney(remaining)} restante`;
    }
  }

  function renderInsights() {
    if (!summary) return;

    // 1) Consumo Mensual
    const monthlyTotal = sumFor(summary.monthly);
    const monthlyTotalEl = document.getElementById('insight-monthly-total');
    if (monthlyTotalEl) monthlyTotalEl.innerText = formatMoney(monthlyTotal);

    // 2) Categoría Principal (Top Category)
    const categoryRows = (summary?.by_category || []).filter((row) => row.currency === activeCurrency);
    let topCategory = 'Ninguna';
    let maxCategoryAmt = 0;
    categoryRows.forEach((row) => {
      const amt = parseFloat(row.total) || 0;
      if (amt > maxCategoryAmt) {
        maxCategoryAmt = amt;
        topCategory = row.category || 'Otros';
      }
    });
    const topCategoryEl = document.getElementById('insight-top-category');
    if (topCategoryEl) {
      if (maxCategoryAmt > 0) {
        const catEmoji = categoryEmojis[topCategory] || '🏷️';
        topCategoryEl.innerText = `${catEmoji} ${topCategory} (${formatMoney(maxCategoryAmt)})`;
      } else {
        topCategoryEl.innerText = 'Ninguna';
      }
    }

    // 3) Día Pico de Gasto
    const dateRows = (summary?.by_date || []).filter((row) => row.currency === activeCurrency);
    let peakDay = '-';
    let maxDayAmt = 0;
    dateRows.forEach((row) => {
      const amt = parseFloat(row.total) || 0;
      if (amt > maxDayAmt) {
        maxDayAmt = amt;
        peakDay = row.date;
      }
    });
    const peakDayEl = document.getElementById('insight-peak-day');
    if (peakDayEl) {
      if (maxDayAmt > 0 && peakDay !== '-') {
        const parts = peakDay.split('-');
        if (parts.length === 3) {
          const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
          const day = parseInt(parts[2], 10);
          const monthIndex = parseInt(parts[1], 10) - 1;
          const monthName = months[monthIndex] || '';
          peakDayEl.innerText = `${day} de ${monthName} (${formatMoney(maxDayAmt)})`;
        } else {
          peakDayEl.innerText = `${peakDay} (${formatMoney(maxDayAmt)})`;
        }
      } else {
        peakDayEl.innerText = '-';
      }
    }

    // 4) Promedio Diario
    const elapsedDays = Math.max(new Date().getDate(), 1);
    const dailyAverage = monthlyTotal / elapsedDays;
    const dailyAverageEl = document.getElementById('insight-daily-average');
    if (dailyAverageEl) dailyAverageEl.innerText = formatMoney(dailyAverage);
  }

  // Selector de moneda de los indicadores (segmented control, persistido)
  function setActiveCurrency(code, { persist = true } = {}) {
    activeCurrency = CURRENCIES[code] ? code : 'PEN';
    if (persist) window.localStorage.setItem(CURRENCY_STORAGE_KEY, activeCurrency);
    currencySwitchBtns.forEach((btn) => {
      const isActive = btn.getAttribute('data-currency') === activeCurrency;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
    if (summary) applySummary();
    else updateBudgetUI();
  }

  currencySwitchBtns.forEach((btn) => {
    btn.addEventListener('click', () => setActiveCurrency(btn.getAttribute('data-currency')));
  });
  setActiveCurrency(activeCurrency, { persist: false });

  // ============================================================
  //  TABLA: consulta con filtros + paginación de servidor
  // ============================================================

  // Escapa los comodines de LIKE para que se busquen literalmente
  const escapeLike = (value) => value.replace(/[%_\\]/g, '\\$&');

  function buildExpenseQuery() {
    // RLS ya restringe por usuario; el .eq() es defensa en profundidad y
    // permite aprovechar el índice compuesto (user_id, date, time).
    let query = supabase
      .from('expenses')
      .select('*')
      .eq('user_id', currentUser.id);

    if (tableFilters.q) query = query.ilike('concept', `%${escapeLike(tableFilters.q)}%`);
    if (tableFilters.category) query = query.eq('category', tableFilters.category);
    if (tableFilters.currency) query = query.eq('currency', tableFilters.currency);
    if (tableFilters.from) query = query.gte('date', tableFilters.from);
    if (tableFilters.to) query = query.lte('date', tableFilters.to);

    return query
      .order('date', { ascending: false })
      .order('time', { ascending: false });
  }

  function renderSkeleton() {
    const widths = [70, 90, 55, 60, 75, 40];
    tableBody.innerHTML = Array.from({ length: 5 }, () =>
      `<tr class="skeleton-row">${widths.map(w => `<td><span class="skeleton-line" style="width:${w}%"></span></td>`).join('')}</tr>`
    ).join('');
  }

  async function fetchExpensesPage({ reset = false, silent = false } = {}) {
    if (!currentUser || isLoadingPage) return;
    isLoadingPage = true;
    if (reset) {
      tableOffset = 0;
      if (!silent) renderSkeleton();
    }

    try {
      const { data, error } = await buildExpenseQuery()
        .range(tableOffset, tableOffset + TABLE_PAGE_SIZE - 1);
      if (error) throw error;

      expenses = reset ? data : expenses.concat(data);
      hasMoreRows = data.length === TABLE_PAGE_SIZE;
      tableOffset += data.length;
      renderTable();
    } catch (error) {
      console.error('Error fetching data:', error);
      tableBody.innerHTML = '<tr><td colspan="6" style="color:var(--danger); text-align:center; padding: 24px 0;">Error de conexión. Intenta de nuevo.</td></tr>';
    } finally {
      isLoadingPage = false;
    }
  }

  function renderEmptyState() {
    if (hasActiveFilters()) {
      tableBody.innerHTML = `
        <tr><td colspan="6">
          <div class="empty-state">
            <p class="empty-state__title">Sin resultados para estos filtros</p>
            <p class="empty-state__hint">Prueba con otro término o rango de fechas.</p>
            <button type="button" class="ghost-btn" id="empty-clear-filters">Limpiar filtros</button>
          </div>
        </td></tr>`;
      return;
    }
    tableBody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-state__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <p class="empty-state__title">Aún no hay gastos registrados</p>
          <p class="empty-state__hint">Registra tu primer gasto y empieza a ver tus métricas.</p>
          <button type="button" class="btn-primary empty-state__cta" id="empty-cta">Registrar mi primer gasto</button>
        </div>
      </td></tr>`;
  }

  function renderTable() {
    tableBody.innerHTML = '';

    if (expenses.length === 0) {
      renderEmptyState();
      return;
    }

    const deleteIcon = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="delete-icon" style="width: 14px; height: 14px; display: block; margin: auto;">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    `;
    const editIcon = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; display: block; margin: auto;">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      </svg>
    `;

    // Los gastos ya vienen ordenados del servidor (recientes primero)
    expenses.forEach((exp, i) => {
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
                  <div class="row-actions">
                    <button class="edit-btn" data-id="${escapeHtml(String(exp.id))}" title="Editar registro" aria-label="Editar registro">${editIcon}</button>
                    <button class="delete-btn" data-id="${escapeHtml(String(exp.id))}" title="Eliminar registro" aria-label="Eliminar registro">${deleteIcon}</button>
                  </div>
                </td>
            `;
      tableBody.appendChild(tr);
    });

    // Fila "Ver más": pide la siguiente página al servidor
    if (hasMoreRows) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.style.cssText = 'text-align:center; padding: 16px 0;';
      const btn = document.createElement('button');
      btn.className = 'load-more-btn';
      btn.textContent = 'Ver más';
      btn.addEventListener('click', () => fetchExpensesPage());
      td.appendChild(btn);
      tr.appendChild(td);
      tableBody.appendChild(tr);
    }
  }

  // ============================================================
  //  FILTROS Y EXPORT CSV
  // ============================================================

  function readFiltersFromUI() {
    tableFilters.q = filterSearch.value.trim();
    tableFilters.category = filterCategory.value;
    tableFilters.currency = filterCurrency.value;
    tableFilters.from = filterFrom.value;
    tableFilters.to = filterTo.value;
    clearFiltersBtn.classList.toggle('hidden', !hasActiveFilters());
  }

  function applyFilters() {
    readFiltersFromUI();
    fetchExpensesPage({ reset: true });
  }

  let searchDebounce = null;
  filterSearch.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(applyFilters, 300);
  });
  [filterCategory, filterCurrency, filterFrom, filterTo].forEach((el) => {
    el.addEventListener('change', applyFilters);
  });

  function clearFilters() {
    [filterSearch, filterCategory, filterCurrency, filterFrom, filterTo].forEach((el) => { el.value = ''; });
    applyFilters();
  }
  clearFiltersBtn.addEventListener('click', clearFilters);

  // Descarga el historial (con los filtros activos) como CSV
  exportCsvBtn.addEventListener('click', async () => {
    const originalLabel = exportCsvBtn.innerHTML;
    exportCsvBtn.disabled = true;
    exportCsvBtn.textContent = 'Exportando…';

    try {
      const rows = [];
      for (let offset = 0; offset < EXPORT_MAX_ROWS; offset += EXPORT_CHUNK) {
        const { data, error } = await buildExpenseQuery().range(offset, offset + EXPORT_CHUNK - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < EXPORT_CHUNK) break;
      }

      if (!rows.length) {
        showToast('No hay gastos que exportar con los filtros actuales.', 'info');
        return;
      }

      const csv = toCsv(rows, [
        { key: 'date', label: 'Fecha' },
        { key: 'time', label: 'Hora' },
        { key: 'concept', label: 'Concepto' },
        { key: 'category', label: 'Categoría' },
        { key: 'amount', label: 'Monto' },
        { key: 'currency', label: 'Moneda' }
      ]);

      // BOM para que Excel detecte UTF-8 (tildes, ñ)
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `apex-gastos-${getLocalDateString()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast(`Exportados ${rows.length} gastos a CSV.`, 'success');
    } catch (error) {
      console.error('Error exportando CSV:', error);
      showToast('Fallo al exportar: ' + error.message, 'error');
    } finally {
      exportCsvBtn.disabled = false;
      exportCsvBtn.innerHTML = originalLabel;
    }
  });

  // ============================================================
  //  CREAR GASTO
  // ============================================================

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

    // Validar el voucher (tipo y tamaño) antes de subirlo a Storage
    if (file) {
      const { valid: fileValid, error: fileError } = validateVoucherFile(file);
      if (!fileValid) {
        showToast(fileError, 'error');
        return;
      }
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

        // 2. Guardar la URL canónica (contiene el path). El bucket es privado:
        // para VER el voucher se genera una URL firmada al momento (ver el
        // handler de .view-img-btn), derivando el path desde este valor.
        const { data: urlData } = supabase.storage
          .from('vouchers')
          .getPublicUrl(uploadedFilePath);

        imageUrl = urlData.publicUrl;
      }

      // 3. Guardar registro en la base de datos relacional
      const { error: dbError } = await supabase
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

      // 4. Refrescar totales y tabla desde el servidor (respeta filtros activos)
      form.reset();
      fileNameDisplay.textContent = 'Ningún archivo seleccionado';
      fileNameDisplay.classList.add('hidden');
      if (uploadZone) uploadZone.classList.remove('has-file');
      document.getElementById('category').value = 'Otros';
      initDateAndTime();

      await Promise.all([fetchSummary(), fetchExpensesPage({ reset: true, silent: true })]);
      showToast('Gasto registrado.', 'success');

    } catch (error) {
      console.error('Error procesando el gasto:', error);
      showToast('Fallo al guardar: ' + error.message, 'error');
    } finally {
      submitBtn.textContent = 'Guardar Registro';
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    }
  });

  // ============================================================
  //  EDITAR GASTO
  // ============================================================

  let editingId = null;

  function openEditModal(exp) {
    editingId = exp.id;
    document.getElementById('edit-concept').value = exp.concept;
    document.getElementById('edit-category').value = exp.category || 'Otros';
    document.getElementById('edit-amount').value = parseFloat(exp.amount);
    document.getElementById('edit-currency').value = CURRENCIES[exp.currency] ? exp.currency : 'USD';
    document.getElementById('edit-date').value = exp.date;
    document.getElementById('edit-time').value = String(exp.time).slice(0, 5);
    openModal(editModal);
  }

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (editingId == null) return;

    const updated = {
      concept: document.getElementById('edit-concept').value,
      category: document.getElementById('edit-category').value,
      amount: parseFloat(document.getElementById('edit-amount').value),
      currency: document.getElementById('edit-currency').value,
      date: document.getElementById('edit-date').value,
      time: document.getElementById('edit-time').value
    };

    const { valid, error: validationError } = validateExpenseInput(updated);
    if (!valid) {
      showToast(validationError, 'error');
      return;
    }

    const saveBtn = document.getElementById('edit-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando…';

    try {
      const { data, error } = await supabase
        .from('expenses')
        .update(updated)
        .eq('id', editingId)
        .select();
      if (error) throw error;

      // Actualizar la fila en la lista cargada y los agregados
      const idx = expenses.findIndex((exp) => String(exp.id) === String(editingId));
      if (idx !== -1 && data && data[0]) expenses[idx] = data[0];
      renderTable();
      fetchSummary();

      closeActiveModal();
      showToast('Gasto actualizado.', 'success');
    } catch (error) {
      console.error('Error actualizando el gasto:', error);
      showToast('Fallo al actualizar: ' + error.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar Cambios';
      editingId = null;
    }
  });

  // ============================================================
  //  ACCIONES DE LA TABLA (delegación de eventos)
  // ============================================================

  tableBody.addEventListener('click', async (e) => {
    // CTA del empty state → llevar al formulario
    if (e.target.closest('#empty-cta')) {
      document.getElementById('upload-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('concept').focus({ preventScroll: true });
      return;
    }
    if (e.target.closest('#empty-clear-filters')) {
      clearFilters();
      return;
    }

    // Ver Imagen: el bucket es privado, así que se pide una URL firmada
    // temporal. Funciona igual con las URLs públicas históricas porque el
    // path se deriva del valor guardado en image_url.
    const viewImgBtn = e.target.closest('.view-img-btn');
    if (viewImgBtn) {
      const imgData = viewImgBtn.getAttribute('data-img');
      const path = voucherPathFromUrl(imgData);
      if (!path) {
        showToast('No se pudo mostrar el voucher: URL no válida.', 'error');
        return;
      }
      const { data: signed, error: signError } = await supabase.storage
        .from('vouchers')
        .createSignedUrl(path, 60 * 60); // válida 1 hora

      const url = signed?.signedUrl;
      // Sólo abrir URLs https del dominio de Supabase (anti URL injection)
      if (!signError && isValidVoucherUrl(url, SUPABASE_URL)) {
        modalImg.src = url;
        openModal(modal);
      } else {
        console.error('Error firmando URL del voucher:', signError);
        showToast('No se pudo mostrar el voucher.', 'error');
      }
      return;
    }

    // Editar Registro
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      const exp = expenses.find((item) => String(item.id) === id);
      if (exp) openEditModal(exp);
      return;
    }

    // Eliminar Registro
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const confirmDelete = await confirmDialog('El registro se borrará de la base de datos permanentemente.');
      if (!confirmDelete) return;

      deleteBtn.innerHTML = '<span class="spinner-inline"></span>';
      deleteBtn.disabled = true;

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) {
        showToast('Error al borrar: ' + error.message, 'error');
        renderTable();
      } else {
        // Buscar el gasto localmente
        const expToDelete = expenses.find(exp => String(exp.id) === id);

        // Si el gasto tiene imagen asociada en Storage, eliminarla
        if (expToDelete && expToDelete.image_url) {
          try {
            const filePath = voucherPathFromUrl(expToDelete.image_url);
            if (filePath) {
              await supabase.storage.from('vouchers').remove([filePath]);
            }
          } catch (storageErr) {
            console.error('Error al borrar la imagen de storage:', storageErr);
          }
        }

        expenses = expenses.filter(exp => String(exp.id) !== id);
        tableOffset = Math.max(0, tableOffset - 1);
        renderTable();
        fetchSummary();
      }
    }
  });

  // ============================================================
  //  GRÁFICOS (instancias persistentes, se actualizan con update())
  // ============================================================

  // Serie por día del mes actual a partir del RPC (summary.by_date)
  function buildLineData() {
    const rows = summary?.by_date || [];
    const byCurrency = { USD: {}, PEN: {} };
    rows.forEach((row) => {
      const code = CURRENCIES[row.currency] ? row.currency : 'USD';
      byCurrency[code][row.date] = (byCurrency[code][row.date] || 0) + (parseFloat(row.total) || 0);
    });
    const allDates = Array.from(new Set(rows.map((row) => row.date))).sort();
    return {
      allDates,
      labels: allDates.map((date) => date.slice(8, 10)), // Mostrar solo el día
      usd: allDates.map((d) => byCurrency.USD[d] || 0),
      pen: allDates.map((d) => byCurrency.PEN[d] || 0)
    };
  }

  function renderChart() {
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const { allDates, labels, usd, pen } = buildLineData();
    chartAllDates = allDates;

    // Actualizar en sitio si el chart ya existe (sin destroy/recrear)
    if (expenseChartInstance) {
      expenseChartInstance.data.labels = labels;
      expenseChartInstance.data.datasets[0].data = usd;
      expenseChartInstance.data.datasets[1].data = pen;
      expenseChartInstance.update();
      return;
    }

    // Relleno en gradiente carmesí (USD) y azul (PEN)
    const fillUSD = ctx.createLinearGradient(0, 0, 0, 260);
    fillUSD.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
    fillUSD.addColorStop(1, 'rgba(239, 68, 68, 0)');
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

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    expenseChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Dólares ($)', data: usd, borderColor: '#ef4444', backgroundColor: fillUSD, pointBorderColor: '#ef4444', ...pointBase },
          { label: 'Soles (S/)', data: pen, borderColor: '#3b82f6', backgroundColor: fillPEN, pointBorderColor: '#3b82f6', ...pointBase }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
              // chartAllDates se actualiza en cada render; el closure lo lee vivo
              title: (tooltipItems) => `Día: ${chartAllDates[tooltipItems[0].dataIndex]}`,
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
      }
    });
  }

  // Lógica de pestañas de gráficos (Evolución / Categorías)
  const chartTabs = document.querySelectorAll('.chart-tab');
  const lineCanvas = document.getElementById('expenseChart');
  const donutCanvas = document.getElementById('categoryChart');

  chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      chartTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

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

    // Totales del mes por categoría en la moneda activa (desde el RPC)
    const rows = (summary?.by_category || []).filter((row) => row.currency === activeCurrency);
    const aggregated = {};
    rows.forEach((row) => {
      const cat = row.category || 'Otros';
      aggregated[cat] = (aggregated[cat] || 0) + (parseFloat(row.total) || 0);
    });

    const labels = Object.keys(aggregated);
    const dataPoints = Object.values(aggregated);

    const colors = {
      Alimentación: '#fb7185',
      Transporte: '#3b82f6',
      Servicios: '#f59e0b',
      Suscripciones: '#8b5cf6',
      Oficina: '#ef4444',
      Otros: '#9ca3af'
    };

    const bgColors = labels.map(label => colors[label] || '#9ca3af');

    // Actualizar en sitio si la dona ya existe
    if (categoryChartInstance) {
      categoryChartInstance.data.labels = labels;
      categoryChartInstance.data.datasets[0].data = dataPoints;
      categoryChartInstance.data.datasets[0].backgroundColor = bgColors;
      categoryChartInstance.update();
      return;
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
              // Lee activeCurrency vivo: la dona siempre muestra la moneda activa
              label: (context) => ` ${context.label}: ${CURRENCIES[activeCurrency].symbol}${context.raw.toFixed(2)}`
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // ============================================================
  //  PRESUPUESTOS
  // ============================================================

  const openBudgetBtn = document.getElementById('open-budget-btn');
  const budgetForm = document.getElementById('budget-form');

  if (openBudgetBtn && budgetModal && budgetForm) {
    openBudgetBtn.addEventListener('click', () => {
      document.getElementById('budget-usd').value = userBudgets.USD;
      document.getElementById('budget-pen').value = userBudgets.PEN;
      openModal(budgetModal);
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

        closeActiveModal();
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
