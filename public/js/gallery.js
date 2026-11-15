/* ==========================================================
   gallery.js: gallery.html (full grid + lightbox)
   Every photo is shown straight away: no hover is needed here.
   Data comes from js/gallery-data.js (load that file first).
   ========================================================== */
(function () {
  'use strict';

  const PHOTOS = window.GALLERY_PHOTOS || [];
  const CATEGORIES = [
    ['all', 'All'], ['campus', 'Campus'], ['events', 'Events'], ['sports', 'Sports'], ['labs', 'Labs']
  ];
  const ZOOM_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2M11 8v6M8 11h6"/></svg>';

  const $ = id => document.getElementById(id);
  const grid = $('galleryGrid');
  const lightbox = $('lightbox');
  let visible = [];      // photos in the current filter
  let current = 0;       // index inside "visible"
  let lastFocus = null;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- Grid ---------- */
  function render(filter) {
    visible = PHOTOS.filter(p => filter === 'all' || p.category === filter);
    grid.replaceChildren();

    visible.forEach((photo, i) => {
      const tile = el('button', 'g-item is-entering');
      tile.type = 'button';
      tile.dataset.cat = photo.category;
      tile.style.setProperty('--i', i);
      tile.setAttribute('aria-label', `Open photo: ${photo.title}`);

      const img = el('img');
            img.alt = photo.title;
      img.loading = 'lazy';
      window.attachPhoto(img, photo.src, () => img.remove());  // tries other extensions; the gradient stays if none exists
      tile.appendChild(img);

      const caption = el('span', 'g-item__caption');
      caption.append(el('span', 'g-item__tag', photo.category), el('span', 'g-item__title', photo.title));
      const zoom = el('span', 'g-item__zoom');
      zoom.innerHTML = ZOOM_ICON;                              // fixed icon markup, no user text
      tile.append(caption, zoom);

      tile.addEventListener('click', () => openBox(i, tile));
      grid.appendChild(tile);
    });

    $('galleryEmpty').hidden = visible.length > 0;
    $('galleryCount').textContent = `${visible.length} photo${visible.length === 1 ? '' : 's'}`;
  }

  function buildFilters() {
    const bar = $('galleryFilters');
    CATEGORIES.forEach(([key, label], idx) => {
      const n = key === 'all' ? PHOTOS.length : PHOTOS.filter(p => p.category === key).length;
      if (key !== 'all' && n === 0) return;
      const chip = el('button', `chip${idx === 0 ? ' is-active' : ''}`, label);
      chip.type = 'button';
      chip.dataset.filter = key;
      chip.setAttribute('aria-pressed', idx === 0);
      chip.appendChild(el('span', 'chip__count', n));
      bar.appendChild(chip);
    });
    bar.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      bar.querySelectorAll('.chip').forEach(c => { c.classList.remove('is-active'); c.setAttribute('aria-pressed', 'false'); });
      chip.classList.add('is-active');
      chip.setAttribute('aria-pressed', 'true');
      render(chip.dataset.filter);
    });
  }

  /* ---------- Lightbox ---------- */
  function show(i) {
    current = (i + visible.length) % visible.length;
    const photo = visible[current];
    const img = $('lbImg');
    const fallback = $('lbFallback');

    lightbox.dataset.cat = photo.category;                     // picks the fallback gradient
    img.classList.remove('is-loaded');
    img.hidden = false;
    fallback.hidden = true;
    img.onload = () => img.classList.add('is-loaded');
    img.alt = photo.title;
    window.attachPhoto(img, photo.src, () => { img.hidden = true; fallback.hidden = false; $('lbFallbackText').textContent = photo.title; });

    $('lbTitle').textContent = photo.title;
    $('lbText').textContent = photo.category[0].toUpperCase() + photo.category.slice(1);
    $('lbCount').textContent = `${current + 1} / ${visible.length}`;
    const single = visible.length < 2;
    $('lbPrev').hidden = single;
    $('lbNext').hidden = single;
  }

  function openBox(i, opener) {
    lastFocus = opener;
    show(i);
    lightbox.inert = false;
    lightbox.setAttribute('aria-hidden', 'false');
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('lbClose').focus();
  }

  function closeBox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.inert = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  $('lbClose').addEventListener('click', closeBox);
  $('lbPrev').addEventListener('click', () => show(current - 1));
  $('lbNext').addEventListener('click', () => show(current + 1));
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeBox(); });
  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeBox();
    else if (e.key === 'ArrowLeft') show(current - 1);
    else if (e.key === 'ArrowRight') show(current + 1);
  });

  buildFilters();
  render('all');
})();