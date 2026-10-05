const { setTimeout: delay } = require('node:timers/promises');

const RECIPIENT = 'smmd999a@gmail.com';
const FORM_URL = 'https://www.smmd.me/redesign';

async function sendSubmissionEmail(data) {
  const body = JSON.stringify({
    _subject: `New hero redesign request — ${data.work_email}`,
    _template: 'table',
    _captcha: 'false',
    _url: FORM_URL,
    _replyto: data.work_email,
    email: data.work_email,
    'Company URL': data.company_url,
    'X handle or profile': data.x_handle,
    Role: data.role === 'Other' ? `Other: ${data.role_other}` : data.role,
    'Company stage': data.company_stage,
    'Improvement goal': data.improvement_goal,
    'All submissions': 'https://www.smmd.me/redesign/submissions',
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`https://formsubmit.co/ajax/${RECIPIENT}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Origin: 'https://www.smmd.me',
          Referer: FORM_URL,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || (result.success !== true && result.success !== 'true')) {
        throw new Error(`Submission email was not accepted (HTTP ${response.status}).`);
      }
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await delay(250 * (attempt + 1));
    }
  }
}

module.exports = { sendSubmissionEmail };
