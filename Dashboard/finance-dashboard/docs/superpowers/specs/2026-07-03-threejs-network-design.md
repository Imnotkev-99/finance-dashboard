# Especificación de Diseño — Fondo 3D de Red de Nodos Interconectados

*   **Fecha:** 2026-07-03
*   **Autor:** Antigravity (AI Coding Assistant)
*   **Estado:** Aprobado para Planificación

Este documento describe la especificación técnica para sustituir el fondo de video local por una escena interactiva de WebGL en tiempo real (Three.js) que representa una red tridimensional de nodos y conexiones en constante flotación. El diseño está concebido para ser minimalista, oscuro, e interactuar sutilmente con la cámara según el movimiento del mouse del usuario.

---

## 1. Objetivos

*   **Estética 3D Premium**: Crear un universo tridimensional fluido donde nodos y uniones vectoriales flotan en un vacío oscuro.
*   **Interactividad con Ratón (Paralaje 3D)**: Permitir al usuario inclinar la cámara 3D sutilmente mediante el cursor, proporcionando profundidad espacial al dashboard.
*   **Desempeño y Cuidado de Batería**: Mantener renderizado WebGL ligero a 60fps pausando el loop de renderizado cuando la página no esté visible.
*   **Higiene de Dependencias**: Usar Three.js vía CDN compatible con la Content-Security-Policy (CSP) del proyecto.

---

## 2. Componentes a Modificar y Crear

### A. Markup: [index.html](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/index.html)
*   Reemplazar la etiqueta `<video id="bg-video">` por un lienzo `<canvas id="three-canvas" class="bg-canvas"></canvas>`.
*   Cargar Three.js vía CDN de jsDelivr al final del body:
    ```html
    <script src="https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js" crossorigin="anonymous"></script>
    ```
*   Cargar el nuevo archivo de lógica `js/three-bg.js` antes del script de parallax.

### B. Estilos: [styles.css](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/css/styles.css)
*   Reemplazar las clases de estilo `.bg-video` por `.bg-canvas` para que afecte tanto al canvas como al posicionamiento general.
*   Asegurar que `.bg-video-overlay` se mantenga con su gradiente oscuro para la legibilidad.

### C. Lógica del Sistema: [three-bg.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/three-bg.js) (Nuevo)
*   Inicializar una escena de Three.js con un color de fondo negro profundo `#07080b`.
*   **Partículas (Nodos)**:
    *   Generar un array de 75 partículas con posiciones aleatorias en 3D y velocidades lentas.
    *   Dibujar los nodos usando `THREE.BufferGeometry` y `THREE.Points`.
*   **Líneas (Conexiones)**:
    *   Calcular distancias en 3D en el loop. Si es menor a 100 unidades, crear líneas.
    *   Actualizar la geometría de líneas de forma óptima usando `THREE.LineSegments`.
*   **Cámara y Paralaje**:
    *   Inclinación de cámara basada en `mousemove`.
*   **Accesibilidad**:
    *   Validar `prefers-reduced-motion` para congelar la animación.

---

## 3. Plan de Verificación

*   **Verificación de Linter**: Garantizar que el nuevo archivo de Javascript pase `npm run lint`.
*   **Verificación E2E**: Ejecutar `npm run verify` para asegurar que Playwright y Vitest continúen en verde.
*   **Verificación de Foco y Batería**: Comprobar en el navegador que el canvas se pause al cambiar de pestaña.
