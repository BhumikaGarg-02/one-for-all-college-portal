/* ==========================================================
   contact.js: enquiry form on contact.html
   Handles prefill from ?course=..., live character count,
   validation and sending the enquiry to the backend.
   ========================================================== */

const ENQUIRY_ENDPOINT = '/api/public/enquiry';   // built in Step 3

const form = document.getElementById('contactForm');
const alertBox = document.getElementById('formAlert');
const submitBtn = document.getElementById('submitBtn');
const messageInput = document.getElementById('message');
const charCount = document.getElementById('charCount');

/* ---------- Validation rules ----------
   Each rule returns an error message, or '' when the value is fine. */
const rules = {
  name:    v => v.trim().length >= 2 ? '' : 'Please enter your full name.',
  email:   v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Please enter a valid email address.',
  // Phone is optional. If filled, accept a 10-digit Indian mobile number (spaces, dashes and +91 allowed)
  phone:   v => {
    if (!v.trim()) return '';
    const digits = v.replace(/[\s-]/g, '').replace(/^(\+91|0)/, '');
    return /^[6-9]\d{9}$/.test(digits) ? '' : 'Enter a valid 10-digit mobile number.';
  },
  role:    v => v ? '' : 'Please choose one option.',
  subject: v => v.trim().length >= 3 ? '' : 'Please add a short subject.',
  message: v => v.trim().length >= 20 ? '' : 'Please write at least 20 characters so we can help properly.'
};

function setError(input, message) {
  const field = input.closest('.field');
  field.classList.toggle('has-error', Boolean(message));
  field.querySelector('.field__error').textContent = message;
  input.setAttribute('aria-invalid', Boolean(message));
}

// Returns true when every field passes; focuses the first one that fails
function validateAll() {
  let firstInvalid = null;
  Object.keys(rules).forEach(name => {
    const input = form.elements[name];
    const message = rules[name](input.value);
    setError(input, message);
    if (message && !firstInvalid) firstInvalid = input;
  });
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

function showAlert(type, text) {
  alertBox.className = `alert alert--${type}`;
  alertBox.textContent = text;
  alertBox.hidden = false;
  alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- Events ---------- */

// Clear a field's error as soon as the user fixes it
Object.keys(rules).forEach(name => {
  form.elements[name].addEventListener('input', e => {
    if (e.target.closest('.field').classList.contains('has-error')) {
      setError(e.target, rules[name](e.target.value));
    }
  });
});

messageInput.addEventListener('input', () => {
  charCount.textContent = `${messageInput.value.length} / ${messageInput.maxLength}`;
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  alertBox.hidden = true;

  // Honeypot: real visitors never fill this. Pretend it worked and do nothing.
  if (form.elements.website.value) {
    showAlert('success', 'Thank you! Your message has been sent.');
    form.reset();
    return;
  }

  if (!validateAll()) return;

  const payload = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    phone: form.elements.phone.value.trim(),
    role: form.elements.role.value,
    subject: form.elements.subject.value.trim(),
    message: form.elements.message.value.trim()
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  try {
    const res = await fetch(ENQUIRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Server replied ${res.status}`);

    showAlert('success', 'Thank you! Your message has been sent. We will reply within two working days.');
    form.reset();
    charCount.textContent = `0 / ${messageInput.maxLength}`;
  } catch (err) {
    // Fallback so the visitor is never stuck: they can still email us directly
    showAlert('error', 'Sorry, we could not send your message just now. Please try again, or email us at info@oneforall.edu.in.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send message';
  }
});

/* ---------- Prefill from the Academics page ----------
   Links like contact.html?course=MBA fill in the subject and pick "Prospective student". */
const course = new URLSearchParams(location.search).get('course');
if (course) {
  form.elements.subject.value = `Admission enquiry: ${course}`;   // .value is safe, it is never parsed as HTML
  form.elements.role.value = 'Prospective student';
  messageInput.placeholder = `Tell us a little about yourself and what you would like to know about ${course}.`;
}