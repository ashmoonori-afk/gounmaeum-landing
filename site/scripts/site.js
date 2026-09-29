// Site shell behaviour: client config values, header disclosure menu, mobile CTA bar (E9).
// Menu adapted from StyleGallery examples/stylegallery-homepage/script.js (aria-expanded + data-open +
// sr-only label swap) and examples/toss-homepage-clone/script.js (close on link click and Escape).
// Mobile CTA follows research/brief.md §5.3 and recipes/form-flow.md ("Sticky or fixed actions must not
// cover focused fields, inline errors, or the first invalid field after submission").
import { SITE_CONFIG, isSet } from './site-config.js';

const listeners = new AbortController();
const { signal } = listeners;

/* ---------- Client config → DOM ---------- */
function telHref(value) {
  return `tel:${String(value).replace(/[^\d+]/g, '')}`;
}

export function applyConfig(config = SITE_CONFIG, root = document) {
  root.querySelectorAll('[data-config]').forEach((slot) => {
    const value = config[slot.dataset.config];
    if (!isSet(value)) {
      slot.dataset.state = 'unset';
      return;
    }
    slot.textContent = String(value);
    slot.dataset.state = 'set';
    if (slot.dataset.configLink === 'mailto') slot.href = `mailto:${value}`;
    if (slot.dataset.configLink === 'tel') slot.href = telHref(value);
  });
  root.querySelectorAll('[data-config-href]').forEach((link) => {
    const value = config[link.dataset.configHref];
    if (!isSet(value)) {
      link.dataset.state = 'unset';
      return;
    }
    link.href = String(value);
    link.dataset.state = 'set';
  });
  if (config.showOperatorLine === false) {
    root.querySelectorAll('[data-operator-line]').forEach((node) => { node.hidden = true; });
    // Operator proof (1,500명+ · 100개+ · 24시간) is only attributable while the operator is named.
    root.querySelectorAll('[data-operator-block]').forEach((node) => { node.hidden = true; });
    root.querySelectorAll('[data-operator-sentence]').forEach((node) => node.remove());
    root.querySelectorAll('[data-operator-swap]').forEach((node) => {
      if (node.dataset.alt) node.textContent = node.dataset.alt;
    });
  }
}

/* ---------- Header disclosure menu ----------
 * One open surface owns focus (design-engineering/native-interaction-contracts.md): when focus leaves the toggle
 * and the panel (Tab past 사전 이용 신청, Shift+Tab above the toggle), the panel closes without moving focus, so the
 * open panel never covers the newly focused element (recipes/homepage.md: never hide focused content). */
function mountMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('#site-nav');
  if (!toggle || !nav) return null;
  const label = toggle.querySelector('[data-menu-label]');
  const wide = matchMedia('(min-width: 768px)');
  toggle.hidden = false;

  const setOpen = (open, { restoreFocus = false } = {}) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.dataset.open = String(open);
    if (label) label.textContent = open ? '메뉴 닫기' : '메뉴 열기';
    document.dispatchEvent(new CustomEvent('menustate', { detail: { open } }));
    if (!open && restoreFocus) toggle.focus();
  };
  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  toggle.addEventListener('click', () => setOpen(!isOpen()), { signal });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a') && isOpen()) setOpen(false);
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    const focusInside = nav.contains(document.activeElement) || toggle === document.activeElement;
    setOpen(false, { restoreFocus: focusInside });
  }, { signal });
  const closeWhenFocusLeaves = (event) => {
    const next = event.relatedTarget;
    if (!isOpen() || !(next instanceof Node)) return; // window blur or a click on nothing focusable keeps it open
    if (next === toggle || nav.contains(next)) return;
    setOpen(false);
  };
  nav.addEventListener('focusout', closeWhenFocusLeaves, { signal });
  toggle.addEventListener('focusout', closeWhenFocusLeaves, { signal });
  wide.addEventListener('change', ({ matches }) => { if (matches && isOpen()) setOpen(false); }, { signal });
  return { isOpen };
}

/* ---------- Mobile CTA bar (E9) ----------
 * Landing v3 fix round: the bar keeps the one conversion reachable on every screen where the catchphrase CTAs are not
 * visible — including the full-height brand hero, whose only other route to 사전 이용 신청 is the collapsed menu.
 * While the brand hero is on screen the bar waits until the logo draw has rested, so the draw plays undisturbed. */
const LOGO_REST_FALLBACK_MS = 2600; // start gate (≤ 800 ms) + draw (1200 ms) + margin, for a draw that never reports

function whenLogoRests(callback) {
  const wordmark = document.querySelector('[data-brand-lockup] .gm-wordmark');
  let done = false;
  const finish = () => { if (done) return; done = true; clearTimeout(timer); callback(); };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const started = document.documentElement.dataset.logo === 'play';
  // No lockup, reduced motion (no draw), or a draw that already ended (its backwards-only fill leaves no animation).
  if (!wordmark || reduced || (started && wordmark.getAnimations().length === 0)) { callback(); return; }
  const timer = setTimeout(finish, LOGO_REST_FALLBACK_MS);
  wordmark.addEventListener('animationend', finish, { once: true, signal });
  wordmark.addEventListener('animationcancel', finish, { once: true, signal });
}

function mountMobileCta(menu) {
  const bar = document.querySelector('[data-mobile-cta]');
  const heroActions = document.querySelector('[data-hero-actions]');
  const apply = document.querySelector('#apply');
  if (!bar || !heroActions || !apply || !('IntersectionObserver' in window)) return null;
  // The catchphrase CTAs sit one viewport below the top, so a long jump (to the top, or from the top to a deep
  // section) can cross them without any intersection change on the CTAs themselves. The brand hero and the
  // catchphrase are observed too, and every report re-reads where the CTAs and the brand hero are.
  const brandHero = document.querySelector('.brand-hero');
  const passTargets = [brandHero, document.querySelector('#intro'), heroActions].filter(Boolean);
  const narrow = matchMedia('(max-width: 767.98px)');
  const state = { applyInView: false, brandOnScreen: true, heroActionsVisible: false, logoRested: false, menuOpen: menu?.isOpen() ?? false };
  bar.hidden = false;
  document.documentElement.dataset.ctaBar = 'on'; // reserves the bar's height (styles/product.css, styles/brand-hero.css)

  const render = () => {
    const calm = state.logoRested || !state.brandOnScreen;
    const visible = narrow.matches && !state.heroActionsVisible && !state.applyInView && !state.menuOpen && calm;
    bar.dataset.visible = String(visible);
    bar.inert = !visible;
    if (visible) bar.removeAttribute('aria-hidden');
    else bar.setAttribute('aria-hidden', 'true');
  };

  const heroObserver = new IntersectionObserver(() => {
    const actions = heroActions.getBoundingClientRect();
    state.heroActionsVisible = actions.bottom > 0 && actions.top < innerHeight;
    state.brandOnScreen = (brandHero?.getBoundingClientRect().bottom ?? 0) > 0;
    render();
  });
  // One batch can hold two entries for the same target (a stale one, then the current one, e.g. when the fragment
  // scroll of /#apply lands in the same frame as the first observation), so the latest entry decides.
  const applyObserver = new IntersectionObserver((entries) => {
    state.applyInView = entries.at(-1).isIntersecting;
    render();
  });
  passTargets.forEach((target) => heroObserver.observe(target));
  applyObserver.observe(apply);
  document.addEventListener('menustate', ({ detail }) => { state.menuOpen = detail.open; render(); }, { signal });
  narrow.addEventListener('change', render, { signal });
  whenLogoRests(() => { state.logoRested = true; render(); });
  render();
  return {
    state,
    destroy() { heroObserver.disconnect(); applyObserver.disconnect(); },
  };
}

applyConfig();
const menu = mountMenu();
const mobileCta = mountMobileCta(menu);

// Test hook for qa/ (read-only state; no behaviour depends on it).
window.__landingSite = { mobileCta: mobileCta?.state ?? null };

window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  listeners.abort();
  mobileCta?.destroy();
});
