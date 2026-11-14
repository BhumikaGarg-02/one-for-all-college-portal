/* ==========================================================
   queryController.js: the Query (doubt) portal
     POST /api/queries                student  ask a question
     GET  /api/queries/mine           student  my questions (newest first)
     GET  /api/queries/inbox          teacher  all questions (status filter)
     POST /api/queries/:id/reply      teacher  answer, or edit your own answer
     GET  /api/queries/summary        student/teacher  counts for the stat cards

   Who may do what is enforced in routes/queries.js (protect(...)).
   A student only ever sees their own questions: every student query
   is filtered by req.user.userId, which comes from the verified login,
   never from anything the browser sends.
   ========================================================== */
const Query = require('../models/Query');

const STATUSES = ['open', 'answered'];
const OBJECT_ID = /^[a-f\d]{24}$/i;
const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const LIMITS = {
  subject:  { min: 3,  max: 120 },
  question: { min: 10, max: 2000 },
  reply:    { min: 2,  max: 3000 }
};

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const invalid = (res, message, code, field) =>
  res.status(400).json({ message, code, field });

/* ---------- Cleaning user text ---------- */
// Removes invisible control characters (keeps new lines and tabs) and trims the ends
function cleanBlock(value) {
  if (typeof value !== 'string') return null;
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

// A single line: every run of spaces, tabs and new lines becomes one space
function cleanLine(value) {
  const text = cleanBlock(value);
  return text === null ? null : text.replace(/\s+/g, ' ');
}

const inRange = (text, { min, max }) => text !== null && text.length >= min && text.length <= max;

/* ---------- What the browser receives ---------- */
function toPublic(q) {
  return {
    id: String(q._id),
    studentId: q.studentId,
    studentName: q.studentName,
    subject: q.subject,
    question: q.question,
    status: q.status,
    teacherReply: q.teacherReply || '',
    repliedBy: q.repliedBy || '',
    repliedByName: q.repliedByName || '',
    repliedAt: q.repliedAt || null,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt
  };
}

// Reads ?status=&page=&limit= from the URL. Returns null after sending a 400.
function readListOptions(req, res) {
  const { status, page: rawPage, limit: rawLimit } = req.query;

  // Query-string values can be arrays or objects (?status[$ne]=x): only plain text is accepted
  const isText = v => v === undefined || typeof v === 'string';
  if (![status, rawPage, rawLimit].every(isText) || (status && !STATUSES.includes(status))) {
    res.status(400).json({ message: 'Invalid request.' });
    return null;
  }
  const page = rawPage === undefined ? 1 : Number(rawPage);
  const limit = rawLimit === undefined ? PAGE_SIZE : Number(rawLimit);
  if (!Number.isInteger(page) || page < 1 || page > 100000 ||
      !Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    res.status(400).json({ message: 'Invalid request.' });
    return null;
  }
  return { status, page, limit };
}

async function sendPage(res, filter, sort, { page, limit }) {
  const [items, total] = await Promise.all([
    Query.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Query.countDocuments(filter)
  ]);
  res.set('Cache-Control', 'no-store');
  res.json({ items: items.map(toPublic), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}

/* ---------- POST /api/queries  (student) ---------- */
const createQuery = asyncHandler(async (req, res) => {
  const { subject: rawSubject, question: rawQuestion } = req.body || {};
  const subject = cleanLine(rawSubject);
  const question = cleanBlock(rawQuestion);

  if (!inRange(subject, LIMITS.subject)) {
    return invalid(res, `Enter a subject of ${LIMITS.subject.min} to ${LIMITS.subject.max} characters.`, 'INVALID_SUBJECT', 'subject');
  }
  if (!inRange(question, LIMITS.question)) {
    return invalid(res, `Describe your doubt in ${LIMITS.question.min} to ${LIMITS.question.max} characters.`, 'INVALID_QUESTION', 'question');
  }

  const created = await Query.create({
    studentId: req.user.userId,
    studentName: String(req.user.name || req.user.userId).slice(0, 80),
    subject,
    question
  });

  res.set('Cache-Control', 'no-store');
  return res.status(201).json({ query: toPublic(created) });
});

/* ---------- GET /api/queries/mine  (student) ---------- */
const listMine = asyncHandler(async (req, res) => {
  const options = readListOptions(req, res);
  if (!options) return;

  const filter = { studentId: req.user.userId };
  if (options.status) filter.status = options.status;
  await sendPage(res, filter, { createdAt: -1 }, options);
});

/* ---------- GET /api/queries/inbox  (teacher) ---------- */
const listInbox = asyncHandler(async (req, res) => {
  const options = readListOptions(req, res);
  if (!options) return;

  const filter = options.status ? { status: options.status } : {};
  // Waiting questions: oldest first, so nobody is left waiting. Everything else: newest first.
  const sort = options.status === 'open' ? { createdAt: 1 } : { createdAt: -1 };
  await sendPage(res, filter, sort, options);
});

/* ---------- POST /api/queries/:id/reply  { reply }  (teacher) ---------- */
const replyToQuery = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!OBJECT_ID.test(id)) return res.status(404).json({ message: 'Question not found.' });

  const reply = cleanBlock((req.body || {}).reply);
  if (!inRange(reply, LIMITS.reply)) {
    return invalid(res, `Write a reply of ${LIMITS.reply.min} to ${LIMITS.reply.max} characters.`, 'INVALID_REPLY', 'reply');
  }

  const existing = await Query.findById(id).select('status repliedBy').lean();
  if (!existing) return res.status(404).json({ message: 'Question not found.' });

  // An answered question can only be edited by the teacher who answered it
  const editing = existing.status === 'answered';
  if (editing && existing.repliedBy !== req.user.userId) {
    return res.status(403).json({ message: 'Another teacher has already answered this question.', code: 'NOT_YOUR_REPLY' });
  }

  // The filter inside the update makes this safe when two teachers click Send at the same moment:
  // only one update can match, the other gets null and a 409.
  const filter = editing
    ? { _id: id, status: 'answered', repliedBy: req.user.userId }
    : { _id: id, status: 'open' };
  const changes = editing
    ? { teacherReply: reply }
    : {
        status: 'answered',
        teacherReply: reply,
        repliedBy: req.user.userId,
        repliedByName: String(req.user.name || req.user.userId).slice(0, 80),
        repliedAt: new Date()
      };

  const updated = await Query.findOneAndUpdate(filter, { $set: changes }, { new: true, runValidators: true }).lean();
  if (!updated) {
    return res.status(409).json({ message: 'Another teacher answered this question a moment ago.', code: 'ALREADY_ANSWERED' });
  }

  res.set('Cache-Control', 'no-store');
  return res.json({ query: toPublic(updated) });
});

/* ---------- GET /api/queries/summary  (student or teacher) ---------- */
const getSummary = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');

  if (req.user.role === 'student') {
    const mine = { studentId: req.user.userId };
    const [open, answered] = await Promise.all([
      Query.countDocuments({ ...mine, status: 'open' }),
      Query.countDocuments({ ...mine, status: 'answered' })
    ]);
    return res.json({ open, answered, total: open + answered });
  }

  const [open, answered, answeredByMe] = await Promise.all([
    Query.countDocuments({ status: 'open' }),
    Query.countDocuments({ status: 'answered' }),
    Query.countDocuments({ status: 'answered', repliedBy: req.user.userId })
  ]);
  return res.json({ open, answered, total: open + answered, answeredByMe });
});

module.exports = { createQuery, listMine, listInbox, replyToQuery, getSummary };