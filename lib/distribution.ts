// Statistics from bracketed (grouped) distributions: how many people fall in each amount
// bracket, and optionally the total amount in each bracket. Pure functions, safe to run
// in the browser (the threshold checker uses shareAbove).
//
// Method (stated on the methodology page):
// - Inside a bounded bracket whose total amount is published, amounts follow a power law
//   (density ∝ x^beta) whose exponent is chosen so the bracket's mean matches the published
//   mean ("Pareto interpolation"). This matters in wide brackets such as 60,000–150,000 €,
//   where most people sit near the lower bound.
// - Inside a bounded bracket without amounts (or starting at 0), people are assumed evenly
//   spread (linear interpolation).
// - Inside the open top bracket ("more than L"), a Pareto tail is fitted from the bracket's
//   mean amount m: alpha = m / (m - L). Without the bracket's amount, values there are only
//   reported as "more than L".
// - The mean is exact when every bracket's total amount is known (sum of amounts / count);
//   otherwise a published mean is used, never a midpoint estimate.
// - "Most common" is the densest range after spreading every bracket evenly over bins of
//   equal width, so very narrow brackets cannot win just because they are narrow.

export type Bracket = { lower: number; upper: number | null; count: number; amount?: number };

export type StatMethod = "published" | "exact" | "linear" | "pareto";

/** A statistic; `atLeast` is set when only a lower bound is known (open top bracket, no amount). */
export type Stat = { value: number | null; atLeast?: number; method: StatMethod };

function total(brackets: Bracket[]): number {
  return brackets.reduce((s, b) => s + b.count, 0);
}

function paretoAlpha(b: Bracket): number | null {
  if (b.upper !== null || b.amount === undefined || b.count <= 0) return null;
  const mean = b.amount / b.count;
  return mean > b.lower ? mean / (mean - b.lower) : null;
}

/**
 * Power-law shape inside a bounded bracket [a, b] with a published mean: density ∝ x^beta,
 * beta solved by bisection so the mean matches. Null when it cannot be used (no amount,
 * a = 0, zero width, or a mean outside the bracket). Works on x / a to avoid overflow.
 */
type Shape = { beta: number; a: number; b: number };

function powerMean(beta: number, r: number): number {
  // Mean of t on [1, r] with density ∝ t^beta.
  if (Math.abs(beta + 1) < 1e-9) return (r - 1) / Math.log(r);
  if (Math.abs(beta + 2) < 1e-9) return Math.log(r) / (1 - 1 / r);
  return ((beta + 1) / (beta + 2)) * ((r ** (beta + 2) - 1) / (r ** (beta + 1) - 1));
}

function bracketShape(b: Bracket): Shape | null {
  if (b.upper === null || b.amount === undefined || b.count <= 0 || b.lower <= 0 || b.upper <= b.lower) return null;
  const m = b.amount / b.count;
  if (!(m > b.lower && m < b.upper)) return null;
  const r = b.upper / b.lower;
  const target = m / b.lower;
  let lo = -40;
  let hi = 40;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (powerMean(mid, r) < target) lo = mid;
    else hi = mid;
  }
  return { beta: (lo + hi) / 2, a: b.lower, b: b.upper };
}

/** Fraction of the bracket's people below x (x inside [a, b]). */
function shapeCdf(s: Shape, x: number): number {
  const r = s.b / s.a;
  const t = x / s.a;
  if (Math.abs(s.beta + 1) < 1e-9) return Math.log(t) / Math.log(r);
  return (t ** (s.beta + 1) - 1) / (r ** (s.beta + 1) - 1);
}

/** Inverse of shapeCdf. */
function shapeQuantile(s: Shape, f: number): number {
  const r = s.b / s.a;
  if (Math.abs(s.beta + 1) < 1e-9) return s.a * r ** f;
  return s.a * (1 + f * (r ** (s.beta + 1) - 1)) ** (1 / (s.beta + 1));
}

export function sortBrackets(brackets: Bracket[]): Bracket[] {
  const sorted = [...brackets].sort((a, b) => a.lower - b.lower || (a.upper ?? Infinity) - (b.upper ?? Infinity));
  sorted.forEach((b, i) => {
    if (b.upper !== null && b.upper < b.lower) throw new Error(`Bracket upper ${b.upper} < lower ${b.lower}`);
    if (b.upper === null && i !== sorted.length - 1) throw new Error("Only the last bracket may be open");
  });
  return sorted;
}

/** Value below which a fraction `p` (0–1) of the population falls. */
export function quantile(brackets: Bracket[], p: number): Stat {
  const sorted = sortBrackets(brackets);
  const n = total(sorted);
  const target = p * n;
  let cum = 0;
  for (const b of sorted) {
    if (b.count > 0 && cum + b.count >= target) {
      if (b.upper !== null) {
        const shape = bracketShape(b);
        const f = (target - cum) / b.count;
        if (shape) return { value: shapeQuantile(shape, f), method: "pareto" };
        return { value: b.lower + f * (b.upper - b.lower), method: "linear" };
      }
      const alpha = paretoAlpha(b);
      if (alpha === null) return { value: null, atLeast: b.lower, method: "linear" };
      // Survival inside the tail: S(x) = S(L) * (L / x)^alpha.
      const above = (n - target) / n;
      const atL = b.count / n;
      return { value: b.lower * (atL / above) ** (1 / alpha), method: "pareto" };
    }
    cum += b.count;
  }
  throw new Error("Quantile not found");
}

/**
 * Share (0–1) of the population strictly above `x`. Null when `x` is inside an open top
 * bracket whose amount is unknown (the spread above its lower bound cannot be estimated).
 */
export function shareAbove(brackets: Bracket[], x: number): number | null {
  const sorted = sortBrackets(brackets);
  const n = total(sorted);
  let above = 0;
  for (const b of sorted) {
    if (x < b.lower) above += b.count;
    else if (b.upper !== null && x < b.upper) {
      const shape = bracketShape(b);
      above += b.count * (shape ? 1 - shapeCdf(shape, x) : (b.upper - x) / (b.upper - b.lower));
    }
    else if (b.upper === null && x > b.lower) {
      const alpha = paretoAlpha(b);
      if (alpha === null) return null;
      above += b.count * (b.lower / x) ** alpha;
    } else if (b.upper === null && x === b.lower) {
      above += b.count;
    }
  }
  return above / n;
}

export function mean(brackets: Bracket[], published?: number): Stat {
  if (published !== undefined) return { value: published, method: "published" };
  if (brackets.every((b) => b.amount !== undefined)) {
    return { value: brackets.reduce((s, b) => s + (b.amount ?? 0), 0) / total(brackets), method: "exact" };
  }
  return { value: null, method: "exact" };
}

export type ModalRange = { lower: number; upper: number; share: number };

/** Densest range of width `binWidth`, after spreading each bounded bracket evenly. */
export function modalRange(brackets: Bracket[], binWidth: number, start = 0): ModalRange {
  const sorted = sortBrackets(brackets);
  const n = total(sorted);
  const bins = new Map<number, number>();
  for (const b of sorted) {
    if (b.upper === null || b.count === 0) continue;
    const lo = Math.max(b.lower, start);
    const width = b.upper - b.lower;
    if (width <= 0) {
      const k = Math.floor((lo - start) / binWidth);
      bins.set(k, (bins.get(k) ?? 0) + b.count);
      continue;
    }
    for (let k = Math.floor((lo - start) / binWidth); start + k * binWidth < b.upper; k++) {
      const binLo = start + k * binWidth;
      const overlap = Math.min(b.upper, binLo + binWidth) - Math.max(b.lower, binLo);
      if (overlap > 0) bins.set(k, (bins.get(k) ?? 0) + (b.count * overlap) / width);
    }
  }
  let best = -1;
  let bestCount = -1;
  for (const [k, c] of bins) {
    if (c > bestCount) [best, bestCount] = [k, c];
  }
  return { lower: start + best * binWidth, upper: start + (best + 1) * binWidth, share: bestCount / n };
}

/** Densest published bracket (people per euro of width), ignoring zero-width and open brackets. */
export function modalBracket(brackets: Bracket[]): ModalRange {
  const n = total(brackets);
  let best: Bracket | null = null;
  for (const b of brackets) {
    if (b.upper === null || b.upper - b.lower < 1 || b.count === 0) continue;
    if (!best || b.count / (b.upper - b.lower) > best.count / (best.upper! - best.lower)) best = b;
  }
  if (!best) throw new Error("No bounded bracket for the mode");
  return { lower: best.lower, upper: best.upper!, share: best.count / n };
}

/** Merges brackets into display groups at the given edges (for readable bar charts). */
export function regroup(brackets: Bracket[], edges: number[]): Bracket[] {
  const sorted = sortBrackets(brackets);
  const bounds = [...edges].sort((a, b) => a - b);
  const groups: Bracket[] = [];
  for (let i = 0; i <= bounds.length; i++) {
    const lower = i === 0 ? sorted[0].lower : bounds[i - 1];
    const upper = i === bounds.length ? null : bounds[i];
    groups.push({ lower, upper, count: 0 });
  }
  for (const b of sorted) {
    // Brackets must not straddle an edge; edges are chosen from the published bounds.
    const g = groups.find((x) => b.lower >= x.lower && (x.upper === null || (b.upper !== null && b.upper <= x.upper + 0.011)));
    if (!g) throw new Error(`Bracket ${b.lower}–${b.upper} straddles a display edge`);
    g.count += b.count;
  }
  return groups.filter((g) => g.count > 0);
}
