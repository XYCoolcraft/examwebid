'use strict';
const { nanoid } = require('nanoid');
const storage = require('./storage');

const COLLECTION = 'shorturls';

/**
 * Membuat short URL yang HANYA mengarah ke halaman ujian di domain sendiri.
 * Tidak pernah membuat redirect ke domain luar - by design.
 *
 * window: { mode: 'duration', hours: number } ATAU { mode: 'range', startAt: ISOString, endAt: ISOString }
 */
function createShortUrl({ examId, window }) {
  const code = nanoid(8);
  const now = new Date();
  let startAt, endAt;

  if (window.mode === 'duration') {
    startAt = now.toISOString();
    endAt = new Date(now.getTime() + window.hours * 60 * 60 * 1000).toISOString();
  } else if (window.mode === 'range') {
    startAt = new Date(window.startAt).toISOString();
    endAt = new Date(window.endAt).toISOString();
  } else {
    throw new Error('window.mode harus "duration" atau "range"');
  }

  const record = {
    code,
    examId,
    startAt,
    endAt,
    createdAt: now.toISOString(),
    usedCount: 0,
  };
  storage.insert(COLLECTION, record);
  return record;
}

function resolveShortUrl(code) {
  const rec = storage.findOne(COLLECTION, (r) => r.code === code);
  if (!rec) return { ok: false, reason: 'not_found' };

  const now = Date.now();
  const start = new Date(rec.startAt).getTime();
  const end = new Date(rec.endAt).getTime();

  if (now < start) return { ok: false, reason: 'not_started', record: rec };
  if (now > end) return { ok: false, reason: 'expired', record: rec };

  storage.update(COLLECTION, (r) => r.code === code, { usedCount: (rec.usedCount || 0) + 1 });
  return { ok: true, record: rec };
}

// Bangun URL absolut TANPA trailing slash setelah path, sesuai basis publik yang dikonfigurasi.
function buildAbsoluteShortUrl(baseUrl, code) {
  const base = baseUrl.replace(/\/+$/, ''); // buang trailing slash di base
  return `${base}/s/${code}`; // tidak ada "/" tambahan setelah code
}

module.exports = { createShortUrl, resolveShortUrl, buildAbsoluteShortUrl };
