// explain.js — derives step-by-step working from the ACTUAL computation.
// Fully offline. No API, no AI, no lookup tables of canned text.
//
// Every generator here recomputes the answer as it narrates, so the steps
// can never drift from the truth. Where a problem admits more than one
// sensible method, we emit an `alternatives` array.

import { Frac, gcd, fmt, primeFactors, placeValues, round } from './util.js';

const S = (text, detail) => (detail ? { text, detail } : { text });

// ─────────────────────────────────────────────────────────────
// ADDITION — column / place-value method, plus a rounding method
// ─────────────────────────────────────────────────────────────
export function explainAdd(a, b) {
  const sum = a + b;
  const steps = [];
  steps.push(S(`Start with ${a} + ${b}.`));

  if (Number.isInteger(a) && Number.isInteger(b) && a > 0 && b > 0) {
    const pa = placeValues(a);
    const pb = placeValues(b);
    if (pa.length > 1 || pb.length > 1) {
      steps.push(S(
        `Split each number into place values.`,
        `${a} = ${pa.map(p => p.value).join(' + ') || '0'}\n${b} = ${pb.map(p => p.value).join(' + ') || '0'}`
      ));
      // Add matching places together, largest first.
      const places = new Set([...pa.map(p => p.place), ...pb.map(p => p.place)]);
      const ordered = [...places].sort((x, y) => y - x);
      const partials = ordered.map(pl => {
        const va = (pa.find(p => p.place === pl)?.value) || 0;
        const vb = (pb.find(p => p.place === pl)?.value) || 0;
        return { pl, total: va + vb, va, vb };
      });
      steps.push(S(
        `Add the matching place values.`,
        partials.map(p => `${p.va} + ${p.vb} = ${p.total}`).join('\n')
      ));
      let running = 0;
      const chain = [];
      for (const p of partials) { running += p.total; chain.push(running); }
      steps.push(S(
        `Combine the partial totals.`,
        `${partials.map(p => p.total).join(' + ')} = ${sum}`
      ));
    }
  }
  steps.push(S(`${a} + ${b} = ${fmt(sum)}.`));

  const alternatives = [];
  // Compensation: round one addend to a friendly number, then correct.
  if (Number.isInteger(b) && b > 10 && b % 10 !== 0) {
    const upTo = Math.ceil(b / 10) * 10;
    const diff = upTo - b;
    alternatives.push({
      name: 'Round and compensate',
      steps: [
        S(`Round ${b} up to ${upTo} (that is ${diff} too much).`),
        S(`${a} + ${upTo} = ${a + upTo}.`),
        S(`Take the extra ${diff} back off: ${a + upTo} − ${diff} = ${fmt(sum)}.`),
      ],
    });
  }
  return { steps, alternatives, answer: sum };
}

// ─────────────────────────────────────────────────────────────
// SUBTRACTION — counting up, plus place-value decomposition
// ─────────────────────────────────────────────────────────────
export function explainSub(a, b) {
  const diff = a - b;
  const steps = [
    S(`Start with ${a} − ${b}.`),
  ];

  if (Number.isInteger(a) && Number.isInteger(b) && b > 0 && a > b) {
    const pb = placeValues(b);
    if (pb.length > 1) {
      let running = a;
      const lines = [];
      for (const p of pb) {
        const next = running - p.value;
        lines.push(`${running} − ${p.value} = ${next}`);
        running = next;
      }
      steps.push(S(
        `Break ${b} into its place values and take them off one at a time.`,
        `${b} = ${pb.map(p => p.value).join(' + ')}\n${lines.join('\n')}`
      ));
    }
  }
  steps.push(S(`${a} − ${b} = ${fmt(diff)}.`));

  const alternatives = [];
  if (Number.isInteger(a) && Number.isInteger(b) && a > b && b > 0) {
    // Counting up from b to a via the next friendly number.
    const bridge = Math.ceil(b / 10) * 10;
    if (bridge > b && bridge < a) {
      const first = bridge - b;
      const second = a - bridge;
      alternatives.push({
        name: 'Count up',
        steps: [
          S(`Count up from ${b} to ${a}.`),
          S(`${b} + ${first} = ${bridge}.`),
          S(`${bridge} + ${second} = ${a}.`),
          S(`Total counted up: ${first} + ${second} = ${fmt(diff)}.`),
        ],
      });
    }
  }
  return { steps, alternatives, answer: diff };
}

// ─────────────────────────────────────────────────────────────
// MULTIPLICATION — partial products (grid), plus doubling/halving
// ─────────────────────────────────────────────────────────────
export function explainMul(a, b) {
  const product = a * b;
  const steps = [S(`Start with ${a} × ${b}.`)];

  if (Number.isInteger(a) && Number.isInteger(b) && Math.abs(b) > 9) {
    const pb = placeValues(b);
    const parts = pb.map(p => ({ v: p.value, r: a * p.value }));
    steps.push(S(
      `Split ${b} into place values: ${pb.map(p => p.value).join(' + ')}.`
    ));
    steps.push(S(
      `Multiply ${a} by each part.`,
      parts.map(p => `${a} × ${p.v} = ${p.r}`).join('\n')
    ));
    steps.push(S(
      `Add the partial products.`,
      `${parts.map(p => p.r).join(' + ')} = ${product}`
    ));
  } else if (Number.isInteger(a) && Number.isInteger(b) && Math.abs(b) <= 9 && Math.abs(a) > 9) {
    const pa = placeValues(a);
    const parts = pa.map(p => ({ v: p.value, r: p.value * b }));
    steps.push(S(
      `Split ${a} into place values: ${pa.map(p => p.value).join(' + ')}.`
    ));
    steps.push(S(
      `Multiply each part by ${b}.`,
      parts.map(p => `${p.v} × ${b} = ${p.r}`).join('\n')
    ));
    steps.push(S(
      `Add the partial products.`,
      `${parts.map(p => p.r).join(' + ')} = ${product}`
    ));
  }
  steps.push(S(`${a} × ${b} = ${fmt(product)}.`));

  const alternatives = [];
  // Doubling and halving, when one side is even.
  if (Number.isInteger(a) && Number.isInteger(b) && a % 2 === 0 && b > 2 && a > 2) {
    alternatives.push({
      name: 'Double and halve',
      steps: [
        S(`Halve ${a} and double ${b}: ${a / 2} × ${b * 2}.`),
        S(`That is easier to read off: ${a / 2} × ${b * 2} = ${fmt(product)}.`),
        S(`Halving one side and doubling the other never changes the product.`),
      ],
    });
  }
  // Round-and-adjust when b is just under a round number.
  if (Number.isInteger(b) && b % 10 >= 7) {
    const up = Math.ceil(b / 10) * 10;
    const back = up - b;
    alternatives.push({
      name: 'Round and adjust',
      steps: [
        S(`Round ${b} up to ${up}: ${a} × ${up} = ${a * up}.`),
        S(`That counted ${back} extra lot${back === 1 ? '' : 's'} of ${a}: ${back} × ${a} = ${back * a}.`),
        S(`Subtract: ${a * up} − ${back * a} = ${fmt(product)}.`),
      ],
    });
  }
  return { steps, alternatives, answer: product };
}

// ─────────────────────────────────────────────────────────────
// DIVISION — chunking / factor pairs, exact where possible
// ─────────────────────────────────────────────────────────────
export function explainDiv(a, b) {
  const q = a / b;
  const steps = [S(`Start with ${a} ÷ ${b}.`)];
  const exact = Number.isInteger(a) && Number.isInteger(b) && a % b === 0;

  if (exact) {
    steps.push(S(`Ask: how many ${b}s fit into ${a}?`));
    // Chunk in tens where it helps.
    if (Math.abs(q) > 10) {
      const tens = Math.floor(Math.abs(q) / 10) * 10;
      const used = tens * Math.abs(b);
      const left = Math.abs(a) - used;
      const rest = left / Math.abs(b);
      steps.push(S(
        `Take ${tens} lots first.`,
        `${tens} × ${Math.abs(b)} = ${used}\n${Math.abs(a)} − ${used} = ${left}`
      ));
      steps.push(S(
        `Then ${left} ÷ ${Math.abs(b)} = ${rest}.`
      ));
      steps.push(S(`So altogether ${tens} + ${rest} = ${Math.abs(q)} lots.`));
    }
    steps.push(S(`Check by multiplying back: ${fmt(q)} × ${b} = ${fmt(q * b)}. ✓`));
  } else {
    steps.push(S(`${b} does not divide ${a} exactly, so work it as a decimal.`));
    steps.push(S(`${a} ÷ ${b} = ${fmt(q)}.`));
    steps.push(S(`Check: ${fmt(q)} × ${b} = ${fmt(round(q * b, 6))}. ✓`));
  }
  steps.push(S(`${a} ÷ ${b} = ${fmt(q)}.`));

  const alternatives = [];
  if (exact && Math.abs(b) > 3) {
    const pf = primeFactors(Math.abs(b));
    const flat = pf.flatMap(([p, c]) => Array(c).fill(p));
    if (flat.length > 1) {
      let running = a;
      const lines = [];
      for (const f of flat) {
        const nxt = running / f;
        lines.push(`${running} ÷ ${f} = ${fmt(nxt)}`);
        running = nxt;
      }
      alternatives.push({
        name: 'Divide in stages',
        steps: [
          S(`Factorise the divisor: ${Math.abs(b)} = ${flat.join(' × ')}.`),
          S(`Divide by each factor in turn.`, lines.join('\n')),
          S(`Result: ${fmt(q)}.`),
        ],
      });
    }
  }
  return { steps, alternatives, answer: q };
}
