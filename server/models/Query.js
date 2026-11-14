/* ==========================================================
   models/Query.js: a student's doubt and the teacher's reply

   One document = one question. It starts as "open" and becomes
   "answered" when a teacher replies.

   People are stored by their portal ID (STD0001, TEA0001) plus a
   name copied at the time, so the list pages never need to look
   anything up in the users collection.
   ========================================================== */
const mongoose = require('mongoose');

const querySchema = new mongoose.Schema(
  {
    // Who asked
    studentId:   { type: String, required: true, match: /^STD\d{4}$/ },
    studentName: { type: String, required: true, trim: true, maxlength: 80 },

    // The question
    subject:  { type: String, required: true, trim: true, minlength: 3,  maxlength: 120 },
    question: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },

    // Where it stands
    status: { type: String, enum: ['open', 'answered'], default: 'open' },

    // The answer (empty until a teacher replies)
    teacherReply:  { type: String, default: '', maxlength: 3000 },
    repliedBy:     { type: String, default: '' },          // teacher ID, e.g. TEA0001
    repliedByName: { type: String, default: '', maxlength: 80 },
    repliedAt:     { type: Date, default: null }
  },
  { timestamps: true }                                     // adds createdAt and updatedAt
);

// A student's own list, newest first
querySchema.index({ studentId: 1, createdAt: -1 });
// The teacher inbox filtered by status
querySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Query', querySchema);