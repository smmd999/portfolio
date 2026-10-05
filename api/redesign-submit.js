const {
  parseRequestBody,
  supabaseRequest,
  validateSubmission,
} = require('../server/redesign');
const { submissionNotification } = require('../server/redesign-email');

module.exports = async function redesignSubmit(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 16_000) {
    return res.status(413).json({ message: 'Submission is too large.' });
  }

  let body;
  try {
    body = parseRequestBody(req);
  } catch {
    return res.status(400).json({ message: 'Invalid request.' });
  }

  // Quietly accept honeypot or implausibly fast submissions without storing them.
  const startedAt = Number(body.form_started_at);
  if (body.website || (Number.isFinite(startedAt) && Date.now() - startedAt < 900)) {
    return res.status(201).json({ ok: true });
  }

  const validation = validateSubmission(body);
  if (!validation.valid) {
    return res.status(400).json({
      message: 'Check the highlighted fields and try again.',
      fields: validation.fields,
    });
  }

  try {
    await supabaseRequest('redesign_submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(validation.data),
    });
  } catch (error) {
    console.error('Unable to store redesign submission:', error.message, error.details || '');
    return res.status(503).json({ message: 'Unable to submit right now. Please try again shortly.' });
  }

  // FormSubmit supports browser AJAX. Requests from Vercel's datacenter are
  // blocked, so return the validated email payload after saving the request.
  // The browser awaits email acceptance before showing its success toast.
  return res.status(201).json({ ok: true, notification: submissionNotification(validation.data) });
};
