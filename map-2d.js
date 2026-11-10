(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('map-2d'), stage = $('stage'), ctx = canvas.getContext('2d');
  const images = { clean: new Image(), original: new Image() };
  // The 5 cm reconstructed raster and 3 cm scan were registered using obstacle pixels.
  // This is a display alignment, not a surveyed coordinate transformation.
  const points = window.MAP_DATA.trajectory.map(([x, y]) => [x * 5 / 3 + 14, y * 5 / 3 - 15]);
  let replay = { a: 0, b: 1, f: 0 };
  const screenPoint = ([x, y]) => [offsetX + x * scale, offsetY + y * scale];
  const robotLayer = $('robot-layer'), taskMode = $('task-mode');
  let selectedRobot = 'history';
  const taskNames = { inspection: '巡检任务', collection: '收集任务', transport: '运输任务' };
  const colors = { inspection: '#6c38cb', collection: '#2e7ff1', transport: '#25c8d6' };
  const scenarios = {
    inspection: [
      {id:'history', name:'历史轨迹', task:'inspection', offset:0, battery:'—'},
      {id:'demo-1', name:'演示机器人 01', task:'inspection', offset:.22, battery:'80%'},
      {id:'demo-2', name:'演示机器人 02', task:'inspection', offset:.53, battery:'80%', warning:true}
    ],
    transport: [
      {id:'history', name:'历史轨迹', task:'transport', offset:0, battery:'—', role:'头部'},
      {id:'demo-1', name:'演示机器人 01', task:'transport', offset:-.018, battery:'80%', role:'尾部'}
    ],
    multi: [
      {id:'history', name:'历史轨迹', task:'inspection', offset:0, battery:'—'},
      {id:'demo-1', name:'演示机器人 01', task:'transport', offset:.23, battery:'80%', role:'头部'},
      {id:'demo-2', name:'演示机器人 02', task:'transport', offset:.215, battery:'80%', role:'尾部'},
      {id:'demo-3', name:'演示机器人 03', task:'collection', offset:.57, battery:'100%'},
      {id:'demo-4', name:'演示机器人 04', task:'inspection', offset:.77, battery:'80%', warning:true}
    ]
  };
  function rebuildMarkers() {
    robotLayer.replaceChildren();
    for (const robot of scenarios[taskMode.value]) {
      const marker = document.createElement('button'); marker.type = 'button'; marker.className = 'robot-marker';
      marker.dataset.robotId = robot.id; marker.dataset.selected = String(robot.id === selectedRobot);
      marker.dataset.warning = String(!!robot.warning);
      marker.setAttribute('aria-label', `${robot.name}，${taskNames[robot.task]}${robot.warning ? '，演示暂停' : ''}`);
      marker.innerHTML = `<span class="direction" aria-hidden="true"></span><span class="robot-pin" aria-hidden="true">🤖</span><span class="robot-card"><span class="robot-card-row"><span>${robot.role ? robot.role + ' · ' : ''}${robot.name}</span><span class="battery">▣ ${robot.battery}</span></span><span class="robot-card-row"><span>${taskNames[robot.task]}</span><span class="robot-badge ${robot.warning ? 'warning' : ''}">${robot.id === 'history' ? '回放' : robot.warning ? '暂停中' : '演示中'}</span></span>${robot.warning ? '<span class="robot-card-row robot-alert">故障提示 · 演示</span>' : ''}</span>`;
      marker.onclick = () => { selectedRobot = robot.id; for (const item of robotLayer.children) item.dataset.selected = String(item.dataset.robotId === selectedRobot); };
      robotLayer.appendChild(marker);
    }
    draw();
  }
  function drawRoute() {
    const {a, b, f} = replay;
    const current = [points[a][0] + (points[b][0] - points[a][0]) * f, points[a][1] + (points[b][1] - points[a][1]) * f];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    function line(start, end, color, width) {
      ctx.beginPath(); const [x,y] = screenPoint(points[start]); ctx.moveTo(x,y);
      for (let i=start+1; i<=end; i++) {const [px,py]=screenPoint(points[i]);ctx.lineTo(px,py);}
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
    }
    const last=points.length-1;
    line(0,last,'rgba(112, 121, 131, .43)',3);
    if(taskMode.value==='multi') {
      line(0,Math.floor(last*.34),colors.inspection,3);
      line(Math.floor(last*.34),Math.floor(last*.67),colors.transport,3);
      line(Math.floor(last*.67),last,colors.collection,3);
    } else line(0,last,colors[taskMode.value],3);
    line(0,a,'rgba(32, 94, 195, .9)',1.5);
    const markers = robotLayer.children;
    scenarios[taskMode.value].forEach((robot,i) => {
      let point=current, headingIndex=a;
      if(robot.id !== 'history') {
        const index = (((robot.warning ? 0 : a + f) + robot.offset * last) % last + last) % last;
        const lo=Math.floor(index), hi=Math.min(last,lo+1), t=index-lo;
        headingIndex=lo;
        point=[points[lo][0]+(points[hi][0]-points[lo][0])*t,points[lo][1]+(points[hi][1]-points[lo][1])*t];
      }
      const [x,y]=screenPoint(point), marker=markers[i];
      marker.style.left=x+'px';marker.style.top=y+'px';
      const prev=points[Math.max(0,headingIndex-3)], next=points[Math.min(last,headingIndex+5)];
      marker.style.setProperty('--heading',Math.atan2(next[1]-prev[1],next[0]-prev[0])+'rad');
      marker.hidden=x < -20 || y < -20 || x > canvas.clientWidth + 20 || y > canvas.clientHeight + 20;
      const card=marker.querySelector('.robot-card');
      card.style.left = x > canvas.clientWidth - 190 ? 'auto' : '28px';
      card.style.right = x > canvas.clientWidth - 190 ? '28px' : 'auto';
      card.style.bottom = y < 105 ? 'auto' : '18px';
      card.style.top = y < 105 ? '18px' : 'auto';
    });
    canvas.dataset.robotMapPosition=current.map(v=>v.toFixed(2)).join(',');
  }
  taskMode.addEventListener('change', () => { selectedRobot='history'; rebuildMarkers(); });
  $('show-zones').addEventListener('change', draw);
  window.addEventListener('map-replay-progress', event => { replay = event.detail; if (document.body.classList.contains('map2d-active')) draw(); });
  const bounds = { x: 47, y: 303, width: 1731, height: 1893 };
  let mode = 'clean', scale = 1, offsetX = 0, offsetY = 0, fitted = false, drag = null;
  function drawLocations() {
    if (!$('show-zones').checked) return;
    const places = [{fraction:.10, name:'收集区 · 演示', color:'#45bbd6'}, {fraction:.42, name:'目标点 · 演示', color:'#a161d0'}, {fraction:.88, name:'充电点 · 演示', color:'#4f8eee'}];
    ctx.save();ctx.font='10px -apple-system, BlinkMacSystemFont, sans-serif';ctx.textBaseline='middle';
    for (const place of places) {
      const [x,y]=screenPoint(points[Math.floor((points.length-1)*place.fraction)]);
      ctx.fillStyle=place.color+'33';ctx.strokeStyle=place.color;ctx.lineWidth=1;
      ctx.fillRect(x-9,y-9,18,18);ctx.strokeRect(x-9,y-9,18,18);
      const width=ctx.measureText(place.name).width+8;
      ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(x+10,y-8,width,16);
      ctx.fillStyle='#516579';ctx.fillText(place.name,x+14,y);
    }
    ctx.restore();
  }
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    if (images[mode].complete && images[mode].naturalWidth) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(images[mode], offsetX, offsetY, images[mode].width * scale, images[mode].height * scale);
      drawLocations();
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
  rebuildMarkers();
  requestAnimationFrame(fit);
})();
