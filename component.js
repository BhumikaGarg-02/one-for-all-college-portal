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