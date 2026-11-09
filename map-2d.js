(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('map-2d'), stage = $('stage'), ctx = canvas.getContext('2d');
  const images = { clean: new Image(), original: new Image() };
  // The 5 cm reconstructed raster and 3 cm scan were registered using obstacle pixels.
  // This is a display alignment, not a surveyed coordinate transformation.
  const points = window.MAP_DATA.trajectory.map(([x, y]) => [x * 5 / 3 + 14, y * 5 / 3 - 15]);
  let replay = { a: 0, b: 1, f: 0 };
  const screenPoint = ([x, y]) => [offsetX + x * scale, offsetY + y * scale];
  function drawRoute() {
    const { a, b, f } = replay;
    const point = [points[a][0] + (points[b][0] - points[a][0]) * f, points[a][1] + (points[b][1] - points[a][1]) * f];
    const [rx, ry] = screenPoint(point);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    function path(start, end, color, width, fromRobot, toRobot) {
      ctx.beginPath();
      if (fromRobot) ctx.moveTo(rx, ry);
      else { const [x, y] = screenPoint(points[start]); ctx.moveTo(x, y); }
      for (let i = fromRobot ? start : start + 1; i <= end; i++) { const [x, y] = screenPoint(points[i]); ctx.lineTo(x, y); }
      if (toRobot) ctx.lineTo(rx, ry);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    }
    path(b, points.length - 1, 'rgba(89, 112, 137, .7)', 2, true, false);
    path(0, a, '#176be5', 3, false, true);
    const before = points[Math.max(0, a - 3)], after = points[Math.min(points.length - 1, b + 5)];
    const angle = Math.atan2(after[1] - before[1], after[0] - before[0]);
    ctx.save(); ctx.translate(rx, ry);
    // Direction pointer rotates; the robot face stays upright and readable.
    ctx.save(); ctx.rotate(angle); ctx.fillStyle = '#176be5'; ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(9, -5); ctx.lineTo(9, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.shadowColor = 'rgba(25, 69, 130, .3)'; ctx.shadowBlur = 7; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#176be5'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3.8, -1.8, 1.5, 0, Math.PI * 2); ctx.arc(3.8, -1.8, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(3, 4); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
    canvas.dataset.robotMapPosition = point.map(v => v.toFixed(2)).join(',');
  }
  window.addEventListener('map-replay-progress', event => { replay = event.detail; if (document.body.classList.contains('map2d-active')) draw(); });
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
      drawRoute();
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
