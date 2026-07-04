(function () {
  const translations = {
    es: {
      // Pantalla de Autenticación
      "auth_title_login": "Iniciar Sesión",
      "auth_title_register": "Crear Cuenta",
      "auth_subtitle": "Tablero financiero corporativo",
      "header_title": "Resumen de Gastos",
      "header_subtitle": "Control de vouchers y gastos operativos",
      "auth_email_label": "Correo Electrónico",
      "auth_password_label": "Contraseña",
      "auth_btn_login": "Entrar",
      "auth_btn_register": "Registrarse",
      "auth_switch_login": "¿No tienes cuenta? ",
      "auth_switch_register": "¿Ya tienes cuenta? ",
      "auth_link_login": "Inicia sesión aquí",
      "auth_link_register": "Regístrate aquí",
      "auth_google_btn": "Entrar con Google",

      // Sidebar
      "nav_profile": "Perfil",
      "nav_logout": "Cerrar Sesión",
      "nav_dashboard": "Panel Principal",
      "nav_upload": "Subir Voucher",
      "nav_history": "Historial",
      "nav_role_admin": "Administrador",

      // KPIs Principales
      "kpi_daily_title": "Gasto Diario",
      "kpi_weekly_title": "Gasto Semanal",
      "kpi_monthly_title": "Gasto Mensual",
      "kpi_consumed": "consumido",
      "kpi_remaining": "restante",
      "cat_Alimentación": "Alimentación",
      "cat_Transporte": "Transporte",
      "cat_Servicios": "Servicios",
      "cat_Suscripciones": "Suscripciones",
      "cat_Oficina": "Oficina",
      "cat_Otros": "Otros",

      // Formulario de Registro
      "form_title": "Registrar Nuevo Gasto",
      "form_concept_label": "Concepto del Gasto",
      "form_concept_placeholder": "Ej. Almuerzo de negocios",
      "form_category_label": "Categoría",
      "form_amount_label": "Monto",
      "form_currency_label": "Moneda",
      "form_date_label": "Fecha",
      "form_time_label": "Hora",
      "form_voucher_label": "Subir Imagen del Voucher",
      "form_voucher_optional": "(opcional)",
      "form_voucher_text": "Arrastra tu voucher aquí o <span>haz clic para buscar</span>",
      "form_voucher_subtext": "Formatos permitidos: PNG, JPG, JPEG. Máx 5MB",
      "form_save_btn": "Guardar Registro",

      // Sección de Gráficos e Insights
      "chart_title": "Análisis Mensual",
      "chart_tab_trend": "📈 Evolución",
      "chart_tab_categories": "🍩 Categorías",
      "insight_monthly_total": "Consumo Mensual",
      "insight_top_category": "Categoría Principal",
      "insight_peak_day": "Día Pico de Gasto",
      "insight_average": "Promedio Diario",
      "insight_none": "Ninguna",

      // Sección de Límites y Metas
      "limits_title": "Límites por Categoría",
      "limits_subtitle": "Límites mensuales y consumo en la moneda activa actual",
      "limits_empty": "No has configurado límites por categoría. Configúralos en el botón del KPI de Gasto Mensual.",
      "limits_empty_currency": "No has configurado límites por categoría para <strong>{currency}</strong>.",
      "goals_title": "Metas de Ahorro",
      "goals_btn_new": "+ Nueva Meta",
      "goals_subtitle": "Ahorros para objetivos de mediano y largo plazo",
      "goals_empty": "No tienes metas de ahorro registradas. ¡Crea una para comenzar!",
      "goals_empty_currency": "No tienes metas de ahorro en <strong>{currency}</strong>. ¡Crea una para comenzar!",
      "goals_saved": "Ahorrado: ",
      "goals_target": "Objetivo: ",
      "goals_completed": "completado",

      // Historial y Tabla
      "history_title": "Historial de Transacciones",
      "history_btn_pdf": "Exportar PDF",
      "history_btn_csv": "Exportar CSV",
      "history_search_placeholder": "Buscar concepto…",
      "history_cat_all": "Todas las categorías",
      "history_curr_all": "Ambas monedas",
      "history_curr_usd": "Dólares ($)",
      "history_curr_pen": "Soles (S/)",
      "history_col_date": "Fecha & Hora",
      "history_col_concept": "Concepto",
      "history_col_amount": "Monto",
      "history_col_currency": "Moneda",
      "history_col_voucher": "Voucher",
      "history_col_action": "Acción",
      "history_empty_title": "Aún no hay gastos registrados",
      "history_empty_hint": "Registra tu primer gasto y empieza a ver tus métricas.",
      "history_empty_cta": "Registrar mi primer gasto",
      "history_empty_filters_title": "Sin resultados para estos filtros",
      "history_empty_filters_hint": "Prueba con otro término o rango de fechas.",
      "history_btn_clear": "Limpiar filtros",

      // Modales - Presupuesto
      "modal_budget_title": "Presupuesto Mensual",
      "modal_budget_subtitle": "Establece los límites mensuales para controlar tus gastos",
      "modal_budget_usd": "Presupuesto Global USD ($)",
      "modal_budget_pen": "Presupuesto Global PEN (S/)",
      "modal_budget_cat_title": "Presupuestos por Categoría",
      "modal_budget_cat_hint": "Límites para categorías específicas en la moneda activa (vacío = sin límite)",
      "modal_budget_save": "Guardar Límites",

      // Modales - Metas de Ahorro
      "modal_goal_title_new": "Nueva Meta de Ahorro",
      "modal_goal_title_edit": "Editar Meta de Ahorro",
      "modal_goal_subtitle": "Define un objetivo financiero para motivar tus ahorros",
      "modal_goal_name": "Nombre de la Meta",
      "modal_goal_target": "Monto Objetivo",
      "modal_goal_currency": "Moneda",
      "modal_goal_saved": "Monto Ahorrado Inicial",
      "modal_goal_save": "Guardar Meta",

      // Modales - Abono
      "modal_contrib_title": "Abonar a la Meta",
      "modal_contrib_subtitle": "Registra un depósito o ahorro acumulado para esta meta",
      "modal_contrib_amount": "Monto a Añadir",
      "modal_contrib_save": "Abonar Ahorro",

      // Modales - Confirmación
      "modal_confirm_title": "Confirmación requerida",
      "modal_confirm_accept": "Aceptar",
      "modal_confirm_cancel": "Cancelar",

      // Toasts
      "toast_save_success": "Registro guardado con éxito.",
      "toast_save_error": "Fallo al guardar registro: ",
      "toast_delete_success": "Gasto eliminado.",
      "toast_delete_error": "Fallo al eliminar: ",
      "toast_budget_success": "Presupuestos actualizados con éxito.",
      "toast_budget_error": "Fallo al guardar límites: ",
      "toast_goal_create": "Meta de ahorro creada con éxito.",
      "toast_goal_edit": "Meta de ahorro modificada.",
      "toast_goal_delete": "Meta de ahorro eliminada.",
      "toast_contrib_success": "Abono registrado con éxito. ¡Sigue así!",
      "toast_auth_error": "Error de autenticación: ",
      "toast_google_error": "Error al entrar con Google: ",
      "toast_voucher_success": "Voucher subido correctamente.",
      "toast_voucher_invalid": "Archivo no permitido. Sube PNG, JPG, JPEG de máx 5MB.",
      "confirm_delete_goal": "¿Estás seguro de que deseas eliminar la meta \"{name}\"?",
      "saving": "Guardando...",
      "save_changes": "Guardar Cambios",
      "exporting": "Exportando...",
      "toast_expense_registered": "Gasto registrado.",
      "toast_expense_updated": "Gasto actualizado.",
      "toast_expense_update_error": "Fallo al actualizar: ",
      "toast_no_expenses_export": "No hay gastos que exportar con los filtros actuales.",
      "toast_exported_csv": "Exportados {count} gastos a CSV.",
      "toast_export_error": "Fallo al exportar: "
    },
    en: {
      // Authentication Screen
      "auth_title_login": "Sign In",
      "auth_title_register": "Create Account",
      "auth_subtitle": "Corporate financial dashboard",
      "header_title": "Expense Summary",
      "header_subtitle": "Voucher control and operating expenses",
      "auth_email_label": "Email Address",
      "auth_password_label": "Password",
      "auth_btn_login": "Sign In",
      "auth_btn_register": "Register",
      "auth_switch_login": "Don't have an account? ",
      "auth_switch_register": "Already have an account? ",
      "auth_link_login": "Sign in here",
      "auth_link_register": "Sign up here",
      "auth_google_btn": "Sign in with Google",

      // Sidebar
      "nav_profile": "Profile",
      "nav_logout": "Sign Out",
      "nav_dashboard": "Dashboard",
      "nav_upload": "Upload Voucher",
      "nav_history": "History",
      "nav_role_admin": "Administrator",

      // Main KPIs
      "kpi_daily_title": "Daily Spend",
      "kpi_weekly_title": "Weekly Spend",
      "kpi_monthly_title": "Monthly Spend",
      "kpi_consumed": "consumed",
      "kpi_remaining": "remaining",
      "cat_Alimentación": "Food",
      "cat_Transporte": "Transportation",
      "cat_Servicios": "Services",
      "cat_Suscripciones": "Subscriptions",
      "cat_Oficina": "Office",
      "cat_Otros": "Others",

      // Registration Form
      "form_title": "Register New Expense",
      "form_concept_label": "Expense Concept",
      "form_concept_placeholder": "E.g. Business lunch",
      "form_category_label": "Category",
      "form_amount_label": "Amount",
      "form_currency_label": "Currency",
      "form_date_label": "Date",
      "form_time_label": "Time",
      "form_voucher_label": "Upload Voucher Image",
      "form_voucher_optional": "(optional)",
      "form_voucher_text": "Drag your voucher here or <span>click to browse</span>",
      "form_voucher_subtext": "Allowed formats: PNG, JPG, JPEG. Max 5MB",
      "form_save_btn": "Save Record",

      // Chart Section & Insights
      "chart_title": "Monthly Analysis",
      "chart_tab_trend": "📈 Evolution",
      "chart_tab_categories": "🍩 Categories",
      "insight_monthly_total": "Monthly Spend",
      "insight_top_category": "Top Category",
      "insight_peak_day": "Peak Spend Day",
      "insight_average": "Daily Average",
      "insight_none": "None",

      // Limits & Goals Section
      "limits_title": "Limits by Category",
      "limits_subtitle": "Monthly limits and consumption in current active currency",
      "limits_empty": "You have not configured category limits. Set them using the Monthly Spend KPI button.",
      "limits_empty_currency": "You have not configured category limits for <strong>{currency}</strong>.",
      "goals_title": "Savings Goals",
      "goals_btn_new": "+ New Goal",
      "goals_subtitle": "Savings for medium and long-term objectives",
      "goals_empty": "No savings goals registered. Create one to start!",
      "goals_empty_currency": "No savings goals in <strong>{currency}</strong>. Create one to start!",
      "goals_saved": "Saved: ",
      "goals_target": "Target: ",
      "goals_completed": "completed",

      // History & Table
      "history_title": "Transaction History",
      "history_btn_pdf": "Export PDF",
      "history_btn_csv": "Export CSV",
      "history_search_placeholder": "Search concept…",
      "history_cat_all": "All categories",
      "history_curr_all": "Both currencies",
      "history_curr_usd": "Dollars ($)",
      "history_curr_pen": "Soles (S/)",
      "history_col_date": "Date & Time",
      "history_col_concept": "Concept",
      "history_col_amount": "Amount",
      "history_col_currency": "Currency",
      "history_col_voucher": "Voucher",
      "history_col_action": "Action",
      "history_empty_title": "No expenses registered yet",
      "history_empty_hint": "Record your first expense and start tracking your metrics.",
      "history_empty_cta": "Register my first expense",
      "history_empty_filters_title": "No results for these filters",
      "history_empty_filters_hint": "Try another search term or date range.",
      "history_btn_clear": "Clear filters",

      // Modales - Budget
      "modal_budget_title": "Monthly Budget",
      "modal_budget_subtitle": "Set monthly limits to control your spend",
      "modal_budget_usd": "Global Budget USD ($)",
      "modal_budget_pen": "Global Budget PEN (S/)",
      "modal_budget_cat_title": "Budgets by Category",
      "modal_budget_cat_hint": "Limits for specific categories in active currency (empty = unlimited)",
      "modal_budget_save": "Save Limits",

      // Modales - Savings Goals
      "modal_goal_title_new": "New Savings Goal",
      "modal_goal_title_edit": "Edit Savings Goal",
      "modal_goal_subtitle": "Define a financial objective to motivate your savings",
      "modal_goal_name": "Goal Name",
      "modal_goal_target": "Target Amount",
      "modal_goal_currency": "Currency",
      "modal_goal_saved": "Initial Saved Amount",
      "modal_goal_save": "Save Goal",

      // Modales - Contribution
      "modal_contrib_title": "Add to Goal",
      "modal_contrib_subtitle": "Record a deposit or savings progress for this goal",
      "modal_contrib_amount": "Amount to Add",
      "modal_contrib_save": "Deposit Savings",

      // Modales - Confirmation
      "modal_confirm_title": "Confirmation required",
      "modal_confirm_accept": "Accept",
      "modal_confirm_cancel": "Cancel",

      // Toasts
      "toast_save_success": "Record saved successfully.",
      "toast_save_error": "Failed to save record: ",
      "toast_delete_success": "Expense deleted.",
      "toast_delete_error": "Failed to delete: ",
      "toast_budget_success": "Budgets updated successfully.",
      "toast_budget_error": "Failed to save limits: ",
      "toast_goal_create": "Savings goal created successfully.",
      "toast_goal_edit": "Savings goal modified.",
      "toast_goal_delete": "Savings goal deleted.",
      "toast_contrib_success": "Contribution registered successfully. Keep it up!",
      "toast_auth_error": "Authentication error: ",
      "toast_google_error": "Google sign in error: ",
      "toast_voucher_success": "Voucher uploaded successfully.",
      "toast_voucher_invalid": "File type not allowed. Upload PNG, JPG, JPEG of max 5MB.",
      "confirm_delete_goal": "Are you sure you want to delete the goal \"{name}\"?",
      "saving": "Saving...",
      "save_changes": "Save Changes",
      "exporting": "Exporting...",
      "toast_expense_registered": "Expense registered.",
      "toast_expense_updated": "Expense updated.",
      "toast_expense_update_error": "Failed to update: ",
      "toast_no_expenses_export": "No expenses to export with current filters.",
      "toast_exported_csv": "Exported {count} expenses to CSV.",
      "toast_export_error": "Failed to export: "
    }
  };

  const LANG_STORAGE_KEY = 'apex-language';
  let currentLang = window.localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'es';

  function translate(key, variables = {}) {
    let text = translations[currentLang][key] || translations['es'][key] || key;
    // Sustituir variables tipo {variableName}
    Object.keys(variables).forEach(varKey => {
      text = text.replace(new RegExp(`{${varKey}}`, 'g'), variables[varKey]);
    });
    return text;
  }

  function setLanguage(lang) {
    if (lang === 'en' || lang === 'es') {
      currentLang = lang;
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    }

    // Buscar y traducir todos los elementos estáticos con data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[currentLang][key]) {
        // Preservar estructura interna si tiene HTML (por ejemplo el botón de arrastrar voucher)
        if (el.querySelector('span') || el.querySelector('svg')) {
          const originalSpan = el.querySelector('span');
          const originalSvg = el.querySelector('svg');
          el.textContent = translations[currentLang][key]; // resetea
          
          // Re-inyectar estructuras
          const newTranslatedText = translations[currentLang][key];
          if (newTranslatedText.includes('<span>') && originalSpan) {
            el.innerHTML = newTranslatedText.replace('<span>', '<span>').replace('</span>', '</span>');
          }
          if (originalSvg) {
            el.insertAdjacentElement('afterbegin', originalSvg);
          }
        } else {
          el.textContent = translations[currentLang][key];
        }
      }
    });

    // Traducir todos los placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (translations[currentLang][key]) {
        el.setAttribute('placeholder', translations[currentLang][key]);
      }
    });

    // Traducir todos los titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (translations[currentLang][key]) {
        el.setAttribute('title', translations[currentLang][key]);
      }
    });

    // Emitir evento global de cambio de idioma
    const event = new CustomEvent('apex-language-changed', { detail: { lang: currentLang } });
    window.dispatchEvent(event);
  }

  function getCurrentLanguage() {
    return currentLang;
  }

  // Exponer API global
  window.APEX = window.APEX || {};
  window.APEX.i18n = {
    translate,
    setLanguage,
    getCurrentLanguage,
    translations
  };
})();
