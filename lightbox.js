// Lightbox: open a centered popup of the clicked preview image.
// - Click or Enter/Space on a [data-lightbox] preview wrap opens it.
// - Click outside the image, the close button, or press Esc closes it.
(() => {
  'use strict';

  const lb        = document.getElementById('lightbox');
  const lbImg     = document.getElementById('lightbox-img');
  const lbCap     = document.getElementById('lightbox-caption');
  const lbClose   = document.getElementById('lightbox-close');
  if (!lb || !lbImg || !lbCap || !lbClose) return;

  let lastFocus = null;

  function open(src, caption, alt) {
    lastFocus = document.activeElement;
    lbImg.src = src;
    lbImg.alt = alt || '';
    lbCap.textContent = caption || '';
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // Defer focus so the transition is visible first.
    requestAnimationFrame(() => lbClose.focus());
  }

  function close() {
    if (!lb.classList.contains('is-open')) return;
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Free the large image so the popup doesn't sit on memory after close.
    lbImg.src = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  // Open: click or keyboard activation on any preview wrap.
  document.querySelectorAll('[data-lightbox]').forEach((el) => {
    el.addEventListener('click', (e) => {
      // Don't open if the user clicked the caption link text (none today, but safe).
      e.preventDefault();
      open(el.dataset.lightbox, el.dataset.caption, el.querySelector('img')?.alt || '');
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(el.dataset.lightbox, el.dataset.caption, el.querySelector('img')?.alt || '');
      }
    });
  });

  // Close: button, backdrop click, Esc.
  lbClose.addEventListener('click', close);
  lb.addEventListener('click', (e) => {
    if (e.target === lb) close();           // backdrop only
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();
