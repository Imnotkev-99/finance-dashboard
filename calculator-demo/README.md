# Calculadora — Demo de coordinación de equipo

Una calculadora de escritorio/navegador construida **sin npm, sin build step y
sin frameworks**: HTML + Tailwind (vía CDN) + JavaScript vanilla. Se abre con
doble clic, directo desde el sistema de archivos (`file://`).

Este proyecto es, además, una demo deliberada de cómo varios agentes
especializados pueden colaborar en una misma pieza de software: cada uno
aportó una capa distinta (lógica de interacción, diseño visual, código de
producción, y por último pruebas/documentación), sin pisarse el trabajo.

## Qué hace

Una calculadora de 4 columnas con las operaciones básicas (`+`, `-`, `×`,
`÷`), pantalla de expresión + resultado, y una máquina de estados explícita
que cubre reglas como:

- Encadenar operaciones sin paréntesis se resuelve estrictamente
  izquierda-a-derecha (sin precedencia de operadores).
- División por cero, `NaN` o overflow numérico → se muestra `"Error"` y la
  única salida es `AC`.
- El punto decimal no puede repetirse dentro de un mismo operando.
- Los operandos en edición están limitados a 12 caracteres; los resultados
  que no entran en ese ancho se intentan reformatear (decimales truncados,
  luego notación exponencial) antes de declararse overflow.
- Presionar `=` repetidamente repite la última operación con el último
  operando B (como en una calculadora física).

## Cómo abrirlo

No requiere instalación. Simplemente abre el archivo en tu navegador:

```bash
open index.html
```

(o doble clic desde el Finder/Explorador de archivos). Tailwind se carga
desde su CDN (`cdn.tailwindcss.com`), así que se necesita conexión a
internet la primera vez para que los estilos se vean correctamente; la
lógica funciona sin conexión.

## Estructura del proyecto

```
calculator-demo/
├── index.html            # UI + máquina de estados (consume calculator.js)
├── calculator.js         # Lógica aritmética pura: evaluate() / formatResult()
├── calculator.test.js    # Suite de pruebas (node:test nativo)
└── README.md
```

`calculator.js` está escrito para funcionar en **dos contextos sin ningún
build step**:

- **Navegador**: cargado con `<script src="calculator.js"></script>` (script
  clásico, no `type="module"`, para evitar restricciones CORS al abrir el
  HTML vía `file://`). Expone todo bajo `window.Calc` / `globalThis.Calc`.
- **Node.js**: cargado con `require("./calculator.js")`. Expone todo vía
  `module.exports`.

## Cómo correr los tests

Los tests usan el runner **nativo** de Node (`node:test` + `node:assert`),
sin ninguna dependencia externa:

```bash
node --test
```

Salida esperada: **28 tests, 0 fallos**, cubriendo suma/resta/multiplicación/
división, división por cero, decimales con artefactos de punto flotante,
encadenamiento izquierda-derecha, overflow de 12 caracteres (con fallback a
notación exponencial), y los casos límite reales de `Number.MAX_VALUE`.

## Atajos de teclado

| Tecla              | Acción                          |
|---------------------|----------------------------------|
| `0`–`9`             | Ingresar dígito                 |
| `.`                 | Punto decimal                   |
| `+` `-` `*` `/`     | Operadores                      |
| `Enter` o `=`       | Calcular (`=`)                  |
| `Backspace`         | Borrar último carácter (`⌫`)    |
| `Escape`, `c`, `C`  | Borrar todo (`AC`)               |

## Construido por el equipo de agentes

Esta demo se construyó coordinando varios agentes especializados, cada uno
responsable de una capa distinta del trabajo:

- **`ux-logic-architect`** — diseñó la máquina de estados pura (sin
  preocuparse de estilos visuales): los estados (`idle_empty`,
  `entering_operand_a`, `operator_selected`, `entering_operand_b`,
  `result_shown`, `error`), las reglas de transición numeradas que aparecen
  comentadas en `index.html` (encadenamiento, reemplazo de operador,
  repetición de `=`, bloqueo de punto decimal duplicado, límite de 12
  caracteres, manejo de error con única salida vía `AC`), y los casos límite
  de interacción (qué pasa si presionas `=` sin operador, qué pasa si
  borras hasta vaciar un operando, etc.).
- **`senior-uiux-designer`** — definió la composición visual: grid de 4
  columnas, jerarquía tipográfica del display (expresión pequeña en gris +
  resultado grande), paleta de color por tipo de botón (rojo para `AC`,
  gris para utilidades/operadores, naranja para `=`), estados de
  interacción (`hover`, `active:scale-95`, anillos de foco accesibles), y
  el uso de clases Tailwind vía CDN para mantener el demo sin build step.
- **`frontend-senior-architect`** — implementó el código de producción:
  el dispatcher de acciones, la delegación de eventos de click, el soporte
  de teclado, y el render que traduce el modelo de estado a DOM, todo en
  JavaScript vanilla dentro de un IIFE para no contaminar el scope global.
- **`senior-intern`** *(yo)* — cerró la cadena con el trabajo operativo:
  extraje la lógica aritmética pura (`evaluate` / `formatResult`) a
  `calculator.js` con exportación dual navegador/Node, refactoricé
  `index.html` para consumirla sin duplicar código, escribí la suite de 28
  pruebas con `node:test` cubriendo happy paths y edge cases agresivos
  (división por cero, `NaN`, `Infinity`, overflow real en el límite de
  `Number.MAX_VALUE`, encadenamiento izquierda-derecha), y redacté esta
  documentación.
