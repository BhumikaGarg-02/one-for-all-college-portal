/* ==========================================================
   pages.js: small behaviours shared by the inner pages
   (About, Academics, Facilities, Contact, Login).
   Every function checks that its elements exist first, so one
   file can safely run on every page.
   ========================================================== */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouchDevice = window.matchMedia('(hover: none)').matches;

/* ---------- Scroll reveal ---------- */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target); // animate once
    });
  }, { threshold: 0.15 });

  items.forEach(el => observer.observe(el));
}

/* ---------- Shery.js cursor + magnetic buttons ----------
   Only runs on pages that load the Shery script (About, Academics,
   Facilities). Forms pages (Login, Contact) skip it on purpose so the
   text cursor stays clear and easy to use. */
function initCursor() {
  if (typeof Shery === 'undefined' || prefersReducedMotion || isTouchDevice) return;

  Shery.mouseFollower({
    skew: true,
    ease: 'cubic-bezier(0.23, 1, 0.320, 1)',
    duration: 1
  });

  Shery.makeMagnet('.magnet', {
    ease: 'cubic-bezier(0.23, 1, 0.320, 1)',
    duration: 1
  });
}

/* ---------- Facilities: video plays inside the circular cursor ----------
   Videos map to the .hvr-media panels by order on the page
   (labs, library, sports, hostel). */
function initFacilityVideos() {
  if (typeof Shery === 'undefined' || prefersReducedMotion || isTouchDevice) return;
  if (!document.querySelector('.hvr-media')) return;

  Shery.hoverWithMediaCircle('.hvr-media', {
    videos: [
      'assets/videos/labs.mp4',
      'assets/videos/library.mp4',
      'assets/videos/sports.mp4',
      'assets/videos/hostel.mp4'
    ]
  });
}

/* ---------- Academics: filter programs by category ---------- */
function initProgramFilter() {
  const bar = document.getElementById('programFilters');
  const cards = document.querySelectorAll('.program-card');
  const counter = document.getElementById('programCount');
  if (!bar || !cards.length) return;

  function applyFilter(category) {
    let visible = 0;
    cards.forEach(card => {
      const show = category === 'all' || card.dataset.category === category;
      card.classList.toggle('is-hidden', !show);
      if (show) visible++;
    });
    // aria-live on the counter announces the change to screen readers
    if (counter) counter.textContent = `Showing ${visible} program${visible === 1 ? '' : 's'}`;
  }

  bar.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    bar.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    applyFilter(btn.dataset.filter);
  });

  applyFilter('all');
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initCursor();          // must run before the hover-video effect
  initFacilityVideos();
  initProgramFilter();
});