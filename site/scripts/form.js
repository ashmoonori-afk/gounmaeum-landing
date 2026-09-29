// 사전 이용 신청 form (E8). recipes/form-flow.md + motion/interaction-recipes.md "Action feedback":
// ready → pending → success | error; a retry is a new request; success waits for a real 2xx response.
// Entered values are kept on failure (design-engineering/worked-examples.md); Enter that confirms Korean IME
// composition never submits (design-engineering/text-input-and-internationalization.md).
import { SITE_CONFIG, isSet } from './site-config.js';

const REQUEST_TIMEOUT_MS = 15000;
const MESSAGE_MAX = 1000;

const COPY = Object.freeze({
  pending: '보내는 중…',
  submit: '사전 이용 신청하기',
  success: '사전 이용 신청을 받았어요. 남긴 연락처로 연락드릴게요.',
  error: '신청을 보내지 못했어요. 입력한 내용은 그대로 있어요. 잠시 후 다시 보내 주세요.',
  preview: '미리보기 화면이라 신청을 보내지 않았어요. 운영 주소를 연결하면 바로 접수해요.',
});

const PHONE_PATTERN = /^01[016789]\d{7,8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Named control lookup (avoids clashes with HTMLFormElement properties such as form.name). */
const field = (form, name) => form.elements.namedItem(name);

// Field rules in DOM order, so the first failing rule is also the first invalid field on the page.
const RULES = [
  { name: 'company', message: '회사명을 입력해 주세요.', valid: (form) => field(form, 'company').value.trim().length > 0 },
  { name: 'name', message: '담당자 이름을 입력해 주세요.', valid: (form) => field(form, 'name').value.trim().length > 0 },
  { name: 'role', message: '부서와 직책을 입력해 주세요.', valid: (form) => field(form, 'role').value.trim().length > 0 },
  { name: 'phone', message: '휴대폰 번호를 확인해 주세요. 예: 010-1234-5678', valid: (form) => PHONE_PATTERN.test(field(form, 'phone').value.replace(/[\s-]/g, '')) },
  { name: 'email', message: '이메일 주소를 확인해 주세요.', valid: (form) => EMAIL_PATTERN.test(field(form, 'email').value.trim()) },
  { name: 'size', message: '임직원 수를 선택해 주세요.', valid: (form) => field(form, 'size').value !== '' },
  { name: 'consent', message: '개인정보 수집·이용에 동의해 주세요.', valid: (form) => field(form, 'consent').checked },
];

export function validate(form) {
  return RULES.map((rule) => ({ ...rule, ok: rule.valid(form) }));
}

function mountForm(form) {
  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[data-submit]');
  const counter = form.querySelector('[data-count]');
  const listeners = new AbortController();
  const { signal } = listeners;
  let attempted = false;
  let pending = false;
  let requestId = 0;
  let inflight = null;

  // The markup keeps native validation and a disabled submit, so without script nothing is ever sent (no GET
  // query with personal data, no POST to the static host). With script this module owns validation and sending.
  form.noValidate = true;
  submit.disabled = false;

  const errorFor = (name) => form.querySelector(`[data-error-for="${name}"]`);
  const control = (name) => form.elements.namedItem(name);

  function showFieldState(result) {
    const field = control(result.name);
    const error = errorFor(result.name);
    if (!field || !error) return;
    field.setAttribute('aria-invalid', String(!result.ok));
    error.textContent = result.ok ? '' : result.message;
  }

  function setStatus(tone, message) {
    if (!status) return;
    status.dataset.tone = tone;
    status.textContent = message;
    status.hidden = false;
    status.focus();
  }
  function clearStatus() {
    if (!status) return;
    status.hidden = true;
    status.textContent = '';
    delete status.dataset.tone;
  }

  function setPending(next) {
    pending = next;
    submit.setAttribute('aria-disabled', String(next));
    submit.textContent = next ? COPY.pending : COPY.submit;
    form.setAttribute('aria-busy', String(next));
  }

  function payload() {
    const data = new FormData(form);
    return {
      company: String(data.get('company') ?? '').trim(),
      name: String(data.get('name') ?? '').trim(),
      role: String(data.get('role') ?? '').trim(),
      phone: String(data.get('phone') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      size: String(data.get('size') ?? ''),
      interests: data.getAll('interests').map(String),
      message: String(data.get('message') ?? '').slice(0, MESSAGE_MAX),
      consent: data.get('consent') === 'on',
      source: 'landing',
    };
  }

  async function send(body) {
    const id = ++requestId;
    inflight = new AbortController();
    const timer = setTimeout(() => inflight?.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(SITE_CONFIG.formEndpoint, {
        body: JSON.stringify(body),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        method: 'POST',
        signal: inflight.signal,
      });
      if (id !== requestId) return; // a newer request owns the outcome
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      form.reset();
      updateCounter();
      attempted = false;
      setStatus('success', COPY.success);
    } catch (error) {
      if (id !== requestId || signal.aborted) return;
      console.warn('[apply-form] submission failed', error); // values stay in the form
      setStatus('error', COPY.error);
    } finally {
      clearTimeout(timer);
      if (id === requestId) { inflight = null; setPending(false); }
    }
  }

  function updateCounter() {
    if (counter) counter.textContent = String(field(form, 'message').value.length);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (pending) return; // single flight
    attempted = true;
    clearStatus();
    const results = validate(form);
    results.forEach(showFieldState);
    const firstInvalid = results.find((result) => !result.ok);
    if (firstInvalid) {
      control(firstInvalid.name)?.focus();
      return;
    }
    if (field(form, 'website')?.value) return; // honeypot: silently drop automated submissions
    if (!isSet(SITE_CONFIG.formEndpoint)) {
      setStatus('preview', COPY.preview);
      return;
    }
    setPending(true);
    send(payload());
  }, { signal });

  // After the first attempt, re-check a field as it changes so fixed errors disappear right away.
  const recheck = (event) => {
    if (!attempted || !event.target.name) return;
    const result = validate(form).find((candidate) => candidate.name === event.target.name);
    if (result) showFieldState(result);
  };
  form.addEventListener('input', recheck, { signal });
  form.addEventListener('change', recheck, { signal });
  field(form, 'message')?.addEventListener('input', updateCounter, { signal });

  // Korean IME: the Enter that confirms composition must not submit.
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229) && event.target instanceof HTMLInputElement) {
      event.preventDefault();
    }
  }, { signal });

  submit.addEventListener('click', (event) => { if (pending) event.preventDefault(); }, { signal });

  return {
    destroy() {
      listeners.abort();
      inflight?.abort();
    },
  };
}

/* ---------- 관심 서비스 pre-check: ?interest=care and the 장례케어 CTA ---------- */
function preselectInterest(value) {
  const box = document.querySelector(`#apply-form input[name="interests"][value="${CSS.escape(value)}"]`);
  if (box) box.checked = true;
}

const form = document.querySelector('[data-apply-form]');
const controller = form ? mountForm(form) : null;
const interest = new URLSearchParams(location.search).get('interest');
if (interest) preselectInterest(interest);
document.querySelectorAll('[data-interest]').forEach((link) => {
  link.addEventListener('click', () => preselectInterest(link.dataset.interest));
});

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) controller?.destroy();
});
