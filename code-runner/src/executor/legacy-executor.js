'use strict';

/**
 * Legacy (v1) executor for POST /run.
 *
 * Kept for backwards compatibility with callers that still send
 * `{ code, testCases: [{ input, expectedOutput }], functionName }` with
 * JSON-*text* fields and a single-argument calling convention. New work should
 * use POST /v2/judge and judge-runtime.js instead.
 *
 * This used to live inline in src/main.ts as a template literal; the nested
 * backtick on the invocation line terminated that literal early, which left
 * main.ts unparseable (and therefore the runner unstartable). It is a real file
 * now so that cannot happen again.
 */

const fs = require('fs');
const vm = require('vm');

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return undefined;
  }
}

const code = fs.readFileSync('./code.js', 'utf8');
const tests = JSON.parse(fs.readFileSync('./tests.json', 'utf8'));
const functionName = fs.existsSync('./functionName.txt')
  ? fs.readFileSync('./functionName.txt', 'utf8').trim()
  : null;
const timeLimit = fs.existsSync('./timeLimit.txt')
  ? parseInt(fs.readFileSync('./timeLimit.txt', 'utf8'), 10)
  : 5;

const results = [];
let passed = 0;

const context = { module: { exports: {} }, exports: {}, console: { log: function () {} } };
vm.createContext(context);

try {
  vm.runInContext(code, context, { timeout: timeLimit * 1000 });
} catch (e) {
  for (const t of tests) {
    results.push({ input: t.input, passed: false, error: 'Initialization error: ' + String(e) });
  }
  console.log(JSON.stringify({ passedTests: 0, totalTests: tests.length, runtimeMs: 0, results }));
  process.exit(0);
}

const fn = functionName || 'solve';
context.__fnName = fn;
vm.runInContext(
  'globalThis.__invoke = function (input) {' +
    '  var target;' +
    '  try { target = eval(__fnName); } catch (e) { target = undefined; }' +
    '  if (typeof target !== "function" && module && module.exports) {' +
    '    if (typeof module.exports === "function") target = module.exports;' +
    '    else if (typeof module.exports[__fnName] === "function") target = module.exports[__fnName];' +
    '    else if (typeof module.exports.default === "function") target = module.exports.default;' +
    '  }' +
    '  if (typeof target !== "function") throw new Error("Function " + __fnName + " not found");' +
    '  return target(input);' +
    '};',
  context,
);

for (const t of tests) {
  const start = Date.now();
  try {
    context.__input = safeParse(t.input);
    const out = vm.runInContext('__invoke(__input)', context, { timeout: timeLimit * 1000 });
    const end = Date.now();
    const expected = safeParse(t.expectedOutput);
    const passedTest = JSON.stringify(out) === JSON.stringify(expected);
    if (passedTest) passed++;
    results.push({ input: t.input, passed: passedTest, runtimeMs: end - start });
  } catch (e) {
    results.push({ input: t.input, passed: false, error: String(e) });
  }
}

const runtime = results.reduce(function (sum, r) {
  return sum + (r.runtimeMs || 0);
}, 0);

console.log(
  JSON.stringify({ passedTests: passed, totalTests: tests.length, runtimeMs: runtime, results }),
);
