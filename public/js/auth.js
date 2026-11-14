/* ==========================================================
   auth.js: route guard + API helper for protected pages

   Put this in the <head> of every dashboard page, BEFORE any
   other script, and say which role the page is for:

     <script src="../js/auth.js" data-role="student"></script>

   What it does
   1) Hides the page until the server confirms who is signed in
   2) No login / expired login   -> login page
   3) Still on the temporary password -> change-password page
   4) Signed in with the WRONG role  -> that person's own dashboard
   5) Otherwise reveals the page and exposes window.OFA

   IMPORTANT: this guard only decides what the browser SHOWS.
   It is not security. The real protection is on the server:
   every data endpoint must use protect('student') etc.

   window.OFA
     OFA.ready          Promise -> { userId, role, name? } once the guard passes
     OFA.apiFetch(url, options)  fetch with the token; returns parsed JSON
     OFA.logout()       clear the login and go to the login page
   ========================================================== */
(function () {
  'use strict';

  /* ---------- Config ---------- */
  const TOKEN_KEY = 'ofa_token';        // same keys login.js and change-password.js use
  const ROLE_KEY = 'ofa_role';
  const PAGES = { login: '/login.html', change: '/change-password.html' };
  const DASHBOARDS = {
    admin: '/dashboard/admin.html',
    teacher: '/dashboard/teacher.html',
    student: '/dashboard/student.html'
  };

  // The role this page is for, read from the <script data-role="..."> attribute
  const script = document.currentScript;
  const requiredRole = script && script.dataset.role;
  if (!DASHBOARDS[requiredRole]) {
    console.error('auth.js: add data-role="student|teacher|admin" to the script tag.');
  }

  /* ---------- Hide the page until we know who is here ---------- */
  const style = document.createElement('style');
  style.textContent = `
    html.ofa-checking body > :not(.ofa-overlay) { visibility: hidden; }
    .ofa-overlay {
      position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 1rem; padding: 1.5rem; text-align: center;
      background: #F8F9FA; color: #44526D; font: 500 1rem/1.5 'Poppins', system-ui, sans-serif;
    }
    .ofa-overlay button {
      padding: .7rem 1.6rem; border: 0; border-radius: 8px; cursor: pointer;
      background: #0077B6; color: #fff; font: 600 .95rem 'Poppins', system-ui, sans-serif;
    }
    .ofa-spinner {
      width: 34px; height: 34px; border: 3px solid #D5E3EE; border-top-color: #0077B6;
      border-radius: 50%; animation: ofa-spin .8s linear infinite;
    }
    @keyframes ofa-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
  document.documentElement.classList.add('ofa-checking');

  /* ---------- Small helpers ---------- */
  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(ROLE_KEY);
    } catch (e) { /* storage blocked: nothing to clear */ }
  }

  // Redirects and then never settles, so the page code after "await OFA.ready" never runs
  function leave(url) {
    window.location.replace(url);
    return new Promise(() => {});
  }

  function logout() {
    clearSession();
    return leave(PAGES.login);
  }

  // Error type for failed API calls. status 0 means "could not reach the server".
  class ApiError extends Error {
    constructor(status, message, data) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data || null;
    }
  }

  /* ---------- OFA.apiFetch ---------- */
  async function apiFetch(url, options = {}) {
    const token = getToken();
    if (!token) { logout(); throw new ApiError(401, 'Not signed in.'); }

    const headers = Object.assign({ Accept: 'application/json' }, options.headers, {
      Authorization: `Bearer ${token}`
    });
    let body = options.body;
    if (body !== undefined && typeof body !== 'string') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    let res;
    try {
      res = await fetch(url, Object.assign({}, options, { headers, body }));
    } catch (err) {
      throw new ApiError(0, 'Could not reach the server.');
    }

    let data = null;
    try { data = await res.json(); } catch (err) { /* empty or non-JSON body */ }

    // Login expired, or the account was changed or disabled
    if (res.status === 401) { logout(); throw new ApiError(401, (data && data.message) || 'Session ended.', data); }
    if (res.status === 403 && data && data.code === 'PASSWORD_CHANGE_REQUIRED') {
      leave(PAGES.change);
      throw new ApiError(403, data.message, data);
    }
    if (!res.ok) {
      throw new ApiError(res.status, (data && data.message) || `Request failed (${res.status}).`, data);
    }
    return data;
  }

  /* ---------- Overlay (checking / error) ---------- */
  function showOverlay(message, withRetry) {
    let box = document.querySelector('.ofa-overlay');
    if (!box) {
      box = document.createElement('div');
      box.className = 'ofa-overlay';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    box.textContent = '';
    if (!withRetry) {
      const spin = document.createElement('div');
      spin.className = 'ofa-spinner';
      box.appendChild(spin);
    }
    const text = document.createElement('p');
    text.style.margin = '0';
    text.textContent = message;
    box.appendChild(text);
    if (withRetry) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Try again';
      btn.addEventListener('click', () => window.location.reload());
      box.appendChild(btn);
    }
  }

  function hideOverlay() {
    const box = document.querySelector('.ofa-overlay');
    if (box) box.remove();
    document.documentElement.classList.remove('ofa-checking');
  }

  // document.body does not exist yet when this script runs in the <head>
  const bodyReady = new Promise(resolve => {
    if (document.body) resolve();
    else document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });

  /* ---------- The guard ---------- */
  async function guard() {
    if (!getToken()) return logout();

    bodyReady.then(() => showOverlay('Checking your session...', false));

    let me;
    try {
      me = await apiFetch('/api/me');
    } catch (err) {
      if (err.status === 401) return new Promise(() => {});          // apiFetch already redirected
      if (err.status === 403) return logout();                       // account disabled
      await bodyReady;
      showOverlay('We could not reach the server. Please check your connection.', true);
      return new Promise(() => {});
    }

    // Still on the temporary password: finish that first
    if (me.mustChangePassword === true) return leave(PAGES.change);

    // Wrong dashboard for this role: send them to their own (they stay signed in)
    if (me.role !== requiredRole) return leave(DASHBOARDS[me.role] || PAGES.login);

    try { sessionStorage.setItem(ROLE_KEY, me.role); } catch (e) { /* ignore */ }
    await bodyReady;
    hideOverlay();
    return me;
  }

  const ready = guard();

  // Back button after signing out can show a cached copy of the page: re-check it
  window.addEventListener('pageshow', event => {
    if (event.persisted) window.location.reload();
  });

  window.OFA = { ready, apiFetch, logout, ApiError };
})();