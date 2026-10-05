const {
  parseRequestBody,
  supabaseRequest,
  validateSubmission,
} = require('../server/redesign');
const { sendSubmissionEmail } = require('../server/redesign-email');

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

  try {
    // Await the provider's acceptance before showing the submission success toast.
    // The database copy is already safe even if the email service is unavailable.
    await sendSubmissionEmail(validation.data);
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Unable to email redesign submission:', error.message);
    return res.status(503).json({
      message: 'Your request was saved, but the notification could not be sent. Please try again shortly.',
    });
  }
};
