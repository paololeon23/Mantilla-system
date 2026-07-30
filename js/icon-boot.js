/**
 * Render temprano de iconos estáticos.
 * Se carga en <head> para evitar que la interfaz llegue a pintarse
 * con espacios vacíos mientras se descargan los demás módulos.
 */
(function () {
  let rendering = false;
  let scheduled = false;

  const observer = new MutationObserver(() => scheduleRender());

  function observe() {
    if (!document.documentElement) return;
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function render() {
    scheduled = false;
    if (rendering || typeof lucide === 'undefined') return;
    if (!document.querySelector('i[data-lucide]')) return;

    rendering = true;
    observer.disconnect();
    try {
      lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
      document.querySelectorAll('svg[data-lucide]').forEach((icon) => {
        icon.removeAttribute('data-lucide');
      });
    } catch (err) {
      console.warn('[Mantilla] Render temprano de iconos:', err);
    } finally {
      rendering = false;
      observe();
    }
  }

  function scheduleRender() {
    if (scheduled || rendering) return;
    scheduled = true;
    if (typeof queueMicrotask === 'function') queueMicrotask(render);
    else Promise.resolve().then(render);
  }

  observe();
  scheduleRender();
})();
