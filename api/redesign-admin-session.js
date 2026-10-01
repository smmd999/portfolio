const {
  adminCookie,
  clientIp,
  createAdminToken,
  getAdminConfig,
  isAdminRequest,
  parseRequestBody,
  secureEqual,
} = require('../server/redesign');

const attempts = new Map();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function activeAttempts(ip) {
  const now = Date.now();
  if (attempts.size > 5_000) {
    for (const [key, value] of attempts) {
      if (now - value.startedAt > ATTEMPT_WINDOW_MS) attempts.delete(key);
    }
  }
  const record = attempts.get(ip);
  if (!record || now - record.startedAt > ATTEMPT_WINDOW_MS) {
    const fresh = { count: 0, startedAt: now };
    attempts.set(ip, fresh);
    return fresh;
  }
  return record;
}

module.exports = async function redesignAdminSession(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'GET, POST, DELETE');

  if (req.method === 'GET') {
    return isAdminRequest(req)
      ? res.status(200).json({ authenticated: true })
      : res.status(401).json({ authenticated: false });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', adminCookie(req, '', 0));
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  let config;
  try {
    config = getAdminConfig();
  } catch {
    return res.status(503).json({ message: 'Admin access is not configured.' });
  }

  const ip = clientIp(req);
  const attempt = activeAttempts(ip);
  if (attempt.count >= MAX_ATTEMPTS) {
    res.setHeader('Retry-After', String(Math.ceil((ATTEMPT_WINDOW_MS - (Date.now() - attempt.startedAt)) / 1000)));
    return res.status(429).json({ message: 'Too many attempts. Try again later.' });
  }

  let body;
  try {
    body = parseRequestBody(req);
  } catch {
    return res.status(400).json({ message: 'Invalid request.' });
  }

  if (!secureEqual(String(body.passcode || ''), config.passcode)) {
    attempt.count += 1;
    return res.status(401).json({ message: 'Incorrect passcode.' });
  }

  attempts.delete(ip);
  res.setHeader('Set-Cookie', adminCookie(req, createAdminToken(config.secret)));
  return res.status(200).json({ authenticated: true });
};
