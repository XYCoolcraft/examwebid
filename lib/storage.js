'use strict';
/**
 * Storage sederhana berbasis file JSON.
 *
 * PENTING (baca ini sebelum deploy):
 * - Di VPS/Hosting biasa: folder /data bersifat PERMANEN. Aman dipakai produksi skala kecil-menengah.
 * - Di Vercel (serverless, free tier): filesystem HANYA bisa ditulis di /tmp, dan /tmp bersifat
 *   SEMENTARA (bisa hilang kapan saja saat cold start / instance baru). Artinya data ujian, hasil,
 *   dan short URL BISA HILANG di Vercel. Untuk produksi serius di Vercel, sambungkan storage
 *   eksternal (mis. Vercel KV / database). Ini bukan bug, tapi keterbatasan platform serverless
 *   yang harus disadari sejak awal, bukan disembunyikan.
 */
const fs = require('fs');
const path = require('path');

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? '/tmp/xayz-exam-data' : path.join(__dirname, '..', 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readAll(name) {
  ensureDir();
  const fp = filePath(name);
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, '[]', 'utf8');
    return [];
  }
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (err) {
    console.error(`[storage] gagal baca ${name}.json:`, err.message);
    return [];
  }
}

function writeAll(name, arr) {
  ensureDir();
  fs.writeFileSync(filePath(name), JSON.stringify(arr, null, 2), 'utf8');
}

function insert(name, record) {
  const arr = readAll(name);
  arr.push(record);
  writeAll(name, arr);
  return record;
}

function update(name, predicate, patch) {
  const arr = readAll(name);
  let updated = null;
  const next = arr.map((item) => {
    if (predicate(item)) {
      updated = Object.assign({}, item, patch);
      return updated;
    }
    return item;
  });
  writeAll(name, next);
  return updated;
}

function findOne(name, predicate) {
  return readAll(name).find(predicate) || null;
}

module.exports = { readAll, writeAll, insert, update, findOne, IS_VERCEL, DATA_DIR };
