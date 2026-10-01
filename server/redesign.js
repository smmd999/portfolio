const crypto = require('node:crypto');

const ROLES = new Set(['Founder', 'Marketing', 'Product', 'Design', 'Other']);
const COMPANY_STAGES = new Set([
  'Pre-revenue',
  '<$500k ARR',
  '$500k–$2M ARR',
  '$2M–$10M ARR',
  '$10M+ ARR',
]);
const ADMIN_COOKIE = 'redesign_admin';
const ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 30;

function valueAsString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function valueAsRawString(value) {
  return typeof value === 'string' ? value : '';
}

function validateSubmission(body) {
  const data = {
    work_email: valueAsString(body.work_email),
    // Keep these in the exact format supplied so an @handle is never silently
    // rewritten into a URL (and vice versa).
    company_url: valueAsRawString(body.company_url),
    x_handle: valueAsRawString(body.x_handle),
    role: valueAsString(body.role),
    role_other: valueAsString(body.role_other) || null,
    company_stage: valueAsString(body.company_stage),
    improvement_goal: valueAsString(body.improvement_goal),
  };
  const fields = {};

  if (!data.work_email) fields.work_email = 'Enter your work email.';
  else if (data.work_email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.work_email)) {
    fields.work_email = 'Enter a valid email address.';
  }

  if (!data.company_url.trim()) fields.company_url = 'Enter your company URL.';
  else if (data.company_url.length > 2048 || !isHttpUrl(data.company_url.trim())) {
    fields.company_url = 'Use a full URL, including https://.';
  }

  if (!data.x_handle.trim()) fields.x_handle = 'Enter your X handle or profile URL.';
  else if (data.x_handle.length > 2048 || !isXHandleOrUrl(data.x_handle.trim())) {
    fields.x_handle = 'Use @handle or a full profile URL.';
  }

  if (!ROLES.has(data.role)) fields.role = 'Select your role.';
  if (data.role === 'Other' && (!data.role_other || data.role_other.length > 120)) {
    fields.role_other = 'Tell me your role.';
  }
  if (data.role !== 'Other') data.role_other = null;

  if (!COMPANY_STAGES.has(data.company_stage)) fields.company_stage = 'Select your company stage.';
  if (!data.improvement_goal) fields.improvement_goal = 'Tell me what you are trying to improve.';
  else if (data.improvement_goal.length > 4000) fields.improvement_goal = 'Keep this to 4,000 characters or fewer.';

  return { data, fields, valid: Object.keys(fields).length === 0 };
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isXHandleOrUrl(value) {
  return /^@[A-Za-z0-9_]{1,15}$/.test(value) || isHttpUrl(value);
}

function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return {};
}

function getSupabaseConfig() {
  const url = valueAsString(process.env.SUPABASE_URL).replace(/\/$/, '');
  const key = valueAsString(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) throw new Error('Supabase is not configured.');
  return { url, key };
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = getSupabaseConfig();
  const headers = {
    Accept: 'application/json',
    apikey: key,
    ...options.headers,
  };

  // Legacy service_role keys are JWTs. New sb_secret keys are opaque and belong
  // in the apikey header; Supabase's gateway supplies the internal role token.
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;

  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers });
  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Supabase request failed with ${response.status}.`);
    error.status = response.status;
    error.details = details;
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function getAdminConfig() {
  const passcode = valueAsString(process.env.ADMIN_PASSCODE);
  const secret = valueAsString(process.env.ADMIN_SESSION_SECRET);
  if (!passcode || !secret || secret.length < 32) {
    throw new Error('Admin access is not configured.');
  }
  return { passcode, secret };
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createAdminToken(secret) {
  const expires = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`redesign-admin:${expires}`)
    .digest('base64url');
  return `${expires}.${signature}`;
}

function verifyAdminToken(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const [expiresValue, suppliedSignature, extra] = token.split('.');
  if (extra || !/^\d+$/.test(expiresValue || '') || !suppliedSignature) return false;
  const expires = Number(expiresValue);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`redesign-admin:${expires}`)
    .digest('base64url');
  return secureEqual(suppliedSignature, expectedSignature);
}

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator === -1) return cookies;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function isAdminRequest(req) {
  try {
    const { secret } = getAdminConfig();
    const token = parseCookies(req.headers.cookie || '')[ADMIN_COOKIE];
    return verifyAdminToken(token, secret);
  } catch {
    return false;
  }
}

function shouldUseSecureCookie(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const protocol = String(req.headers['x-forwarded-proto'] || 'https');
  return protocol === 'https' && !/^localhost(?::|$)|^127\.0\.0\.1(?::|$)/.test(host);
}

function adminCookie(req, token, maxAge = ADMIN_SESSION_SECONDS) {
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (shouldUseSecureCookie(req)) parts.push('Secure');
  return parts.join('; ');
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

module.exports = {
  adminCookie,
  clientIp,
  createAdminToken,
  getAdminConfig,
  isAdminRequest,
  parseRequestBody,
  secureEqual,
  supabaseRequest,
  validateSubmission,
};
