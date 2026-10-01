(() => {
  const loginView = document.querySelector('#login-view');
  const viewerView = document.querySelector('#viewer-view');
  const loginForm = document.querySelector('#login-form');
  const loginStatus = document.querySelector('#login-status');
  const viewerStatus = document.querySelector('#viewer-status');
  const submissionList = document.querySelector('#submission-list');
  const submissionCount = document.querySelector('#submission-count');
  const loadMoreButton = document.querySelector('#load-more-button');
  const logoutButton = document.querySelector('#logout-button');

  let nextPage = 0;
  let totalLoaded = 0;

  function showLogin() {
    loginView.hidden = false;
    viewerView.hidden = true;
    loginForm.querySelector('#passcode').focus();
  }

  function showViewer() {
    loginView.hidden = true;
    viewerView.hidden = false;
  }

  function textCell(label, value, className = '') {
    const cell = document.createElement('div');
    cell.className = `submission-cell${className ? ` ${className}` : ''}`;
    cell.dataset.label = label;
    cell.textContent = value || '—';
    return cell;
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL((value || '').trim());
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  }

  function xProfileUrl(value) {
    const trimmed = (value || '').trim();
    if (/^@[A-Za-z0-9_]{1,15}$/.test(trimmed)) return `https://x.com/${trimmed.slice(1)}`;
    return safeHttpUrl(value);
  }

  function linkCell(label, value, href) {
    const cell = textCell(label, '');
    if (!href) {
      cell.textContent = value || '—';
      return cell;
    }

    cell.textContent = '';
    const link = document.createElement('a');
    link.href = href;
    link.rel = 'noreferrer';
    link.target = '_blank';
    link.textContent = value;
    cell.append(link);
    return cell;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '—';
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function renderHeader() {
    const row = document.createElement('div');
    row.className = 'submission-row is-header';
    ['Submitted', 'Email', 'Company', 'X handle', 'Role', 'Stage', 'Improvement goal']
      .forEach((label) => row.append(textCell(label, label)));
    submissionList.append(row);
  }

  function renderSubmission(submission) {
    const row = document.createElement('article');
    row.className = 'submission-row';
    row.append(
      textCell('Submitted', formatDate(submission.created_at)),
      linkCell('Email', submission.work_email, `mailto:${submission.work_email}`),
      linkCell('Company', submission.company_url, safeHttpUrl(submission.company_url)),
      linkCell('X handle', submission.x_handle, xProfileUrl(submission.x_handle)),
      textCell('Role', submission.role === 'Other' && submission.role_other
        ? `Other — ${submission.role_other}`
        : submission.role),
      textCell('Stage', submission.company_stage),
      textCell('Improvement goal', submission.improvement_goal, 'goal-cell'),
    );
    submissionList.append(row);
  }

  async function loadSubmissions(reset = false) {
    if (reset) {
      nextPage = 0;
      totalLoaded = 0;
      submissionList.replaceChildren();
      loadMoreButton.hidden = true;
    }

    viewerStatus.textContent = nextPage === 0 ? 'Loading submissions…' : 'Loading more…';
    loadMoreButton.disabled = true;

    try {
      const response = await fetch(`/api/redesign-admin-submissions?page=${nextPage}`, {
        headers: { Accept: 'application/json' },
      });
      if (response.status === 401) {
        showLogin();
        return;
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Unable to load submissions.');

      if (nextPage === 0 && result.submissions.length) renderHeader();
      result.submissions.forEach(renderSubmission);
      totalLoaded += result.submissions.length;
      nextPage = result.next_page;

      submissionCount.textContent = totalLoaded === 1
        ? '1 submission'
        : `${totalLoaded.toLocaleString()} submissions${result.has_more ? ' loaded' : ''}`;
      loadMoreButton.hidden = !result.has_more;
      viewerStatus.textContent = '';

      if (totalLoaded === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No submissions yet.';
        submissionList.append(empty);
      }
    } catch (error) {
      viewerStatus.textContent = error.message || 'Unable to load submissions.';
    } finally {
      loadMoreButton.disabled = false;
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('button');
    const passcode = loginForm.querySelector('#passcode').value;
    button.disabled = true;
    loginStatus.textContent = 'Checking…';

    try {
      const response = await fetch('/api/redesign-admin-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Unable to sign in.');
      loginForm.reset();
      loginStatus.textContent = '';
      showViewer();
      await loadSubmissions(true);
    } catch (error) {
      loginStatus.textContent = error.message || 'Unable to sign in.';
    } finally {
      button.disabled = false;
    }
  });

  logoutButton.addEventListener('click', async () => {
    await fetch('/api/redesign-admin-session', { method: 'DELETE' });
    showLogin();
  });

  loadMoreButton.addEventListener('click', () => loadSubmissions());

  fetch('/api/redesign-admin-session', { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error('Not authenticated');
      showViewer();
      return loadSubmissions(true);
    })
    .catch(showLogin);
})();
