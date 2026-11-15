/* ==========================================================
   gallery-data.js: the ONE list of campus photos
   Used by the homepage cards (main.js) and by gallery.html (gallery.js).
   To add a photo: drop the file in public/images/ and add one line here.

   category : campus | events | sports | labs   (drives the filter chips)
   featured : true = also shown on the homepage
   ========================================================== */
window.GALLERY_PHOTOS = [
  { title: 'Main Block',                category: 'campus', featured: true,  src: 'images/main_block.jpeg' },
  { title: 'Central Library',           category: 'campus', featured: true,  src: 'images/central_library.jpeg' },
  { title: 'Tech Fest & DJ Night',      category: 'events', featured: true,  src: 'images/tech_fest.jpeg' },
  { title: 'Cultural Fest',             category: 'events', featured: true,  src: 'images/cultural_fest.jpeg' },
  { title: 'Athletic Meet',             category: 'sports', featured: true,  src: 'images/athletic_meet.jpeg' },
  { title: 'Inter-College Cricket',     category: 'sports', featured: true,  src: 'images/cricket_sports.jpeg' },
  { title: 'Coordinator / Faculty',     category: 'campus', featured: false, src: 'images/coordinator.jpeg' },
  { title: 'Hostel / Accommodation',    category: 'campus', featured: false, src: 'images/hostel.jpeg' },
  { title: 'Training & Placement Cell', category: 'campus', featured: false, src: 'images/placement_cell.jpeg' },
  { title: 'Sports Complex',            category: 'sports', featured: false, src: 'images/sports_complex.jpeg' },
  { title: 'Canteen / Cafeteria',       category: 'campus', featured: false, src: 'images/canteen.jpeg' },
  { title: 'Auditorium',                category: 'campus', featured: false, src: 'images/audi.jpeg' },
  { title: 'Computer Center',           category: 'labs',   featured: false, src: 'images/cc.jpeg' }
];

// Keeps the file names safe in a URL (a no-op for clean names like main_block.jpeg)
window.photoUrl = function (src) { return encodeURI(src); };

/* Loads a photo into an <img>. If the file is not found with the extension written above
   (for example the file is really .jpg, .png or .JPG), the other common extensions are
   tried one by one. onMissing() runs only when none of them exists. */
window.attachPhoto = function (img, src, onMissing) {
  const dot = src.lastIndexOf('.');
  const base = dot > src.lastIndexOf('/') ? src.slice(0, dot) : src;
  const own = dot > src.lastIndexOf('/') ? src.slice(dot + 1) : '';
  const tries = [...new Set([own, 'jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG'].filter(Boolean))];
  let i = 0;
  img.onerror = function () {
    i += 1;
    if (i < tries.length) {
      img.src = window.photoUrl(`${base}.${tries[i]}`);
    } else {
      img.onerror = null;
      if (onMissing) onMissing();
    }
  };
  img.src = window.photoUrl(`${base}.${tries[0]}`);
};