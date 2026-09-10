# Xayz Exam Web

Web ujian online sederhana: fullscreen enforcement, timer, short URL berbatas waktu, scan QR,
dashboard live (jam, baterai, jaringan, FPS, dll), login Google opsional, dan pencatatan pelanggaran.

Dibangun dengan **Node.js v20 + Express (CommonJS)**, storage file JSON, tanpa dependensi berat.

---

## ⚠️ BACA DULU — Apa yang benar-benar bisa & TIDAK bisa dilakukan

Supaya tidak ada ekspektasi keliru saat dipakai untuk ujian sungguhan:

| Fitur | Status | Catatan |
|---|---|---|
| Fullscreen wajib + deteksi keluar fullscreen | ✅ Nyata | Pakai Fullscreen API standar, bekerja di semua browser modern |
| Timer & auto-submit saat waktu habis | ✅ Nyata | |
| Short URL dengan batas waktu (durasi/rentang tanggal) | ✅ Nyata | |
| Scan QR via webcam, auto redirect internal | ✅ Nyata | Pakai library jsQR |
| Login Google, redirect selalu balik ke domain sendiri | ✅ Nyata (opsional, perlu setup sendiri) | |
| Dashboard jam otomatis WIB/WITA/WIT | ✅ Nyata | |
| Battery indicator | ⚠️ Terbatas | Battery Status API sudah dihapus di banyak browser modern (Firefox, Safari, Chrome desktop terbaru). Tampil "N/A" jika tidak didukung. |
| CPU/Memory/Disk/GPU indicator | ⚠️ Terbatas & perkiraan | Browser TIDAK memberi akses ke persentase pemakaian CPU/RAM/disk sistem asli. Yang ditampilkan: jumlah core logis, heap JS (Chrome saja), nama render GPU, kuota storage browser (bukan disk fisik). |
| FPS real-time | ✅ Nyata | |
| Indikator sinyal/kecepatan internet | ⚠️ Terbatas | Network Information API hanya didukung sebagian browser (utamanya Chrome Android). Browser lain hanya tampil status online/offline. |
| Blokir klik kanan / copy / drag / select | ⚠️ Deterrent saja | Ini level tampilan (CSS/JS), bisa dilewati pengguna yang tahu caranya. Bukan proteksi mutlak. |
| **Anti screenshot / anti screen recording** | ❌ **Tidak mungkin** | Tidak ada website manapun di dunia yang bisa benar-benar mencegah ini — screenshot/recording terjadi di level sistem operasi, di luar kendali halaman web. |
| **Blokir DevTools sepenuhnya** | ❌ **Tidak mungkin, hanya heuristik** | Ada heuristik deteksi (ukuran window), tapi bisa dilewati (devtools di layar lain, mode tertentu, dll). |
| **Deteksi/blokir ekstensi browser luar (AI dll)** | ❌ **Tidak tersedia** | Browser tidak menyediakan API untuk website mendeteksi ekstensi pihak ketiga. |
| **Rotasi IP/User-Agent/Proxy otomatis milik pengguna** | ❌ **Sengaja tidak dibuat** | Ini pola teknik bot-evasion/anti-detect, bukan fitur ujian yang wajar, dan tidak diimplementasikan di proyek ini. |

---

## Instalasi & Menjalankan (VPS / Hosting / Lokal)

```bash
npm install
cp .env.example .env
# edit .env: isi ADMIN_PASSWORD, PUBLIC_BASE_URL, dst
npm start
```

Server berjalan di `http://localhost:3000` (atau `PORT` yang diset di `.env`).

## Deploy ke Vercel (Free Tier)

1. Push project ini ke repository GitHub Anda.
2. Buka [vercel.com](https://vercel.com) → **Import Project** → pilih repo ini.
3. Vercel otomatis mendeteksi `vercel.json` (sudah dikonfigurasi untuk free tier: serverless function + static assets).
4. Set Environment Variables di dashboard Vercel (ADMIN_PASSWORD, PUBLIC_BASE_URL, dll — isi manual, sesuai `.env.example`).
5. Deploy.

**Penting soal Vercel:** filesystem serverless hanya bisa menulis ke `/tmp`, dan `/tmp` bisa
hilang kapan saja saat cold start. Artinya data ujian/hasil **bisa hilang** di Vercel. Cocok untuk
demo atau ujian jangka pendek. Untuk produksi jangka panjang, gunakan VPS/Hosting biasa (`npm start`),
atau sambungkan storage eksternal (Vercel KV/Postgres — perlu modifikasi kode `lib/storage.js`).

> Catatan: kami **tidak** mengimplementasikan penyimpanan otomatis token GitHub (`ghp_...`) ke file
> apa pun. Menyimpan token pribadi secara otomatis setiap kali membuat URL adalah risiko keamanan
> besar (kebocoran kredensial). Jika Anda ingin otomasi deploy dari kode, gunakan GitHub Actions
> dengan **GitHub Secrets** resmi (bukan file biasa) dan Vercel CLI/GitHub integration standar.

## Deploy ke GitHub Pages

GitHub Pages **hanya statis** — tidak ada server backend, jadi fitur dinamis (buat ujian, short URL,
simpan hasil) **tidak bisa berjalan** di sana. Workflow `.github/workflows/deploy-pages.yml` hanya
men-deploy halaman info statis di folder `docs/`. Untuk ujian sungguhan, gunakan VPS/Hosting atau Vercel.

## Login Google (Opsional) — Tutorial Lengkap Bikin Client ID & Secret

1. Buka [Google Cloud Console](https://console.cloud.google.com/) dan login dengan akun Google Anda.
2. Klik dropdown project di pojok kiri atas → **New Project** → beri nama (mis. "Xayz Exam") → **Create**. Tunggu sampai project aktif (pastikan project ini yang terpilih di dropdown).
3. Di menu kiri (atau search bar atas), buka **APIs & Services → OAuth consent screen**.
   - Pilih **User Type**: "External" (kalau untuk umum) lalu **Create**.
   - Isi **App name** (mis. "Xayz Exam"), **User support email**, dan **Developer contact email** — lalu **Save and Continue** sampai selesai (scopes & test users boleh dilewati/default untuk kebutuhan sederhana).
4. Masih di **APIs & Services**, buka **Credentials** di menu kiri.
5. Klik **+ Create Credentials → OAuth client ID**.
   - **Application type**: pilih **Web application**.
   - **Name**: bebas, mis. "Xayz Exam Web".
   - Di bagian **Authorized redirect URIs**, klik **+ Add URI** dan masukkan persis:
     `https://domain-anda.com/auth/google/callback`
     (kalau masih coba-coba lokal: `http://localhost:3000/auth/google/callback`)
   - Klik **Create**.
6. Sebuah popup akan muncul berisi **Client ID** dan **Client Secret** — salin keduanya.
7. Buka file `.env` di project ini, isi:
   ```
   GOOGLE_CLIENT_ID=tempel-client-id-di-sini
   GOOGLE_CLIENT_SECRET=tempel-client-secret-di-sini
   PUBLIC_BASE_URL=https://domain-anda.com
   ```
8. Simpan, lalu jalankan ulang server (`npm start`). Login Google akan otomatis aktif.
9. Kalau ganti domain nantinya, jangan lupa update **Authorized redirect URIs** di langkah 5 dan `PUBLIC_BASE_URL` di `.env` agar tetap sinkron.

Setelah login, peserta **selalu** diarahkan balik ke halaman ujian di domain ini — sistem ini tidak pernah mengarahkan peserta ke domain lain setelah proses login selesai, dan token Google tidak disimpan permanen di server.

---

## Sumber Soal: JSON Internal atau Embed URL Eksternal (Google Form, dll)

Saat admin membuat ujian, ada dua pilihan **Sumber Soal**:

1. **Soal JSON** — soal & pilihan jawaban disimpan di server ini, dinilai otomatis, hasilnya muncul di dashboard admin.
2. **Embed URL Eksternal** — alih-alih soal JSON, admin memasukkan URL apa pun (Google Form, Microsoft Forms, kuis situs lain, dsb). URL tersebut ditampilkan **di dalam iframe** pada halaman ujian kita.
   - Address bar peserta tetap di domain ujian Anda — konten eksternal hanya "dibingkai" di dalamnya, bukan navigasi pindah halaman.
   - Fullscreen enforcement, timer, dan pencatatan pelanggaran (keluar fullscreen/tab) tetap berjalan seperti biasa di sekitar iframe tersebut.
   - **Keterbatasan jujur:** karena kontennya berasal dari domain lain (cross-origin), sistem ini **tidak bisa membaca jawaban** yang diisi peserta di dalam form eksternal itu, dan tidak bisa menilai otomatis — penilaian tetap dilakukan di sistem eksternal (mis. di Google Form/Google Sheets terkait). Beberapa situs juga mengaktifkan header `X-Frame-Options`/CSP yang menolak ditampilkan dalam iframe sama sekali — ini kendali situs tujuan, bukan sesuatu yang bisa dipaksa dari sisi kita. Google Form sendiri **resmi mendukung** mode embed, jadi aman dipakai.

**Cara ambil URL embed Google Form:** buka form Anda → tombol **Send** (Kirim) → pilih tab ikon `<>` (Embed HTML) → salin URL yang ada di dalam atribut `src="..."` pada kode yang muncul (biasanya berakhiran `?embedded=true`) → tempel di kolom "URL Google Form / Situs Lain" saat membuat ujian di admin.

**Selalu klik "Test Embed" dulu sebelum membagikan link ke peserta.** Beberapa platform kuis (terutama yang punya sistem anti-cheat sendiri, seperti sebagian fitur di Quizizz/Kahoot) sengaja memblokir iframe lewat header `X-Frame-Options`/CSP supaya tidak bisa "dibungkus" tool eksternal manapun — ini kontrol penuh dari situs tujuan dan tidak bisa dipaksa tembus dari sisi manapun. Kami juga tidak bisa mengklaim deteksi otomatis 100% akurat (browser tidak mengizinkan JavaScript membaca status sukses/gagal iframe cross-origin secara pasti) — makanya tombol Test Embed menampilkan pratinjau visual yang harus Anda periksa sendiri sebelum dipakai peserta. Kalau ternyata diblokir, gunakan tipe "Soal JSON" sebagai gantinya.

---

## Tutorial Penggunaan

### Sebagai Admin
1. Buka `/admin.html`, login dengan `ADMIN_PASSWORD`.
2. Buat ujian baru: isi judul, durasi, batas pelanggaran, dan soal (format JSON, lihat contoh di form).
3. Generate short URL: pilih ujian, tentukan batas waktu (durasi dari sekarang, atau rentang tanggal spesifik).
4. Bagikan short URL atau tampilkan sebagai QR code ke peserta.
5. Lihat hasil peserta di bagian "Hasil Peserta".

### Sebagai Peserta
1. Buka halaman utama, masukkan URL/kode ujian atau scan QR.
2. Klik "Masuk Fullscreen & Mulai" — wajib fullscreen untuk memulai.
3. Jawab soal; jawaban tersimpan otomatis setiap kali memilih opsi.
4. Jika keluar dari fullscreen atau pindah tab, sistem mencatat sebagai pelanggaran. Terlalu banyak pelanggaran → otomatis didiskualifikasi.
5. Submit manual, atau otomatis ter-submit saat waktu habis.

---

## Struktur Proyek

```
xayz-exam-web/
├── server.js              # Entry point utama (npm start)
├── api/index.js           # Wrapper untuk Vercel serverless
├── vercel.json            # Config Vercel (free tier)
├── lib/                    # Logic: exam, session, shorturl, storage, googleAuth
├── public/                 # Frontend: HTML/CSS/JS statis
├── data/                   # Storage JSON (dibuat otomatis, jangan commit isinya)
├── docs/                   # Halaman statis untuk GitHub Pages
└── .github/workflows/       # CI untuk deploy GitHub Pages
```

## Lisensi

MIT — silakan dimodifikasi sesuai kebutuhan Anda.
