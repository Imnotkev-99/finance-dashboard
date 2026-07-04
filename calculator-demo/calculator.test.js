/**
 * calculator.test.js
 * ---------------------------------------------------------------------------
 * Unit tests for calculator.js, using Node's NATIVE test runner.
 * No dependencies installed — this project stays npm-free on purpose.
 *
 * Run with:
 *   node --test
 * or, to also see a coverage-ish verbose list:
 *   node --test --test-reporter=spec
 *
 * Scope: pure arithmetic logic only (evaluate / formatResult). The DOM/
 * state-machine wiring in index.html is intentionally out of scope here —
 * it has no pure functions left to unit test in isolation once calculator.js
 * was extracted (it's pure UI orchestration + DOM access).
 * ---------------------------------------------------------------------------
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Calc = require("./calculator.js");

// ---------------------------------------------------------------------------
// evaluate(a, operator, b)
// ---------------------------------------------------------------------------

test("evaluate: addition", () => {
  assert.equal(Calc.evaluate(2, "+", 3), 5);
  assert.equal(Calc.evaluate(-2, "+", 3), 1);
  assert.equal(Calc.evaluate(0, "+", 0), 0);
});

test("evaluate: subtraction", () => {
  assert.equal(Calc.evaluate(10, "-", 4), 6);
  assert.equal(Calc.evaluate(4, "-", 10), -6);
  assert.equal(Calc.evaluate(5, "-", 5), 0);
});

test("evaluate: multiplication", () => {
  assert.equal(Calc.evaluate(6, "*", 7), 42);
  assert.equal(Calc.evaluate(-3, "*", 3), -9);
  assert.equal(Calc.evaluate(0, "*", 999), 0);
});

test("evaluate: division (happy path)", () => {
  assert.equal(Calc.evaluate(10, "/", 2), 5);
  assert.equal(Calc.evaluate(1, "/", 4), 0.25);
});

test("evaluate: division by zero returns null (regla 8)", () => {
  assert.equal(Calc.evaluate(10, "/", 0), null);
  assert.equal(Calc.evaluate(0, "/", 0), null);
  assert.equal(Calc.evaluate(-5, "/", 0), null);
});

test("evaluate: decimals are handled with floating point semantics", () => {
  // Classic floating point artifact: 0.1 + 0.2 !== 0.3 exactly.
  // We assert the *raw* numeric behavior here; formatResult is what
  // later truncates this into something display-friendly.
  const result = Calc.evaluate(0.1, "+", 0.2);
  assert.ok(Math.abs(result - 0.3) < 1e-10);

  assert.equal(Calc.evaluate(2.5, "*", 2), 5);
  assert.equal(Calc.evaluate(1.5, "-", 0.5), 1);
});

test("evaluate: chained left-to-right composition (no operator precedence)", () => {
  // The calculator has no operator precedence — every operation is
  // resolved strictly left-to-right by feeding the previous result back
  // in as the new "a" operand, exactly like inputOperator()/inputEquals()
  // do in index.html's state machine.
  // Simulates: 2 + 3 * 4  =>  (2 + 3) = 5, then 5 * 4 = 20 (NOT 14).
  let acc = Calc.evaluate(2, "+", 3);
  acc = Calc.evaluate(acc, "*", 4);
  assert.equal(acc, 20);

  // Simulates: 10 - 2 - 3 - 1 => ((10 - 2) - 3) - 1 = 4
  acc = Calc.evaluate(10, "-", 2);
  acc = Calc.evaluate(acc, "-", 3);
  acc = Calc.evaluate(acc, "-", 1);
  assert.equal(acc, 4);

  // Simulates: 100 / 5 / 2 => (100 / 5) / 2 = 10
  acc = Calc.evaluate(100, "/", 5);
  acc = Calc.evaluate(acc, "/", 2);
  assert.equal(acc, 10);
});

test("evaluate: accepts numeric strings, mirroring original parseFloat-based behavior", () => {
  assert.equal(Calc.evaluate("3", "+", "4"), 7);
  assert.equal(Calc.evaluate("2.5", "*", "2"), 5);
  assert.equal(Calc.evaluate("-1", "-", "-1"), 0);
});

test("evaluate: unknown operator returns null", () => {
  assert.equal(Calc.evaluate(1, "%", 2), null);
  assert.equal(Calc.evaluate(1, "^", 2), null);
  assert.equal(Calc.evaluate(1, undefined, 2), null);
  assert.equal(Calc.evaluate(1, "", 2), null);
});

test("evaluate: non-numeric operands produce NaN (propagated, not swallowed)", () => {
  // evaluate() itself does not guard against NaN — that's formatResult's
  // job downstream, exactly matching the original index.html contract.
  assert.ok(Number.isNaN(Calc.evaluate("abc", "+", 1)));
  assert.ok(Number.isNaN(Calc.evaluate(undefined, "+", undefined)));
});

test("evaluate: compute() alias is exported for backward compatibility", () => {
  assert.equal(typeof Calc.compute, "function");
  assert.equal(Calc.compute(2, "+", 2), Calc.evaluate(2, "+", 2));
});

// ---------------------------------------------------------------------------
// formatResult(n)
// ---------------------------------------------------------------------------

test("formatResult: simple integers and decimals pass through as strings", () => {
  assert.equal(Calc.formatResult(5), "5");
  assert.equal(Calc.formatResult(-5), "-5");
  assert.equal(Calc.formatResult(0), "0");
  assert.equal(Calc.formatResult(0.25), "0.25");
  assert.equal(Calc.formatResult(1 / 4), "0.25");
});

test("formatResult: null input (propagated division-by-zero) -> null (\"Error\")", () => {
  assert.equal(Calc.formatResult(null), null);
});

test("formatResult: NaN -> null (\"Error\")", () => {
  assert.equal(Calc.formatResult(NaN), null);
  assert.equal(Calc.formatResult(0 / 0), null);
});

test("formatResult: Infinity / -Infinity -> null (\"Error\")", () => {
  assert.equal(Calc.formatResult(Infinity), null);
  assert.equal(Calc.formatResult(-Infinity), null);
  assert.equal(Calc.formatResult(1 / 0), null); // raw JS division, not evaluate()
});

test("formatResult: undefined input -> null (defensive, not produced by evaluate() directly)", () => {
  assert.equal(Calc.formatResult(undefined), null);
});

test("formatResult: repeating decimals get truncated to fit MAX_DISPLAY (12 chars)", () => {
  const result = Calc.formatResult(1 / 3); // 0.3333333333333333 normally
  assert.ok(result.length <= 12, `expected length <= 12, got "${result}" (${result.length})`);
  assert.ok(result.startsWith("0.333"));
});

test("formatResult: trailing zeros are stripped after fixed-decimal truncation", () => {
  // 100000000.5 has length 11 already (fits raw), so test a case that
  // actually needs toFixed() truncation and zero-stripping.
  // 123456789.1 as a String() is "123456789.1" (11 chars) -> fits as-is.
  // Force a real truncation case: a long repeating decimal whose
  // toFixed() output ends in trailing zeros after rounding.
  const result = Calc.formatResult(2 / 3); // 0.6666666666666666
  assert.ok(result.length <= 12);
  assert.ok(!result.endsWith("0"), `should not have trailing zero padding: "${result}"`);
});

test("formatResult: result exactly at the 12-character boundary is kept as-is", () => {
  const twelveChars = "123456789012"; // length === 12
  assert.equal(twelveChars.length, 12);
  assert.equal(Calc.formatResult(123456789012), twelveChars);
});

test("formatResult: large integers fall back to exponential notation when they fit", () => {
  // String(huge) is 15 chars long, which overflows the 12-char budget,
  // so formatResult must NOT just return null right away -- it should
  // first try the exponential-notation fallback, which for this
  // magnitude is "1.23457e+14" (11 chars) and DOES fit. This guards
  // against a naive implementation that gives up too early.
  const huge = 123456789012345; // 15-digit integer
  const result = Calc.formatResult(huge);
  assert.equal(result, huge.toExponential(5).replace(/\.?0+e/, "e"));
  assert.ok(result.length <= 12);
});

test("formatResult: true overflow when even exponential notation exceeds 12 chars", () => {
  // Number.MAX_VALUE's exponential form is "1.79769e+308" (12 chars) --
  // it just barely fits. Negating it adds a leading "-", pushing the
  // string to 13 characters ("-1.79769e+308"), which is the real
  // boundary case where even the exponential fallback can't save us
  // (regla 7: true overflow -> "Error").
  assert.equal(Calc.formatResult(Number.MAX_VALUE).length, 12);
  assert.equal(Calc.formatResult(-Number.MAX_VALUE), null);
});

test("formatResult: negative numbers account for the sign when computing decimal budget", () => {
  const result = Calc.formatResult(-1 / 3);
  assert.ok(result.length <= 12, `expected length <= 12, got "${result}"`);
  assert.ok(result.startsWith("-0.333"));
});

test("formatResult: zero and negative zero are both formatted as plain strings", () => {
  assert.equal(Calc.formatResult(0), "0");
  // -0 stringifies to "0" via String(-0) === "0" in JS, matching original behavior.
  assert.equal(Calc.formatResult(-0), "0");
});

// ---------------------------------------------------------------------------
// Integration-style: simulate full calculator interactions end-to-end
// through evaluate() + formatResult() together, mirroring how
// index.html's inputEquals()/inputOperator() chain them.
// ---------------------------------------------------------------------------

test("integration: 5 / 0 = -> \"Error\" (division by zero end-to-end)", () => {
  const raw = Calc.evaluate(5, "/", 0);
  assert.equal(Calc.formatResult(raw), null);
});

test("integration: 0.1 + 0.2 = -> floating point artifact stays within display width", () => {
  const raw = Calc.evaluate(0.1, "+", 0.2);
  const formatted = Calc.formatResult(raw);
  assert.ok(formatted.length <= 12);
});

test("integration: chained 2 + 3 * 4 = (left-to-right) -> \"20\"", () => {
  let raw = Calc.evaluate(2, "+", 3);
  let formatted = Calc.formatResult(raw);
  raw = Calc.evaluate(formatted, "*", 4);
  formatted = Calc.formatResult(raw);
  assert.equal(formatted, "20");
});

test("integration: overflow during a chained operation surfaces as \"Error\"", () => {
  // Multiplying two huge numbers can overflow past Number.MAX_VALUE,
  // which JavaScript represents as Infinity -- already covered by the
  // Infinity test above. Here we specifically drive a *negative*
  // near-MAX_VALUE result, which is finite but still fails to fit even
  // in exponential notation once the sign is added (see the dedicated
  // formatResult overflow test for why -Number.MAX_VALUE is the real
  // boundary case).
  const raw = Calc.evaluate(-Number.MAX_VALUE, "*", 1);
  assert.equal(Calc.formatResult(raw), null);
});

// ---------------------------------------------------------------------------
// Dual-context export contract
// ---------------------------------------------------------------------------

test("exports: module.exports shape matches the documented public contract", () => {
  assert.equal(typeof Calc.evaluate, "function");
  assert.equal(typeof Calc.formatResult, "function");
  assert.equal(typeof Calc.compute, "function");
  assert.equal(Calc.MAX_DISPLAY, 12);
});
