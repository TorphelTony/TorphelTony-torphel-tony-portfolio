import { type Inquiry, validateInquiry } from './model.ts';

const json = (body: object, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function handleContact(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false, message: 'Method not allowed.' }, 405);
  if (Number(request.headers.get('content-length') || 0) > 12000)
    return json({ ok: false, message: 'Message is too large.' }, 413);
  let data: Inquiry;
  try {
    const body = await request.text();
    if (body.length > 12000) return json({ ok: false, message: 'Message is too large.' }, 413);
    data = JSON.parse(body) as Inquiry;
  } catch {
    return json({ ok: false, message: 'Invalid request.' }, 400);
  }
  if (!data || typeof data !== 'object')
    return json({ ok: false, message: 'Invalid request.' }, 400);
  if (data.website_check) return json({ ok: true });
  const age = Date.now() - Number(data.startedAt);
  if (!Number.isFinite(age) || age < 2000 || age > 7200000)
    return json({ ok: false, message: 'Please refresh the page and try again.' }, 400);
  if (Object.keys(validateInquiry(data)).length)
    return json({ ok: false, message: 'Please check your form details.' }, 400);
  if (
    typeof data.recaptchaToken !== 'string' ||
    data.recaptchaToken.length < 20 ||
    data.recaptchaToken.length > 5000
  )
    return json({ ok: false, message: 'Complete spam protection.' }, 400);
  const url = process.env.APPS_SCRIPT_WEB_APP_URL;
  const key = process.env.APPS_SCRIPT_WEBHOOK_KEY;
  if (!url || !key)
    return json(
      { ok: false, message: 'The form is not ready yet. Please email me directly.' },
      503,
    );
  if (!/^https:\/\/script\.google\.com\/macros\/s\//.test(url))
    return json({ ok: false, message: 'The form is not configured correctly.' }, 503);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...data, webhookKey: key }),
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    const result = (await response.json()) as { ok?: boolean; message?: string };
    if (!result.ok) {
      const reasons: Record<string, string> = {
        'Captcha failed.': 'captcha_rejected',
        'Captcha is required.': 'captcha_missing',
        'Unauthorized.': 'webhook_key_mismatch',
        'Configuration missing.': 'script_configuration_missing',
        'Please wait before sending again.': 'rate_limited',
        'Submission failed.': 'script_execution_failed',
      };
      console.warn(
        'Contact delivery rejected:',
        reasons[result.message || ''] || 'upstream_rejected',
      );
      if (result.message === 'Captcha failed.' || result.message === 'Captcha is required.')
        return json(
          {
            ok: false,
            message: 'Spam verification expired or failed. Please complete reCAPTCHA again.',
          },
          400,
        );
      if (result.message === 'Please wait before sending again.')
        return json(
          { ok: false, message: 'Please wait a minute before sending another inquiry.' },
          429,
        );
    }
    if (!response.ok || !result.ok)
      return json(
        { ok: false, message: 'The inquiry could not be delivered. Please email me directly.' },
        502,
      );
    return json({ ok: true });
  } catch {
    return json(
      { ok: false, message: 'The form is temporarily unavailable. Please email me directly.' },
      502,
    );
  }
}

export function handleWhatsApp(request: Request): Response {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const phone = process.env.WHATSAPP_NUMBER;
  if (!phone || !/^\d{8,15}$/.test(phone))
    return new Response('WhatsApp is not configured.', { status: 503 });
  const requested = new URL(request.url).searchParams.get('text') || '';
  const message =
    requested.slice(0, 300) ||
    'Hi Torphel, I found your portfolio and would like to discuss a project.';
  return Response.redirect(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, 302);
}
