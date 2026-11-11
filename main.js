/* ==========================================================
   main.js: homepage behaviour + Shery.js animations
   Sections: 1) data  2) Shery effects  3) gallery
             4) announcements  5) counters  6) scroll reveal
   ========================================================== */

/* ---------- 1) Data ----------
   Temporary local data. Once the backend exists (Step 3) these are
   replaced with fetch('/api/public/gallery') and fetch('/api/public/announcements'),
   which the Admin dashboard controls. */
const galleryItems = [
  { title: 'Annual Day 2026',       category: 'events', src: 'assets/images/gallery-1.jpg' },
  { title: 'Main Block',            category: 'campus', src: 'assets/images/gallery-2.jpg' },
  { title: 'Inter-College Cricket', category: 'sports', src: 'assets/images/gallery-3.jpg' },
  { title: 'Tech Fest',             category: 'events', src: 'assets/images/gallery-4.jpg' },
  { title: 'Central Library',       category: 'campus', src: 'assets/images/gallery-5.jpg' },
  { title: 'Athletics Meet',        category: 'sports', src: 'assets/images/gallery-6.jpg' }
];

const announcements = [
  { tag: 'Exams',  date: '2026-11-10', title: 'Semester exam timetable released',
    text: 'The end-semester timetable is now available in the student portal. Check your dates and download hall tickets.' },
  { tag: 'Event',  date: '2026-11-08', title: 'Tech Fest registrations open',
    text: 'Teams can register for the annual Tech Fest until 30 November. Workshops, hackathon and project expo included.' },
  { tag: 'Library', date: '2026-11-05', title: 'Extended library hours',
    text: 'The central library stays open until 9 PM on weekdays throughout the exam weeks.' },
  { tag: 'Sports', date: '2026-11-03', title: 'Cricket trials on 16 November',
    text: 'Inter-department cricket trials begin on Monday, 16 November at the main ground. Bring your ID card.' }
];

/* ---------- 2) Shery.js effects ----------
   Every call is guarded so the page still works if the CDN is
   blocked or the user prefers reduced motion. */
function initSheryEffects() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  if (typeof Shery === 'undefined' || reduceMotion) return;

  // Animated hero headline: characters slide up one by one
  Shery.textAnimate('#heroTitle', {
    style: 1,
    y: 10,
    delay: 0.1,
    duration: 2,
    ease: 'cubic-bezier(0.23, 1, 0.320, 1)',
    multiplier: 0.1
  });

  // Desktop-only cursor effects (touch devices have no hover)
  if (isTouch) return;

  // Custom smooth cursor that follows the mouse
  Shery.mouseFollower({
    skew: true,
    ease: 'cubic-bezier(0.23, 1, 0.320, 1)',
    duration: 1
  });

  // Magnetic buttons: they lean toward the cursor
  Shery.makeMagnet('.magnet', {
    ease: 'cubic-bezier(0.23, 1, 0.320, 1)',
    duration: 1
  });

  // Cuberto-style effect: a circular cursor plays a video while you hover a facility card.
  // Videos map to the .hvr-media cards by order (01 labs, 02 library, 03 sports, 04 hostel).
  Shery.hoverWithMediaCircle('.hvr-media', {
    videos: [
      'assets/videos/labs.mp4',
      'assets/videos/library.mp4',
      'assets/videos/sports.mp4',
      'assets/videos/hostel.mp4'
    ]
  });
}

/* ---------- 3) Gallery with category filter ---------- */
function renderGallery(filter = 'all') {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  const items = galleryItems.filter(i => filter === 'all' || i.category === filter);

  // Navy-to-blue gradient sits behind the photo so cards look fine before real images are added
  grid.innerHTML = items.map((item, idx) => `
    <figure class="gallery__item" data-title="${item.title}"
            style="background-image: linear-gradient(${135 + idx * 20}deg, #0B1B3D, #0077B6)">
      <img src="${item.src}" alt="${item.title}" loading="lazy" onerror="this.remove()">
    </figure>`).join('');

  // Small stagger-in with GSAP when available
  if (window.gsap) {
    gsap.from('.gallery__item', { opacity: 0, y: 30, duration: .6, stagger: .08, ease: 'power3.out' });
  }
}

function initGalleryFilters() {
  const bar = document.getElementById('galleryFilters');
  if (!bar) return;
  bar.addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    bar.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    renderGallery(btn.dataset.filter);
  });
}

/* ---------- 4) Announcement cards ---------- */
function renderAnnouncements() {
  const grid = document.getElementById('announceGrid');
  if (!grid) return;

  const formatDate = iso => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  grid.innerHTML = announcements.map(a => `
    <article class="announce-card">
      <span class="announce-card__tag">${a.tag}</span>
      <h3 class="announce-card__title">${a.title}</h3>
      <p class="announce-card__text">${a.text}</p>
      <time class="announce-card__date" datetime="${a.date}">${formatDate(a.date)}</time>
    </article>`).join('');
}

/* ---------- 5) Animated number counters ---------- */
function animateCounter(el) {
  const target = Number(el.dataset.count);
  const duration = 1600;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(target * eased).toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------- 6) Scroll reveal + counters trigger ---------- */
function initScrollEffects() {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      if (entry.target.dataset.count) animateCounter(entry.target);
      obs.unobserve(entry.target); // run once
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.reveal, [data-count]').forEach(el => observer.observe(el));
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  renderAnnouncements();
  renderGallery();
  initGalleryFilters();
  initScrollEffects();
  initSheryEffects();
});