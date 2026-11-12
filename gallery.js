/* ==========================================================
   gallery.js: Campus Gallery Interactive Script
   Vanilla JavaScript for filtering, masonry display and accessible lightbox modal.
   ========================================================== */

// DATA: In Step 3, the backend API will supply this list via fetch('/api/public/gallery')
const CATEGORIES = [
  { key: 'all',    label: 'All' },
  { key: 'campus', label: 'Campus' },
  { key: 'events', label: 'Events' },
  { key: 'sports', label: 'Sports' },
  { key: 'labs',   label: 'Labs' }
];

const PHOTOS = [
  {
    id: 1,
    title: 'Annual Day 2026',
    category: 'events',
    src: 'assets/images/gallery-1.jpg',
    ratio: '16 / 9',
    caption: 'Students and faculty celebrating academic excellence and artistic milestones in the grand auditorium.'
  },
  {
    id: 2,
    title: 'Main Block',
    category: 'campus',
    src: 'assets/images/gallery-2.jpg',
    ratio: '4 / 3',
    caption: 'The iconic administrative and academic block standing tall in the morning sunshine.'
  },
  {
    id: 3,
    title: 'Inter-College Cricket',
    category: 'sports',
    src: 'assets/images/gallery-3.jpg',
    ratio: '4 / 3',
    caption: 'A decisive match moment during the annual inter-college championship tournament.'
  },
  {
    id: 4,
    title: 'Tech Fest',
    category: 'events',
    src: 'assets/images/gallery-4.jpg',
    ratio: '3 / 4',
    caption: 'Innovative robotics and software prototypes showcased by passionate engineering students.'
  },
  {
    id: 5,
    title: 'Central Library',
    category: 'campus',
    src: 'assets/images/gallery-5.jpg',
    ratio: '16 / 9',
    caption: 'Quiet reading halls and extensive digital stacks offering an inspiring research environment.'
  },
  {
    id: 6,
    title: 'Athletics Meet',
    category: 'sports',
    src: 'assets/images/gallery-6.jpg',
    ratio: '1 / 1',
    caption: 'Sprinters crossing the finish line amidst loud cheers at the annual university sports meet.'
  },
  {
    id: 7,
    title: 'Computer Lab',
    category: 'labs',
    src: 'assets/images/gallery-7.jpg',
    ratio: '4 / 3',
    caption: 'High-performance computing workstations equipped for machine learning and systems research.'
  },
  {
    id: 8,
    title: 'Electronics Lab',
    category: 'labs',
    src: 'assets/images/gallery-8.jpg',
    ratio: '3 / 4',
    caption: 'Hands-on circuit analysis, microcontrollers and signal processing experiments in action.'
  },
  {
    id: 9,
    title: 'Cultural Night',
    category: 'events',
    src: 'assets/images/gallery-9.jpg',
    ratio: '1 / 1',
    caption: 'Colourful folk performances and musical bands illuminating the open-air amphitheatre.'
  },
  {
    id: 10,
    title: 'Campus Gardens',
    category: 'campus',
    src: 'assets/images/gallery-10.jpg',
    ratio: '16 / 9',
    caption: 'Peaceful landscaped green corridors designed for student relaxation between lecture hours.'
  },
  {
    id: 11,
    title: 'Basketball Court',
    category: 'sports',
    src: 'assets/images/gallery-11.jpg',
    ratio: '3 / 4',
    caption: 'Fast-paced evening drills on the floodlit outdoor courts.'
  },
  {
    id: 12,
    title: 'Robotics Workshop',
    category: 'labs',
    src: 'assets/images/gallery-12.jpg',
    ratio: '4 / 3',
    caption: 'Collaborative hardware prototyping using automated arms, sensors and embedded logic.'
  },
  {
    id: 13,
    title: 'Graduation Day',
    category: 'events',
    src: 'assets/images/gallery-13.jpg',
    ratio: '4 / 3',
    caption: 'Proud graduates tossing their caps as they begin their next professional chapter.'
  },
  {
    id: 14,
    title: 'Hostel Courtyard',
    category: 'campus',
    src: 'assets/images/gallery-14.jpg',
    ratio: '1 / 1',
    caption: 'The vibrant residential courtyard where students gather for group study and evening tea.'
  }
];

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return; // Guard for pages without the gallery grid

  const filtersContainer = document.getElementById('galleryFilters');
  const countEl = document.getElementById('galleryCount');
  const emptyEl = document.getElementById('galleryEmpty');

  // Lightbox elements
  const lb = document.getElementById('lightbox');
  const lbClose = document.getElementById('lbClose');
  const lbPrev = document.getElementById('lbPrev');
  const lbNext = document.getElementById('lbNext');
  const lbImg = document.getElementById('lbImg');
  const lbFallback = document.getElementById('lbFallback');
  const lbFallbackText = document.getElementById('lbFallbackText');
  const lbTitle = document.getElementById('lbTitle');
  const lbText = document.getElementById('lbText');
  const lbCount = document.getElementById('lbCount');

  let shown = [];
  let currentIndex = 0;
  let lastActiveTrigger = null;

  // Sanitise text strings for innerHTML interpolation
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 1. Build Filter Buttons
  function buildFilters() {
    if (!filtersContainer) return;
    const buttonsHtml = CATEGORIES.map(cat => {
      const count = cat.key === 'all'
        ? PHOTOS.length
        : PHOTOS.filter(p => p.category === cat.key).length;
      return `<button type="button" class="chip${cat.key === 'all' ? ' is-active' : ''}" data-filter="${cat.key}" aria-pressed="${cat.key === 'all'}">${escapeHtml(cat.label)}<span class="chip__count">${count}</span></button>`;
    }).join('');
    filtersContainer.innerHTML = buttonsHtml;
  }

  // 2. Render Grid Once
  function buildGrid() {
    const tilesHtml = PHOTOS.map(photo => {
      const catObj = CATEGORIES.find(c => c.key === photo.category);
      const catLabel = catObj ? catObj.label : photo.category;
      return `
        <button class="g-item" type="button" data-id="${photo.id}" data-cat="${escapeHtml(photo.category)}" style="--ratio: ${photo.ratio};">
          <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.title)} - ${escapeHtml(photo.caption)}" loading="lazy" onerror="this.remove()">
          <span class="g-item__caption">
            <span class="g-item__tag">${escapeHtml(catLabel)}</span>
            <strong class="g-item__title">${escapeHtml(photo.title)}</strong>
          </span>
          <span class="g-item__zoom" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </span>
        </button>
      `;
    }).join('');
    grid.innerHTML = tilesHtml;
  }

  // 3. Filter Grid and Trigger Stagger Animation
  function applyFilter(key) {
    const activeKey = CATEGORIES.some(c => c.key === key) ? key : 'all';

    // Update filter chip UI state
    if (filtersContainer) {
      const chips = filtersContainer.querySelectorAll('.chip');
      chips.forEach(chip => {
        const isMatch = chip.dataset.filter === activeKey;
        chip.classList.toggle('is-active', isMatch);
        chip.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      });
    }

    // Determine visible photos and toggle tile visibility
    shown = [];
    const tiles = grid.querySelectorAll('.g-item');
    let visibleIndex = 0;

    tiles.forEach(tile => {
      const cat = tile.dataset.cat;
      const isVisible = activeKey === 'all' || cat === activeKey;
      tile.hidden = !isVisible;

      // Remove entering class first so animation can re-trigger
      tile.classList.remove('is-entering');

      if (isVisible) {
        tile.style.setProperty('--i', visibleIndex);
        visibleIndex++;
        const pId = Number(tile.dataset.id);
        const pObj = PHOTOS.find(p => p.id === pId);
        if (pObj) shown.push(pObj);
      }
    });

    // Force a single DOM reflow before re-applying the stagger animation
    void grid.offsetHeight;

    tiles.forEach(tile => {
      if (!tile.hidden) {
        tile.classList.add('is-entering');
      }
    });

    // Update photo counter text
    if (countEl) {
      countEl.textContent = `Showing ${shown.length} ${shown.length === 1 ? 'photo' : 'photos'}`;
    }

    // Toggle empty state message
    if (emptyEl) {
      emptyEl.hidden = shown.length > 0;
    }

    // Sync URL hash without polluting history
    const targetHash = activeKey === 'all' ? '' : `#${activeKey}`;
    if (location.hash !== targetHash) {
      const cleanUrl = targetHash
        ? location.pathname + location.search + targetHash
        : location.pathname + location.search;
      history.replaceState(null, '', cleanUrl);
    }
  }

  // 4. Lightbox: Open and Populate
  function openLightbox(index) {
    if (!lb || shown.length === 0) return;
    currentIndex = index;

    // Lock page scroll and prevent layout shift by compensating for scrollbar width
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Reveal modal and remove accessibility inertness
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    lb.removeAttribute('inert');

    renderPhoto(currentIndex);

    // Focus close button for accessibility
    if (lbClose) lbClose.focus();
    window.addEventListener('keydown', handleKeydown);
  }

  // Render photo at index into lightbox
  function renderPhoto(index) {
    if (!shown[index]) return;
    const photo = shown[index];

    if (lbTitle) lbTitle.textContent = photo.title;
    if (lbText) lbText.textContent = photo.caption;
    if (lbCount) lbCount.textContent = `${index + 1} / ${shown.length}`;

    // Hide navigation if only one photo is in the filtered list
    const single = shown.length <= 1;
    if (lbPrev) lbPrev.hidden = single;
    if (lbNext) lbNext.hidden = single;

    // Reset image display and prepare loading state
    if (lbImg) {
      lbImg.classList.remove('is-loaded');
      lbImg.hidden = false;
      if (lbFallback) lbFallback.hidden = true;

      lbImg.onload = () => {
        lbImg.classList.add('is-loaded');
      };

      lbImg.onerror = () => {
        lbImg.hidden = true;
        if (lbFallback) {
          lbFallback.hidden = false;
          lbFallback.setAttribute('data-cat', photo.category);
          if (lbFallbackText) lbFallbackText.textContent = photo.title;
        }
      };

      lbImg.alt = photo.title;
      lbImg.src = photo.src;
    }

    // Preload previous and next images for snappy transitions
    if (shown.length > 1) {
      const prevIdx = (index - 1 + shown.length) % shown.length;
      const nextIdx = (index + 1) % shown.length;
      new Image().src = shown[prevIdx].src;
      new Image().src = shown[nextIdx].src;
    }
  }

  function nextPhoto() {
    if (shown.length <= 1) return;
    currentIndex = (currentIndex + 1) % shown.length;
    renderPhoto(currentIndex);
  }

  function prevPhoto() {
    if (shown.length <= 1) return;
    currentIndex = (currentIndex - 1 + shown.length) % shown.length;
    renderPhoto(currentIndex);
  }

  // 5. Lightbox: Close and Cleanup
  function closeLightbox() {
    if (!lb || !lb.classList.contains('is-open')) return;

    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    lb.setAttribute('inert', '');

    // Restore body scrolling
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    window.removeEventListener('keydown', handleKeydown);

    // Return keyboard focus to the triggering tile
    if (lastActiveTrigger) {
      lastActiveTrigger.focus();
      lastActiveTrigger = null;
    }
  }

  // Keyboard navigation and modal focus trapping
  function handleKeydown(e) {
    if (!lb || !lb.classList.contains('is-open')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextPhoto();
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevPhoto();
      return;
    }

    // Focus trap inside the modal across enabled buttons
    if (e.key === 'Tab') {
      const focusable = [lbClose, lbPrev, lbNext].filter(b => b && !b.hidden && b.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // 6. Touch swipe gestures for mobile viewers
  let touchStartX = 0;
  let touchStartY = 0;

  if (lb) {
    lb.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    lb.addEventListener('touchend', e => {
      const diffX = e.changedTouches[0].clientX - touchStartX;
      const diffY = e.changedTouches[0].clientY - touchStartY;
      // Trigger when horizontal swipe exceeds 50px and is predominantly horizontal
      if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          nextPhoto();
        } else {
          prevPhoto();
        }
      }
    }, { passive: true });

    // Backdrop click closes lightbox
    lb.addEventListener('click', e => {
      if (e.target === lb) {
        closeLightbox();
      }
    });
  }

  // Attach button event listeners
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbPrev) lbPrev.addEventListener('click', prevPhoto);
  if (lbNext) lbNext.addEventListener('click', nextPhoto);

  // Filter container click delegation
  if (filtersContainer) {
    filtersContainer.addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      applyFilter(btn.dataset.filter);
    });
  }

  // Grid click delegation to open tiles
  grid.addEventListener('click', e => {
    const tile = e.target.closest('.g-item');
    if (!tile) return;
    lastActiveTrigger = tile;
    const id = Number(tile.dataset.id);
    const index = shown.findIndex(p => p.id === id);
    if (index !== -1) {
      openLightbox(index);
    }
  });

  // 7. Initialise on Page Load
  buildFilters();
  buildGrid();

  // Support direct category linking via URL hash (e.g. #sports)
  const initialHash = (location.hash || '').replace('#', '').toLowerCase();
  const validHash = CATEGORIES.some(c => c.key === initialHash) ? initialHash : 'all';
  applyFilter(validHash);
});
