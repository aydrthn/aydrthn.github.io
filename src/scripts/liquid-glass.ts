import type { LiquidGlass, GlassConfig } from '../vendor/liquidglass/index.js';

// Keep one WebGL renderer for the whole page. Empty, direct-child proxies satisfy
// the library's scene contract; its output canvases live in the semantic cards.
// Text, links and inputs are never rasterised, cloned or moved out of the DOM.
const BACKGROUND_PAD = 128;
const OPTICS: Partial<GlassConfig> = {
  refraction: 1.7,
  chromAberration: 0.236,
  blurAmount: 0.5,
  edgeHighlight: 0,
  specular: 0,
  fresnel: 0.55,
  distortion: 0.015,
  saturation: 0.06,
  tintStrength: 0.025,
  shadowOpacity: 0.12,
  shadowSpread: 14,
  shadowOffsetY: 4,
  floating: false,
};

type Panel = {
  card: HTMLElement;
  proxy: HTMLDivElement;
  canvas?: HTMLCanvasElement;
  visible: boolean;
  geometry: string;
  metrics?: { width: number; height: number; config: string };
};

export function startLiquidGlass() {
  const root = document.querySelector<HTMLElement>('.liquid-glass-scene');
  const halo = root?.querySelector<HTMLCanvasElement>('.site-halo');
  if (!root || !halo) return;
  const context = halo.getContext('2d');
  if (!context) return;

  const abort = new AbortController();
  const { signal } = abort;
  const panels: Panel[] = Array.from(document.querySelectorAll<HTMLElement>('[data-liquid-glass]'), (card) => {
    const proxy = document.createElement('div');
    proxy.className = 'liquid-glass-proxy';
    proxy.style.position = 'absolute';
    root.append(proxy);
    return { card, proxy, visible: false, geometry: '' };
  });
  let instance: LiquidGlass | undefined;
  let pending = false;
  let stopped = false;
  let frame = 0;
  let settleFrame = 0;
  let pointerFrame = 0;
  const pointers = new Map<HTMLElement, { x: number; y: number }>();
  let trackUntil = 0;
  let paintNeeded = true;
  let metricsNeeded = true;
  let updateNeeded = true;
  let lastScrollX = window.scrollX;
  let lastScrollY = window.scrollY;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const forcedColors = matchMedia('(forced-colors: active)');

  function paintHalo() {
    if (!root || !halo || !context) return;
    const { width, height } = root.getBoundingClientRect();
    // The background is a solid fill, so it does not need retina-sized
    // backing storage. The library still renders the card edges at native DPR.
    halo.width = Math.ceil(width + BACKGROUND_PAD * 2);
    halo.height = Math.ceil(height + BACKGROUND_PAD * 2);
    Object.assign(halo.style, {
      inset: 'auto', left: `${-BACKGROUND_PAD}px`, top: `${-BACKGROUND_PAD}px`,
      width: `${halo.width}px`, height: `${halo.height}px`,
    });
    const styles = getComputedStyle(document.documentElement);
    context.fillStyle = styles.getPropertyValue('--bg').trim();
    context.fillRect(0, 0, halo.width, halo.height);
    instance?.markChanged(halo);
  }

  function syncPanels() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const viewportHeight = root!.clientHeight;
    // Read every card before writing proxies, so one card's update cannot
    // force layout again while measuring the next card.
    const measurements = panels.map((panel) => {
      const { card } = panel;
      const rect = card.getBoundingClientRect();
      if (metricsNeeded || !panel.metrics) {
        const width = card.offsetWidth;
        const height = card.offsetHeight;
        const cssRadius = getComputedStyle(card).borderTopLeftRadius;
        const radius = cssRadius.endsWith('%')
          ? parseFloat(cssRadius) * Math.min(width, height) / 100
          : parseFloat(cssRadius) || 24;
        panel.metrics = { width, height, config: JSON.stringify({
          cornerRadius: radius,
          zRadius: Math.min(18, radius),
          brightness: dark ? 0.015 : 0,
          shadowOpacity: 0,
          // The CSS pointer halo replaces the upstream button brightness boost.
          button: false,
        }) };
      }
      const visible = rect.width > 0 && rect.height > 0 && rect.bottom > -40 && rect.top < viewportHeight + 40;
      return { panel, rect, visible, metrics: panel.metrics };
    });
    metricsNeeded = false;
    for (const { panel, rect, visible, metrics } of measurements) {
      const { card, proxy } = panel;
      // An interrupted init also calls destroy(), which clears positioning.
      if (proxy.style.position !== 'absolute') proxy.style.position = 'absolute';
      panel.visible = visible;
      // Park offscreen/hidden surfaces at a tiny size to avoid shading large
      // invisible panels. The library retains its reusable GPU framebuffer pool.
      const x = visible ? rect.left : -1000;
      const y = visible ? rect.top : -1000;
      const width = visible ? metrics.width : 1;
      const panelHeight = visible ? metrics.height : 1;
      const geometry = `${x},${y},${width},${panelHeight}`;
      if (geometry !== panel.geometry) {
        Object.assign(proxy.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${panelHeight}px` });
        panel.geometry = geometry;
        instance?.markChanged(proxy);
      }
      if (proxy.dataset.config !== metrics.config) {
        proxy.dataset.config = metrics.config;
        // MutationObserver runs later; invalidate now for this frame's render.
        instance?.markChanged(proxy);
      }
      if (!visible) delete card.dataset.glassReady;
    }
  }

  function schedule(repaint = false) {
    paintNeeded ||= repaint;
    metricsNeeded ||= repaint;
    updateNeeded = true;
    // Once initialized, the renderer owns geometry updates and drawing in one
    // RAF. A separate frame is only needed before init or for the CSS fallback.
    if (stopped || instance || frame) return;
    frame = requestAnimationFrame(update);
  }

  function beforeRender() {
    const scrollChanged = window.scrollX !== lastScrollX || window.scrollY !== lastScrollY;
    if (!updateNeeded && !scrollChanged && performance.now() >= trackUntil) return;
    update();
  }

  function update() {
    frame = 0;
    if (stopped) return;
    updateNeeded = false;
    lastScrollX = window.scrollX;
    lastScrollY = window.scrollY;
    if (paintNeeded) {
      paintHalo();
      paintNeeded = false;
    }
    syncPanels();
    schedulePointerUpdate();
    // A scheduled frame is not proof that the renderer has drawn its output.
    // Check the actual first frame before cross-fading from the CSS fallback.
    cancelAnimationFrame(settleFrame);
    settleFrame = requestAnimationFrame(() => {
      let waiting = false;
      for (const { card, canvas, visible } of panels) {
        if (!canvas || !visible || !instance || instance.renderer.contextLost || card.dataset.glassReady) continue;
        const padding = -parseFloat(canvas.style.left || '0');
        const expectedWidth = Math.round((card.offsetWidth + padding * 2) * devicePixelRatio);
        const expectedHeight = Math.round((card.offsetHeight + padding * 2) * devicePixelRatio);
        const sized = canvas.width === expectedWidth && canvas.height === expectedHeight;
        const painted = sized && canvas.getContext('2d')?.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data[3];
        if (painted) card.dataset.glassReady = 'true';
        else waiting = true;
      }
      if (waiting) schedule();
    });
    if (!instance && performance.now() < trackUntil) schedule();
  }

  function trackTransition() {
    trackUntil = performance.now() + (reducedMotion.matches ? 0 : 220);
    schedule();
  }

  function clearPointer(card: HTMLElement) {
    pointers.delete(card);
    delete card.dataset.glassPointer;
    // Keep the last position while opacity fades, avoiding a jump to centre.
  }

  function schedulePointerUpdate() {
    if (stopped || pointerFrame || !pointers.size) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      // CSS paints the local halo without re-running the WebGL pipeline or
      // updating every card for each pointer event. Scroll also refreshes these
      // coordinates so the light stays under a stationary pointer.
      for (const [card, point] of pointers) {
        const rect = card.getBoundingClientRect();
        const x = point.x - rect.left;
        const y = point.y - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
          clearPointer(card);
          continue;
        }
        card.style.setProperty('--glass-pointer-x', `${x}px`);
        card.style.setProperty('--glass-pointer-y', `${y}px`);
        card.dataset.glassPointer = 'true';
      }
    });
  }

  function destroyRenderer() {
    instance?.destroy();
    instance = undefined;
    for (const panel of panels) {
      panel.canvas = undefined;
      delete panel.card.dataset.glassReady;
      // destroy() clears the library's inline position property.
      panel.proxy.style.position = 'absolute';
    }
  }

  async function initialise() {
    if (stopped || pending || instance || forcedColors.matches || document.hidden || !panels.length) return;
    pending = true;
    try {
      const { LiquidGlass } = await import('../vendor/liquidglass/index.js');
      if (stopped || document.hidden || forcedColors.matches) return;
      paintHalo();
      paintNeeded = false;
      syncPanels();
      const next = await LiquidGlass.init({
        root: root!, glassElements: panels.map(({ proxy }) => proxy), defaults: OPTICS, beforeRender,
      });
      if (stopped || document.hidden || forcedColors.matches) {
        next.destroy();
        return;
      }
      instance = next;
      cancelAnimationFrame(frame);
      frame = 0;
      for (const panel of panels) {
        const canvas = next.glassCanvases.get(panel.proxy);
        if (!canvas) continue;
        canvas.className = 'liquid-glass-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        panel.card.prepend(canvas);
        panel.canvas = canvas;
      }
      next.renderer.canvas.addEventListener('webglcontextlost', () => {
        for (const { card } of panels) delete card.dataset.glassReady;
      }, { signal });
      next.renderer.canvas.addEventListener('webglcontextrestored', () => schedule(true), { signal });
      schedule(true);
    } catch (error) {
      destroyRenderer();
      console.warn('Liquid glass is unavailable; using the CSS glass fallback.', error);
    } finally {
      pending = false;
    }
  }

  for (const { card } of panels) {
    const movePointer = (event: PointerEvent) => {
      // Touch users retain native scrolling and never get a stuck hover halo.
      if (event.pointerType === 'touch') return;
      pointers.set(card, { x: event.clientX, y: event.clientY });
      schedulePointerUpdate();
    };
    card.addEventListener('pointermove', movePointer, { passive: true, signal });
    card.addEventListener('pointerenter', (event) => {
      movePointer(event);
      trackTransition();
    }, { passive: true, signal });
    card.addEventListener('pointerleave', () => { clearPointer(card); trackTransition(); }, { signal });
    card.addEventListener('pointercancel', () => clearPointer(card), { signal });
  }

  const resize = new ResizeObserver(() => schedule(true));
  resize.observe(document.body);
  panels.forEach(({ card }) => resize.observe(card));
  const theme = new MutationObserver(() => schedule(true));
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const visibility = new MutationObserver(() => schedule(true));
  panels.forEach(({ card }) => visibility.observe(card, { attributes: true, attributeFilter: ['hidden'] }));
  window.addEventListener('scroll', () => schedule(), { passive: true, signal });
  window.addEventListener('resize', () => schedule(true), { passive: true, signal });
  window.visualViewport?.addEventListener('resize', () => schedule(true), { passive: true, signal });
  window.addEventListener('blur', () => pointers.forEach((_, card) => clearPointer(card)), { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pointers.forEach((_, card) => clearPointer(card));
      // Browser animation frames pause in the background. Keep the completed
      // material so returning to this tab does not replay its initialisation.
    }
    else { schedule(true); void initialise(); }
  }, { signal });
  forcedColors.addEventListener('change', () => {
    if (forcedColors.matches) destroyRenderer();
    else void initialise();
  }, { signal });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    destroyRenderer();
    stopped = true;
    abort.abort();
    resize.disconnect();
    theme.disconnect();
    visibility.disconnect();
    cancelAnimationFrame(frame);
    cancelAnimationFrame(settleFrame);
    cancelAnimationFrame(pointerFrame);
  }, { signal });
  window.addEventListener('pageshow', () => { schedule(true); void initialise(); }, { signal });
  schedule(true);
  void initialise();
}
