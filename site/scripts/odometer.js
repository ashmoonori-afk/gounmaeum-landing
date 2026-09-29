// E6 — operator stats odometer (docs/motion-briefs.md E6, research/landing-v3-spec.md §4b).
// The final figures ("1,500명+", "100개+", "24시간") are the real DOM text from the start; this module lays an
// aria-hidden digit roll over them once, when the stats row is ≥ 40 % in view. StyleGallery rules applied:
// a complete stationary state first (motion/accessible-motion.md), a view-entry trigger that is not scroll progress
// (motion/interaction-recipes.md "Scroll reveal": once, content never hidden while on screen), one owner per
// property (motion/interruption-and-retargeting.md: Web Animations own the strips' transform and, after landing,
// the unit's opacity/transform and the rule's transform; the CSS pre-state is removed in the same task), no layout
// reads during the roll and no idle loop (motion/rendering-and-performance.md).
import { ODOMETER, odometerPlan } from './odometer-plan.js';

const THRESHOLDS = Array.from({ length: 11 }, (_, index) => index / 10);

function buildOverlay(stat, index) {
  const digits = stat.querySelector('.stat-digits');
  const value = stat.querySelector('.stat-value');
  if (!digits || !value) return null;
  const plan = odometerPlan(digits.textContent.trim(), index);
  const overlay = document.createElement('span');
  overlay.className = 'odo';
  overlay.setAttribute('aria-hidden', 'true');
  const strips = [];
  plan.cells.forEach((cell) => {
    if (cell.kind === 'static') {
      const separator = document.createElement('span');
      separator.className = 'odo-static';
      separator.textContent = cell.char;
      overlay.append(separator);
      return;
    }
    const frame = document.createElement('span');
    frame.className = 'odo-cell';
    const strip = document.createElement('span');
    strip.className = 'odo-strip';
    strip.textContent = cell.sequence.join('\n');
    frame.append(strip);
    overlay.append(frame);
    strips.push({ cell, strip });
  });
  value.append(overlay);
  return { overlay, plan, stat, strips };
}

export function mountOdometer(list, { reduced, signal }) {
  const supported = list && 'IntersectionObserver' in window && typeof Element.prototype.animate === 'function';
  if (!supported) return null;
  const stats = [...list.querySelectorAll('.stat')];
  const animations = new Set();
  let rolls = [];
  let state = 'idle'; // idle → ready → rolling → done
  let reported = false;
  let runs = 0;
  let landed = 0;
  let observer = null;

  const setState = (next) => { state = next; list.dataset.odometerState = next; };
  const track = (animation) => {
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    return animation;
  };

  // Final values at once: no overlay, no pre-state, nothing running. Used for direct entry, reduced motion and teardown.
  function settle(next = 'done') {
    observer?.disconnect();
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    rolls.forEach(({ overlay }) => overlay.remove());
    rolls = [];
    stats.forEach((stat) => { delete stat.dataset.odo; });
    setState(next);
  }

  // Pre-state while the row is still below the viewport: zeros in the overlay, unit and rule waiting.
  function prepare() {
    rolls = stats.map(buildOverlay).filter(Boolean);
    rolls.forEach(({ stat }) => { stat.dataset.odo = 'ready'; });
    setState('ready');
  }

  function land(roll) {
    if (state !== 'rolling') return;
    const { overlay, stat } = roll;
    // One task: the overlay (showing the final digits) leaves as the real text returns, so nothing jumps.
    overlay.remove();
    delete stat.dataset.odo;
    const unit = stat.querySelector('.stat-unit');
    const rule = stat.querySelector('.stat-rule');
    if (unit) track(unit.animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'none' }], { duration: ODOMETER.unitMs, easing: ODOMETER.landEasing, fill: 'backwards' }));
    if (rule) track(rule.animate([{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: ODOMETER.ruleMs, easing: ODOMETER.landEasing, fill: 'backwards' }));
    landed += 1;
    if (landed === rolls.length) {
      rolls = [];
      setState('done');
    }
  }

  function run() {
    observer?.disconnect();
    runs += 1;
    landed = 0;
    setState('rolling');
    rolls.forEach(({ stat }) => { stat.dataset.odo = 'rolling'; });
    rolls.forEach((roll) => {
      const rolling = roll.strips.map(({ cell, strip }) => track(strip.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(-${cell.steps}em)` }],
        { delay: cell.delay, duration: cell.duration, easing: ODOMETER.easing, fill: 'both' },
      )));
      Promise.all(rolling.map((animation) => animation.finished)).then(() => land(roll), () => {}); // cancelled: settle() owns the end state
    });
  }

  if (reduced.matches) {
    setState('done');
    return { get metrics() { return { landed, runs, state }; }, destroy() {} };
  }

  // One target: the latest entry decides (a batch can hold a stale and a current entry for it after a fragment scroll).
  observer = new IntersectionObserver((entries) => {
    const entry = entries.at(-1);
    if (!reported) {
      reported = true;
      // The first report decides (E3 idiom): a row on screen or already scrolled past (direct entry, reload
      // mid-page) keeps its final values and never replays; only a row still below the viewport waits.
      const below = !entry.isIntersecting && entry.boundingClientRect.top >= (entry.rootBounds?.bottom ?? innerHeight);
      if (below) prepare();
      else settle();
      return;
    }
    if (state !== 'ready' || !entry.isIntersecting) return;
    const viewport = entry.rootBounds?.height ?? innerHeight;
    // ≥ 40 % of the row, or 40 % of the viewport when the row is taller than the viewport (large text).
    if (entry.intersectionRatio >= ODOMETER.trigger || entry.intersectionRect.height >= viewport * ODOMETER.trigger) run();
  }, { threshold: THRESHOLDS });
  observer.observe(list);
  reduced.addEventListener('change', ({ matches }) => { if (matches && state !== 'done') settle(); }, { signal });

  return {
    get metrics() { return { landed, runs, state }; },
    destroy() { settle('idle'); delete list.dataset.odometerState; },
  };
}
