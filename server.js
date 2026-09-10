'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { nanoid } = require('nanoid');

const storage = require('./lib/storage');
const examLib = require('./lib/exam');
const shortUrlLib = require('./lib/shorturl');
const sessionLib = require('./lib/session');
const googleAuth = require('./lib/googleAuth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

// ---------- Auth admin sederhana (cookie signed manual, cukup untuk skala kecil) ----------
function isAdmin(req) {
  return req.cookies && req.cookies.xayz_admin === ADMIN_PASSWORD;
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    res.cookie('xayz_admin', password, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 });
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: 'password salah' });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('xayz_admin');
  res.json({ ok: true });
});

app.get('/api/admin/whoami', (req, res) => {
  res.json({ ok: true, isAdmin: isAdmin(req) });
});

// ---------- Exam CRUD (admin only untuk create/list, publicExamView untuk peserta) ----------
app.post('/api/exams', requireAdmin, (req, res) => {
  try {
    const exam = examLib.createExam(req.body || {});
    res.json({ ok: true, exam });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/exams', requireAdmin, (req, res) => {
  res.json({ ok: true, exams: examLib.listExams() });
});

app.get('/api/exams/:id', requireAdmin, (req, res) => {
  const exam = examLib.getExam(req.params.id);
  if (!exam) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, exam });
});

// ---------- Short URL ----------
app.post('/api/shorturls', requireAdmin, (req, res) => {
  try {
    const { examId, window } = req.body || {};
    const exam = examLib.getExam(examId);
    if (!exam) return res.status(404).json({ ok: false, error: 'exam_not_found' });
    const record = shortUrlLib.createShortUrl({ examId, window });
    const absoluteUrl = shortUrlLib.buildAbsoluteShortUrl(PUBLIC_BASE_URL, record.code);
    res.json({ ok: true, shortUrl: record, absoluteUrl });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/shorturls', requireAdmin, (req, res) => {
  res.json({ ok: true, shorturls: storage.readAll('shorturls') });
});

// Resolver short URL -> selalu redirect INTERNAL (ke /exam?token=...), tidak pernah ke domain luar.
// Tidak ada trailing slash tambahan setelah code.
app.get('/s/:code', (req, res) => {
  const result = shortUrlLib.resolveShortUrl(req.params.code);
  if (!result.ok) {
    return res.redirect(`/expired.html?reason=${result.reason}`);
  }
  const exam = examLib.getExam(result.record.examId);
  if (!exam) return res.redirect('/expired.html?reason=exam_missing');

  const session = sessionLib.createSession({ examId: exam.id, userLabel: 'Peserta' });
  // Redirect internal, path bersih tanpa trailing slash ganda.
  res.redirect(`/exam.html?token=${session.token}`);
});

// ---------- Sesi ujian peserta ----------
app.get('/api/session/:token', (req, res) => {
  const session = sessionLib.getSession(req.params.token);
  if (!session) return res.status(404).json({ ok: false, error: 'session_not_found' });
  const exam = examLib.getExam(session.examId);
  if (!exam) return res.status(404).json({ ok: false, error: 'exam_not_found' });

  const elapsedMs = Date.now() - new Date(session.startedAt).getTime();
  const totalMs = exam.durationMinutes * 60 * 1000;
  const remainingMs = Math.max(0, totalMs - elapsedMs);

  res.json({
    ok: true,
    session: { token: session.token, status: session.status, violations: session.violations, answers: session.answers },
    exam: examLib.publicExamView(exam),
    remainingMs,
  });
});

app.post('/api/session/:token/answer', (req, res) => {
  const { questionId, answerIndex } = req.body || {};
  const updated = sessionLib.saveAnswer(req.params.token, questionId, answerIndex);
  if (!updated) return res.status(404).json({ ok: false, error: 'session_not_found' });
  res.json({ ok: true });
});

app.post('/api/session/:token/violation', (req, res) => {
  const { type, detail } = req.body || {};
  const session = sessionLib.getSession(req.params.token);
  if (!session) return res.status(404).json({ ok: false, error: 'session_not_found' });

  const updated = sessionLib.addViolation(req.params.token, type, detail);
  const exam = examLib.getExam(session.examId);
  const limit = exam ? exam.violationLimit : 3;

  let disqualified = false;
  if (updated.violations.length >= limit) {
    sessionLib.finishSession(req.params.token, 'disqualified');
    disqualified = true;
  }
  res.json({ ok: true, violationCount: updated.violations.length, limit, disqualified });
});

app.post('/api/session/:token/submit', (req, res) => {
  const session = sessionLib.getSession(req.params.token);
  if (!session) return res.status(404).json({ ok: false, error: 'session_not_found' });
  const exam = examLib.getExam(session.examId);
  const score = exam ? examLib.scoreExam(exam, session.answers) : null;
  sessionLib.finishSession(req.params.token, 'submitted');
  storage.insert('results', {
    id: nanoid(10),
    examId: session.examId,
    token: session.token,
    userLabel: session.userLabel,
    answers: session.answers,
    score,
    submittedAt: new Date().toISOString(),
  });
  res.json({ ok: true, score });
});

app.get('/api/results/:examId', requireAdmin, (req, res) => {
  const all = storage.readAll('results').filter((r) => r.examId === req.params.examId);
  res.json({ ok: true, results: all });
});

// ---------- Google login (opsional) ----------
app.get('/auth/google/start', (req, res) => {
  const cfg = googleAuth.getConfig();
  if (!cfg.enabled) return res.status(400).send('Google OAuth belum dikonfigurasi (isi .env).');
  const returnToken = req.query.token || '';
  const state = Buffer.from(JSON.stringify({ token: returnToken })).toString('base64url');
  res.redirect(googleAuth.buildAuthUrl(state));
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const profile = await googleAuth.exchangeCodeForProfile(code);
    let token = '';
    try {
      token = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')).token || '';
    } catch (_) {}
    if (token) {
      const session = sessionLib.getSession(token);
      if (session) {
        storage.update('sessions', (r) => r.token === token, { userLabel: profile.email || profile.name });
      }
      // Redirect balik ke halaman exam DI DOMAIN SENDIRI, tidak pernah keluar.
      return res.redirect(`/exam.html?token=${token}`);
    }
    res.redirect('/index.html');
  } catch (err) {
    res.status(500).send('Login Google gagal: ' + err.message);
  }
});

app.get('/api/config/public', (req, res) => {
  res.json({ ok: true, googleEnabled: googleAuth.getConfig().enabled, baseUrl: PUBLIC_BASE_URL });
});

app.get('/', (req, res) => res.sendFile ? res.redirect('/index.html') : res.redirect('/index.html'));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`xayz-exam-web berjalan di http://localhost:${PORT}`);
    console.log(`Storage data: ${storage.DATA_DIR}`);
  });
}

module.exports = app;
