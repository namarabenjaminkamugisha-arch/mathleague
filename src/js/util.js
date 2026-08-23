// util.js — pure helpers shared by the engine, scoring and UI.

export function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

export function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

/** Round to at most `dp` decimals, killing float fuzz. */
export function round(n, dp = 6) {
  const f = Math.pow(10, dp);
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Human-friendly number: 3 not 3.0, 2.5 not 2.500000. */
export function fmt(n) {
  if (typeof n !== 'number' || !isFinite(n)) return String(n);
  const r = round(n, 6);
  if (Number.isInteger(r)) return String(r);
  return String(parseFloat(r.toFixed(6)));
}

/** A minimal exact rational. */
export class Frac {
  constructor(n, d = 1) {
    if (d === 0) throw new Error('divide by zero');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }
  static from(x) { return x instanceof Frac ? x : new Frac(x, 1); }
  add(o) { o = Frac.from(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Frac.from(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Frac.from(o); return new Frac(this.n * o.n, this.d * o.d); }
  div(o) { o = Frac.from(o); return new Frac(this.n * o.d, this.d * o.n); }
  neg() { return new Frac(-this.n, this.d); }
  get value() { return this.n / this.d; }
  isInt() { return this.d === 1; }
  /** "3/4", "-3/4", "5" */
  toString() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
  /** "1 1/4" style, for explanations only. */
  toMixed() {
    if (this.d === 1) return String(this.n);
    const sign = this.n < 0 ? '-' : '';
    const a = Math.abs(this.n);
    const whole = Math.floor(a / this.d);
    const rem = a % this.d;
    if (whole === 0) return `${sign}${rem}/${this.d}`;
    return `${sign}${whole} ${rem}/${this.d}`;
  }
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Signed term for building expressions: 3 -> "+ 3", -3 -> "- 3" */
export function signed(n) {
  return n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`;
}

/** Prime factorisation as [[prime, power], ...] */
export function primeFactors(n) {
  const out = [];
  let x = Math.abs(n);
  for (let p = 2; p * p <= x; p++) {
    let c = 0;
    while (x % p === 0) { x /= p; c++; }
    if (c) out.push([p, c]);
  }
  if (x > 1) out.push([x, 1]);
  return out;
}

/** Digits of an integer, most significant first, with place values. */
export function placeValues(n) {
  const s = String(Math.abs(n));
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const digit = Number(s[i]);
    const place = Math.pow(10, s.length - 1 - i);
    if (digit !== 0) out.push({ digit, place, value: digit * place });
  }
  return out;
}
