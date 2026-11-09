(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('map-2d'), stage = $('stage'), ctx = canvas.getContext('2d');
  const images = { clean: new Image(), original: new Image() };
  const bounds = { x: 47, y: 303, width: 1731, height: 1893 };
  let mode = 'clean', scale = 1, offsetX = 0, offsetY = 0, fitted = false, drag = null;
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    if (images[mode].complete && images[mode].naturalWidth) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(images[mode], offsetX, offsetY, images[mode].width * scale, images[mode].height * scale);
    }
    canvas.dataset.zoom = scale.toFixed(4);
  }
  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    scale = Math.min((w - 40) / bounds.width, (h - 65) / bounds.height);
    offsetX = (w - bounds.width * scale) / 2 - bounds.x * scale;
    offsetY = (h - bounds.height * scale) / 2 - bounds.y * scale;
    fitted = true; draw();
  }
  function zoom(factor, x = canvas.clientWidth / 2, y = canvas.clientHeight / 2) {
    const next = Math.max(.05, Math.min(4, scale * factor));
    offsetX = x - (x - offsetX) * next / scale;
    offsetY = y - (y - offsetY) * next / scale;
    scale = next; draw();
  }
  images.clean.onload = images.original.onload = draw;
  images.clean.onerror = images.original.onerror = () => { $('map-2d-error').hidden = false; };
  images.clean.src = 'assets/map-216-clean.png'; images.original.src = 'assets/map-216-original.png';
  $('map-clean').onclick = () => setImage('clean'); $('map-original').onclick = () => setImage('original');
  function setImage(value) {
    mode = value;
    $('map-clean').setAttribute('aria-pressed', String(mode === 'clean'));
    $('map-original').setAttribute('aria-pressed', String(mode === 'original'));
    draw();
  }
  $('map-zoom-in').onclick = () => zoom(1.25); $('map-zoom-out').onclick = () => zoom(.8); $('map-fit').onclick = fit;
  canvas.addEventListener('wheel', event => { event.preventDefault(); const r = canvas.getBoundingClientRect(); zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX - r.left, event.clientY - r.top); }, { passive: false });
  canvas.addEventListener('pointerdown', event => { if (event.button !== 0) return; drag = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', event => { if (!drag || drag.id !== event.pointerId) return; offsetX += event.clientX - drag.x; offsetY += event.clientY - drag.y; drag.x = event.clientX; drag.y = event.clientY; draw(); });
  canvas.addEventListener('pointerup', () => { drag = null; }); canvas.addEventListener('pointercancel', () => { drag = null; });
  function setView(is2d) {
    document.body.classList.toggle('map2d-active', is2d);
    $('view-2d').setAttribute('aria-pressed', String(is2d)); $('view-3d').setAttribute('aria-pressed', String(!is2d));
    if (is2d) requestAnimationFrame(() => fitted ? draw() : fit());
  }
  $('view-2d').addEventListener('click', () => setView(true)); $('view-3d').addEventListener('click', () => setView(false));
  new ResizeObserver(() => { if (document.body.classList.contains('map2d-active')) fit(); }).observe(stage);
  requestAnimationFrame(fit);
})();
