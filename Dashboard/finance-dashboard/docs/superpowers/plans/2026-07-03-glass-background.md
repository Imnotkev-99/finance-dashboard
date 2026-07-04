# Local Glass Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurar un bucle de video de esferas de vidrio 3D en movimiento lento de forma 100% local en el proyecto, sustituyendo la dependencia externa del CDN de CloudFront.

**Architecture:** Se creará la carpeta local `assets/video/` en el proyecto y se descargará el video en formato MP4 usando curl. Luego se actualizará `index.html` para buscar dicho archivo localmente, preservando la compatibilidad con el parallax de `js/parallax.js`.

**Tech Stack:** HTML5, Git, curl.

## Global Constraints

- El archivo de video debe alojarse exclusivamente de forma local bajo `assets/video/`.
- No debe haber dependencias externas para el renderizado del fondo.
- Todos los tests unitarios y e2e deben continuar pasando exitosamente.

---

### Task 1: Crear Directorio y Descargar Video de Vidrio 3D

**Files:**
- Create: `assets/video/bg-glass.mp4`

**Interfaces:**
- Consumes: URL de origen de Mixkit.
- Produces: Archivo binario local de video mp4 en `assets/video/bg-glass.mp4`.

- [ ] **Step 1: Crear la estructura de directorios en el workspace**
  Crear la carpeta `assets/video` si no existe.
  Run: `mkdir -p assets/video`

- [ ] **Step 2: Descargar el video de esferas de vidrio 3D usando curl**
  Ejecutar el comando de descarga:
  Run: `curl -L "https://assets.mixkit.co/videos/preview/mixkit-glass-spheres-moving-slowly-42456-large.mp4" -o assets/video/bg-glass.mp4`

- [ ] **Step 3: Verificar que el archivo se ha descargado correctamente y no está vacío**
  Run: `ls -la assets/video/bg-glass.mp4`
  Expected: El archivo debe pesar ~1MB a 2MB y existir en la ruta.

- [ ] **Step 4: Commit de la estructura y el video**
  Añadir el archivo a git (si no está ignorado por .gitignore; si lo está, forzar la adición o asegurarnos de subirlo) y commitear:
  ```bash
  git add assets/video/bg-glass.mp4
  git commit -m "feat: download and host 3D glass background loop video locally"
  ```

---

### Task 2: Actualizar Referencia en index.html

**Files:**
- Modify: `index.html:23-27`

**Interfaces:**
- Consumes: Archivo local `./assets/video/bg-glass.mp4`.
- Produces: Etiqueta de video en index.html buscando el recurso local.

- [ ] **Step 1: Cambiar la URL de source a la ruta local en index.html**
  Buscar el bloque `<video id="bg-video">` al inicio del body de `index.html` y cambiar el `<source>` para que apunte a `assets/video/bg-glass.mp4`:
  ```html
    <video id="bg-video" class="bg-video" autoplay muted loop playsinline aria-hidden="true">
      <source
        src="assets/video/bg-glass.mp4"
        type="video/mp4">
    </video>
  ```

- [ ] **Step 2: Ejecutar la suite de verificación completa**
  Comprobar que todos los tests unitarios, de linter y E2E pasen:
  Run: `npm run verify`
  Expected: ESLint limpio, 26 tests unitarios pasan, 8 tests e2e pasan.

- [ ] **Step 3: Commit de la actualización de index.html y push final**
  Confirmar los cambios en index.html y subirlos:
  ```bash
  git add index.html
  git commit -m "markup: link bg-video element to local bg-glass.mp4"
  git push github ui-redesign
  ```
