# Especificación de Diseño: Categorías y Control de Presupuestos en Supabase

Este documento detalla el diseño y la implementación para agregar categorización de gastos con gráficos interactivos y control de presupuestos mensuales sincronizados en Supabase dentro de **Apex Finance**.

---

## ⚠️ Requiere Revisión del Usuario

Para que la sincronización en la nube funcione correctamente, se deben aplicar las siguientes actualizaciones de esquema de base de datos en el SQL Editor de tu consola de Supabase.

### 1. Columna de Categoría en Tabla `expenses`
Agrega una columna de texto para guardar la categoría de cada gasto:
```sql
ALTER TABLE expenses 
ADD COLUMN category TEXT DEFAULT 'Otros' NOT NULL;
```

### 2. Tabla `budgets` para Presupuestos Mensuales
Crea una nueva tabla para almacenar los límites de presupuesto mensual por usuario y moneda:
```sql
CREATE TABLE budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  currency TEXT NOT NULL, -- 'USD' o 'PEN'
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_currency UNIQUE (user_id, currency)
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso para que los usuarios gestionen sus propios presupuestos
CREATE POLICY "Users can manage their own budgets" ON budgets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## Cambios Propuestos

### 1. Estructura y UI ([index.html](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/index.html))

* **Formulario de Registro**:
  * Añadir un campo de selección (`<select id="category">`) para elegir la categoría del gasto al guardar, justo debajo de la sección de Monto y Moneda.
* **Tarjeta de Análisis Gráfico**:
  * Crear cabeceras de pestañas (`.chart-tabs`) en la parte superior de la sección de análisis para alternar entre "📈 Evolución" (gráfico lineal) y "🍩 Categorías" (nuevo gráfico de dona).
  * Ocultar/mostrar los contenedores `<canvas id="expenseChart">` y el nuevo `<canvas id="categoryChart">` usando una clase `.hidden`.
* **Tarjeta KPI de Gasto Mensual**:
  * Incluir un botón flotante con el ícono de engranaje (⚙️) para configurar límites de presupuesto.
  * Añadir un contenedor de barra de progreso (`.budget-container`) debajo del total de gasto mensual.
* **Modal de Presupuesto**:
  * Crear un nuevo contenedor modal (`#budget-modal`) con campos de entrada para el presupuesto mensual en dólares (USD) y soles (PEN).

### 2. Estilos Visuales ([css/styles.css](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/css/styles.css))

* Estilos premium para las pestañas activas/inactivas (efectos de borde degradado y opacidad).
* Estilos para la barra de progreso del presupuesto (`.budget-bar`) con un fondo translúcido y una barra de progreso animada con gradiente dinámico (`linear-gradient(90deg, #10b981, #3b82f6)`).
* Clases de colores dinámicos para el progreso de la barra:
  * **Verde** (< 70%): Estado óptimo.
  * **Amarillo** (70% - 90%): Advertencia.
  * **Rojo** (> 90%): Presupuesto excedido o casi excedido.

### 3. Lógica de la Aplicación ([js/app.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/app.js))

* **Pestañas**:
  * Agregar manejadores de eventos click a las pestañas para cambiar la visibilidad de los canvas y redibujar el gráfico respectivo.
* **Registro de Gastos**:
  * Capturar el valor seleccionado de `#category` y agregarlo al objeto enviado en la consulta de inserción de Supabase.
* **Gráfico de Dona (Chart.js)**:
  * Agrupar localmente los gastos del mes corriente por categoría y moneda.
  * Inicializar y renderizar un gráfico de dona en `#categoryChart` utilizando paletas de colores predeterminadas por categoría.
* **Gestión de Presupuestos**:
  * Función `fetchBudgets()` que obtiene los presupuestos en dólares y soles del usuario desde Supabase al iniciar sesión. Si no existen, define valores predeterminados ($1000 USD y S/ 3000 PEN).
  * Función `updateBudgetUI()` que calcula el porcentaje de gasto del mes actual contra el presupuesto guardado y actualiza el ancho, color y texto de la barra de progreso en la tarjeta KPI.
  * Modal interactivo `#budget-modal` para enviar un upsert (guardar o actualizar) de los presupuestos de soles y dólares a Supabase.

---

## Plan de Verificación

### Pruebas Manuales
1. **Flujo de Base de Datos**: Registrar un gasto seleccionando una categoría y verificar en la tabla de Supabase que la columna `category` reciba el valor correcto.
2. **Interacción de Pestañas**: Alternar entre las pestañas "Evolución" y "Categorías" en la sección de análisis y comprobar que los gráficos de Chart.js carguen y respondan correctamente.
3. **Barra de Progreso y Alertas**: Guardar un presupuesto bajo (ej. $10 USD) y añadir un gasto de $9 USD. Verificar que la barra de progreso se pinte de color rojo indicando que se ha consumido más del 90% del presupuesto mensual.
4. **Sincronización**: Cambiar el presupuesto desde el modal y validar que al recargar la página persistan los mismos valores desde la base de datos de Supabase.
