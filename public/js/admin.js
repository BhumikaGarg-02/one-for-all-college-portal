/* ==========================================================
   admin.js: user management for admin.html
   Needs auth.js (window.OFA) and dashboard.js (sidebar, panels,
   stat cards, user chip) to be loaded first.

   Back-end endpoints used (all admin-only):
     GET   /api/admin/summary
     GET   /api/admin/users?role=&status=&q=&page=
     POST  /api/admin/users                          { role, name }
     PATCH /api/admin/users/:userId/status           { isActive }
     POST  /api/admin/users/:userId/reset-password

   All text from the server is put on the page with textContent,
   so a name like "<b>x</b>" can never inject HTML.
   ========================================================== */
(function () {
  'use strict';

  const API = {
    summary: '/api/admin/summary',
    users: '/api/admin/users'
  };

  const $ = id => document.getElementById(id);
  const state = { page: 1, q: '', role: '', status: '', me: null, requestId: 0, lastUsers: [] };

  /* ---------- Small helpers ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return 'Never';
    // The year is only shown when it is not the current one, which keeps the column narrow
    const options = { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };
    if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
    return date.toLocaleString('en-IN', options);
  }

  const ROLE_LABELS = { student: 'Student', teacher: 'Teacher', admin: 'Admin' };

  // Toast: a short message at the bottom of the screen
  let toastTimer;
  function toast(message, type) {
    const box = $('toast');
    box.textContent = message;
    box.className = `toast is-visible${type === 'error' ? ' toast--error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('is-visible'), 4500);
  }

  // A failed call already redirected to the login page when the login expired (status 401)
  function reportError(err) {
    if (err && err.status === 401) return;
    toast((err && err.message) || 'Something went wrong. Please try again.', 'error');
  }

  /* ---------- Dialogs ---------- */
  // Shows a Yes/No dialog and resolves to true (confirmed) or false (Cancel or Esc)
  function askConfirm({ title, text, okLabel, danger }) {
    const dialog = $('confirmDialog');
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    const ok = $('confirmOk');
    ok.textContent = okLabel;
    ok.className = `btn ${danger ? 'btn--danger-solid' : 'btn--primary'}`;
    dialog.returnValue = '';

    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
      dialog.showModal();
      $('confirmCancel').focus();            // the safe choice is focused first
    });
  }

  // The temporary password dialog. The password only lives in the page while it is open.
  function showSecret({ title, intro, userId, name, password }) {
    const dialog = $('secretDialog');
    $('secretTitle').textContent = title;
    $('secretIntro').textContent = intro;
    $('secretId').textContent = userId;
    $('secretName').textContent = name || '-';
    $('secretPassword').textContent = password;
    $('copyPassword').textContent = 'Copy password';
    $('copyMessage').textContent = 'Copy login details';

    const lines = [
      'ONE FOR ALL login details',
      `ID: ${userId}`,
      `Temporary password: ${password}`,
      `Sign in at ${window.location.origin}/login.html and choose your own password when asked.`
    ];
    const message = lines.join('\n');

    return new Promise(resolve => {
      const wire = (id, text, doneLabel) => {
        $(id).onclick = async event => {
          const button = event.currentTarget;
          const copied = await copyText(text);
          button.textContent = copied ? 'Copied!' : 'Press Ctrl+C to copy';
          if (!copied) selectText($('secretPassword'));
          setTimeout(() => { button.textContent = doneLabel; }, 2200);
        };
      };
      wire('copyPassword', password, 'Copy password');
      wire('copyMessage', message, 'Copy login details');

      $('secretDone').onclick = () => dialog.close();
      dialog.addEventListener('close', () => {
        // Remove the secret from the page as soon as the dialog closes
        $('secretPassword').textContent = '';
        $('copyPassword').onclick = null;
        $('copyMessage').onclick = null;
        resolve();
      }, { once: true });

      dialog.showModal();
    });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      return false;           // not allowed (for example, a non-HTTPS address): the caller shows a hint
    }
  }

  function selectText(node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /* ---------- Stat cards (refreshed after every change) ---------- */
  async function refreshStats() {
    try {
      const data = await window.OFA.apiFetch(API.summary);
      document.querySelectorAll('#statsGroup [data-stat]').forEach(card => {
        const value = data[card.dataset.stat];
        card.querySelector('.stat__value').textContent = value === undefined ? '-' : value;
      });
    } catch (err) { /* the cards simply keep their old numbers */ }
  }

  /* ---------- Users table ---------- */
  function showUsersState(title, text, onRetry) {
    const box = el('div', 'state');
    box.appendChild(el('p', 'state__title', title));
    if (text) box.appendChild(el('p', '', text));
    if (onRetry) {
      const retry = el('button', 'btn btn--outline', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', onRetry);
      box.appendChild(retry);
    }
    $('usersState').replaceChildren(box);
    $('usersTable').hidden = true;
    $('pager').hidden = true;
  }

  function cell(label, content, className) {
    const td = el('td', className);
    td.dataset.label = label;
    if (content instanceof Node) td.appendChild(content);
    else td.textContent = content;
    return td;
  }

  function statusBadges(user) {
    const wrap = el('div', 'badges');
    wrap.appendChild(user.isActive ? el('span', 'badge badge--ok', 'Active') : el('span', 'badge badge--bad', 'Disabled'));
    if (user.isActive && user.isFirstLogin) wrap.appendChild(el('span', 'badge badge--warn', 'Awaiting first login'));
    return wrap;
  }

  function actionButtons(user) {
    const wrap = el('div', 'row-actions');

    // An admin cannot disable or reset their own account (the server refuses too)
    if (state.me && user.userId === state.me.userId) {
      wrap.appendChild(el('span', 'you-tag', 'This is you'));
      return wrap;
    }

    const toggle = el('button', `btn btn--small ${user.isActive ? 'btn--danger' : 'btn--outline'}`, user.isActive ? 'Disable' : 'Enable');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', `${user.isActive ? 'Disable' : 'Enable'} ${user.userId}`);
    toggle.addEventListener('click', () => toggleActive(user, toggle));

    const reset = el('button', 'btn btn--small btn--outline', 'Reset password');
    reset.type = 'button';
    reset.setAttribute('aria-label', `Reset password for ${user.userId}`);
    reset.addEventListener('click', () => resetPassword(user, reset));

    wrap.append(toggle, reset);
    return wrap;
  }

  function renderUsers(data) {
    state.lastUsers = data.items;
    const body = $('usersBody');
    body.replaceChildren();

    if (!data.items.length) {
      const filtered = state.q || state.role || state.status;
      showUsersState(filtered ? 'No matching users' : 'No users yet',
        filtered ? 'Try a different search or clear the filters.' : 'Create the first account from the Create User page.');
      return;
    }

    data.items.forEach(user => {
      const tr = el('tr');
      tr.append(
        cell('ID', user.userId, 'col-id'),
        cell('Name', user.name || '-', 'col-name'),
        cell('Role', ROLE_LABELS[user.role] || user.role),
        cell('Status', statusBadges(user)),
        cell('Last sign-in', formatDateTime(user.lastLoginAt), 'col-muted'),
        cell('Actions', actionButtons(user))
      );
      body.appendChild(tr);
    });

    $('usersState').replaceChildren();
    $('usersTable').hidden = false;

    // "Showing 1-10 of 54"
    const first = (data.page - 1) * data.limit + 1;
    const last = first + data.items.length - 1;
    $('pagerText').textContent = `Showing ${first}-${last} of ${data.total}`;
    $('prevBtn').disabled = data.page <= 1;
    $('nextBtn').disabled = data.page >= data.pages;
    $('pager').hidden = false;
  }

  async function loadUsers() {
    const requestId = ++state.requestId;           // so a slow, older answer can never overwrite a newer one
    const params = new URLSearchParams({ page: state.page });
    if (state.q) params.set('q', state.q);
    if (state.role) params.set('role', state.role);
    if (state.status) params.set('status', state.status);

    $('usersBox').setAttribute('aria-busy', 'true');
    try {
      const data = await window.OFA.apiFetch(`${API.users}?${params}`);
      if (requestId !== state.requestId) return;

      // The last user on this page was just removed from view (for example filtered out): go back a page
      if (!data.items.length && data.page > 1) {
        state.page = data.pages;
        return loadUsers();
      }
      renderUsers(data);
    } catch (err) {
      if (requestId !== state.requestId || (err && err.status === 401)) return;
      showUsersState('Could not load users', err.message, loadUsers);
    } finally {
      if (requestId === state.requestId) $('usersBox').removeAttribute('aria-busy');
    }
  }

  /* ---------- Row actions ---------- */
  async function toggleActive(user, button) {
    const disabling = user.isActive;
    if (disabling) {
      const sure = await askConfirm({
        title: `Disable ${user.userId}?`,
        text: `${user.name || user.userId} will be signed out straight away and cannot sign in until you enable the account again.`,
        okLabel: 'Disable account',
        danger: true
      });
      if (!sure) return;
    }

    button.classList.add('is-loading');
    button.disabled = true;
    try {
      await window.OFA.apiFetch(`${API.users}/${user.userId}/status`, { method: 'PATCH', body: { isActive: !disabling } });
      toast(`${user.userId} ${disabling ? 'disabled' : 'enabled'}.`);
      await loadUsers();
      refreshStats();
    } catch (err) {
      reportError(err);
      button.classList.remove('is-loading');
      button.disabled = false;
    }
  }

  async function resetPassword(user, button) {
    const sure = await askConfirm({
      title: `Reset password for ${user.userId}?`,
      text: `${user.name || user.userId}'s current password will stop working and they will be signed out everywhere. You will get a new temporary password to give them.`,
      okLabel: 'Reset password',
      danger: false
    });
    if (!sure) return;

    button.classList.add('is-loading');
    button.disabled = true;
    try {
      const result = await window.OFA.apiFetch(`${API.users}/${user.userId}/reset-password`, { method: 'POST' });
      button.classList.remove('is-loading');
      button.disabled = false;
      await showSecret({
        title: 'Password reset',
        intro: `Give this temporary password to ${user.name || user.userId}. They will choose a new one when they sign in.`,
        userId: user.userId,
        name: user.name,
        password: result.temporaryPassword
      });
      loadUsers();
      refreshStats();
    } catch (err) {
      reportError(err);
      button.classList.remove('is-loading');
      button.disabled = false;
    }
  }

  /* ---------- Search and filters ---------- */
  function setupFilters() {
    let timer;
    $('searchInput').addEventListener('input', event => {
      clearTimeout(timer);
      timer = setTimeout(() => {              // wait until typing pauses, so we do not ask the server on every key
        state.q = event.target.value.trim();
        state.page = 1;
        loadUsers();
      }, 300);
    });
    $('roleFilter').addEventListener('change', event => { state.role = event.target.value; state.page = 1; loadUsers(); });
    $('statusFilter').addEventListener('change', event => { state.status = event.target.value; state.page = 1; loadUsers(); });
    $('prevBtn').addEventListener('click', () => { if (state.page > 1) { state.page--; loadUsers(); } });
    $('nextBtn').addEventListener('click', () => { state.page++; loadUsers(); });
  }

  /* ---------- Create user ---------- */
  function setupCreateForm() {
    const form = $('createForm');
    const nameInput = $('nameInput');
    const button = $('createBtn');
    const alertBox = $('createAlert');

    const setNameError = message => {
      $('nameField').classList.toggle('has-error', Boolean(message));
      $('nameError').textContent = message || '';
      nameInput.setAttribute('aria-invalid', Boolean(message));
    };
    nameInput.addEventListener('input', () => setNameError(''));

    form.addEventListener('submit', async event => {
      event.preventDefault();
      alertBox.hidden = true;
      setNameError('');

      const role = form.elements.role.value;
      const name = nameInput.value.trim().replace(/\s+/g, ' ');

      // Same rule as the server (letters, spaces, . ' - and 2 to 80 characters). The server checks again.
      if (!/^\p{L}[\p{L}\p{M}.' -]{1,79}$/u.test(name)) {
        setNameError('Enter the full name using letters only (2 to 80 characters).');
        nameInput.focus();
        return;
      }

      button.classList.add('is-loading');
      button.disabled = true;
      try {
        const result = await window.OFA.apiFetch(API.users, { method: 'POST', body: { role, name } });
        form.reset();
        button.classList.remove('is-loading');
        button.disabled = false;

        refreshStats();
        loadUsers();
        await showSecret({
          title: 'Account created',
          intro: `Give these login details to ${result.user.name}. They must choose their own password the first time they sign in.`,
          userId: result.user.userId,
          name: result.user.name,
          password: result.temporaryPassword
        });
        nameInput.focus();                     // ready for the next person
      } catch (err) {
        button.classList.remove('is-loading');
        button.disabled = false;
        if (err.status === 401) return;
        if (err.data && err.data.code === 'INVALID_NAME') {
          setNameError(err.message);
          nameInput.focus();
        } else {
          alertBox.textContent = err.message;
          alertBox.hidden = false;
        }
      }
    });
  }

  /* ---------- Start ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    setupFilters();
    setupCreateForm();

    state.me = await window.OFA.ready;          // waits for the guard; stops here if it redirects
    loadUsers();
  });
})();