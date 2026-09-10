'use strict';
const { nanoid } = require('nanoid');
const storage = require('./storage');

const COLLECTION = 'exams';

function createExam({ title, durationMinutes, questions, violationLimit, type, embedUrl }) {
  const examType = type === 'embed' ? 'embed' : 'quiz';

  if (examType === 'embed') {
    if (!embedUrl || !/^https?:\/\//i.test(embedUrl)) {
      throw new Error('embedUrl wajib diisi dan harus URL http(s) yang valid untuk tipe embed');
    }
  }

  const record = {
    id: nanoid(10),
    title,
    type: examType, // 'quiz' (soal JSON internal) atau 'embed' (Google Form / situs lain via iframe)
    embedUrl: examType === 'embed' ? embedUrl : null,
    durationMinutes: Number(durationMinutes) || 30,
    violationLimit: Number(violationLimit) || 3,
    questions: examType === 'quiz'
      ? (questions || []).map((q, i) => ({
          id: q.id || `q${i + 1}`,
          text: q.text,
          options: q.options,
          correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : null,
        }))
      : [],
    createdAt: new Date().toISOString(),
  };
  storage.insert(COLLECTION, record);
  return record;
}

function getExam(id) {
  return storage.findOne(COLLECTION, (e) => e.id === id);
}

function listExams() {
  return storage.readAll(COLLECTION);
}

// Versi tanpa jawaban benar - dikirim ke peserta agar tidak bisa dilihat di response network.
function publicExamView(exam) {
  return {
    id: exam.id,
    title: exam.title,
    type: exam.type || 'quiz',
    embedUrl: exam.embedUrl || null,
    durationMinutes: exam.durationMinutes,
    violationLimit: exam.violationLimit,
    questions: exam.questions.map((q) => ({ id: q.id, text: q.text, options: q.options })),
  };
}

function scoreExam(exam, answers) {
  // Ujian tipe "embed" (Google Form/situs luar) tidak bisa dinilai otomatis oleh sistem ini,
  // karena jawabannya masuk ke sistem eksternal (mis. Google Form), bukan ke server kita.
  if (exam.type === 'embed') return null;

  let correct = 0;
  exam.questions.forEach((q) => {
    if (q.correctIndex !== null && answers[q.id] === q.correctIndex) correct += 1;
  });
  const total = exam.questions.filter((q) => q.correctIndex !== null).length;
  return { correct, total, percent: total ? Math.round((correct / total) * 100) : null };
}

module.exports = { createExam, getExam, listExams, publicExamView, scoreExam };
