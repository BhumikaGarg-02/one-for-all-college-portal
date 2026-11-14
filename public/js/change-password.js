/* ==========================================================
   change-password.js: forced password change on first login
   (also works for a voluntary change later)

   Flow: 1) find the saved login  2) ask the server who we are
         3) live rules + strength meter  4) send the new password
         5) save the NEW token the server returns  6) go to the dashboard
   ========================================================== */

/* ---------- 1) Config ---------- */
// Same storage keys that login.js writes
const TOKEN_KEY = 'ofa_token';
const ROLE_KEY = 'ofa_role';

const API = {
  me: '/api/me',
  change: '/api/auth/change-password'
};

// Where each role lands afterwards. These must match ROLES[...].dashboard in login.js.
const DASHBOARDS = {
  admin: 'dashboard/admin.html',
  teacher: 'dashboard/teacher.html',
  student: 'dashboard/student.html'
};
const ROLE_LABELS = { admin: 'Admin', teacher: 'Teacher', student: 'Student' };
const LOGIN_PAGE = 'login.html';

/* ---------- 2) Password rules ----------
   Keep in sync with passwordProblems() in server/controllers/authController.js.
   The server always re-checks, this is only for instant feedback. */
const COMMON_WORDS = ['password', 'qwerty', '123456', 'letmein', 'changeme', 'admin123', 'oneforall', 'welcome'];

const RULES = [
  { key: 'length',    test: pw => pw.length >= 8 && pw.length <= 64 },
  { key: 'lower',     test: pw => /[a-z]/.test(pw) },
  { key: 'upper',     test: pw => /[A-Z]/.test(pw) },
  { key: 'digit',     test: pw => /\d/.test(pw) },
  { key: 'special',   test: pw => /[^A-Za-z0-9\s]/.test(pw) },
  { key: 'spaces',    test: pw => pw.length > 0 && !/\s/.test(pw) },
  { key: 'id',        test: (pw, ctx) => pw.length > 0 && !pw.toUpperCase().includes(ctx.userId) },
  { key: 'common',    test: pw => pw.length > 0 && !COMMON_WORDS.some(w => pw.toLowerCase().includes(w)) },
  // Only meaningful once the current password has been typed
  { key: 'different', test: (pw, ctx) => pw.length > 0 && ctx.current.length > 0 && pw !== ctx.current }
];

/* ---------- 3) Page elements and state ---------- */
const $ = id => document.getElementById(id);
const form = $('changeForm');
const currentInput = $('currentPassword');
const newInput = $('newPassword');
const confirmInput = $('confirmPassword');
const submitBtn = $('submitBtn');
const alertBox = $('formAlert');

// Filled in after the server confirms the login
const state = { userId: '', role: '', forced: true };

/* ---------- 4) Small helpers ---------- */
function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ROLE_KEY);
}

function goToLogin() {
  clearSession();
  window.location.replace(LOGIN_PAGE);
}

// Shows a message in the alert box. "list" is an optional array of bullet points.
// textContent is used everywhere, so nothing from the server can inject HTML.
function showAlert(message, type = 'error', list = []) {
  alertBox.className = `alert alert--${type}`;
  alertBox.textContent = message;
  if (list.length) {
    const ul = document.createElement('ul');
    list.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
    alertBox.appendChild(ul);
  }
  alertBox.hidden = false;
}

function clearAlert() {
  alertBox.hidden = true;
  alertBox.textContent = '';
}

function setFieldError(input, message) {
  const field = input.closest('.field');
  field.classList.toggle('has-error', Boolean(message));
  $(`${input.id}-error`).textContent = message || '';
  input.setAttribute('aria-invalid', Boolean(message));
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle('is-loading', loading);
}

/* ---------- 5) Start: check the saved login ---------- */
async function init() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return goToLogin();            // not signed in: back to the login page

  try {
    const res = await fetch(API.me, { headers: { Authorization: `Bearer ${token}` } });

    // Expired, forged or disabled: the saved login is no good
    if (res.status === 401 || res.status === 403) return goToLogin();
    if (!res.ok) throw new Error(`Server replied ${res.status}`);

    const me = await res.json();
    state.userId = me.userId;
    state.role = me.role;
    state.forced = me.mustChangePassword === true;
    showForm();
  } catch (err) {
    $('loadingNote').hidden = true;
    showAlert('We could not reach the server. Please check your connection and reload the page.');
  }
}

// Reveals the form and adapts the wording to "forced first login" or "voluntary change"
function showForm() {
  $('loadingNote').hidden = true;
  $('whoId').textContent = state.userId;
  $('whoRole').textContent = ROLE_LABELS[state.role] || state.role;
  $('usernameField').value = state.userId;
  $('whoLine').hidden = false;

  if (state.forced) {
    $('pageTitle').textContent = 'Set a new password';
  } else {
    // Already has their own password: this is a normal change, so allow cancelling
    $('pageTitle').textContent = 'Change your password';
    $('asideTitle').textContent = 'Keep your account safe';
    $('asideText').textContent = 'Choose a new password that only you know. Older sessions on other devices will be signed out.';
    $('currentLabel').textContent = 'Current password';
    $('currentHint').textContent = '';
    $('cancelLink').href = DASHBOARDS[state.role] || LOGIN_PAGE;
    $('cancelRow').hidden = false;
  }

  form.hidden = false;
  currentInput.focus();
  updateRules();
}

/* ---------- 6) Live rules checklist and strength meter ---------- */
function updateRules() {
  const ctx = { userId: state.userId, current: currentInput.value };
  const pw = newInput.value;

  let coreMet = 0;    // all rules except "different" feed the meter
  RULES.forEach(rule => {
    const met = rule.test(pw, ctx);
    document.querySelector(`[data-rule="${rule.key}"]`).classList.toggle('is-met', met);
    if (met && rule.key !== 'different') coreMet++;
  });

  const coreTotal = RULES.length - 1;
  let level = '', text = '';
  if (pw.length > 0) {
    if (coreMet < 5) { level = 'weak'; text = 'Weak'; }
    else if (coreMet < coreTotal) { level = 'fair'; text = 'Fair, keep going'; }
    else if (pw.length < 12) { level = 'good'; text = 'Good'; }
    else { level = 'strong'; text = 'Strong'; }
  }
  $('pwMeter').dataset.level = level;
  $('pwMeterBar').style.width = pw.length ? `${Math.max(8, (coreMet / coreTotal) * 100)}%` : '0';
  $('pwMeterText').textContent = text;

  updateMatch();
}

function updateMatch() {
  const both = newInput.value && confirmInput.value;
  const matches = both && newInput.value === confirmInput.value;
  $('confirmOk').hidden = !matches;
  if (matches) setFieldError(confirmInput, '');
}

/* ---------- 7) Submit ---------- */
// Returns true when everything is fine; otherwise shows errors and focuses the first bad field
function validateForm() {
  const ctx = { userId: state.userId, current: currentInput.value };
  let firstBad = null;
  const fail = (input, message) => { setFieldError(input, message); firstBad = firstBad || input; };

  setFieldError(currentInput, '');
  setFieldError(newInput, '');
  setFieldError(confirmInput, '');

  if (!currentInput.value) fail(currentInput, state.forced ? 'Enter the temporary password you were given.' : 'Enter your current password.');
  if (!RULES.every(rule => rule.test(newInput.value, ctx))) fail(newInput, 'Please meet every requirement in the list.');
  if (confirmInput.value !== newInput.value) fail(confirmInput, 'The two passwords do not match.');

  if (firstBad) firstBad.focus();
  return !firstBad;
}

async function handleSubmit(event) {
  event.preventDefault();
  clearAlert();
  if (!validateForm()) return;

  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return goToLogin();

  setLoading(true);
  try {
    const res = await fetch(API.change, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: currentInput.value, newPassword: newInput.value })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) return onSuccess(data);
    handleError(res.status, data);
  } catch (err) {
    showAlert('We could not reach the server. Please check your connection and try again.');
  } finally {
    setLoading(false);
  }
}

function onSuccess(data) {
  // The old token stops working the moment the password changes, so replace it right away
  sessionStorage.setItem(TOKEN_KEY, data.token);
  sessionStorage.setItem(ROLE_KEY, data.role);

  const target = DASHBOARDS[data.role] || LOGIN_PAGE;
  showAlert('Password updated. Taking you to your dashboard...', 'success');
  form.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
  setTimeout(() => window.location.replace(target), 1200);
}

function handleError(status, data) {
  if (status === 401) {
    // Session ended while the page was open (or another device changed the password)
    showAlert('Your session has ended. Taking you back to the login page...');
    return void setTimeout(goToLogin, 1500);
  }
  if (data.code === 'WRONG_CURRENT_PASSWORD') {
    setFieldError(currentInput, data.message);
    return currentInput.focus();
  }
  if (data.code === 'WEAK_PASSWORD') {
    return showAlert(data.message, 'error', data.problems || []);
  }
  showAlert(data.message || 'Something went wrong. Please try again.');
}

/* ---------- 8) Wire everything up ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Show / Hide buttons for all three fields
  form.addEventListener('click', event => {
    const toggle = event.target.closest('.password-toggle');
    if (!toggle) return;
    const input = $(toggle.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', show);
    input.focus();
  });

  newInput.addEventListener('input', () => { setFieldError(newInput, ''); updateRules(); });
  currentInput.addEventListener('input', () => { setFieldError(currentInput, ''); updateRules(); });
  confirmInput.addEventListener('input', () => { setFieldError(confirmInput, ''); updateMatch(); });

  form.addEventListener('submit', handleSubmit);
  $('signOutBtn').addEventListener('click', goToLogin);

  init();
});