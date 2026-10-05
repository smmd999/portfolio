const assert = require('node:assert/strict');
const { test } = require('node:test');
const submit = require('../api/redesign-submit');
const { submissionNotification } = require('../server/redesign-email');
const { sendRedesignNotification } = require('../redesign/notification');

const submission = {
  work_email: 'lead@example.com',
  company_url: 'https://example.com',
  x_handle: '@example',
  role: 'Other',
  role_other: 'CEO',
  company_stage: 'Pre-revenue',
  improvement_goal: 'Make our product easier to understand.',
};

function response() {
  return {
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function mockServices(t, handler) {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = 'https://database.example.com';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  t.mock.method(global, 'fetch', handler);
  t.mock.method(console, 'error', () => {});
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousKey;
  });
}

test('stores the request and awaits email acceptance before returning success', async (t) => {
  const calls = [];
  let releaseEmail;
  mockServices(t, async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (url.includes('database.example.com')) return new Response(null, { status: 204 });
    await new Promise((resolve) => { releaseEmail = resolve; });
    return Response.json({ success: 'true' });
  });
  const res = response();
  await submit({ method: 'POST', headers: {}, body: submission }, res);
  let accepted = false;
  const request = sendRedesignNotification(res.body.notification).then(() => { accepted = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(accepted, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://formsubmit.co/ajax/smmd999a@gmail.com');
  assert.equal(calls[1].body._replyto, submission.work_email);
  assert.equal(calls[1].body.Role, 'Other: CEO');
  assert.equal(calls[1].body['Improvement goal'], submission.improvement_goal);
  releaseEmail();
  await request;
  assert.equal(accepted, true);
});

test('retries a temporary email outage', async (t) => {
  let emailAttempts = 0;
  mockServices(t, async (url) => {
    if (url.includes('database.example.com')) return new Response(null, { status: 204 });
    emailAttempts += 1;
    if (emailAttempts === 1) throw new Error('Temporary network failure');
    return Response.json({ success: true });
  });
  await sendRedesignNotification(submissionNotification(submission));
  assert.equal(emailAttempts, 2);
});

test('does not report success when an HTTP 200 contains an email rejection', async (t) => {
  let emailAttempts = 0;
  mockServices(t, async (url) => {
    if (url.includes('database.example.com')) return new Response(null, { status: 204 });
    emailAttempts += 1;
    return Response.json({ success: 'false', message: 'Activation required' });
  });
  await assert.rejects(sendRedesignNotification(submissionNotification(submission)), /saved/);
  assert.equal(emailAttempts, 3);
});

test('does not send email if the database cannot save the submission', async (t) => {
  const calls = [];
  mockServices(t, async (url) => {
    calls.push(url);
    return new Response('Database unavailable', { status: 503 });
  });
  const res = response();
  await submit({ method: 'POST', headers: {}, body: submission }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /database.example.com/);
});

test('invalid and honeypot submissions never call the database or email service', async (t) => {
  mockServices(t, () => { throw new Error('Unexpected network call'); });
  const invalid = response();
  await submit({ method: 'POST', headers: {}, body: {} }, invalid);
  assert.equal(invalid.statusCode, 400);
  const spam = response();
  await submit({ method: 'POST', headers: {}, body: { ...submission, website: 'spam' } }, spam);
  assert.equal(spam.statusCode, 201);
});
