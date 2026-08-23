// calculator.js — the calculator's brain. No DOM, no eval.
//
// Expressions are parsed by hand rather than handed to eval(): eval would run
// whatever a user pasted in, and on a public site that is a genuine hole. A
// small recursive-descent parser is also the only way to give useful errors
// ("unmatched bracket") instead of a blank "NaN".
//
// Grammar, loosest binding first:
//   expr    := term (('+' | '-') term)*
//   term    := unary (('*' | '/' | '%mod') unary)*
//   unary   := ('-' | '+') unary | power     // looser than ^, so -2^2 = -4
//   power   := postfix ('^' unary)?          // right-associative: 2^3^2 = 512
//   postfix := atom ('!' | '%')*
//   atom    := number | constant | 'fn' '(' expr ')' | '(' expr ')'

export const CONSTANTS = { pi: Math.PI, 'π': Math.PI, e: Math.E };

// Angle mode is passed in rather than held here, so the engine stays stateless
// and the tests can check both modes without any setup or teardown.
const toRadians = (x, deg) => (deg ? (x * Math.PI) / 180 : x);
const fromRadians = (x, deg) => (deg ? (x * 180) / Math.PI : x);

function factorial(n) {
  if (!Number.isInteger(n) || n < 0) {
    throw new CalcError('Factorial needs a whole number that is not negative');
  }
  if (n > 170) throw new CalcError('That factorial is too big to show');
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
}

export class CalcError extends Error {}

const FUNCTIONS = {
  sin: (x, deg) => Math.sin(toRadians(x, deg)),
  cos: (x, deg) => Math.cos(toRadians(x, deg)),
  tan: (x, deg) => {
    // tan(90°) is undefined, but floating point gives a huge number instead of
    // infinity, so the check has to be on the angle rather than the result.
    const r = toRadians(x, deg);
    if (Math.abs(Math.cos(r)) < 1e-12) throw new CalcError('tan is undefined there');
    return Math.tan(r);
  },
  asin: (x, deg) => {
    if (x < -1 || x > 1) throw new CalcError('asin only accepts -1 to 1');
    return fromRadians(Math.asin(x), deg);
  },
  acos: (x, deg) => {
    if (x < -1 || x > 1) throw new CalcError('acos only accepts -1 to 1');
    return fromRadians(Math.acos(x), deg);
  },
  atan: (x, deg) => fromRadians(Math.atan(x), deg),
  sinh: x => Math.sinh(x),
  cosh: x => Math.cosh(x),
  tanh: x => Math.tanh(x),
  ln: x => {
    if (x <= 0) throw new CalcError('ln only accepts numbers above zero');
    return Math.log(x);
  },
  log: x => {
    if (x <= 0) throw new CalcError('log only accepts numbers above zero');
    return Math.log10(x);
  },
  sqrt: x => {
    if (x < 0) throw new CalcError('Cannot square-root a negative number');
    return Math.sqrt(x);
  },
  cbrt: x => Math.cbrt(x),
  abs: x => Math.abs(x),
  exp: x => Math.exp(x),
  round: x => Math.round(x),
  floor: x => Math.floor(x),
  ceil: x => Math.ceil(x),
};

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

// ── tokenizer ──────────────────────────────────────────────────────────────

const OPERATORS = '+-*/^()!%';

export function tokenize(input) {
  const src = String(input)
    .replace(/×/g, '*')      // ×
    .replace(/÷/g, '/')      // ÷
    .replace(/−/g, '-')      // −  (the minus sign, not a hyphen)
    .replace(/√/g, 'sqrt')   // √
    .replace(/\s+/g, '');

  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];

    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      if ((num.match(/\./g) || []).length > 1) {
        throw new CalcError(`"${num}" has too many decimal points`);
      }
      if (num === '.') throw new CalcError('A lone decimal point is not a number');
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    if (/[a-zA-Zπ]/.test(ch)) {
      let word = '';
      while (i < src.length && /[a-zA-Z0-9π]/.test(src[i])) word += src[i++];
      const lower = word.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, word)) {
        tokens.push({ type: 'number', value: CONSTANTS[word] });
      } else if (Object.prototype.hasOwnProperty.call(CONSTANTS, lower)) {
        tokens.push({ type: 'number', value: CONSTANTS[lower] });
      } else if (Object.prototype.hasOwnProperty.call(FUNCTIONS, lower)) {
        tokens.push({ type: 'function', value: lower });
      } else {
        throw new CalcError(`I do not know what "${word}" means`);
      }
      continue;
    }

    if (OPERATORS.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    throw new CalcError(`"${ch}" is not something I can calculate`);
  }
  return tokens;
}

// ── parser / evaluator ─────────────────────────────────────────────────────

function parse(tokens, degrees) {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = value => {
    const t = tokens[pos];
    if (t && t.type === 'op' && t.value === value) { pos += 1; return true; }
    return false;
  };

  function expr() {
    let left = term();
    for (;;) {
      if (eat('+')) left += term();
      else if (eat('-')) left -= term();
      else return left;
    }
  }

  function term() {
    let left = unary();
    for (;;) {
      if (eat('*')) left *= unary();
      else if (eat('/')) {
        const right = unary();
        if (right === 0) throw new CalcError('Cannot divide by zero');
        left /= right;
      } else if (peek() && peek().type === 'op' && peek().value === '%'
                 && isModulo()) {
        pos += 1;
        const right = unary();
        if (right === 0) throw new CalcError('Cannot take a remainder by zero');
        left %= right;
      } else if (implicitMultiplication()) {
        // "2(3+4)" and "3pi" read naturally, so treat them as multiplication
        left *= unary();
      } else return left;
    }
  }

  // A number or bracket straight after a value means multiply, but only when
  // there is genuinely no operator between them.
  function implicitMultiplication() {
    const t = peek();
    if (!t) return false;
    if (t.type === 'number' || t.type === 'function') return true;
    return t.type === 'op' && t.value === '(';
  }

  // Unary minus binds LOOSER than a power, which is why -2^2 is -4 and not 4:
  // the power happens first and the sign is applied to its result. Getting
  // this the wrong way round is the classic calculator bug.
  function unary() {
    if (eat('-')) return -unary();
    if (eat('+')) return unary();
    return power();
  }

  function power() {
    const base = postfix();
    // The exponent goes through unary() so that 2^-3 works.
    if (eat('^')) return base ** unary();   // right-associative
    return base;
  }

  function postfix() {
    let value = atom();
    for (;;) {
      if (eat('!')) value = factorial(value);
      else if (peek() && peek().type === 'op' && peek().value === '%'
               && !isModulo()) { pos += 1; value /= 100; }
      else return value;
    }
  }

  // "%" means "percent" at the end of a value but "remainder" between two,
  // which is how every phone calculator behaves.
  function isModulo() {
    const next = tokens[pos + 1];
    if (!next) return false;
    return next.type === 'number' || next.type === 'function'
      || (next.type === 'op' && (next.value === '(' || next.value === '-'));
  }

  function atom() {
    const t = peek();
    if (!t) throw new CalcError('The expression stops too early');

    if (t.type === 'number') { pos += 1; return t.value; }

    if (t.type === 'function') {
      pos += 1;
      if (!eat('(')) throw new CalcError(`${t.value} needs a bracket, like ${t.value}(9)`);
      const arg = expr();
      if (!eat(')')) throw new CalcError('A bracket was left open');
      return FUNCTIONS[t.value](arg, degrees);
    }

    if (t.type === 'op' && t.value === '(') {
      pos += 1;
      const value = expr();
      if (!eat(')')) throw new CalcError('A bracket was left open');
      return value;
    }

    throw new CalcError(`"${t.value}" is out of place here`);
  }

  const result = expr();
  if (pos < tokens.length) {
    const stray = tokens[pos];
    if (stray.type === 'op' && stray.value === ')') {
      throw new CalcError('There is a closing bracket with nothing to close');
    }
    throw new CalcError(`"${stray.value}" is out of place here`);
  }
  return result;
}

/**
 * Work out an expression.
 * @param {string} input     e.g. "2 + 3 × (4 - 1)"
 * @param {object} [options] { degrees: boolean } — degrees default true
 * @returns {number}
 */
export function evaluate(input, options = {}) {
  const degrees = options.degrees !== false;
  const text = String(input).trim();
  if (!text) throw new CalcError('Nothing to work out yet');

  const tokens = tokenize(text);
  if (!tokens.length) throw new CalcError('Nothing to work out yet');

  const value = parse(tokens, degrees);

  if (Number.isNaN(value)) throw new CalcError('That does not give a number');
  if (!Number.isFinite(value)) throw new CalcError('That result is too big to show');
  return value;
}

/**
 * Turn a result into something worth reading: no 0.30000000000000004, no
 * 1e-7 for something that is really zero, but full precision when it matters.
 */
export function format(value) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';

  const magnitude = Math.abs(value);
  if (magnitude >= 1e15 || magnitude < 1e-9) {
    return value.toExponential(9).replace(/\.?0+e/, 'e');
  }

  // 12 significant figures is past the point where binary floating point is
  // trustworthy, so rounding there hides the artefacts without losing anything.
  const rounded = parseFloat(value.toPrecision(12));
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

/** True when the brackets balance — used to grey out "=" before it can fail. */
export function bracketsBalanced(text) {
  let depth = 0;
  for (const ch of String(text)) {
    if (ch === '(') depth += 1;
    else if (ch === ')') { depth -= 1; if (depth < 0) return false; }
  }
  return depth === 0;
}
