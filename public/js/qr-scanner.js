/**
 * Scan QR lewat webcam. Butuh library jsQR (dimuat lewat <script> CDN di index.html).
 * Begitu QR terbaca dan isinya adalah URL di DOMAIN SENDIRI (short URL /s/xxxx),
 * otomatis redirect. QR yang mengarah ke domain luar akan DITOLAK demi keamanan.
 */
async function startQrScanner({ videoEl, canvasEl, onResult, allowedOrigin }) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  videoEl.srcObject = stream;
  await videoEl.play();

  const ctx = canvasEl.getContext('2d');
  let stopped = false;

  function tick() {
    if (stopped) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      const code = window.jsQR ? window.jsQR(imageData.data, imageData.width, imageData.height) : null;
      if (code && code.data) {
        try {
          const url = new URL(code.data, window.location.origin);
          if (url.origin === allowedOrigin) {
            stopped = true;
            stream.getTracks().forEach((t) => t.stop());
            onResult({ ok: true, url: url.href });
            return;
          } else {
            onResult({ ok: false, reason: 'external_domain', raw: code.data });
          }
        } catch (_) {
          onResult({ ok: false, reason: 'invalid_url', raw: code.data });
        }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return { stop: () => { stopped = true; stream.getTracks().forEach((t) => t.stop()); } };
}
