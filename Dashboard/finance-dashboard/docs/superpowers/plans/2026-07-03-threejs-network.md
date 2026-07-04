# Three.js 3D Network Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el fondo de video mp4 local por un lienzo WebGL interactivo en tiempo real de Three.js que renderice una constelación de partículas y líneas tridimensionales (Red de Nodos).

**Architecture:** Se creará un nuevo script de Javascript `js/three-bg.js` para renderizar la constelación usando THREE.Points y THREE.LineSegments a 60fps con física flotante, textura circular dinámica generada en canvas y parallax 3D de cámara. Se removerá la carga de `js/parallax.js` e `index.html` cargará la librería Three.js desde jsDelivr.

**Tech Stack:** HTML5, CSS3, JavaScript (ES6), Three.js Library, WebGL API.

## Global Constraints

- Cargar la librería Three.js mediante jsDelivr (`https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js`).
- El canvas 3D no debe interferir con los eventos de clic del dashboard (`pointer-events: none`).
- Pausar la animación cuando la pestaña del navegador esté inactiva o si `prefers-reduced-motion` está activado.
- Todos los tests unitarios y e2e deben continuar en verde.

---

### Task 1: Crear Script de WebGL en Three.js

**Files:**
- Create: `js/three-bg.js`

**Interfaces:**
- Consumes: Librería global `THREE` en el contexto del navegador.
- Produces: Escena 3D e interactividad en el elemento `#three-canvas`.

- [ ] **Step 1: Crear el archivo `js/three-bg.js` con el renderizador de partículas y líneas**
  Escribir el siguiente código en `js/three-bg.js`:
  ```javascript
  (function () {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080b);

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 1000);
    camera.position.z = 400;

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const particleCount = 75;
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    const r = 350;

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * r * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * r * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * r * 2;

      velocities.push({
        x: (Math.random() - 0.5) * 0.3,
        y: (Math.random() - 0.5) * 0.3,
        z: (Math.random() - 0.5) * 0.3
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    function createPointTexture() {
      const size = 16;
      const canvasPoint = document.createElement('canvas');
      canvasPoint.width = size;
      canvasPoint.height = size;
      const ctx = canvasPoint.getContext('2d');
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      return new THREE.CanvasTexture(canvasPoint);
    }

    const pointMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 6,
      transparent: true,
      opacity: 0.75,
      map: createPointTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const pointCloud = new THREE.Points(geometry, pointMaterial);
    scene.add(pointCloud);

    const maxConnections = particleCount * particleCount;
    const linePositions = new Float32Array(maxConnections * 3);
    const lineColors = new Float32Array(maxConnections * 3);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineMesh);

    const mouse = { x: 0, y: 0 };
    const targetCamera = { x: 0, y: 0 };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    window.addEventListener('mousemove', (e) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 80;
      mouse.y = -(e.clientY / window.innerHeight - 0.5) * 80;
    });

    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    let animationFrameId = null;

    function animate() {
      if (!reduceMotion.matches) {
        const posAttr = geometry.getAttribute('position');
        const coords = posAttr.array;

        for (let i = 0; i < particleCount; i++) {
          coords[i * 3] += velocities[i].x;
          coords[i * 3 + 1] += velocities[i].y;
          coords[i * 3 + 2] += velocities[i].z;

          if (coords[i * 3] < -r || coords[i * 3] > r) velocities[i].x *= -1;
          if (coords[i * 3 + 1] < -r || coords[i * 3 + 1] > r) velocities[i].y *= -1;
          if (coords[i * 3 + 2] < -r || coords[i * 3 + 2] > r) velocities[i].z *= -1;
        }
        posAttr.needsUpdate = true;
      }

      let lineIdx = 0;
      let colorIdx = 0;
      const coords = geometry.getAttribute('position').array;
      const limit = 110;

      for (let i = 0; i < particleCount; i++) {
        const x1 = coords[i * 3];
        const y1 = coords[i * 3 + 1];
        const z1 = coords[i * 3 + 2];

        for (let j = i + 1; j < particleCount; j++) {
          const x2 = coords[j * 3];
          const y2 = coords[j * 3 + 1];
          const z2 = coords[j * 3 + 2];

          const dx = x1 - x2;
          const dy = y1 - y2;
          const dz = z1 - z2;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < limit && !reduceMotion.matches) {
            linePositions[lineIdx++] = x1;
            linePositions[lineIdx++] = y1;
            linePositions[lineIdx++] = z1;
            linePositions[lineIdx++] = x2;
            linePositions[lineIdx++] = y2;
            linePositions[lineIdx++] = z2;

            const alpha = (1 - dist / limit) * 0.16;
            for (let k = 0; k < 2; k++) {
              lineColors[colorIdx++] = alpha;
              lineColors[colorIdx++] = alpha;
              lineColors[colorIdx++] = alpha;
            }
          }
        }
      }

      lineGeometry.getAttribute('position').needsUpdate = true;
      lineGeometry.getAttribute('color').needsUpdate = true;
      lineGeometry.setDrawRange(0, lineIdx / 3);

      if (!reduceMotion.matches) {
        targetCamera.x += (mouse.x - targetCamera.x) * 0.05;
        targetCamera.y += (mouse.y - targetCamera.y) * 0.05;
        camera.position.x = targetCamera.x;
        camera.position.y = targetCamera.y;
        camera.lookAt(scene.position);
      }

      renderer.render(scene, camera);

      if (!document.hidden) {
        animationFrameId = requestAnimationFrame(animate);
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        animate();
      }
    });

    animate();
  })();
  ```

- [ ] **Step 2: Verificar que el archivo pasa ESLint**
  Run: `npm run lint`
  Expected: ESLint limpio sin errores en `js/three-bg.js`.

- [ ] **Step 3: Commit del nuevo archivo js/three-bg.js**
  ```bash
  git add js/three-bg.js
  git commit -m "feat: create Three.js interactive 3D network physics background"
  ```

---

### Task 2: Actualizar Estilos CSS

**Files:**
- Modify: `css/styles.css:1676-1716`

- [ ] **Step 1: Reemplazar las reglas .bg-video por .bg-canvas en styles.css**
  Modificar `css/styles.css` eliminando `.bg-video` y cambiándola por:
  ```css
  .bg-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    height: 100lvh;
    z-index: -2;
    will-change: transform;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .bg-canvas {
      /* sin transformaciones JS */
    }
  }
  ```

- [ ] **Step 2: Commit de los estilos modificados**
  ```bash
  git add css/styles.css
  git commit -m "style: replace bg-video CSS with bg-canvas"
  ```

---

### Task 3: Modificar index.html e Integrar CDN

**Files:**
- Modify: `index.html:22-28`, `index.html:492-498`

- [ ] **Step 1: Reemplazar el video de fondo por el elemento canvas**
  Buscar el tag `<video>` en `index.html` al principio del body y reemplazarlo por:
  ```html
    <!-- Fondo de canvas 3D interactivo (login + dashboard) -->
    <canvas id="three-canvas" class="bg-canvas" aria-hidden="true"></canvas>
    <div class="bg-video-overlay" aria-hidden="true"></div>
  ```

- [ ] **Step 2: Cargar el CDN de Three.js y js/three-bg.js en index.html**
  Modificar la carga de scripts antes del final del body:
  1. Integrar el script de Three.js desde jsDelivr.
  2. Reemplazar la carga de `js/parallax.js` por `js/three-bg.js` (ya que Three.js maneja su propio parallax 3D nativo).
  ```html
    <script src="https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js" crossorigin="anonymous"></script>
    <script type="module" src="js/bootstrap.js"></script>
    <script src="js/app.js?v=3"></script>
    <!-- Fondo 3D interactivo en Three.js -->
    <script src="js/three-bg.js"></script>
  ```

- [ ] **Step 3: Eliminar fisicamente el script parallax.js anterior y el video local para mantener el repositorio higiénico**
  Run: `rm js/parallax.js && rm -rf assets/video/`

- [ ] **Step 4: Ejecutar la suite de verificación completa**
  Comprobar que linter y tests pasen tras la integración de Three.js:
  Run: `npm run verify`
  Expected: ESLint pasa limpio, 26 tests unitarios pasan, 8 tests e2e pasan de forma exitosa.

- [ ] **Step 5: Commit de index.html, remociones y push final**
  Añadir los cambios y empujarlos:
  ```bash
  git add index.html js/parallax.js
  git rm -f js/parallax.js assets/video/bg-glass.mp4
  git commit -m "markup: load Three.js CDN and hook three-bg.js, cleaning up deprecated assets"
  git push github ui-redesign
  ```
