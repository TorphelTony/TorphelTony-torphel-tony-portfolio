import { type Inquiry, validateInquiry } from './model';

interface RecaptchaApi {
  getResponse(): string;
  reset(): void;
}
declare global {
  interface Window {
    grecaptcha?: RecaptchaApi;
  }
}

const form = document.querySelector<HTMLFormElement>('#discovery-form');
if (form) {
  const panels = [...form.querySelectorAll<HTMLFieldSetElement>('.form-panel')];
  const steps = [...document.querySelectorAll<HTMLLIElement>('.form-steps li')];
  const progress = document.querySelector<HTMLElement>('.step-progress span');
  const status = document.querySelector<HTMLElement>('#form-status');
  const summary = document.querySelector<HTMLElement>('#brief-summary');
  const back = document.querySelector<HTMLButtonElement>('#back-button');
  const next = document.querySelector<HTMLButtonElement>('#next-button');
  const submit = document.querySelector<HTMLButtonElement>('#submit-button');
  const date = form.elements.namedItem('preferredDate') as HTMLInputElement;
  const started = form.elements.namedItem('startedAt') as HTMLInputElement;
  started.value = String(Date.now());
  date.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  let current = 0;
  const read = (): Inquiry => {
    const values = new FormData(form);
    const field = (key: string): string => String(values.get(key) ?? '').trim();
    return {
      fullName: field('fullName'),
      email: field('email'),
      dialCode: field('dialCode'),
      phone: field('phone'),
      company: field('company'),
      website: field('website'),
      projectType: field('projectType'),
      budget: field('budget'),
      projectBrief: field('projectBrief'),
      preferredDate: field('preferredDate'),
      preferredTime: field('preferredTime'),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      startedAt: Number(field('startedAt')),
      website_check: field('website_check'),
      recaptchaToken: window.grecaptcha?.getResponse() || '',
    };
  };
  const updateSummary = (): void => {
    const data = read();
    const lines = [
      data.fullName,
      data.company,
      data.projectType,
      data.budget,
      data.projectBrief,
      data.preferredDate && data.preferredTime
        ? `${data.preferredDate} at ${data.preferredTime} (${data.timezone})`
        : '',
    ].filter(Boolean);
    if (summary) summary.textContent = lines.join('\n') || 'Fills in as you go.';
  };
  const show = (index: number): void => {
    current = index;
    panels.forEach((panel, i) => {
      panel.hidden = i !== index;
    });
    steps.forEach((step, i) => {
      step.classList.toggle('is-active', i === index);
      step.classList.toggle('is-done', i < index);
      if (i === index) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    if (progress) progress.style.width = `${((index + 1) * 100) / 3}%`;
    if (back) back.hidden = index === 0;
    if (next) next.hidden = index === 2;
    if (submit) submit.hidden = index !== 2;
    if (status)
      status.textContent =
        index === 2
          ? 'Choose a time, complete spam protection, then send.'
          : 'Takes about a minute.';
    panels[index].querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
  };
  const errorMap: Record<string, string> = {
    fullName: 'name-error',
    email: 'email-error',
    phone: 'phone-error',
    projectType: 'type-error',
    budget: 'budget-error',
    projectBrief: 'brief-error',
    preferredDate: 'date-error',
    preferredTime: 'time-error',
  };
  const validateStep = (index: number): boolean => {
    const errors = validateInquiry(read());
    let first: HTMLElement | null = null;
    for (const input of panels[index].querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >('input,select,textarea')) {
      const message = errors[input.name] || '';
      const target = document.getElementById(errorMap[input.name] || '');
      if (target) target.textContent = message;
      if (message) {
        input.setAttribute('aria-invalid', 'true');
        first ??= input;
      } else input.removeAttribute('aria-invalid');
    }
    if (first) {
      first.focus();
      if (status) status.textContent = 'Please correct the highlighted fields.';
      return false;
    }
    return true;
  };
  form.addEventListener('input', updateSummary);
  form.addEventListener('change', updateSummary);
  form.addEventListener('keydown', (event) => {
    if (
      event.key === 'Enter' &&
      current < 2 &&
      event.target instanceof HTMLInputElement &&
      event.target.type !== 'hidden'
    ) {
      event.preventDefault();
      if (validateStep(current)) show(current + 1);
    }
  });
  next?.addEventListener('click', () => {
    if (validateStep(current)) show(current + 1);
  });
  back?.addEventListener('click', () => show(current - 1));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateStep(current)) return;
    const data = read();
    if (!data.recaptchaToken) {
      if (status) status.textContent = 'Complete the reCAPTCHA checkbox before sending.';
      return;
    }
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Sending…';
    }
    if (status) status.textContent = 'Sending your inquiry…';
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok)
        throw new Error(result.message || 'The message could not be sent. Please try again.');
      if (status) status.textContent = 'Thanks! Your inquiry was sent. I’ll reply by email.';
      form.reset();
      window.grecaptcha?.reset();
      started.value = String(Date.now());
      updateSummary();
      show(0);
      if (status) status.textContent = 'Thanks! Your inquiry was sent. I’ll reply by email.';
    } catch (error) {
      if (status)
        status.textContent =
          error instanceof Error ? error.message : 'The message could not be sent.';
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = 'Send inquiry <span aria-hidden="true">→</span>';
      }
    }
  });
  updateSummary();
}
