(() => {
  const HERO_COLLECTION_URL = '/#yc-title';
  const form = document.querySelector('#redesign-form');
  const intro = document.querySelector('[data-redesign-intro]');
  const collectionLink = document.querySelector('#hero-collection-link');
  const roleSelect = document.querySelector('#role');
  const otherRoleReveal = document.querySelector('#other-role-reveal');
  const otherRoleInput = document.querySelector('#role-other');
  const submitButton = form.querySelector('.submit-button');
  const status = document.querySelector('#form-status');
  const startedAt = document.querySelector('#form-started-at');

  const fieldMap = {
    work_email: document.querySelector('#work-email'),
    company_url: document.querySelector('#company-url'),
    x_handle: document.querySelector('#x-handle'),
    role: roleSelect,
    role_other: otherRoleInput,
    company_stage: form.elements.company_stage,
    improvement_goal: document.querySelector('#improvement-goal'),
  };

  collectionLink.href = HERO_COLLECTION_URL;
  startedAt.value = String(Date.now());

  requestAnimationFrame(() => {
    requestAnimationFrame(() => intro.classList.add('is-drawn'));
  });

  function setOtherRoleVisibility(shouldShow, focus = false) {
    otherRoleReveal.classList.toggle('is-open', shouldShow);
    otherRoleReveal.setAttribute('aria-hidden', String(!shouldShow));
    otherRoleInput.disabled = !shouldShow;
    otherRoleInput.required = shouldShow;

    if (!shouldShow) {
      otherRoleInput.value = '';
      clearFieldError('role_other');
    } else if (focus) {
      window.setTimeout(() => otherRoleInput.focus(), 180);
    }
  }

  function errorElement(fieldName) {
    return document.querySelector(`#${fieldName.replaceAll('_', '-')}-error`);
  }

  function clearFieldError(fieldName) {
    const field = fieldMap[fieldName];
    const error = errorElement(fieldName);
    if (error) error.textContent = '';

    if (field instanceof RadioNodeList) {
      Array.from(field).forEach((input) => input.removeAttribute('aria-invalid'));
    } else if (field) {
      field.removeAttribute('aria-invalid');
    }
  }

  function setFieldError(fieldName, message) {
    const field = fieldMap[fieldName];
    const error = errorElement(fieldName);
    if (error) error.textContent = message;

    if (field instanceof RadioNodeList) {
      Array.from(field).forEach((input) => input.setAttribute('aria-invalid', 'true'));
    } else if (field) {
      field.setAttribute('aria-invalid', 'true');
    }
  }

  function clearErrors() {
    Object.keys(fieldMap).forEach(clearFieldError);
  }

  function isValidXHandle(value) {
    const trimmed = value.trim();
    if (/^@[A-Za-z0-9_]{1,15}$/.test(trimmed)) return true;

    try {
      const url = new URL(trimmed);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function validateForm() {
    clearErrors();
    const errors = {};
    const email = fieldMap.work_email.value;
    const companyUrl = fieldMap.company_url.value;
    const xHandle = fieldMap.x_handle.value;
    const stage = form.querySelector('input[name="company_stage"]:checked');

    if (!email) errors.work_email = 'Enter your work email.';
    else if (!fieldMap.work_email.validity.valid) errors.work_email = 'Enter a valid email address.';

    if (!companyUrl) errors.company_url = 'Enter your company URL.';
    else if (!fieldMap.company_url.validity.valid) errors.company_url = 'Use a full URL, including https://.';

    if (!xHandle) errors.x_handle = 'Enter your X handle or profile URL.';
    else if (!isValidXHandle(xHandle)) errors.x_handle = 'Use @handle or a full profile URL.';

    if (!roleSelect.value) errors.role = 'Select your role.';
    if (roleSelect.value === 'Other' && !otherRoleInput.value.trim()) errors.role_other = 'Tell me your role.';
    if (!stage) errors.company_stage = 'Select your company stage.';
    if (!fieldMap.improvement_goal.value.trim()) errors.improvement_goal = 'Tell me what you are trying to improve.';

    Object.entries(errors).forEach(([name, message]) => setFieldError(name, message));
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const field = fieldMap[firstInvalid];
      const target = field instanceof RadioNodeList ? field[0] : field;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }

    return true;
  }

  function setLoading(isLoading) {
    form.classList.toggle('is-loading', isLoading);
    form.setAttribute('aria-busy', String(isLoading));
    submitButton.disabled = isLoading;
  }

  function setStatus(message = '', type = '') {
    status.textContent = message;
    status.className = `form-status${type ? ` is-${type}` : ''}`;
  }

  roleSelect.addEventListener('change', () => {
    const isOther = roleSelect.value === 'Other';
    setOtherRoleVisibility(isOther, isOther);
    clearFieldError('role');
  });

  Object.entries(fieldMap).forEach(([name, field]) => {
    const eventName = field instanceof RadioNodeList || field.tagName === 'SELECT' ? 'change' : 'input';
    if (field instanceof RadioNodeList) {
      Array.from(field).forEach((input) => input.addEventListener(eventName, () => clearFieldError(name)));
    } else {
      field.addEventListener(eventName, () => clearFieldError(name));
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus();
    if (!validateForm()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    setLoading(true);
    setStatus('Submitting…');

    try {
      const response = await fetch('/api/redesign-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (result.fields) {
          Object.entries(result.fields).forEach(([name, message]) => setFieldError(name, message));
        }
        throw new Error(result.message || 'Something went wrong. Please try again.');
      }

      form.reset();
      setOtherRoleVisibility(false);
      startedAt.value = String(Date.now());
      setStatus('Thanks — your website is in. I’ll be in touch if it’s selected.', 'success');
    } catch (error) {
      setStatus(error.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  });
})();
