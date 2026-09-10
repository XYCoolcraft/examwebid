'use strict';
// Entry point untuk Vercel (Serverless Function, free tier).
// PENTING: lihat lib/storage.js - di Vercel data disimpan di /tmp yang bersifat SEMENTARA.
// Cocok untuk demo/ujian singkat, kurang cocok untuk penyimpanan hasil jangka panjang
// tanpa storage eksternal (mis. Vercel KV/Postgres).
const app = require('../server.js');
module.exports = app;
