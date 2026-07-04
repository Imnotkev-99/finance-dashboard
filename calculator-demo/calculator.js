/**
 * calculator.js
 * ---------------------------------------------------------------------------
 * Pure arithmetic logic for the calculator demo, extracted from index.html
 * so it can be unit-tested with `node --test` AND consumed by the browser
 * via a plain <script> tag (no build step, no ES modules, no bundler).
 *
 * Design constraints (per the team's "no npm dependencies" rule):
 *   - Zero imports, zero external dependencies.
 *   - Works in two runtimes without any build step:
 *       1) Browser: loaded via <script src="calculator.js"></script>.
 *          Exposes everything under `globalThis.Calc`.
 *       2) Node.js: loaded via `require("./calculator.js")`.
 *          Exposes everything via `module.exports`.
 *   - Uses a classic IIFE + UMD-lite export pattern (CommonJS detection)
 *     instead of `export` so it can be loaded with a *non-module* <script>
 *     tag — this avoids CORS restrictions when index.html is opened
 *     directly from the filesystem (file:// protocol).
 *
 * IMPORTANT: this file intentionally contains ONLY pure functions (no DOM
 * access, no global state, no side effects). The state machine that drives
 * the UI (operandA/operandB/state transitions, rendering, keyboard
 * listeners, etc.) stays in index.html, and calls into these functions.
 * ---------------------------------------------------------------------------
 */
(function (root) {
  "use strict";

  // Maximum number of characters allowed in the display for a single
  // operand or result (mirrors the original MAX_DISPLAY constant and
  // "regla 6/7" from the ux-logic-architect spec: anything that doesn't
  // fit after formatting is treated as a non-representable overflow).
  var MAX_DISPLAY = 12;

  /**
   * Evaluates a single binary arithmetic operation: `a <operator> b`.
   *
   * This is a thin, well-named public wrapper around the original
   * `compute(a, op, b)` helper from index.html — same semantics, same
   * edge-case handling (division by zero returns `null`, unknown
   * operators return `null`). Renamed to `evaluate` to match the public
   * contract requested for calculator.js; `compute` is kept as an alias
   * for anyone importing under the legacy name.
   *
   * @param {number|string} a - Left-hand operand. Strings are parsed with
   *   `parseFloat`, matching the original implementation (so `"3.5px"`
   *   would parse as `3.5`, exactly like before — no new validation was
   *   introduced to avoid behavior drift).
   * @param {"+"|"-"|"*"|"/"} operator - Arithmetic operator.
   * @param {number|string} b - Right-hand operand. Same parsing rules as `a`.
   * @returns {number|null} The numeric result, or `null` when the operation
   *   is not representable:
   *     - division by zero (`b` parses to `0` with operator `"/"`)
   *     - unknown/unsupported operator
   *   Note: this function does NOT itself check for NaN/Infinity on the
   *   resulting value (e.g. `NaN + 1`) — that responsibility belongs to
   *   `formatResult`, exactly like in the original index.html, where
   *   `compute()`'s raw output is always piped through `formatResult()`
   *   before being shown or stored.
   *
   * @example
   * evaluate(2, "+", 3);   // 5
   * evaluate(10, "/", 0);  // null (division by zero)
   * evaluate("4", "*", "2.5"); // 10
   */
  function evaluate(a, operator, b) {
    var x = parseFloat(a);
    var y = parseFloat(b);
    switch (operator) {
      case "+":
        return x + y;
      case "-":
        return x - y;
      case "*":
        return x * y;
      case "/":
        if (y === 0) return null; // Division by zero -> caller treats as error.
        return x / y;
      default:
        return null; // Unknown operator -> caller treats as error.
    }
  }

  /**
   * Formats a numeric value for display, enforcing the calculator's
   * display-width contract and normalizing non-representable values to a
   * single, explicit error signal.
   *
   * Mirrors the original `formatResult(n)` from index.html 1:1:
   *   1. `null`, `NaN`, and non-finite values (`Infinity`/`-Infinity`)
   *      immediately resolve to "not representable".
   *   2. If the default `String(n)` representation already fits within
   *      `MAX_DISPLAY` (12) characters, it's returned as-is.
   *   3. Otherwise, the function tries to shrink the decimal portion
   *      (via `toFixed`) just enough to fit within the character budget,
   *      stripping trailing zeros and a dangling decimal point.
   *   4. If it still doesn't fit, it falls back to scientific notation
   *      (`toExponential(5)`, with trailing zeros trimmed).
   *   5. If NONE of the above fit in `MAX_DISPLAY` characters, the value
   *      is considered a true overflow.
   *
   * @param {number|null} n - The raw numeric result to format. Passing the
   *   `null` produced by `evaluate()` on division-by-zero is the expected
   *   way to propagate that error through this function.
   * @returns {string|null} A display-ready string (e.g. "5", "3.333333333"),
   *   or `null` when the value cannot be represented within the display
   *   constraints (division by zero, NaN, Infinity, or true overflow).
   *   Callers that want the literal string `"Error"` shown to the user
   *   (per the spec) should treat `null` as that signal — exactly like the
   *   original `index.html`, which checks `formatted === null` and calls
   *   `toError()`.
   *
   * @example
   * formatResult(5);              // "5"
   * formatResult(null);           // null (propagated error, e.g. div/0)
   * formatResult(NaN);            // null
   * formatResult(Infinity);       // null
   * formatResult(1 / 3);          // "0.333333333" (fits in 12 chars)
   * formatResult(123456789012345); // null (true overflow, doesn't fit even in exponential form... see tests)
   */
  function formatResult(n) {
    if (n === null || typeof n === "undefined") return null;
    if (typeof n !== "number" || isNaN(n) || !isFinite(n)) return null;

    // 1) Default string representation, if it already fits.
    var str = String(n);
    if (str.length <= MAX_DISPLAY) return str;

    // 2) Try to shrink decimals to fit the budget.
    var intLen = String(Math.trunc(Math.abs(n))).length + (n < 0 ? 1 : 0);
    var decimalsAllowed = MAX_DISPLAY - intLen - 1; // -1 reserves the decimal point.
    if (decimalsAllowed > 0) {
      str = n.toFixed(decimalsAllowed);
      // Strip trailing zeros and a dangling decimal point (e.g. "3.000" -> "3").
      str = str.replace(/\.?0+$/, "");
      if (str.length <= MAX_DISPLAY) return str;
    }

    // 3) Last resort: scientific notation.
    var exp = n.toExponential(5).replace(/\.?0+e/, "e");
    if (exp.length <= MAX_DISPLAY) return exp;

    // 4) True overflow: nothing fits within MAX_DISPLAY characters.
    return null;
  }

  // Public surface of this module. Kept as a flat object so both export
  // targets (CommonJS and the global) expose an identical shape.
  var Calc = {
    MAX_DISPLAY: MAX_DISPLAY,
    evaluate: evaluate,
    compute: evaluate, // Backward-compatible alias for the original name used in index.html.
    formatResult: formatResult,
  };

  // ---- Dual-context export -------------------------------------------------
  // Node.js / CommonJS (e.g. `const Calc = require("./calculator.js")`).
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Calc;
  }

  // Browser / plain <script> tag (e.g. `window.Calc.evaluate(...)`).
  // `root` is `globalThis` in both modern browsers and Node, passed in
  // via the IIFE invocation below.
  if (root) {
    root.Calc = Calc;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
