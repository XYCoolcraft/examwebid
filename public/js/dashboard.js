/**
 * Dashboard live: jam, baterai, CPU, memori, GPU, disk, FPS, sinyal/jaringan.
 *
 * CATATAN JUJUR:
 * - Baterai: Battery Status API sudah dihapus dari sebagian besar browser modern (Firefox/Safari,
 *   dan Chrome desktop terbaru) karena alasan privasi. Kalau tidak tersedia, kita tampilkan "N/A".
 * - Memori & CPU: browser TIDAK memberi akses ke persentase pemakaian CPU/RAM sistem sungguhan.
 *   Yang bisa kita tampilkan hanya: jumlah core logis (navigator.hardwareConcurrency) dan,
 *   di Chrome saja, heap JavaScript (performance.memory) sebagai perkiraan kasar - BUKAN RAM total.
 * - GPU: nama render GPU (lewat WebGL) kalau browser mengizinkan, tanpa persentase pemakaian.
 * - Disk: kuota storage browser (navigator.storage.estimate), bukan kapasitas disk fisik.
 * - Sinyal/kecepatan internet: Network Information API hanya didukung sebagian browser
 *   (terutama Chrome Android). Kalau tidak ada, kita tampilkan status online/offline saja.
 */

function initDashboard(rootEl) {
  rootEl.innerHTML = `
    <div class="dash-item" id="d-clock">${icon('clock')}<strong id="d-clock-text">--:--:--</strong><span id="d-tz"></span></div>
    <div class="dash-item" id="d-battery">${icon('battery')}<span class="battery-shell"><span class="battery-fill" id="d-batt-fill" style="width:0%"></span></span><strong id="d-batt-text">N/A</strong></div>
    <div class="dash-item" id="d-cpu">${icon('cpu')}<strong id="d-cpu-text">-</strong></div>
    <div class="dash-item" id="d-mem">${icon('memory')}<strong id="d-mem-text">-</strong></div>
    <div class="dash-item" id="d-gpu">${icon('gpu')}<strong id="d-gpu-text" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">-</strong></div>
    <div class="dash-item" id="d-disk">${icon('disk')}<strong id="d-disk-text">-</strong></div>
    <div class="dash-item" id="d-fps">${icon('fps')}<strong id="d-fps-text">-- FPS</strong></div>
    <div class="dash-item" id="d-net">${icon('wifi')}<span class="signal-bars" id="d-signal"><i></i><i></i><i></i><i></i></span><strong id="d-net-text">-</strong></div>
    <div class="dash-spacer"></div>
    <div class="dash-item dash-timer" id="d-timer">${icon('clock')} <span id="d-timer-text">--:--:--</span></div>
  `;

  startClock();
  startBattery();
  startCpuMem();
  startGpu();
  startDisk();
  startFps();
  startNetwork();
}

// ---------- Jam + zona waktu otomatis ----------
function startClock() {
  const textEl = document.getElementById('d-clock-text');
  const tzEl = document.getElementById('d-tz');
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const tzLabel = mapIndonesiaZone(tz);

  function tick() {
    const now = new Date();
    if (tzLabel) {
      textEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      tzEl.textContent = ' ' + tzLabel;
    } else {
      textEl.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      tzEl.textContent = '';
    }
  }
  tick();
  setInterval(tick, 1000);
}

function mapIndonesiaZone(tz) {
  const map = {
    'Asia/Jakarta': 'WIB',
    'Asia/Pontianak': 'WIB',
    'Asia/Makassar': 'WITA',
    'Asia/Denpasar': 'WITA',
    'Asia/Jayapura': 'WIT',
  };
  return map[tz] || null;
}

// ---------- Baterai (real-time jika API tersedia) ----------
function startBattery() {
  const fill = document.getElementById('d-batt-fill');
  const text = document.getElementById('d-batt-text');
  if (!navigator.getBattery) {
    text.textContent = 'N/A';
    return;
  }
  navigator.getBattery().then((batt) => {
    function render() {
      const pct = Math.round(batt.level * 100);
      fill.style.width = pct + '%';
      fill.style.background = pct <= 20 ? 'var(--red)' : pct <= 50 ? 'var(--yellow)' : 'var(--green)';
      text.textContent = pct + '%' + (batt.charging ? ' ⚡' : '');
    }
    render();
    batt.addEventListener('levelchange', render);
    batt.addEventListener('chargingchange', render);
  }).catch(() => { text.textContent = 'N/A'; });
}

// ---------- CPU cores + heap memori (Chrome only, perkiraan) ----------
function startCpuMem() {
  const cpuText = document.getElementById('d-cpu-text');
  const memText = document.getElementById('d-mem-text');
  cpuText.textContent = navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' core' : 'N/A';

  function renderMem() {
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize / 1048576;
      const limit = performance.memory.jsHeapSizeLimit / 1048576;
      memText.textContent = Math.round(used) + '/' + Math.round(limit) + ' MB';
    } else {
      memText.textContent = navigator.deviceMemory ? '~' + navigator.deviceMemory + ' GB RAM' : 'N/A';
    }
  }
  renderMem();
  setInterval(renderMem, 2000);
}

// ---------- GPU (nama renderer, tanpa persentase pemakaian) ----------
function startGpu() {
  const gpuText = document.getElementById('d-gpu-text');
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const dbgInfo = gl && gl.getExtension('WEBGL_debug_renderer_info');
    if (gl && dbgInfo) {
      gpuText.textContent = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL);
    } else {
      gpuText.textContent = 'N/A';
    }
  } catch (_) {
    gpuText.textContent = 'N/A';
  }
}

// ---------- Disk (kuota storage browser, bukan disk fisik) ----------
function startDisk() {
  const diskText = document.getElementById('d-disk-text');
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then((est) => {
      const usedMB = Math.round((est.usage || 0) / 1048576);
      const quotaMB = Math.round((est.quota || 0) / 1048576);
      diskText.textContent = usedMB + '/' + quotaMB + ' MB';
    }).catch(() => { diskText.textContent = 'N/A'; });
  } else {
    diskText.textContent = 'N/A';
  }
}

// ---------- FPS real-time (genuine, via requestAnimationFrame) ----------
function startFps() {
  const fpsText = document.getElementById('d-fps-text');
  let frames = 0;
  let lastTime = performance.now();

  function loop(now) {
    frames++;
    if (now - lastTime >= 1000) {
      fpsText.textContent = frames + ' FPS';
      frames = 0;
      lastTime = now;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ---------- Jaringan: tipe koneksi, kecepatan perkiraan, status online/offline ----------
function startNetwork() {
  const netText = document.getElementById('d-net-text');
  const bars = document.querySelectorAll('#d-signal i');

  function levelFromEffectiveType(type) {
    return { 'slow-2g': 1, '2g': 1, '3g': 2, '4g': 4 }[type] || 3;
  }

  function render() {
    if (!navigator.onLine) {
      netText.textContent = 'Offline';
      bars.forEach((b) => b.classList.remove('on'));
      netText.style.color = 'var(--red)';
      return;
    }
    const conn = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
    if (conn) {
      const level = levelFromEffectiveType(conn.effectiveType);
      bars.forEach((b, i) => b.classList.toggle('on', i < level));
      const label = (conn.effectiveType || '').toUpperCase();
      const downlink = conn.downlink ? conn.downlink.toFixed(1) + ' Mbps' : '';
      netText.textContent = `${label} ${downlink}`.trim();
      netText.style.color = level >= 4 ? 'var(--green)' : level >= 2 ? 'var(--yellow)' : 'var(--red)';
    } else {
      bars.forEach((b, i) => b.classList.toggle('on', i < 3));
      netText.textContent = 'Online';
      netText.style.color = 'var(--green)';
    }
  }

  render();
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  if (navigator.connection) navigator.connection.addEventListener('change', render);
  setInterval(render, 5000);
}
