// APEX — Parallax del fondo de video (#bg-video) según mouse + scroll.
// Portado desde vanguard-landing: suavizado lerp, clamp para no destapar bordes,
// y respeta prefers-reduced-motion. Escribe el transform directo al elemento (sin
// re-renders) para máxima fluidez.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const onReady = () => {
    const video = document.getElementById('bg-video');
    if (!video) return;

    const MAX = 40; // px máx. de deriva por eje (mouse)
    const SCROLL_FACTOR = 0.15; // px de deriva vertical por px scrolleado
    const SMOOTH = 0.08; // factor de interpolación (lerp)

    const target = { x: 0, y: 0, scroll: 0 };
    const current = { x: 0, y: 0, scroll: 0 };
    const clamp = (v, max) => Math.max(-max, Math.min(max, v));

    window.addEventListener('mousemove', (e) => {
      target.x = -(e.clientX / window.innerWidth - 0.5) * MAX * 2;
      target.y = -(e.clientY / window.innerHeight - 0.5) * MAX * 2;
    });

    window.addEventListener(
      'scroll',
      () => {
        target.scroll = window.scrollY * SCROLL_FACTOR;
      },
      { passive: true }
    );

    const tick = () => {
      current.x += (target.x - current.x) * SMOOTH;
      current.y += (target.y - current.y) * SMOOTH;
      current.scroll += (target.scroll - current.scroll) * SMOOTH;

      // scale(1.25) da ~12.5% de margen por lado; limitamos la deriva al 11%.
      // translate ANTES de scale: el desplazamiento es en píxeles de pantalla,
      // así nunca se mueve lo suficiente para destapar el fondo.
      const tx = clamp(current.x, window.innerWidth * 0.11);
      const ty = clamp(current.y + current.scroll, window.innerHeight * 0.11);
      video.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(1.25)`;

      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  };

  if (document.readyState !== 'loading') onReady();
  else window.addEventListener('DOMContentLoaded', onReady);
})();
