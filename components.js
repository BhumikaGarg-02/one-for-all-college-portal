/* ==========================================================
   components.js: shared top bar, navbar and footer
   Edit the nav here once and every page updates.
   Paths are relative to the page, so pages inside /dashboard
   should set <body data-root="../"> before loading this file.
   ========================================================== */
(function () {
  const root = document.body.dataset.root || '';

  const links = [
    { label: 'Home',       href: 'index.html' },
    { label: 'About',      href: 'about.html' },
    { label: 'Academics',  href: 'academics.html' },
    { label: 'Facilities', href: 'facilities.html' },
    { label: 'Gallery',    href: 'gallery.html' },
    { label: 'Contact',    href: 'contact.html' }
  ];

  // Highlight the link for the current page ("" means index)
  const current = location.pathname.split('/').pop() || 'index.html';

  const navItems = links
    .map(l => `<a href="${root}${l.href}" class="${l.href === current ? 'is-active' : ''}">${l.label}</a>`)
    .join('');

  const header = `
    <div class="topbar">
      <div class="container topbar__inner">
        <div class="topbar__info">
          <a href="tel:+910000000000">+91 00000 00000</a>
          <a href="mailto:info@oneforall.edu.in">info@oneforall.edu.in</a>
        </div>
        <div class="topbar__links">
          <span class="topbar__badge">Admissions open 2026-27</span>
          <a href="${root}login.html?role=student">Student Login</a>
          <a href="${root}login.html?role=teacher">Teacher Login</a>
        </div>
      </div>
    </div>
    <header class="site-header">
      <nav class="nav container" aria-label="Main navigation">
        <a href="${root}index.html" class="logo"><span class="logo__mark">1</span>ONE FOR ALL</a>
        <button class="nav__toggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span></button>
        <div class="nav__links" id="navLinks">
          ${navItems}
          <a href="${root}login.html" class="btn btn--primary magnet">Portal Login</a>
        </div>
      </nav>
    </header>`;

  const footer = `
    <footer class="site-footer">
      <div class="footer__cta">
        <div class="container footer__cta-inner">
          <div>
            <h3>Admissions are open for 2026-27</h3>
            <p>Join a community of learners, teachers and mentors in the heart of Hyderabad.</p>
          </div>
          <div class="footer__cta-actions">
            <a href="${root}contact.html" class="btn btn--light magnet">Enquire now</a>
            <a href="${root}academics.html" class="btn btn--outline-light magnet">View programs</a>
          </div>
        </div>
      </div>

      <div class="footer__main container">
        <div class="footer__grid">
          <div class="footer__about">
            <a href="${root}index.html" class="logo"><span class="logo__mark">1</span>ONE FOR ALL</a>
            <p>A trusted Hyderabad institution since 1985, with one portal for students, teachers and administrators.</p>
            <div class="social">
              <a href="https://www.facebook.com/" target="_blank" rel="noopener" aria-label="Facebook">Fb</a>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener" aria-label="Instagram">Ig</a>
              <a href="https://www.linkedin.com/" target="_blank" rel="noopener" aria-label="LinkedIn">In</a>
              <a href="https://www.youtube.com/" target="_blank" rel="noopener" aria-label="YouTube">Yt</a>
            </div>
          </div>

          <div>
            <h4>Quick Links</h4>
            <ul class="footer__links">
              <li><a href="${root}about.html">About Us</a></li>
              <li><a href="${root}facilities.html">Facilities</a></li>
              <li><a href="${root}gallery.html">Gallery</a></li>
              <li><a href="${root}contact.html">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4>Academics</h4>
            <ul class="footer__links">
              <li><a href="${root}academics.html">Undergraduate</a></li>
              <li><a href="${root}academics.html">Postgraduate</a></li>
              <li><a href="${root}academics.html">Diploma Courses</a></li>
              <li><a href="${root}academics.html">Research</a></li>
            </ul>
          </div>

          <div>
            <h4>Portal</h4>
            <ul class="footer__links">
              <li><a href="${root}login.html?role=student">Student Login</a></li>
              <li><a href="${root}login.html?role=teacher">Teacher Login</a></li>
              <li><a href="${root}login.html?role=admin">Admin Login</a></li>
            </ul>
          </div>

          <div>
            <h4>Contact Us</h4>
            <ul class="footer__contact">
              <li><span>Address</span>ONE FOR ALL College, Hyderabad, Telangana, India</li>
              <li><span>Phone</span><a href="tel:+910000000000">+91 00000 00000</a></li>
              <li><span>Email</span><a href="mailto:info@oneforall.edu.in">info@oneforall.edu.in</a></li>
              <li><span>Office hours</span>Mon to Sat, 9:00 AM to 5:00 PM</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="footer__bottom">
        <div class="container footer__bottom-inner">
          <span>&copy; ${new Date().getFullYear()} ONE FOR ALL College. All rights reserved.</span>
          <span>Built by Team Anti Gravity &bull; <a href="#">Back to top</a></span>
        </div>
      </div>
    </footer>`;

  // SVG icon sprite, added once so every page can use icons like this:
  //   <svg class="icon"><use href="#i-book"></use></svg>
  // Stroke, size and colour come from the .icon class in pages.css.
  const iconPaths = {
    book:      `<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>`,
    users:     `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
    user:      `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
    award:     `<circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>`,
    globe:     `<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
    target:    `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
    eye:       `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
    heart:     `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
    flask:     `<path d="M9 2h6"/><path d="M10 2v6L4.5 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-2.8L14 8V2"/><path d="M7.5 15h9"/>`,
    trophy:    `<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>`,
    home:      `<path d="M3 10.5L12 3l9 7.5V21H3z"/><path d="M9 21v-7h6v7"/>`,
    wifi:      `<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>`,
    bus:       `<rect x="3" y="3" width="18" height="15" rx="2"/><path d="M3 11h18"/><path d="M7 18v2"/><path d="M17 18v2"/><path d="M7 15h.01"/><path d="M17 15h.01"/>`,
    health:    `<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8"/><path d="M8 12h8"/>`,
    briefcase: `<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/>`,
    mic:       `<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/>`,
    message:   `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
    pin:       `<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
    phone:     `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>`,
    mail:      `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>`,
    clock:     `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`,
    check:     `<path d="M20 6L9 17l-5-5"/>`,
    lock:      `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
    arrow:     `<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>`
  };
  const sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">'
    + Object.entries(iconPaths).map(([name, d]) => `<symbol id="i-${name}" viewBox="0 0 24 24">${d}</symbol>`).join('')
    + '</svg>';
  document.body.insertAdjacentHTML('afterbegin', sprite);

  document.getElementById('site-header').innerHTML = header;
  document.getElementById('site-footer').innerHTML = footer;

  // Mobile menu toggle
  const toggle = document.querySelector('.nav__toggle');
  const menu = document.getElementById('navLinks');
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
})();