/**
 * Formula evaluator for the Atlas canonical metrics catalog.
 *
 * A faithful port of `evaluateCanonicalFormula` (atlas-prod/web/atlas-v4.1.html:2491).
 * Recursive descent, no `eval` — the catalog is data, and its formulas are a tiny
 * DSL, so parsing it is safer and more predictable than handing strings to a JS
 * engine.
 *
 * Grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := '-' factor | '(' expr ')' | NUMBER | IDENT '(' call ')' | ref
 *   ref    := IDENT | IDENT '[' 't' ('-' INT)? ']'
 *   call   := FIELD (',' (INT 'd' | 'all' | 't' ('-' INT)?))*
 *
 * `[t]` is the most recent day, `[t-1]` yesterday. A bare identifier is `[t]`.
 * The optional trailing `t-k` argument to a window function shifts the window's
 * END back k days, so `sum(x, 7d, t-7)` is the seven days before the last seven.
 *
 * Anything non-computable throws the no-data sentinel and surfaces as `null`:
 * an unknown identifier or function, a field with no series, a window longer
 * than the available history, `all` (cumulative-since-launch, whose history is
 * partial), division by zero, a non-finite intermediate, or leftover tokens.
 * That last case is why prose formulas — `count(sources where earn_share >= 10%)`
 * — never compute: `>=` and `%` tokenise but have no grammar rule.
 */

/** Resolves a canonical raw-field id to its date-ascending daily series. */
export type SeriesLookup = (canonicalId: string) => number[] | null;

/** Sentinel thrown internally; never escapes `evaluateFormula`. */
const ND = Symbol("no-data");

function mean(a: number[]): number {
  return a.reduce((x, y) => x + y, 0) / a.length;
}

function stdev(a: number[]): number {
  // Sample standard deviation (n-1), matching Atlas.
  if (a.length < 2) throw ND;
  const m = mean(a);
  return Math.sqrt(
    a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1),
  );
}

function slope(a: number[]): number {
  // OLS slope against the index.
  const n = a.length;
  if (n < 2) throw ND;
  const mx = (n - 1) / 2;
  const my = mean(a);
  let sxy = 0;
  let sxx = 0;
  for (let k = 0; k < n; k++) {
    sxy += (k - mx) * (a[k] - my);
    sxx += (k - mx) * (k - mx);
  }
  if (sxx === 0) throw ND;
  return sxy / sxx;
}

const FNS: Record<string, (a: number[]) => number> = {
  sum: (a) => a.reduce((x, y) => x + y, 0),
  avg: mean,
  mean,
  min: (a) => a.reduce((x, y) => (y < x ? y : x), a[0]),
  max: (a) => a.reduce((x, y) => (y > x ? y : x), a[0]),
  stdev,
  linear_slope: slope,
  z_score: (a) => {
    const sd = stdev(a);
    if (sd === 0) throw ND;
    return (a[a.length - 1] - mean(a)) / sd;
  },
};

/** The function names the DSL supports. Anything else is no-data by design. */
export const FORMULA_FUNCTIONS = Object.keys(FNS);

const TOKEN_RE =
  /\s*(\d+\.?\d*d?|[A-Za-z_][A-Za-z0-9_]*|\[|\]|\(|\)|,|\+|-|\*|\/|%|>=|<=|>|<)/y;

function tokenize(formula: string): string[] {
  const toks: string[] = [];
  let pos = 0;
  while (pos < formula.length) {
    TOKEN_RE.lastIndex = pos;
    const m = TOKEN_RE.exec(formula);
    if (!m) {
      if (/^\s+$/.test(formula.slice(pos))) break;
      throw ND;
    }
    toks.push(m[1]);
    pos = TOKEN_RE.lastIndex;
  }
  return toks;
}

/**
 * Evaluate one formula against a partner's series. Returns `null` for anything
 * the DSL cannot compute — callers render that as "no data".
 */
export function evaluateFormula(
  formula: string,
  lookup: SeriesLookup,
): number | null {
  try {
    return run(formula, lookup);
  } catch (err) {
    if (err === ND) return null;
    throw err;
  }
}

function run(formula: string, lookup: SeriesLookup): number {
  const toks = tokenize(formula);
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];

  const finite = (v: number): number => {
    if (typeof v !== "number" || !Number.isFinite(v)) throw ND;
    return v;
  };

  // Last `n` values ending `endOff` days back.
  const win = (arr: number[], n: number, endOff: number): number[] => {
    const end = arr.length - endOff;
    const start = end - n;
    if (start < 0 || end <= start) throw ND;
    return arr.slice(start, end);
  };

  function callFn(name: string): number {
    const fn = FNS[name];
    if (!fn) throw ND;
    const series = lookup(next());
    if (!series) throw ND;
    let n: number | null = null;
    let endOff = 0;
    while (peek() === ",") {
      next();
      const a = next();
      if (/^\d+d$/.test(a)) {
        n = parseInt(a, 10);
      } else if (a === "all") {
        // Cumulative since launch — our history is partial, so refuse rather
        // than report a number that silently understates the true total.
        throw ND;
      } else if (a === "t") {
        if (peek() === "-") {
          next();
          endOff = parseInt(next(), 10) || 0;
        }
      } else {
        throw ND;
      }
    }
    if (next() !== ")") throw ND;
    if (n == null) n = series.length;
    return finite(fn(win(series, n, endOff)));
  }

  function ref(name: string): number {
    const series = lookup(name);
    if (!series) throw ND;
    let off = 0;
    if (peek() === "[") {
      next();
      if (next() !== "t") throw ND;
      if (peek() === "-") {
        next();
        off = parseInt(next(), 10) || 0;
      }
      if (next() !== "]") throw ND;
    }
    const idx = series.length - 1 - off;
    if (idx < 0) throw ND;
    return finite(series[idx]);
  }

  function factor(): number {
    const t = peek();
    if (t === undefined) throw ND;
    if (t === "-") {
      next();
      return -factor();
    }
    if (t === "(") {
      next();
      const v = expr();
      if (next() !== ")") throw ND;
      return v;
    }
    if (/^\d/.test(t)) {
      // A bare `30d` outside a call is a window literal with nowhere to go.
      if (/d$/.test(t)) throw ND;
      next();
      const v = parseFloat(t);
      if (!Number.isFinite(v)) throw ND;
      return v;
    }
    if (/^[A-Za-z_]/.test(t)) {
      next();
      if (peek() === "(") {
        next();
        return callFn(t);
      }
      return ref(t);
    }
    throw ND;
  }

  function term(): number {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const r = factor();
      if (op === "/") {
        if (r === 0) throw ND;
        v = v / r;
      } else {
        v = v * r;
      }
    }
    return finite(v);
  }

  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return finite(v);
  }

  const out = expr();
  // Leftover tokens mean the formula was prose, not an expression.
  if (i !== toks.length) throw ND;
  return out;
}
