// APEX Core Logic - Supabase Integration + Auth
document.addEventListener('DOMContentLoaded', () => {

  // 🔴 CLAVES DE SUPABASE 🔴
  const SUPABASE_URL = 'https://lkndwsolpimmezdshgpx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_616dQHKwWWKMRaXe7zcv3Q_L7Wd6Ek0';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Estado de sesión
  let currentUser = null;
  let isLoginMode = true; // true = Login, false = Register

  // Estado del dashboard
  let expenses = [];
  let expenseChartInstance = null;

  // Catálogo de monedas soportadas
  const CURRENCIES = {
    USD: { label: 'Dólares', symbol: '$' },
    PEN: { label: 'Soles', symbol: 'S/' }
  };

  // Elementos Auth
  const authScreen = document.getElementById('auth-screen');
  const mainDashboard = document.getElementById('main-dashboard');
  const authForm = document.getElementById('auth-form');
  const toggleAuthBtn = document.getElementById('toggle-auth');
  const authTitle = document.getElementById('auth-title');
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

  // ============================================================
  //  AUTENTICACIÓN
  // ============================================================

  // Comprobar sesión activa al cargar
  checkSession();

  // Cambiar entre Login y Registro
  toggleAuthBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    authTitle.textContent = isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta';
    authSubmitBtn.textContent = isLoginMode ? 'Entrar' : 'Registrarse';
    toggleAuthBtn.textContent = isLoginMode ? 'Regístrate aquí' : 'Inicia sesión aquí';
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
        // Registro de nuevo amigo
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Registro exitoso. Si Supabase requiere confirmación, revisa tu correo. Si no, ya puedes iniciar sesión.');
        isLoginMode = false; // toggleAuthBtn.click() lo pondrá en Login
        toggleAuthBtn.click();
      }
    } catch (error) {
      alert('Error de autenticación: ' + error.message);
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
    authScreen.classList.add('hidden');
    mainDashboard.classList.remove('hidden');
    userEmailDisplay.textContent = currentUser.email;
    initDashboard(); // Carga fecha/hora y datos
  }

  function hideDashboard() {
    authScreen.classList.remove('hidden');
    mainDashboard.classList.add('hidden');
    authForm.reset();
    form.reset();
    fileNameDisplay.textContent = 'Ningún archivo seleccionado';
    tableBody.innerHTML = ''; // Limpiar datos de la vista
  }

  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  // Actualizar nombre de archivo seleccionado en input
  voucherInput.addEventListener('change', () => {
    const file = voucherInput.files[0];
    if (file) {
      fileNameDisplay.textContent = file.name;
    } else {
      fileNameDisplay.textContent = 'Ningún archivo seleccionado';
    }
  });

  // ============================================================
  //  DASHBOARD
  // ============================================================

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

  // 📡 Obtener datos de Supabase
  async function fetchExpenses() {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando base de datos cloud... ⚡</td></tr>';

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) {
      console.error('Error fetching data:', error);
      tableBody.innerHTML = '<tr><td colspan="6" style="color:var(--danger); text-align:center;">Error de conexión. Revisa tus claves.</td></tr>';
      return;
    }

    expenses = data;
    updateUI();
  }

  // 📤 Enviar formulario y subir a Cloud
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const concept = document.getElementById('concept').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const currency = document.getElementById('currency').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const file = voucherInput.files[0];

    // El voucher es OPCIONAL: si no hay archivo, se guarda sin imagen.

    // Estado de carga (UX)
    submitBtn.textContent = 'Procesando en la Nube... ⚡';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';

    try {
      let imageUrl = null;
      let uploadedFilePath = null;

      // 1. Subir imagen a Supabase Storage SOLO si se adjuntó un archivo
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        uploadedFilePath = `${currentUser.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('vouchers')
          .upload(uploadedFilePath, file);

        if (uploadError) throw uploadError;

        // 2. Obtener URL pública de la imagen
        const { data: urlData } = supabase.storage
          .from('vouchers')
          .getPublicUrl(uploadedFilePath);

        imageUrl = urlData.publicUrl;
      }

      // 3. Guardar registro en la base de datos relacional
      //    user_id explícito = usuario de la sesión, para cumplir la
      //    política RLS (auth.uid() = user_id) sin depender del default.
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
  });

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

        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', id);

        if (error) {
          alert('Error al borrar: ' + error.message);
          e.target.textContent = 'X';
          e.target.disabled = false;
        } else {
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
  }

  function renderTable() {
    tableBody.innerHTML = '';

    if (expenses.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No hay gastos registrados aún.</td></tr>';
      return;
    }

    expenses.forEach((exp, i) => {
      const cur = CURRENCIES[exp.currency] || CURRENCIES.USD;
      const tr = document.createElement('tr');
      tr.className = 'row-anim';
      tr.style.animationDelay = `${Math.min(i * 0.04, 0.4)}s`;
      tr.innerHTML = `
                <td>${exp.date} <br><small style="color: var(--text-muted)">${exp.time}</small></td>
                <td>${exp.concept}</td>
                <td style="color: var(--accent); font-weight: 600;">${cur.symbol}${parseFloat(exp.amount).toFixed(2)}</td>
                <td><span class="currency-tag">${cur.label}</span></td>
                <td>
                    ${exp.image_url
          ? `<button class="view-img-btn" data-img="${exp.image_url}">Ver Voucher</button>`
          : `<span class="no-voucher">Sin voucher</span>`}
                </td>
                <td>
                    <button class="delete-btn" data-id="${exp.id}">X</button>
                </td>
            `;
      tableBody.appendChild(tr);
    });
  }

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

  // Convierte { USD, PEN } en texto, mostrando sólo las monedas con monto
  function formatTotals(totals) {
    const parts = Object.keys(totals)
      .filter(code => totals[code] > 0)
      .map(code => `${CURRENCIES[code].symbol}${totals[code].toFixed(2)}`);
    return parts.length ? parts.join('  ·  ') : '$0.00';
  }

  // Anima de 0 al valor (count-up), respetando multi-moneda y reduced-motion
  function animateTotals(elId, totals) {
    const el = document.getElementById(elId);
    if (!el) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.innerText = formatTotals(totals); return; }

    const duration = 900;
    const start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3); // easeOutCubic

    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const e = ease(p);
      const interp = {};
      Object.keys(totals).forEach(code => { interp[code] = totals[code] * e; });
      el.innerText = formatTotals(interp);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

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
});
