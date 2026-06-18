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
  const uploadZone = document.getElementById('upload-zone');

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
        alert('Registro exitoso. Si Supabase requiere confirmación, revisa tu correo. Si no, ya puedes iniciar sesión.');
        isLoginMode = false;
        // Simular click para volver al login con la animación
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
    await fetchExpenses();
  }

  function initDateAndTime() {
    const now = new Date();
    document.getElementById('date').value = getLocalDateString(now);
    document.getElementById('time').value = now.toTimeString().slice(0, 5);
  }

  function getLocalDateString(d = new Date()) {
    return d.toLocaleDateString('sv');
  }

  // Obtener datos de Supabase
  async function fetchExpenses() {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px 0;">Cargando base de datos cloud... ⚡</td></tr>';

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) {
      console.error('Error fetching data:', error);
      tableBody.innerHTML = '<tr><td colspan="6" style="color:var(--danger); text-align:center; padding: 24px 0;">Error de conexión. Revisa tus claves.</td></tr>';
      return;
    }

    expenses = data;
    updateUI();
  }

  // Enviar formulario y subir a Cloud
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const concept = document.getElementById('concept').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const currency = document.getElementById('currency').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const file = voucherInput.files[0];

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
      
      updateUI();
      initDateAndTime();

    } catch (error) {
      console.error('Error procesando el gasto:', error);
      alert('Fallo al guardar: ' + error.message);
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
      modalImg.src = imgData;
      modal.classList.remove('hidden');
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
          alert('Error al borrar: ' + error.message);
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

    expenses.forEach((exp, i) => {
      const cur = CURRENCIES[exp.currency] || CURRENCIES.USD;
      const tr = document.createElement('tr');
      tr.className = 'row-anim';
      tr.style.animationDelay = `${Math.min(i * 0.03, 0.3)}s`;
      tr.innerHTML = `
                <td>${exp.date} <br><small style="color: var(--text-faint)">${exp.time}</small></td>
                <td style="font-weight: 500;">${exp.concept}</td>
                <td style="color: var(--accent-bright); font-weight: 600;">${cur.symbol}${parseFloat(exp.amount).toFixed(2)}</td>
                <td><span class="currency-tag">${cur.label}</span></td>
                <td>
                    ${exp.image_url
          ? `<button class="view-img-btn" data-img="${exp.image_url}">Ver Voucher</button>`
          : `<span class="no-voucher">Sin voucher</span>`}
                </td>
                <td>
                    <button class="delete-btn" data-id="${exp.id}" title="Eliminar registro">${deleteIcon}</button>
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

  // Anima de 0 al valor (count-up)
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
    const canvas = document.getElementById('expenseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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
    const fillUSD = ctx.createLinearGradient(0, 0, 0, 260);
    fillUSD.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
    fillUSD.addColorStop(1, 'rgba(16, 185, 129, 0)');

    // Relleno en gradiente azul (PEN)
    const fillPEN = ctx.createLinearGradient(0, 0, 0, 260);
    fillPEN.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
    fillPEN.addColorStop(1, 'rgba(59, 130, 246, 0)');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    expenseChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allDates.map(date => date.slice(8, 10)), // Mostrar solo el día
        datasets: [
          {
            label: 'Dólares ($)',
            data: usdPoints,
            borderColor: '#10b981',
            backgroundColor: fillUSD,
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#121318',
            pointBorderColor: '#10b981',
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
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#121318',
            pointBorderColor: '#3b82f6',
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
      }
    });
  }
});
