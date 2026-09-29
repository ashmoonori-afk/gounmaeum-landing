// Pure scroll-story math, shared by scripts/motion.js and qa/test-contract.mjs.
// Adapted from StyleGallery examples/toss-homepage-clone/story/timeline.mjs (sampleStory, scrollProgress).
// Values below are product-local choices recorded in docs/motion-briefs.md (E2), not SG defaults.

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Sequential crossfade (product-local, replaces the SG example's overlapping curve): chapter copy is fully opaque
 * while |distance| ≤ 0.2 and gone by 0.45, so two chapters' copy is never on screen at the same time (with 24 px
 * travel the SG curve printed both headings on top of each other). The phone screens hard-cut through a short
 * dissolve at the midpoint (|distance| 0.47–0.53), so the stage always shows one readable screen.
 */
export const COPY_FADE = Object.freeze([0.2, 0.45]);
export const SCREEN_CUT = Object.freeze([0.47, 0.53]);

const fade = (distance, [hold, gone]) => clamp((gone - Math.abs(distance)) / (gone - hold));

/**
 * Presented state for a progress value. Chapters are centred at i / (count - 1).
 * travel (px) and minScale are reduced from the SG example (64 px, .9) to respect the brief's 24 px limit.
 */
export function sampleStory(progress, count = 5, { travel = 24, minScale = 0.97 } = {}) {
  if (!Number.isFinite(progress) || !Number.isInteger(count) || count < 1) {
    throw new TypeError('Expected finite progress and a positive integer scene count');
  }
  const p = clamp(progress);
  const position = p * (count - 1);
  return {
    progress: p,
    position,
    active: Math.round(position),
    panels: Array.from({ length: count }, (_, index) => {
      const distance = position - index;
      const weight = clamp(1 - Math.abs(distance));
      return {
        opacity: round(fade(distance, COPY_FADE)),
        screen: round(fade(distance, SCREEN_CUT)),
        y: round(clamp(-distance, -1, 1) * travel, 2),
        scale: round(minScale + weight * (1 - minScale)),
      };
    }),
  };
}

export function scrollProgress(scroll, start, distance) {
  return distance > 0 ? clamp((scroll - start) / distance) : 0;
}

/** Phone pose: rotateY −10°→+10°, scale 1→1.06, held flat and still while chapter 3 (부고장) is readable. */
export const PHONE_HOLD = Object.freeze([0.375, 0.625]);

export function phonePose(progress, { hold = PHONE_HOLD, maxAngle = 10, maxScale = 0.06 } = {}) {
  const p = clamp(progress);
  const [from, to] = hold;
  let t = 0.5;
  if (p < from) t = (p / from) * 0.5;
  else if (p > to) t = 0.5 + ((p - to) / (1 - to)) * 0.5;
  return { angle: round(-maxAngle + 2 * maxAngle * t, 3), scale: round(1 + maxScale * t) };
}

/** Chapter 3 field fill: field i appears once progress passes its threshold, then holds (reversible). */
export const FIELD_FILL_START = 0.39;
export const FIELD_FILL_STEP = 0.0125;

export function fieldFilled(progress, index) {
  return clamp(progress) >= FIELD_FILL_START + index * FIELD_FILL_STEP;
}

/** Console settle (E-console): 0 = tilted back, 1 = flat. Linear in scroll progress (direct manipulation), so the
 * last degrees of settle happen while the mock is mostly on screen (the ease-out version finished too early). */
export function settlePose(progress, { maxTilt = 14, depth = 60, lift = 24 } = {}) {
  const p = clamp(progress);
  const rest = 1 - p;
  return { tilt: round(maxTilt * rest, 3), depth: round(-depth * rest, 2), lift: round(lift * rest, 2), flat: rest < 0.001 };
}

/** Hero scrub (E1): rotateY −12° → −4°, rotateX 4° → 2°, layer separation 1 → 0.5 while the object leaves
 * (progress 1 = the object's centre reaches the header, scripts/motion.js). */
export function heroPose(progress) {
  const p = clamp(progress);
  return { rotateX: round(4 - 2 * p, 3), rotateY: round(-12 + 8 * p, 3), depth: round(1 - 0.5 * p) };
}
