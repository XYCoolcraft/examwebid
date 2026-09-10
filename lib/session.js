'use strict';
const { nanoid } = require('nanoid');
const storage = require('./storage');

const COLLECTION = 'sessions';

function createSession({ examId, userLabel }) {
  const token = nanoid(24);
  const record = {
    token,
    examId,
    userLabel: userLabel || 'Peserta',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running', // running | submitted | expired | disqualified
    violations: [],
    answers: {},
  };
  storage.insert(COLLECTION, record);
  return record;
}

function getSession(token) {
  return storage.findOne(COLLECTION, (s) => s.token === token);
}

function addViolation(token, type, detail) {
  const s = getSession(token);
  if (!s) return null;
  const violations = s.violations.concat([{ type, detail: detail || null, at: new Date().toISOString() }]);
  return storage.update(COLLECTION, (r) => r.token === token, { violations });
}

function saveAnswer(token, questionId, answerIndex) {
  const s = getSession(token);
  if (!s) return null;
  const answers = Object.assign({}, s.answers, { [questionId]: answerIndex });
  return storage.update(COLLECTION, (r) => r.token === token, { answers });
}

function finishSession(token, status) {
  return storage.update(COLLECTION, (r) => r.token === token, {
    status: status || 'submitted',
    finishedAt: new Date().toISOString(),
  });
}

module.exports = { createSession, getSession, addViolation, saveAnswer, finishSession };
