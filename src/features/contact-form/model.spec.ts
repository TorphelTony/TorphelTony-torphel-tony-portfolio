import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Inquiry, validateInquiry } from './model.ts';
import { handleContact, handleWhatsApp } from './server.ts';

const valid: Inquiry = {
  fullName: 'Jane Cooper',
  email: 'jane@example.com',
  dialCode: '+91',
  phone: '98765 43210',
  company: '',
  website: '',
  projectType: 'Web application',
  budget: 'Let’s discuss',
  projectBrief: 'I need help building an accessible web app.',
  preferredDate: '2027-01-15',
  preferredTime: '14:30',
  timezone: 'Asia/Kolkata',
  startedAt: Date.now() - 5000,
  website_check: '',
  recaptchaToken: 'x'.repeat(30),
};

test('accepts a complete inquiry and rejects malicious or missing fields', () => {
  assert.deepEqual(validateInquiry(valid), {});
  assert.ok(validateInquiry({ ...valid, email: 'not-an-email' }).email);
  assert.ok(validateInquiry({ ...valid, projectBrief: 'short' }).projectBrief);
  assert.ok(validateInquiry({ ...valid, projectType: '<script>' }).projectType);
  assert.ok(validateInquiry({ ...valid, preferredDate: '2027-02-31' }).preferredDate);
});

test('server rejects a rushed submission before forwarding it', async () => {
  const request = new Request('https://example.com/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...valid, startedAt: Date.now() }),
  });
  const response = await handleContact(request);
  assert.equal(response.status, 400);
});

test('server requires configured delivery and never returns false success', async () => {
  const request = new Request('https://example.com/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(valid),
  });
  const response = await handleContact(request);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});

test('WhatsApp redirect requires server-side phone configuration', () => {
  const response = handleWhatsApp(new Request('https://example.com/api/whatsapp'));
  assert.equal(response.status, 503);
});

test('server forwards with a private key and rejects an Apps Script failure response', async () => {
  const previousUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
  const previousKey = process.env.APPS_SCRIPT_WEBHOOK_KEY;
  const previousFetch = globalThis.fetch;
  let forwarded = '';
  process.env.APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/test/exec';
  process.env.APPS_SCRIPT_WEBHOOK_KEY = 'test-only-key';
  globalThis.fetch = async (_input, init) => {
    forwarded = String(init?.body || '');
    return Response.json({ ok: false });
  };
  try {
    const request = new Request('https://example.com/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(valid),
    });
    const response = await handleContact(request);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).ok, false);
    assert.equal(JSON.parse(forwarded).webhookKey, 'test-only-key');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.APPS_SCRIPT_WEB_APP_URL;
    else process.env.APPS_SCRIPT_WEB_APP_URL = previousUrl;
    if (previousKey === undefined) delete process.env.APPS_SCRIPT_WEBHOOK_KEY;
    else process.env.APPS_SCRIPT_WEBHOOK_KEY = previousKey;
  }
});
