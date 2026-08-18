(() => {
  const cards = Array.from(document.querySelectorAll('.work-card'));
  const images = Array.from(document.querySelectorAll('.work-image'));
  const revealItems = Array.from(document.querySelectorAll('.reveal'));

  // Keep the designer-day count tied to calendar days rather than timers.
  // Aug 18, 2026 is day 1,328; every following Toronto calendar day adds one.
  const designerDay = document.querySelector('#designer-day');

  function getTorontoDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function calendarDayNumber(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  }

  function ordinal(value) {
    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${value.toLocaleString('en-US')}th`;
    const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] || 'th';
    return `${value.toLocaleString('en-US')}${suffix}`;
  }

  function updateDesignerDay() {
    if (!designerDay) return;

    const anchorDay = Number(designerDay.dataset.anchorDay);
    const anchorDate = designerDay.dataset.anchorDate;
    const today = getTorontoDateKey();
    const elapsedDays = calendarDayNumber(today) - calendarDayNumber(anchorDate);
    const currentDay = Math.max(anchorDay, anchorDay + elapsedDays);

    designerDay.textContent = ordinal(currentDay);
  }

  updateDesignerDay();
  // Recompute periodically so a tab left open across midnight updates itself.
  window.setInterval(updateDesignerDay, 60_000);

  // Fade gallery images in only once pixels are ready.
  images.forEach((img) => {
    const markLoaded = () => img.classList.add('loaded');
    if (img.complete && img.naturalWidth > 0) markLoaded();
    else img.addEventListener('load', markLoaded, { once: true });
  });

  // Stagger reveals lightly inside each gallery without making the motion feel canned.
  document.querySelectorAll('.gallery-grid').forEach((grid) => {
    Array.from(grid.children).forEach((item, index) => {
      item.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 38}ms`);
    });
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, {
      root: null,
      rootMargin: '0px 0px -7% 0px',
      threshold: 0.08,
    });

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const lightbox = document.querySelector('.lightbox');
  const lightboxImage = document.querySelector('.lightbox-image');
  const lightboxTitle = document.querySelector('.lightbox-title');
  const lightboxCount = document.querySelector('.lightbox-count');
  const closeButton = document.querySelector('.lightbox-close');
  const prevButton = document.querySelector('.lightbox-prev');
  const nextButton = document.querySelector('.lightbox-next');

  let currentIndex = 0;
  let lastFocused = null;
  let touchStartX = 0;
  let touchStartY = 0;

  function preload(index) {
    const card = cards[(index + cards.length) % cards.length];
    if (!card) return;
    const img = new Image();
    img.src = card.dataset.full;
  }

  function setLightboxImage(index, animate = true) {
    currentIndex = (index + cards.length) % cards.length;
    const card = cards[currentIndex];
    const source = card.dataset.full;
    const thumb = card.querySelector('img');
    const title = card.dataset.title || thumb?.alt || 'Selected work';

    lightboxImage.classList.remove('is-ready');
    if (!animate) lightboxImage.style.transition = 'none';

    const ready = () => {
      requestAnimationFrame(() => {
        lightboxImage.classList.add('is-ready');
        if (!animate) {
          requestAnimationFrame(() => {
            lightboxImage.style.transition = '';
          });
        }
      });
    };

    lightboxImage.onload = ready;
    lightboxImage.src = source;
    lightboxImage.alt = thumb?.alt || title;
    lightboxTitle.textContent = title;
    lightboxCount.textContent = `${currentIndex + 1} / ${cards.length}`;

    if (lightboxImage.complete && lightboxImage.naturalWidth > 0) ready();

    preload(currentIndex + 1);
    preload(currentIndex - 1);
  }

  function openLightbox(index) {
    lastFocused = document.activeElement;
    setLightboxImage(index, false);
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    closeButton.focus({ preventScroll: true });
  }

  function closeLightbox() {
    if (!lightbox.classList.contains('is-open')) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    window.setTimeout(() => {
      lightboxImage.src = '';
      lightboxImage.classList.remove('is-ready');
    }, 360);
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus({ preventScroll: true });
    }
  }

  function showNext() {
    setLightboxImage(currentIndex + 1);
  }

  function showPrevious() {
    setLightboxImage(currentIndex - 1);
  }

  cards.forEach((card, index) => {
    card.addEventListener('click', () => openLightbox(index));
  });

  closeButton.addEventListener('click', closeLightbox);
  nextButton.addEventListener('click', showNext);
  prevButton.addEventListener('click', showPrevious);

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox || event.target.classList.contains('lightbox-stage')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!lightbox.classList.contains('is-open')) return;

    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowRight') showNext();
    if (event.key === 'ArrowLeft') showPrevious();

    // Keep keyboard focus inside the lightbox while open.
    if (event.key === 'Tab') {
      const focusable = [closeButton, prevButton, nextButton];
      const current = focusable.indexOf(document.activeElement);
      if (event.shiftKey && current <= 0) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && current === focusable.length - 1) {
        event.preventDefault();
        focusable[0].focus();
      }
    }
  });

  lightbox.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  lightbox.addEventListener('touchend', (event) => {
    if (!event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) showNext();
    else showPrevious();
  }, { passive: true });
})();
