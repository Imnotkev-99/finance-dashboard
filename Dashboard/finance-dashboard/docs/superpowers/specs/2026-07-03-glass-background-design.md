# Especificación de Diseño — Fondo de Video de Vidrio 3D Abstracto Local

*   **Fecha:** 2026-07-03
*   **Autor:** Antigravity (AI Coding Assistant)
*   **Estado:** Aprobado para Planificación

Este documento describe la especificación técnica para sustituir el video de fondo de CloudFront de terceros por un loop de video abstracto de esferas de vidrio 3D en movimiento lento, hospedado de manera 100% local en el proyecto. Esto garantiza total autonomía de red, carga offline, y una estética visual elegante y coherente con el estilo de *glassmorphism* del dashboard.

---

## 1. Objetivos

*   **Consistencia de Materiales (Aesthetics)**: Implementar un bucle de video en el que esferas de vidrio 3D se desplacen lentamente. Esto encaja de manera natural con el vidrio esmerilado translúcido de las tarjetas.
*   **Hospedaje Local**: Alojar el archivo de video en la carpeta `assets/video/bg-glass.mp4` en el propio proyecto, evitando peticiones HTTP hacia CDNs ajenos.
*   **Flexibilidad**: Permitir al usuario y a otros colaboradores personalizar el fondo reemplazando simplemente el archivo local.
*   **Preservar Funcionalidades**: Mantener el efecto de paralaje interactivo del ratón y el scroll controlado por `js/parallax.js`.

---

## 2. Componentes a Modificar y Crear

### A. Estructura de Directorios
*   Crear una carpeta dedicada a recursos multimedia en la raíz: `assets/video/`.

### B. Descarga del Recurso
*   Descargar el video de esferas de vidrio 3D (libre de derechos de Mixkit) usando un comando `curl` seguro durante la fase de implementación y guardarlo como `assets/video/bg-glass.mp4`.
*   *URL de origen:* `https://assets.mixkit.co/videos/preview/mixkit-glass-spheres-moving-slowly-42456-large.mp4`

### C. Markup: [index.html](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/index.html)
*   Modificar la etiqueta `<source>` dentro de `<video id="bg-video">` al inicio del body para apuntar al archivo local:
    ```html
    <video id="bg-video" class="bg-video" autoplay muted loop playsinline aria-hidden="true">
      <source src="assets/video/bg-glass.mp4" type="video/mp4">
    </video>
    ```

### D. Lógica de Parallax: [parallax.js](file:///Users/kevinsantos/claudeproject/Dashboard/finance-dashboard/js/parallax.js)
*   No requiere modificaciones de lógica ya que mantiene el ID del elemento `#bg-video` y su clase original `.bg-video`.

---

## 3. Plan de Verificación

*   **Verificación de Carga de Red**: Comprobar en las herramientas de desarrollo del navegador que la app ya no realiza llamadas externas a CDNs de terceros para el video.
*   **Verificación Visual (Estilo y Parallax)**: Validar que el video se cargue y se reproduzca en bucle continuo de forma local, y que el desplazamiento y efecto de paralaje sigan respondiendo suavemente a la interacción del usuario.
