// Pure plan for the E6 odometer (operator stats), shared by scripts/odometer.js and qa/test-contract.mjs.
// Values are product-local choices recorded in docs/motion-briefs.md (E6), not StyleGallery defaults
// (motion/practice-reference.md: timing and easing are context-dependent hypotheses).

export const ODOMETER = Object.freeze({
  baseMs: 1400, // the rightmost digit's roll
  digitStaggerMs: 75, // each place further left lands this much later, so digits land right to left
  statStaggerMs: 200, // the three stats fire in sequence
  minLoops: 1, // every digit spins at least one full cycle; each place further left adds one more
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)', // quint-out: fast spin, firm settle, no overshoot past the digit
  unitMs: 280, // unit pop (scale 0.8 → 1 + opacity), the same ease-out as the logo's seal stamp
  ruleMs: 520, // light-blue rule under the figure draws left → right
  landEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  trigger: 0.4, // fire once when the stats row is ≥ 40 % in view
});

const FIGURE = /^[0-9][0-9,]*$/;

/**
 * Roll plan for one figure. Digits get a strip 0‥9 repeated (minLoops + place) times, then 0‥digit, so the last
 * entry is always the final digit; the comma stays static. `place` 0 is the rightmost digit.
 */
export function odometerPlan(text, statIndex = 0, options = ODOMETER) {
  const value = String(text);
  if (!FIGURE.test(value) || !Number.isInteger(statIndex) || statIndex < 0) {
    throw new TypeError(`Expected a figure such as "1,500" and a stat index ≥ 0, got ${JSON.stringify(text)}`);
  }
  const chars = [...value];
  const digitCount = chars.filter((char) => char !== ',').length;
  const delay = statIndex * options.statStaggerMs;
  let seen = 0;
  const cells = chars.map((char) => {
    if (char === ',') return { kind: 'static', char };
    const place = digitCount - 1 - seen;
    seen += 1;
    const digit = Number(char);
    const loops = options.minLoops + place;
    const sequence = [...Array.from({ length: loops * 10 }, (_, n) => n % 10), ...Array.from({ length: digit + 1 }, (_, n) => n)];
    return { kind: 'digit', char, delay, digit, duration: options.baseMs + place * options.digitStaggerMs, loops, place, sequence, steps: sequence.length - 1 };
  });
  const durations = cells.filter((cell) => cell.kind === 'digit').map((cell) => cell.duration);
  return { cells, delay, end: delay + Math.max(...durations), text: value };
}
