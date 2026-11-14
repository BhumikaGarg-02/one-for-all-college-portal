/* ==========================================================
   queries.js: the Query Portal for student.html and teacher.html
   Needs auth.js (window.OFA) and dashboard.js (sidebar/panels) loaded first.

   One file serves both roles. After the login check it looks at the
   role and switches on the right parts of the page:

   STUDENT   ask a question (form)  +  list of my questions with replies
   TEACHER   inbox of all questions (Open / Answered / All)  +  reply form

   Back-end endpoints used:
     GET  /api/queries/summary            counts for the stat cards and tabs
     GET  /api/queries/mine               student's own questions
     GET  /api/queries/inbox              teacher's inbox
     POST /api/queries                    ask               { subject, question }
     POST /api/queries/:id/reply          answer or edit    { reply }

   All text from the server goes onto the page with textContent, so a
   question like "<script>" is shown as plain text and can never run.
   ========================================================== */
(function () {
  'use strict';

  const API = {
    summary: '/api/queries/summary',
    mine: '/api/queries/mine',
    inbox: '/api/queries/inbox',
    ask: '/api/queries',
    reply: id => `/api/queries/${id}/reply`
  };

  // The same limits the server uses (the server checks again)
  const LIMITS = { subject: [3, 120], question: [10, 2000], reply: [2, 3000] };
  const PAGE_SIZE = 10;

  const $ = id => document.getElementById(id);

  const state = {
    role: '',
    me: null,
    tab: 'all',               // student: all | open | answered     teacher: open | answered | all
    items: [],                // the questions shown in the list, in order
    page: 0,                  // last page loaded
    pages: 1,
    total: 0,
    requestId: 0,             // so a slow, older answer can never replace a newer one
    openIds: new Set()        // cards that are expanded (kept when the list is redrawn)
  };

  /* ---------- Small helpers ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '';
    // The year is only shown when it is not the current one
    const options = { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };
    if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
    return date.toLocaleString('en-IN', options);
  }

  let toastTimer;
  function toast(message, type) {
    const box = $('toast');
    box.textContent = message;
    box.className = `toast is-visible${type === 'error' ? ' toast--error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('is-visible'), 4500);
  }

  // A 401 already sent the person to the login page, so there is nothing to show
  function reportError(err) {
    if (err && err.status === 401) return;
    toast((err && err.message) || 'Something went wrong. Please try again.', 'error');
  }

  function setLoading(button, loading) {
    button.disabled = loading;
    button.classList.toggle('is-loading', loading);
  }

  function statusBadge(status) {
    return status === 'answered'
      ? el('span', 'badge badge--ok', 'Answered')
      : el('span', 'badge badge--warn', 'Open');
  }

  // A message block with an optional "Try again" button (used for empty and error states)
  function showState(box, title, text, onRetry) {
    const wrap = el('div', 'state');
    wrap.appendChild(el('p', 'state__title', title));
    if (text) wrap.appendChild(el('p', '', text));
    if (onRetry) {
      const retry = el('button', 'btn btn--outline', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', onRetry);
      wrap.appendChild(retry);
    }
    box.replaceChildren(wrap);
  }

  function showSkeleton(box) {
    box.replaceChildren(el('div', 'skeleton'), el('div', 'skeleton'), el('div', 'skeleton'));
    box.setAttribute('aria-busy', 'true');
  }

  /* ---------- Counters and stat cards ---------- */
  async function refreshSummary() {
    try {
      const data = await window.OFA.apiFetch(API.summary);
      document.querySelectorAll('#statsGroup [data-stat]').forEach(card => {
        const value = data[card.dataset.stat];
        card.querySelector('.stat__value').textContent = value === undefined ? '-' : value;
      });
      document.querySelectorAll('[data-count]').forEach(span => {
        const value = data[span.dataset.count];
        span.textContent = value === undefined ? '' : value;
      });
    } catch (err) { /* the numbers simply keep their old values */ }
  }

  // "123 / 2000" under a text box
  function wireCounter(input, counter, max) {
    const update = () => {
      counter.textContent = `${input.value.length} / ${max}`;
      counter.classList.toggle('is-near', input.value.length > max * 0.9);
    };
    input.addEventListener('input', update);
    update();
    return update;
  }

  function setFieldError(field, errorNode, input, message) {
    field.classList.toggle('has-error', Boolean(message));
    errorNode.textContent = message || '';
    input.setAttribute('aria-invalid', Boolean(message));
  }

  /* ---------- One question card ---------- */
  function replyBlock(q) {
    const block = el('div', 'q-block q-reply');
    const edited = q.repliedAt && new Date(q.updatedAt) - new Date(q.repliedAt) > 1500;
    const who = q.repliedByName || q.repliedBy || 'A teacher';
    block.appendChild(el('p', 'q-label', `Reply from ${who} · ${formatDateTime(q.repliedAt)}${edited ? ' (edited)' : ''}`));
    block.appendChild(el('p', 'q-text', q.teacherReply));
    return block;
  }

  // The teacher's reply form. "initial" is filled in when editing an existing reply.
  function replyForm(q, { initial = '', label = 'Send reply', onCancel } = {}) {
    const form = el('form', 'q-reply-form');
    form.noValidate = true;

    const field = el('div', 'field');
    const labelNode = el('label', '', onCancel ? 'Edit your reply' : 'Your reply');
    labelNode.htmlFor = `reply-${q.id}`;
    const textarea = el('textarea', 'textarea');
    textarea.id = `reply-${q.id}`;
    textarea.rows = 4;
    textarea.maxLength = LIMITS.reply[1];
    textarea.placeholder = 'Write a clear answer the student can follow...';
    textarea.value = initial;
    const error = el('span', 'field__error');
    error.setAttribute('aria-live', 'polite');
    field.append(labelNode, textarea, error);

    const foot = el('div', 'q-form-foot');
    const counter = el('span', 'counter');
    wireCounter(textarea, counter, LIMITS.reply[1]);
    foot.appendChild(counter);

    if (onCancel) {
      const cancel = el('button', 'btn btn--outline btn--small', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', onCancel);
      foot.appendChild(cancel);
    }
    const send = el('button', 'btn btn--primary btn--small', label);
    send.type = 'submit';
    foot.appendChild(send);
    form.append(field, foot);

    textarea.addEventListener('input', () => setFieldError(field, error, textarea, ''));
    textarea.addEventListener('keydown', event => {          // Ctrl+Enter sends
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) form.requestSubmit();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const text = textarea.value.trim();
      if (text.length < LIMITS.reply[0] || text.length > LIMITS.reply[1]) {
        setFieldError(field, error, textarea, `Write a reply of ${LIMITS.reply[0]} to ${LIMITS.reply[1]} characters.`);
        textarea.focus();
        return;
      }

      setLoading(send, true);
      try {
        const data = await window.OFA.apiFetch(API.reply(q.id), { method: 'POST', body: { reply: text } });
        toast(onCancel ? 'Reply updated.' : `Reply sent to ${q.studentName}.`);
        applyUpdate(data.query);
      } catch (err) {
        setLoading(send, false);
        if (err.data && err.data.field === 'reply') {
          setFieldError(field, error, textarea, err.message);
          textarea.focus();
        } else if (err.data && (err.data.code === 'ALREADY_ANSWERED' || err.data.code === 'NOT_YOUR_REPLY')) {
          toast(err.message, 'error');      // somebody else got there first: show the current state
          loadList(true);
          refreshSummary();
        } else {
          reportError(err);
        }
      }
    });
    return form;
  }

  function renderCard(q) {
    const isTeacher = state.role === 'teacher';
    const card = el('details', `q-card ${q.status === 'answered' ? 'is-answered' : 'is-open-question'}`);
    card.dataset.id = q.id;
    card.open = state.openIds.has(q.id);
    card.addEventListener('toggle', () => {
      if (card.open) state.openIds.add(q.id); else state.openIds.delete(q.id);
    });

    // The always-visible header line
    const head = el('summary', 'q-card__head');
    const main = el('div', 'q-card__main');
    main.appendChild(el('p', 'q-card__subject', q.subject));
    main.appendChild(el('p', 'q-card__meta',
      isTeacher ? `${q.studentName} (${q.studentId}) · ${formatDateTime(q.createdAt)}` : `Asked ${formatDateTime(q.createdAt)}`));
    const side = el('div', 'q-card__side');
    side.appendChild(statusBadge(q.status));
    head.append(main, side);

    // The part that opens
    const body = el('div', 'q-card__body');
    const question = el('div', 'q-block');
    question.appendChild(el('p', 'q-label', 'Question'));
    question.appendChild(el('p', 'q-text', q.question));
    body.appendChild(question);

    if (q.status === 'answered') {
      const slot = el('div');
      const showReply = () => {
        slot.replaceChildren(replyBlock(q));
        if (isTeacher && q.repliedBy === state.me.userId) {
          const edit = el('button', 'btn btn--outline btn--small q-edit', 'Edit reply');
          edit.type = 'button';
          edit.addEventListener('click', () => {
            const form = replyForm(q, { initial: q.teacherReply, label: 'Save changes', onCancel: showReply });
            slot.replaceChildren(form);
            form.querySelector('textarea').focus();
          });
          slot.appendChild(edit);
        }
      };
      showReply();
      body.appendChild(slot);
    } else if (isTeacher) {
      body.appendChild(replyForm(q));
    } else {
      body.appendChild(el('p', 'q-wait', 'Waiting for a teacher to reply. Your answer will appear here.'));
    }

    card.append(head, body);
    return card;
  }

  /* ---------- The main list ---------- */
  function emptyMessage() {
    if (state.role === 'student') {
      return {
        all: ['You have not asked anything yet', 'Use the form to send your first doubt to the teachers.'],
        open: ['Nothing is waiting', 'All your questions have been answered.'],
        answered: ['No replies yet', 'Replies from teachers will show up here.']
      }[state.tab];
    }
    return {
      open: ['All caught up', 'No questions are waiting for a reply.'],
      answered: ['No answered questions yet', 'Questions you and other teachers answer will be listed here.'],
      all: ['No questions yet', 'Questions from students will appear here.']
    }[state.tab];
  }

  function renderList() {
    const box = $('queryList');
    box.removeAttribute('aria-busy');
    const more = $('loadMore');

    if (!state.items.length) {
      const [title, text] = emptyMessage();
      showState(box, title, text);
      more.hidden = true;
      return;
    }

    const list = el('div', 'q-list');
    state.items.forEach(q => list.appendChild(renderCard(q)));
    box.replaceChildren(list);

    more.hidden = state.page >= state.pages;
    more.textContent = `Load more (${Math.max(state.total - state.items.length, 0)} left)`;
  }

  async function loadList(reset) {
    const box = $('queryList');
    if (reset) {
      state.items = [];
      state.page = 0;
      state.pages = 1;
      state.total = 0;
      $('loadMore').hidden = true;
      showSkeleton(box);
    }
    const requestId = ++state.requestId;

    const params = new URLSearchParams({ page: state.page + 1, limit: PAGE_SIZE });
    if (state.tab !== 'all') params.set('status', state.tab);
    const url = state.role === 'student' ? API.mine : API.inbox;

    setLoading($('loadMore'), true);
    try {
      const data = await window.OFA.apiFetch(`${url}?${params}`);
      if (requestId !== state.requestId) return;

      const known = new Set(state.items.map(q => q.id));          // a question may shift between pages
      state.items = state.items.concat(data.items.filter(q => !known.has(q.id)));
      state.page = data.page;
      state.pages = data.pages;
      state.total = data.total;
      renderList();
    } catch (err) {
      if (requestId !== state.requestId || (err && err.status === 401)) return;
      if (!state.items.length) {
        box.removeAttribute('aria-busy');
        showState(box, 'Could not load the questions', err.message, () => loadList(true));
      } else {
        reportError(err);
      }
    } finally {
      if (requestId === state.requestId) setLoading($('loadMore'), false);
    }
  }

  function setTab(tab, reload = true) {
    state.tab = tab;
    document.querySelectorAll('#queryTabs [data-tab]').forEach(button => {
      button.setAttribute('aria-pressed', button.dataset.tab === tab);
    });
    if (reload) loadList(true);
  }

  // A question was created or changed: update the list in place instead of reloading it
  function applyUpdate(updated) {
    const index = state.items.findIndex(q => q.id === updated.id);
    const belongs = state.tab === 'all' || state.tab === updated.status;

    if (index >= 0) {
      if (belongs) state.items[index] = updated;
      else { state.items.splice(index, 1); state.total = Math.max(0, state.total - 1); }
    } else if (belongs) {
      state.items.unshift(updated);
      state.total += 1;
    }
    renderList();
    refreshSummary();
    loadPreview();
  }

  // Jump from the Overview to one question in the full list
  function goTo(q) {
    state.openIds.add(q.id);
    const fits = state.tab === 'all' || state.tab === q.status;
    const needsReload = !fits || !state.items.some(item => item.id === q.id);
    if (!fits) setTab(state.role === 'student' ? 'all' : q.status, false);

    const finish = () => {
      const card = document.querySelector(`.q-card[data-id="${q.id}"]`);
      if (card) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    window.location.hash = 'queries';          // dashboard.js switches the panel
    if (needsReload) loadList(true).then(finish);
    else { renderList(); setTimeout(finish, 60); }
  }

  /* ---------- Overview preview ---------- */
  async function loadPreview() {
    const box = $('recentList');
    if (!box) return;
    const isTeacher = state.role === 'teacher';
    const url = isTeacher ? `${API.inbox}?status=open&limit=4` : `${API.mine}?limit=3`;

    try {
      const data = await window.OFA.apiFetch(url);
      if (!data.items.length) {
        return showState(box, isTeacher ? 'All caught up' : 'No questions yet',
          isTeacher ? 'No questions are waiting for a reply.' : 'Ask your first doubt from the Query Portal.');
      }
      const list = el('ul', 'item-list');
      data.items.forEach(q => {
        const li = el('li', 'item');
        const main = el('div', 'item__main');
        main.appendChild(el('p', 'item__title', q.subject));
        main.appendChild(el('p', 'item__meta',
          isTeacher ? `${q.studentName} (${q.studentId}) · ${formatDateTime(q.createdAt)}` : formatDateTime(q.createdAt)));
        li.appendChild(main);

        if (isTeacher) {
          const reply = el('button', 'btn btn--outline btn--small', 'Reply');
          reply.type = 'button';
          reply.addEventListener('click', () => goTo(q));
          li.appendChild(reply);
        } else {
          const side = el('div', 'q-card__side');
          side.appendChild(statusBadge(q.status));
          li.appendChild(side);
          li.style.cursor = 'pointer';
          li.addEventListener('click', () => goTo(q));
        }
        list.appendChild(li);
      });
      box.replaceChildren(list);
    } catch (err) {
      if (err && err.status === 401) return;
      showState(box, 'Could not load this', err.message, loadPreview);
    }
  }

  /* ---------- Student: ask a question ---------- */
  function setupAskForm() {
    const form = $('askForm');
    if (!form) return;

    const subject = $('subjectInput');
    const question = $('questionInput');
    const button = $('askBtn');
    const alertBox = $('askAlert');
    const fields = {
      subject: { input: subject, wrap: $('subjectField'), error: $('subjectError') },
      question: { input: question, wrap: $('questionField'), error: $('questionError') }
    };
    const updateSubjectCount = wireCounter(subject, $('subjectCount'), LIMITS.subject[1]);
    const updateQuestionCount = wireCounter(question, $('questionCount'), LIMITS.question[1]);

    const showError = (name, message) => setFieldError(fields[name].wrap, fields[name].error, fields[name].input, message);
    subject.addEventListener('input', () => showError('subject', ''));
    question.addEventListener('input', () => showError('question', ''));
    question.addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) form.requestSubmit();
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      alertBox.hidden = true;
      const subjectText = subject.value.trim().replace(/\s+/g, ' ');
      const questionText = question.value.trim();

      let firstBad = null;
      if (subjectText.length < LIMITS.subject[0] || subjectText.length > LIMITS.subject[1]) {
        showError('subject', `Enter a subject of ${LIMITS.subject[0]} to ${LIMITS.subject[1]} characters.`);
        firstBad = subject;
      }
      if (questionText.length < LIMITS.question[0] || questionText.length > LIMITS.question[1]) {
        showError('question', `Describe your doubt in ${LIMITS.question[0]} to ${LIMITS.question[1]} characters.`);
        firstBad = firstBad || question;
      }
      if (firstBad) return firstBad.focus();

      setLoading(button, true);
      try {
        const data = await window.OFA.apiFetch(API.ask, { method: 'POST', body: { subject: subjectText, question: questionText } });
        form.reset();
        updateSubjectCount();
        updateQuestionCount();
        toast('Question sent. A teacher will reply here.');

        state.openIds.add(data.query.id);          // show the new question expanded
        applyUpdate(data.query);
      } catch (err) {
        if (err.status === 401) return;
        if (err.data && fields[err.data.field]) {
          showError(err.data.field, err.message);
          fields[err.data.field].input.focus();
        } else {
          alertBox.textContent = err.message;
          alertBox.hidden = false;
        }
      } finally {
        setLoading(button, false);
      }
    });
  }

  /* ---------- Start ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    // Wire the parts that do not need to know who is signed in
    document.querySelectorAll('#queryTabs [data-tab]').forEach(button => {
      button.addEventListener('click', () => setTab(button.dataset.tab));
    });
    $('loadMore').addEventListener('click', () => loadList(false));

    const me = await window.OFA.ready;          // waits for the guard; stops here if it redirects
    state.me = me;
    state.role = me.role;
    state.tab = me.role === 'teacher' ? 'open' : 'all';

    setupAskForm();
    setTab(state.tab, false);
    loadList(true);
    loadPreview();
    refreshSummary();
  });
})();