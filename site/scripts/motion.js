// Motion for the 고운마음 landing page: E3 reveals, E1 catchphrase stack, E2 story + persistent phone, E-console settle,
// E6 operator odometer (scripts/odometer.js). E-logo (the brand hero lockup) is CSS only (styles/brand-hero.css).
// Every effect is an enhancement: the HTML/CSS state without this file is complete and readable
// (motion/accessible-motion.md "Start with a complete stationary interaction").
// Parameters are product-local experiments recorded in docs/motion-briefs.md, not StyleGallery defaults.
import { mountOdometer } from './odometer.js';
import { clamp, fieldFilled, heroPose, phonePose, sampleStory, scrollProgress, settlePose } from './story-timeline.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const listeners = new AbortController();
const { signal } = listeners;

/* ---------- E3 section reveals ----------
 * Adapted from StyleGallery examples/toss-homepage-clone/script.js (reveal controller): content is visible by
 * default in CSS; JS adds the hidden pre-state only when motion is allowed; one-shot (unobserve after reveal).
 * Direct entry (/#services, reload mid-page): the observer's first report per element decides. Anything already
 * on screen at that point is never hidden (motion/interaction-recipes.md Scroll reveal: "content hidden before
 * script starts"); only elements that start off screen get the pre-state, which CSS applies without a transition. */
function mountReveals() {
  const items = [...document.querySelectorAll('.reveal')];
  if (!items.length || !('IntersectionObserver' in window)) return null;
  const reported = new WeakSet();
  const reveal = (element) => element.classList.add('is-visible');
  const onScreen = ({ top, bottom }) => top < innerHeight && bottom > 0;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const element = entry.target;
      if (!reported.has(element)) {
        reported.add(element);
        if (onScreen(entry.boundingClientRect)) {
          reveal(element);
          observer.unobserve(element);
        } else {
          element.classList.add('reveal-ready');
        }
        return;
      }
      if (!entry.isIntersecting) return;
      reveal(element);
      observer.unobserve(element);
    });
  }, { rootMargin: '0px 0px -12%', threshold: 0.1 });
  const revealAll = () => { items.forEach(reveal); observer.disconnect(); };

  if (reduced.matches) revealAll();
  else items.forEach((element) => observer.observe(element));
  reduced.addEventListener('change', ({ matches }) => { if (matches) revealAll(); }, { signal });
  return { destroy: () => observer.disconnect() };
}

/* ---------- E1 catchphrase layered stack ----------
 * Three nested wrappers, one transform owner each (motion/interruption-and-retargeting.md "Prefer one owner per
 * animated property"): .hero-object-enter = CSS entrance, .hero-object-scroll = scrub below, .hero-object-tilt = tilt.
 * Tilt idiom from research/04-stylegallery-spec.md §5.8 (fine hover pointers only, rAF-coalesced, retarget to rest).
 * Since landing v3 the section sits below the full-bleed brand hero, so the entrance waits for the object to enter
 * view (once) and the scrub is anchored to the section's own position, not to the document top. */
function mountHero() {
  const hero = document.querySelector('.hero');
  const scrollEl = document.querySelector('[data-hero-scroll]');
  const tiltEl = document.querySelector('[data-hero-tilt]');
  const figure = document.querySelector('[data-hero-figure]');
  if (!hero || !scrollEl || !tiltEl || !figure) return null;
  const object = figure.querySelector('[data-hero-object]');
  const wide = matchMedia('(min-width: 960px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const TILT_MAX = 6;
  let frame = null;
  let tiltFrame = null;
  let dirty = true;
  let previous = null;
  let heroTop = 0;
  let heroHeight = 1;
  let inView = true;
  let nx = 0;
  let ny = 0;
  let updates = 0;

  const scrubAllowed = () => wide.matches && !reduced.matches;
  const tiltAllowed = () => scrubAllowed() && finePointer.matches;

  function clearScrub() {
    scrollEl.style.removeProperty('transform');
    scrollEl.style.removeProperty('--hero-depth');
    delete scrollEl.dataset.progress;
    previous = null;
  }

  function render() {
    frame = null;
    if (!scrubAllowed()) { clearScrub(); return; }
    if (dirty) {
      dirty = false;
      const headerHeight = document.querySelector('[data-header]')?.offsetHeight ?? 0;
      const rect = hero.getBoundingClientRect();
      const box = figure.getBoundingClientRect();
      // Progress 0 = the section's top reaches the sticky header (its own framed position below the brand hero);
      // while the section is still entering from below, the pose stays at rest.
      heroTop = rect.top + scrollY - headerHeight;
      // Progress 1 when the object's centre reaches the header: the whole pose change happens while at least
      // half of the object is visible (over the full hero height the end pose was never seen).
      heroHeight = Math.max(1, box.top + box.height / 2 + scrollY - headerHeight - heroTop);
      previous = null;
    }
    // Derived from the scroll position only (no event history).
    const progress = clamp((scrollY - heroTop) / heroHeight);
    if (progress === previous) return;
    previous = progress;
    const pose = heroPose(progress);
    scrollEl.style.transform = `rotateX(${pose.rotateX}deg) rotateY(${pose.rotateY}deg)`;
    scrollEl.style.setProperty('--hero-depth', String(pose.depth));
    scrollEl.dataset.progress = progress.toFixed(4);
    updates += 1;
  }
  const schedule = () => { if (frame === null && inView) frame = requestAnimationFrame(render); };
  const refresh = () => { dirty = true; if (frame === null) frame = requestAnimationFrame(render); };

  function writeTilt() {
    tiltFrame = null;
    if (!tiltAllowed() || (nx === 0 && ny === 0)) {
      tiltEl.style.removeProperty('transform');
      return;
    }
    tiltEl.style.transform = `rotateX(${(-ny * 2 * TILT_MAX).toFixed(2)}deg) rotateY(${(nx * 2 * TILT_MAX).toFixed(2)}deg)`;
  }
  const scheduleTilt = () => { if (tiltFrame === null) tiltFrame = requestAnimationFrame(writeTilt); };
  const rest = () => { nx = 0; ny = 0; scheduleTilt(); };

  figure.addEventListener('pointermove', (event) => {
    if (!tiltAllowed() || event.pointerType !== 'mouse') return;
    const rect = figure.getBoundingClientRect();
    nx = clamp((event.clientX - rect.left) / rect.width) - 0.5;
    ny = clamp((event.clientY - rect.top) / rect.height) - 0.5;
    scheduleTilt();
  }, { passive: true, signal });
  figure.addEventListener('pointerleave', rest, { signal });
  window.addEventListener('blur', rest, { signal });

  // Single-target observers read the latest entry: one batch can report a stale and a current entry for the same
  // target when a fragment scroll lands in the same frame as the first observation.
  const visibility = new IntersectionObserver((entries) => {
    inView = entries.at(-1).isIntersecting;
    if (inView) schedule();
    else rest();
  });
  visibility.observe(hero);

  // Entrance, once per page view (CSS keyframes in styles/mockups.css, keyed on data-enter). The first observer report
  // decides, as for the E3 reveals: an object already on screen (direct entry, reload mid-page) is never hidden; one
  // below the viewport gets the pre-state (applied off screen) and plays when a fifth of it is in view.
  let entrance = null;
  if (object && !reduced.matches) {
    let first = true;
    entrance = new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      if (first) {
        first = false;
        if (entry.isIntersecting) { entrance.disconnect(); return; }
        object.dataset.enter = 'ready';
        return;
      }
      if (entry.intersectionRatio < 0.2) return;
      object.dataset.enter = 'run';
      entrance.disconnect();
    }, { threshold: [0, 0.2] });
    entrance.observe(figure);
  }
  const settleEntrance = () => {
    entrance?.disconnect();
    if (object?.dataset.enter === 'ready') delete object.dataset.enter;
  };
  reduced.addEventListener('change', ({ matches }) => { if (matches) settleEntrance(); }, { signal });

  const resize = new ResizeObserver(refresh);
  resize.observe(hero);
  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', refresh, { signal });
  window.addEventListener('pageshow', refresh, { signal });
  [reduced, wide, finePointer].forEach((query) => query.addEventListener('change', () => { rest(); refresh(); }, { signal }));
  render();

  return {
    refresh,
    get metrics() { return { distance: heroHeight, enter: object?.dataset.enter ?? null, progress: previous, scrub: scrubAllowed(), start: heroTop, tilt: tiltAllowed(), updates }; },
    destroy() {
      if (frame !== null) cancelAnimationFrame(frame);
      if (tiltFrame !== null) cancelAnimationFrame(tiltFrame);
      settleEntrance();
      visibility.disconnect();
      resize.disconnect();
      clearScrub();
      tiltEl.style.removeProperty('transform');
    },
  };
}

/* ---------- E2 scroll-driven story ----------
 * Adapted from StyleGallery examples/toss-homepage-clone/story/controller.mjs (mountStory): clamp progress,
 * derive the whole scene from progress, expose only the active chapter (inert + aria-hidden), static path for
 * reader mode / reduced motion / narrow or short windows / overflowing copy, no wheel interception. */
// Animated panel chrome: padding-block 1rem + 3rem (styles/story.css) plus 12 px clear of the meter.
const storyPanelChrome = () => 4 * (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) + 12;

function mountStory(root) {
  const stage = root.querySelector('[data-story-stage]');
  const panels = [...root.querySelectorAll('[data-story-panel]')];
  const toggle = root.querySelector('[data-story-toggle]');
  const controls = root.querySelector('.story-controls');
  const meter = root.querySelector('[data-story-meter]');
  const header = document.querySelector('[data-header]');
  if (!stage || !panels.length || !toggle || !controls) return null;
  let reading = false;
  let disposed = false;
  let frame = null;
  let dirty = true;
  let start = 0;
  let distance = 0;
  let enhanced = false;
  let initialized = false;
  let previous = -1;
  let updates = 0;
  let maxUpdateMs = 0;

  function measure() {
    const offset = Math.round(header?.getBoundingClientRect().height ?? 0);
    const height = innerHeight - offset;
    const roomy = root.clientWidth >= 900 && height >= 570; // SG lab local thresholds
    // Chapter copy starts on one fixed line (styles/story.css); it must fit between that line and the meter.
    const textTop = Math.round(clamp(height * 0.24, 48, 208));
    const room = height - textTop - storyPanelChrome();
    const fits = panels.every((panel) => (panel.querySelector('.story-text')?.scrollHeight ?? panel.scrollHeight) <= room);
    const next = !reading && !reduced.matches && roomy && fits;
    const changed = next !== enhanced;
    const priorTop = root.getBoundingClientRect().top;
    enhanced = next;
    root.dataset.storyOffset = String(offset);
    root.dataset.storyMode = enhanced ? 'animated' : 'static';
    root.dataset.storyReason = reading ? 'reader' : reduced.matches ? 'reduced-motion' : !roomy ? 'viewport' : !fits ? 'content' : 'ready';
    root.style.setProperty('--story-offset', `${offset}px`);
    root.style.setProperty('--story-height', `${height}px`);
    root.style.setProperty('--story-text-top', `${textTop}px`);
    root.style.setProperty('--story-controls', `${controls.offsetHeight}px`);
    distance = enhanced ? height * 2.6 : 0; // SG lab local value
    root.style.setProperty('--story-track', `${distance + height}px`);
    // The reading toggle only means something where the animated path is possible.
    toggle.hidden = !(reading || (!reduced.matches && roomy && fits));
    toggle.setAttribute('aria-pressed', String(reading));
    // Keep the mode control in view when collapsing a long pinned track (SG controller behaviour).
    if (initialized && changed && priorTop < -60 && priorTop > -root.offsetHeight) {
      root.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    start = root.getBoundingClientRect().top + scrollY + controls.offsetHeight - offset;
    initialized = true;
    previous = -1;
  }

  function render() {
    frame = null;
    if (disposed) return;
    const began = performance.now();
    if (dirty) { dirty = false; measure(); }
    const progress = enhanced ? scrollProgress(scrollY, start, distance) : 0;
    if (previous === progress) return;
    previous = progress;
    const state = sampleStory(progress, panels.length);
    root.dataset.storyProgress = progress.toFixed(4);
    root.dataset.storyScene = String(state.active);
    panels.forEach((panel, index) => {
      const values = state.panels[index];
      if (enhanced) {
        panel.style.opacity = String(values.opacity);
        panel.style.transform = `translateY(${values.y}px) scale(${values.scale})`;
        panel.inert = state.active !== index;
        panel.setAttribute('aria-hidden', String(state.active !== index));
      } else {
        panel.style.removeProperty('opacity');
        panel.style.removeProperty('transform');
        panel.inert = false;
        panel.removeAttribute('aria-hidden');
      }
    });
    if (meter) meter.style.transform = `scaleX(${progress})`;
    root.dispatchEvent(new CustomEvent('storyprogress', { detail: { ...state, enhanced } }));
    updates += 1;
    maxUpdateMs = Math.max(maxUpdateMs, performance.now() - began);
  }
  const schedule = () => { if (!disposed && frame === null) frame = requestAnimationFrame(render); };
  const refresh = () => { dirty = true; schedule(); };

  toggle.addEventListener('click', () => { reading = !reading; refresh(); }, { signal });
  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', refresh, { signal });
  window.addEventListener('pageshow', refresh, { signal });
  document.addEventListener('visibilitychange', refresh, { signal });
  document.addEventListener('load', refresh, { capture: true, signal });
  reduced.addEventListener('change', refresh, { signal });
  const resize = new ResizeObserver(refresh);
  resize.observe(document.body);
  panels.forEach((panel) => resize.observe(panel));
  document.fonts?.ready.then(refresh);
  render();

  return {
    refresh,
    get metrics() { return { updates, maxUpdateMs, enhanced, start, distance }; },
    destroy() {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      resize.disconnect();
      root.dataset.storyMode = 'static';
      panels.forEach((panel) => {
        panel.style.removeProperty('opacity');
        panel.style.removeProperty('transform');
        panel.inert = false;
        panel.removeAttribute('aria-hidden');
      });
      toggle.hidden = true;
    },
  };
}

/* Persistent phone: adapted from StyleGallery examples/toss-homepage-clone/story/persistent-device.mjs.
 * One phone shell keeps identity while its five DOM screens crossfade with the chapter copy.
 * Product choices: rotateY −10°→+10°, held flat and still while the 부고장 chapter is readable. */
function mountPersistentPhone(root) {
  const sources = [...root.querySelectorAll('[data-story-panel] .story-art .phone-screen')];
  const stage = root.querySelector('[data-story-stage]');
  if (!stage || sources.length < 2) return null;
  const art = document.createElement('div');
  art.className = 'persistent-art';
  art.setAttribute('aria-hidden', 'true');
  const phone = document.createElement('div');
  phone.className = 'phone persistent-phone';
  const glass = document.createElement('div');
  glass.className = 'phone-screen';
  const screens = sources.map((source) => {
    const screen = document.createElement('div');
    screen.className = 'persistent-screen';
    screen.dataset.screen = source.dataset.screen ?? '';
    screen.innerHTML = source.innerHTML;
    glass.append(screen);
    return screen;
  });
  phone.append(glass);
  art.append(phone);
  stage.append(art);
  root.dataset.persistentDevice = 'true';
  const fields = screens.flatMap((screen) => [...screen.querySelectorAll('[data-fill]')]);
  fields.forEach((field) => field.style.setProperty('--fill-index', field.dataset.fill));

  function present(event) {
    const { progress, panels, enhanced } = event.detail;
    if (!enhanced) {
      phone.style.removeProperty('transform');
      delete phone.dataset.angle;
      screens.forEach((screen) => screen.style.removeProperty('opacity'));
      return;
    }
    const pose = phonePose(progress);
    phone.style.transform = `rotateY(${pose.angle}deg) scale(${pose.scale})`;
    phone.dataset.angle = String(pose.angle);
    screens.forEach((screen, index) => { screen.style.opacity = String(panels[index]?.screen ?? 0); });
    fields.forEach((field) => { field.dataset.filled = String(fieldFilled(progress, Number(field.dataset.fill))); });
  }
  root.addEventListener('storyprogress', present, { signal });
  return {
    destroy() {
      art.remove();
      delete root.dataset.persistentDevice;
    },
  };
}

/* ---------- E-console plane settle ----------
 * Scroll-driven, clamped 0–1, derived from the cached geometry and the current scroll position only. */
function mountConsoleSettle() {
  const plane = document.querySelector('[data-console-plane]');
  const scene = plane?.closest('.console-scene');
  if (!plane || !scene) return null;
  let frame = null;
  let dirty = true;
  let previous = null;
  let top = 0;
  let viewport = innerHeight;
  let track = 1;
  let inView = false;
  let updates = 0;

  function clear() {
    plane.style.removeProperty('transform');
    delete plane.dataset.settle;
    previous = null;
  }
  function render() {
    frame = null;
    if (reduced.matches) { clear(); return; }
    if (dirty) {
      dirty = false;
      const rect = scene.getBoundingClientRect();
      top = rect.top + scrollY;
      viewport = innerHeight;
      // Track: from the scene top at 90 % of the viewport until 70 % of the scene is visible (at least 20 % of the
      // viewport), so the plane is still settling while most of the mock is on screen.
      track = Math.max(0.2 * viewport, 0.7 * rect.height - 0.1 * viewport);
      previous = null;
    }
    const progress = clamp((0.9 * viewport - (top - scrollY)) / track);
    if (progress === previous) return;
    previous = progress;
    const pose = settlePose(progress);
    plane.style.transform = pose.flat ? 'none' : `translate3d(0, ${pose.lift}px, ${pose.depth}px) rotateX(${pose.tilt}deg)`;
    plane.dataset.settle = progress.toFixed(3);
    updates += 1;
  }
  const schedule = () => { if (frame === null && inView) frame = requestAnimationFrame(render); };
  const refresh = () => { dirty = true; if (frame === null) frame = requestAnimationFrame(render); };
  const visibility = new IntersectionObserver((entries) => { inView = entries.at(-1).isIntersecting; if (inView) refresh(); }, { rootMargin: '10% 0px' });
  visibility.observe(scene);
  const resize = new ResizeObserver(refresh);
  resize.observe(document.body);
  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', refresh, { signal });
  window.addEventListener('pageshow', refresh, { signal });
  reduced.addEventListener('change', refresh, { signal });
  render();
  return {
    refresh,
    get metrics() { return { updates, progress: previous }; },
    destroy() {
      if (frame !== null) cancelAnimationFrame(frame);
      visibility.disconnect();
      resize.disconnect();
      clear();
    },
  };
}

/* ---------- Mount + teardown (SG story/init.mjs idiom) ---------- */
const storyRoot = document.querySelector('[data-story]');
const phone = storyRoot ? mountPersistentPhone(storyRoot) : null;
const story = storyRoot ? mountStory(storyRoot) : null;
const reveals = mountReveals();
const hero = mountHero();
const consoleSettle = mountConsoleSettle();
const odometer = mountOdometer(document.querySelector('[data-odometer]'), { reduced, signal });

// Read-only test hook for qa/ (metrics and refresh only; no behaviour depends on it).
window.__landingMotion = { story, hero, console: consoleSettle, odometer };

window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  listeners.abort();
  [phone, story, reveals, hero, consoleSettle, odometer].forEach((controller) => controller?.destroy());
});
