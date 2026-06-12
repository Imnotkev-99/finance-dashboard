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
    tableBody.innerHTML = ''; // Limpiar datos de la vista
  }

  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  // ============================================================
  //  DASHBOARD
  // ============================================================

  async function initDashboard() {
    const now = new Date();
    document.getElementById('date').value = now.toISOString().split('T')[0];
    document.getElementById('time').value = now.toTimeString().slice(0, 5);

    // Cargar datos desde la nube
    await fetchExpenses();
  }

  // 📡 Obtener datos de Supabase
  async function fetchExpenses() {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando base de datos cloud... ⚡</td></tr>';

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) {
      console.error('Error fetching data:', error);
      tableBody.innerHTML = '<tr><td colspan="5" style="color:var(--danger); text-align:center;">Error de conexión. Revisa tus claves.</td></tr>';
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
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const file = voucherInput.files[0];

    if (!file) return alert('Por favor selecciona una imagen');

    // Estado de carga (UX)
    submitBtn.textContent = 'Procesando en la Nube... ⚡';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';

    try {
      // 1. Crear nombre único y subir imagen a Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('vouchers')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Obtener URL pública de la imagen
      const { data: urlData } = supabase.storage
        .from('vouchers')
        .getPublicUrl(filePath);

      const imageUrl = urlData.publicUrl;

      // 3. Guardar registro en la base de datos relacional
      const { data: newExpense, error: dbError } = await supabase
        .from('expenses')
        .insert([{
          concept,
          amount,
          date,
          time,
          image_url: imageUrl
        }])
        .select();

      if (dbError) throw dbError;

      // 4. Actualizar vista local
      expenses.unshift(newExpense[0]);
      form.reset();
      updateUI();

      // Resetear fecha y hora actual
      document.getElementById('date').value = new Date().toISOString().split('T')[0];
      document.getElementById('time').value = new Date().toTimeString().slice(0, 5);

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
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No hay gastos registrados aún.</td></tr>';
      return;
    }

    expenses.forEach(exp => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
                <td>${exp.date} <br><small style="color: var(--text-muted)">${exp.time}</small></td>
                <td>${exp.concept}</td>
                <td style="color: var(--accent); font-weight: 600;">$${parseFloat(exp.amount).toFixed(2)}</td>
                <td>
                    <button class="view-img-btn" data-img="${exp.image_url}">Ver Voucher</button>
                </td>
                <td>
                    <button class="delete-btn" data-id="${exp.id}">X</button>
                </td>
            `;
      tableBody.appendChild(tr);
    });
  }

  function calculateKPIs() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7);

    let daily = 0, weekly = 0, monthly = 0;

    expenses.forEach(exp => {
      const amt = parseFloat(exp.amount);
      if (exp.date === today) daily += amt;
      if (exp.date >= startOfWeek && exp.date <= today) weekly += amt;
      if (exp.date.startsWith(currentMonth)) monthly += amt;
    });

    document.getElementById('daily-total').innerText = `$${daily.toFixed(2)}`;
    document.getElementById('weekly-total').innerText = `$${weekly.toFixed(2)}`;
    document.getElementById('monthly-total').innerText = `$${monthly.toFixed(2)}`;
  }

  function renderChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthData = expenses.filter(exp => exp.date.startsWith(currentMonth));

    const aggregatedData = {};
    monthData.forEach(exp => {
      aggregatedData[exp.date] = (aggregatedData[exp.date] || 0) + parseFloat(exp.amount);
    });

    const labels = Object.keys(aggregatedData).sort();
    const dataPoints = labels.map(date => aggregatedData[date]);

    if (expenseChartInstance) {
      expenseChartInstance.destroy();
    }

    expenseChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Gasto Diario ($)',
          data: dataPoints,
          borderColor: '#00ffcc',
          backgroundColor: 'rgba(0, 255, 204, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#00ffcc',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#f8fafc' } } },
        scales: {
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }
});
