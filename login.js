/* ==========================================================
   login.js: role tabs, form building, validation, sign-in
   Sections: 1) config  2) build forms  3) tabs  4) form helpers
             5) sign in  6) forgot password dialog  7) init
   ========================================================== */

/* ---------- 1) Config ----------
   One entry per role. Adding a role later means adding one object
   here plus one tab button in login.html. */
const ROLES = {
  student: {
    label: 'Student', prefix: 'STD', example: 'STD0001',
    dashboard: 'dashboard/student.html',
    asideTitle: 'Welcome back, student',
    asideText: 'Check your marks, track attendance and stay on top of what is happening on campus.',
    perks: ['View marks and attendance progress', 'Download study materials', 'Book appointments with teachers', 'Ask doubts and get answers']
  },
  teacher: {
    label: 'Teacher', prefix: 'TEA', example: 'TEA0001',
    dashboard: 'dashboard/teacher.html',
    asideTitle: 'Welcome back, teacher',
    asideText: 'Manage your classes, share materials and stay connected with your students.',
    perks: ['Upload marks and results', 'Mark daily attendance', 'Share PDF study materials', 'Accept appointments and answer queries']
  },
  admin: {
    label: 'Admin', prefix: 'ADM', example: 'ADM0001',
    dashboard: 'dashboard/admin.html',
    asideTitle: 'Welcome back, admin',
    asideText: 'Run the college from one place: people, courses, content and reports.',
    perks: ['Create and manage users and IDs', 'Manage courses and subjects', 'Publish announcements and gallery', 'View statistics and reports']
  }
};

// Backend endpoints (built in Step 3). Kept in one place so they are easy to change.
const API = {
  login: '/api/auth/login',
  forgot: '/api/auth/forgot-password'
};

const tabsEl = document.getElementById('roleTabs');
const panelsEl = document.getElementById('loginPanels');
let activeRole = 'student';

/* ---------- 2) Build one form per role from the <template> ---------- */
function buildForms() {
  const template = document.getElementById('loginTemplate');

  Object.entries(ROLES).forEach(([role, cfg]) => {
    const form = template.content.firstElementChild.cloneNode(true);
    form.id = `panel-${role}`;
    form.dataset.role = role;
    form.setAttribute('aria-labelledby', `tab-${role}`);

    form.querySelector('.login-form__title').textContent = `${cfg.label} login`;
    form.querySelector('.login-form__sub').textContent = `Enter the ${cfg.label} ID and password you received.`;
    form.querySelector('.login-form__submit').textContent = `Sign in as ${cfg.label}`;

    // Unique ids per form so labels and error messages connect correctly
    const idInput = form.querySelector('[data-id="userId"]');
    const pwInput = form.querySelector('[data-id="password"]');
    idInput.id = `${role}-userId`;
    pwInput.id = `${role}-password`;
    idInput.placeholder = `e.g. ${cfg.example}`;
    form.querySelector('[data-for="userId"]').htmlFor = idInput.id;
    form.querySelector('[data-for="password"]').htmlFor = pwInput.id;
    form.querySelector('.field__hint').textContent = `Format: ${cfg.prefix} followed by 4 digits`;

    const errors = form.querySelectorAll('.field__error');
    errors[0].id = `${role}-userId-error`;
    errors[1].id = `${role}-password-error`;
    idInput.setAttribute('aria-describedby', errors[0].id);
    pwInput.setAttribute('aria-describedby', errors[1].id);

    wireForm(form, idInput, pwInput);
    panelsEl.appendChild(form);
  });
}

/* ---------- 3) Tabs ---------- */
function selectRole(role, { focus = false } = {}) {
  if (!ROLES[role]) role = 'student';
  activeRole = role;

  const tabs = [...tabsEl.querySelectorAll('.role-tab')];
  tabs.forEach((tab, i) => {
    const selected = tab.dataset.role === role;
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;            // roving tabindex: only the active tab is in the tab order
    if (selected) {
      tabsEl.style.setProperty('--i', i);        // moves the sliding pill (see login.css)
      if (focus) tab.focus();
    }
  });

  panelsEl.querySelectorAll('.login-form').forEach(form => {
    form.hidden = form.dataset.role !== role;
  });

  // Update the left panel text
  const cfg = ROLES[role];
  document.getElementById('asideTitle').textContent = cfg.asideTitle;
  document.getElementById('asideText').textContent = cfg.asideText;
  document.getElementById('asidePerks').innerHTML = cfg.perks
    .map(p => `<li><svg class="icon icon--sm"><use href="#i-check"></use></svg><span>${p}</span></li>`)
    .join('');

  // Keep the URL shareable (login.html?role=teacher) without adding history entries
  history.replaceState(null, '', `?role=${role}`);
}

function initTabs() {
  tabsEl.addEventListener('click', e => {
    const tab = e.target.closest('.role-tab');
    if (tab) selectRole(tab.dataset.role);
  });

  // Arrow keys move between tabs, as screen-reader users expect from a tablist
  tabsEl.addEventListener('keydown', e => {
    const roles = Object.keys(ROLES);
    const current = roles.indexOf(activeRole);
    let next = null;
    if (e.key === 'ArrowRight') next = (current + 1) % roles.length;
    if (e.key === 'ArrowLeft')  next = (current - 1 + roles.length) % roles.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End')  next = roles.length - 1;
    if (next === null) return;
    e.preventDefault();
    selectRole(roles[next], { focus: true });
  });
}

/* ---------- 4) Form helpers ---------- */
function showAlert(form, message) {
  const box = form.querySelector('.alert');
  box.textContent = message;
  box.hidden = !message;
}

function setFieldError(input, message) {
  const field = input.closest('.field');
  field.classList.toggle('has-error', Boolean(message));
  field.querySelector('.field__error').textContent = message || '';
  input.setAttribute('aria-invalid', Boolean(message));
}

function setLoading(form, loading) {
  const btn = form.querySelector('.login-form__submit');
  btn.disabled = loading;
  btn.classList.toggle('is-loading', loading);
}

// Wires up the show/hide toggle, caps-lock hint, forgot link and submit for one form
function wireForm(form, idInput, pwInput) {
  const toggle = form.querySelector('.password-toggle');
  const caps = form.querySelector('.caps-warning');

  toggle.addEventListener('click', () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', show);
    pwInput.focus();
  });

  // Caps Lock hint (only works on key events, which is fine for typing a password)
  const checkCaps = e => { caps.hidden = !e.getModifierState || !e.getModifierState('CapsLock'); };
  pwInput.addEventListener('keydown', checkCaps);
  pwInput.addEventListener('keyup', checkCaps);
  pwInput.addEventListener('blur', () => { caps.hidden = true; });

  // IDs are always upper case, so convert while typing
  idInput.addEventListener('input', () => {
    idInput.value = idInput.value.toUpperCase().replace(/\s/g, '');
    setFieldError(idInput, '');
  });
  pwInput.addEventListener('input', () => setFieldError(pwInput, ''));

  form.querySelector('.forgot-link').addEventListener('click', () => openForgotDialog(idInput.value));
  form.addEventListener('submit', e => { e.preventDefault(); handleSignIn(form, idInput, pwInput); });
}

function validateId(value, role) {
  const { prefix, example, label } = ROLES[role];
  const pattern = new RegExp(`^${prefix}\\d{4}$`);
  return pattern.test(value) ? '' : `Enter a valid ${label} ID, like ${example}.`;
}

/* ---------- 5) Sign in ---------- */
async function handleSignIn(form, idInput, pwInput) {
  const role = form.dataset.role;
  const userId = idInput.value.trim();
  const password = pwInput.value;
  showAlert(form, '');

  // Client-side checks first; the server repeats them, this is only for quick feedback
  const idError = validateId(userId, role);
  const pwError = password ? '' : 'Enter your password.';
  setFieldError(idInput, idError);
  setFieldError(pwInput, pwError);
  if (idError || pwError) {
    (idError ? idInput : pwInput).focus();
    return;
  }

  setLoading(form, true);
  try {
    const res = await fetch(API.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password, role })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // One generic message for 401 so we never reveal whether the ID or the password was wrong
      const fallback = res.status === 429
        ? 'Too many attempts. Please wait a few minutes and try again.'
        : 'Incorrect ID or password.';
      showAlert(form, data.message || fallback);
      return;
    }

    // Expected response: { token, role, mustChangePassword }
    // sessionStorage clears when the tab closes. If Step 3 uses an httpOnly cookie
    // instead, these two lines can simply be removed.
    sessionStorage.setItem('ofa_token', data.token);
    sessionStorage.setItem('ofa_role', data.role);

    // First login with the admin-issued password forces a change before anything else
    window.location.href = data.mustChangePassword ? 'change-password.html' : ROLES[role].dashboard;
  } catch (err) {
    showAlert(form, 'We could not reach the server. Please check your connection and try again.');
  } finally {
    setLoading(form, false);
  }
}

/* ---------- 6) Forgot password dialog ---------- */
const forgotDialog = document.getElementById('forgotDialog');
const forgotForm = document.getElementById('forgotForm');
const forgotId = document.getElementById('forgotId');
const forgotAlert = document.getElementById('forgotAlert');

function openForgotDialog(prefillId = '') {
  forgotId.value = prefillId;                    // carry over whatever the user already typed
  forgotAlert.hidden = true;
  setFieldError(forgotId, '');
  forgotDialog.showModal();
  forgotId.focus();
}

function initForgotDialog() {
  document.getElementById('forgotClose').addEventListener('click', () => forgotDialog.close());

  // Click on the dark backdrop (the dialog element itself) closes it
  forgotDialog.addEventListener('click', e => { if (e.target === forgotDialog) forgotDialog.close(); });

  forgotId.addEventListener('input', () => {
    forgotId.value = forgotId.value.toUpperCase().replace(/\s/g, '');
    setFieldError(forgotId, '');
  });

  forgotForm.addEventListener('submit', async e => {
    e.preventDefault();
    const userId = forgotId.value.trim();

    // Any of the three prefixes is valid here, since we don't know the role yet
    if (!/^(STD|TEA|ADM)\d{4}$/.test(userId)) {
      setFieldError(forgotId, 'Enter a valid ID, like STD0001 or TEA0001.');
      forgotId.focus();
      return;
    }

    const submit = document.getElementById('forgotSubmit');
    submit.disabled = true;
    try {
      const res = await fetch(API.forgot, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error('request failed');

      // Same message whether or not the ID exists, so IDs can't be guessed from this form
      forgotAlert.className = 'alert alert--success';
      forgotAlert.textContent = 'Request sent. If this ID exists, the admin office will reset the password and share a temporary one with you.';
    } catch (err) {
      forgotAlert.className = 'alert alert--error';
      forgotAlert.textContent = 'We could not send the request. Please try again, or visit the admin office.';
    } finally {
      forgotAlert.hidden = false;
      submit.disabled = false;
    }
  });
}

/* ---------- 7) Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  buildForms();
  initTabs();
  initForgotDialog();

  // login.html?role=teacher opens the Teacher tab (used by the footer links)
  const requested = new URLSearchParams(location.search).get('role');
  selectRole(requested);
});