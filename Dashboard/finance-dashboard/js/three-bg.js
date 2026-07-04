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
