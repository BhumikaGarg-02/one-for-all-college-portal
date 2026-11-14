/* ==========================================================
   dashboard.js: behaviour shared by the student, teacher
   (and later admin) dashboards.

   Needs auth.js loaded first (it provides window.OFA).

   The HTML decides WHAT to show, this file does the work:
     <div data-list data-endpoint="/api/announcements" data-render="announcement" data-limit="3">
       -> fetches the endpoint and fills the box with a list
     <div data-stats-endpoint="/api/student/summary"> with
       <div class="stat" data-stat="courses"><span class="stat__value"></span>
       -> fills each stat from the matching key in the JSON

   When a back-end endpoint does not exist yet (404) the page shows
   a friendly "coming soon" message instead of breaking.
   ========================================================== */
(function () {
  'use strict';

  /* ---------- 1) Icons (small inline SVG paths) ---------- */
  const ICONS = {
    home:    '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    book:    '<path d="M4 4h12a3 3 0 013 3v13H7a3 3 0 01-3-3z"/><path d="M4 17a3 3 0 013-3h12"/>',
    bell:    '<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 004 0"/>',
    chat:    '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>',
    user:    '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    users:   '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0114 0"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14a7 7 0 014 6"/>',
    check:   '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    menu:    '<path d="M4 7h16M4 12h16M4 17h16"/>',
    logout:  '<path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
    inbox:   '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
    alert:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
    clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };

  function icon(name) {
    const span = document.createElement('span');
    span.className = 'ico';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg>`;   // our own constants, no user data
    return span;
  }

  function fillIcons(root) {
    root.querySelectorAll('[data-icon]').forEach(slot => {
      slot.replaceChildren(...icon(slot.dataset.icon).childNodes);
      slot.classList.add('ico');
      slot.setAttribute('aria-hidden', 'true');
    });
  }

  /* ---------- 2) Tiny DOM helpers (text only, so server data can never inject HTML) ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Accepts either [..] or { items: [..] }
  function toItems(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  /* ---------- 3) Renderers: one per kind of list item ----------
     Each takes one JSON object and returns an <li>.
     The shape each one expects is the contract for the back-end. */
  function item(title, text, meta, badge, badgeClass) {
    const li = el('li', 'item');
    const main = el('div', 'item__main');
    main.appendChild(el('p', 'item__title', title));
    if (text) main.appendChild(el('p', 'item__text', text));
    if (meta) main.appendChild(el('p', 'item__meta', meta));
    li.appendChild(main);
    if (badge) li.appendChild(el('span', `badge ${badgeClass || ''}`.trim(), badge));
    return li;
  }

  const RENDERERS = {
    // { title, body, date, author }
    announcement: a => item(a.title || 'Announcement', a.body, [formatDate(a.date), a.author].filter(Boolean).join(' · ')),

    // { code, name, teacher }
    course: c => item(c.name || 'Course', c.teacher ? `Taught by ${c.teacher}` : '', c.code),

    // { name, section, students }
    class: c => item(c.name || 'Class', c.section ? `Section ${c.section}` : '', '',
      Number.isFinite(c.students) ? `${c.students} students` : ''),

    // { subject, status: 'open' | 'answered' | 'closed', date, from? }
    query: q => {
      const status = String(q.status || 'open').toLowerCase();
      const badgeClass = status === 'answered' ? 'badge--ok' : status === 'open' ? 'badge--warn' : '';
      return item(q.subject || 'Question', '', [q.from, formatDate(q.date)].filter(Boolean).join(' · '),
        status.charAt(0).toUpperCase() + status.slice(1), badgeClass);
    }
  };

  /* ---------- 4) Loading, empty and error states ---------- */
  function showState(box, iconName, title, text, onRetry) {
    const state = el('div', 'state');
    state.appendChild(icon(iconName));
    state.appendChild(el('p', 'state__title', title));
    if (text) state.appendChild(el('p', '', text));
    if (onRetry) {
      const btn = el('button', 'btn btn--outline', 'Try again');
      btn.type = 'button';
      btn.addEventListener('click', onRetry);
      state.appendChild(btn);
    }
    box.replaceChildren(state);
  }

  function showSkeleton(box) {
    box.replaceChildren(el('div', 'skeleton'), el('div', 'skeleton'), el('div', 'skeleton'));
    box.setAttribute('aria-busy', 'true');
  }

  // One request per URL, even if two boxes on the page use the same endpoint
  const requests = new Map();
  function getJson(url, fresh) {
    if (fresh || !requests.has(url)) requests.set(url, window.OFA.apiFetch(url));
    return requests.get(url);
  }

  /* ---------- 5) Lists ---------- */
  async function loadList(box, fresh) {
    const render = RENDERERS[box.dataset.render];
    const limit = Number(box.dataset.limit) || Infinity;
    const emptyText = box.dataset.empty || 'Nothing to show yet.';
    if (!render) return;

    showSkeleton(box);
    try {
      const items = toItems(await getJson(box.dataset.endpoint, fresh)).slice(0, limit);
      box.removeAttribute('aria-busy');
      if (!items.length) return showState(box, 'inbox', emptyText);

      const list = el('ul', 'item-list');
      items.forEach(entry => list.appendChild(render(entry)));
      box.replaceChildren(list);
    } catch (err) {
      box.removeAttribute('aria-busy');
      if (err.status === 404) {
        showState(box, 'clock', 'Coming soon', 'This section is not switched on yet.');
      } else if (err.status === 403) {
        showState(box, 'alert', 'No access', 'Your account cannot view this section.');
      } else {
        showState(box, 'alert', 'Could not load this', err.message, () => loadList(box, true));
      }
    }
  }

  /* ---------- 6) Stat cards ---------- */
  async function loadStats(group) {
    const stats = group.querySelectorAll('[data-stat]');
    stats.forEach(s => { s.classList.add('is-loading'); s.querySelector('.stat__value').textContent = '0'; });

    let data = {};
    try {
      data = (await getJson(group.dataset.statsEndpoint)) || {};
    } catch (err) {
      /* Not built yet or failed: cards fall back to a dash below */
    }
    stats.forEach(s => {
      const value = data[s.dataset.stat];
      s.classList.remove('is-loading');
      s.querySelector('.stat__value').textContent =
        value === undefined || value === null ? '-' : `${value}${s.dataset.suffix || ''}`;
    });
  }

  /* ---------- 7) Sidebar panels ---------- */
  function setupPanels() {
    const links = document.querySelectorAll('[data-panel-link]');
    const panels = document.querySelectorAll('.panel');
    const title = document.getElementById('pageTitle');
    const names = new Set([...panels].map(p => p.id));
    const first = panels[0] && panels[0].id;

    function show(id, pushHash) {
      if (!names.has(id)) id = first;
      panels.forEach(p => { p.hidden = p.id !== id; });
            // Only the sidebar links are "current" and set the page title. Other links that point at a
      // panel (banner buttons, "See all") just switch panels and must not rename the page.
      links.forEach(link => {
        if (!link.classList.contains('side-link')) return;
        if (link.dataset.panelLink === id) {
          link.setAttribute('aria-current', 'page');
          if (title) title.textContent = link.dataset.title || link.textContent.trim();
        } else {
          link.removeAttribute('aria-current');
        }
      });
      if (pushHash) history.replaceState(null, '', `#${id}`);
      document.body.classList.remove('nav-open');
      window.scrollTo(0, 0);
    }

    // Every element with data-panel-link switches panels (sidebar links and quick-action buttons)
    document.querySelectorAll('[data-panel-link]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        show(link.dataset.panelLink, true);
      });
    });
    window.addEventListener('hashchange', () => show(location.hash.slice(1), false));
    show(location.hash.slice(1), false);
  }

  /* ---------- 8) Mobile menu ---------- */
  function setupMenu() {
    const button = document.getElementById('menuBtn');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!button) return;

    const setOpen = open => {
      document.body.classList.toggle('nav-open', open);
      button.setAttribute('aria-expanded', open);
    };
    button.addEventListener('click', () => setOpen(!document.body.classList.contains('nav-open')));
    if (backdrop) backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
  }

  /* ---------- 9) Who is signed in ---------- */
  const ROLE_LABELS = { student: 'Student', teacher: 'Teacher', admin: 'Admin' };

  function initials(text) {
    const parts = String(text).trim().split(/\s+/);
    const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : String(text).slice(0, 2);
    return letters.toUpperCase();
  }

  function fillUser(me) {
    const display = me.name || me.userId;
    const role = ROLE_LABELS[me.role] || me.role;
    const set = (selector, text) => document.querySelectorAll(selector).forEach(n => { n.textContent = text; });

    set('[data-user="name"]', display);
    set('[data-user="firstName"]', String(display).split(/\s+/)[0]);
    set('[data-user="id"]', me.userId);
    set('[data-user="role"]', role);
    set('[data-user="initials"]', initials(display));

    // Name row in the profile card is only shown when the server sends a name
    const nameRow = document.querySelectorAll('[data-if-name]');
    nameRow.forEach(n => { n.hidden = !me.name; });
  }

  /* ---------- 10) Start ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    fillIcons(document);
    setupMenu();
    setupPanels();

    document.querySelectorAll('[data-logout]').forEach(btn => {
      btn.addEventListener('click', () => window.OFA.logout());
    });

    const me = await window.OFA.ready;        // waits for the guard; never continues if it redirects
    fillUser(me);

    document.querySelectorAll('[data-stats-endpoint]').forEach(loadStats);
    document.querySelectorAll('[data-list]').forEach(box => loadList(box));
  });
})();