/**
 * exam-guard.js
 *
 * PENTING - baca sebelum pakai:
 * Modul ini adalah PENCEGAH KECURANGAN RINGAN (deterrent), BUKAN proteksi mutlak.
 * - Fullscreen enforcement: BENAR-BENAR bekerja (Fullscreen API standar semua browser modern).
 *   Kalau peserta keluar fullscreen, kita anggap itu sebagai indikasi kecurangan dan reload halaman.
 * - "Deteksi DevTools": hanya HEURISTIK (based on perbedaan ukuran window), bisa dilewati peserta
 *   yang cukup paham teknis (misalnya devtools di monitor kedua, atau mode responsive tertentu).
 *   Jangan mengklaim ke peserta ini 100% anti-devtools.
 * - Blokir klik kanan/copy/drag/select: hanya level UI (CSS/JS), TIDAK mencegah screenshot atau
 *   screen recording OS-level - itu di luar kendali halaman web mana pun.
 * - Tab-switch / blur: dicatat sebagai violation, bukan diblokir (tidak ada cara mem-block user
 *   pindah tab dari sisi web).
 */

function initExamGuard({ token, violationLimit, onDisqualified }) {
  let violationCount = 0;

  function reportViolation(type, detail) {
    violationCount++;
    fetch(`/api/session/${token}/violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, detail }),
    }).then((r) => r.json()).then((data) => {
      if (data.disqualified && onDisqualified) onDisqualified(data);
    }).catch(() => {});
  }

  // ---------- Deterrent UI: blok klik kanan, select, drag, copy/paste ----------
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());
  document.addEventListener('copy', (e) => { e.preventDefault(); reportViolation('copy_attempt'); });
  document.addEventListener('cut', (e) => e.preventDefault());
  document.addEventListener('paste', (e) => e.preventDefault());
  document.body.classList.add('no-select', 'no-drag');

  // Shortcut umum untuk devtools / save / print - deterrent saja, bisa dilewati browser tertentu.
  document.addEventListener('keydown', (e) => {
    const blocked =
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
      (e.ctrlKey && ['s', 'p', 'u'].includes(e.key.toLowerCase()));
    if (blocked) {
      e.preventDefault();
      reportViolation('shortcut_blocked', e.key);
    }
  });

  // ---------- Fullscreen enforcement (nyata & efektif) ----------
  function requestFs() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) return req.call(el);
    return Promise.reject(new Error('Fullscreen API tidak didukung browser ini'));
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  }

  ['fullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'].forEach((evt) => {
    document.addEventListener(evt, () => {
      if (!isFullscreen()) {
        reportViolation('exit_fullscreen');
        // Sesuai permintaan: keluar fullscreen -> reload agar keluar dari sesi ujian.
        setTimeout(() => { window.location.href = '/index.html'; }, 400);
      }
    });
  });

  // ---------- Tab-switch / blur detection (dicatat, tidak bisa diblokir) ----------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reportViolation('tab_hidden');
  });
  window.addEventListener('blur', () => reportViolation('window_blur'));

  // ---------- Heuristik DevTools (deterrent, bukan jaminan) ----------
  setInterval(() => {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > 160 || heightDiff > 160) {
      reportViolation('devtools_heuristic');
    }
  }, 1500);

  return { requestFs, isFullscreen, reportViolation };
}

// ---------- Timer countdown + auto-submit ----------
function initExamTimer({ remainingMs, onExpire }) {
  const el = document.getElementById('d-timer-text');
  let ms = remainingMs;

  function render() {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    if (el) el.textContent = `${h}:${m}:${s}`;
  }
  render();

  const interval = setInterval(() => {
    ms -= 1000;
    render();
    if (ms <= 0) {
      clearInterval(interval);
      if (onExpire) onExpire();
    }
  }, 1000);

  return { stop: () => clearInterval(interval) };
}
