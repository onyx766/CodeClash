'use strict';

/**
 * CodeClash judge runtime (protocol v2).
 *
 * This file is copied into a per-job directory and executed by the worker
 * inside a locked-down `docker run` (no network, read-only rootfs, dropped
 * capabilities, non-root user, pids/cpu/memory caps). It is the ONLY place
 * where challenge or player code is ever executed - the NestJS API never
 * evaluates any of it.
 *
 * `vm` is used *inside* that container purely to get per-test timeouts and to
 * keep the solution, the reference solution and the custom checker in separate
 * globals. It is not treated as the security boundary; the container is.
 *
 * Input : ./job.json   (RunnerJobPayload + jobId)
 * Output: one JSON line on stdout (RunnerJobResult)
 */

const fs = require('fs');
const vm = require('vm');

const MAX_MESSAGE_LENGTH = 500;
const ACTUAL_OUTPUT_PREVIEW_LENGTH = 1000;
const CHECKER_TIMEOUT_MS = 2000;
const GENERATOR_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function truncate(text, max) {
  const value = String(text === undefined || text === null ? '' : text);
  return value.length > max ? value.slice(0, max) + '…' : value;
}

function describeError(error) {
  if (error && error.message) {
    const name = error.name || 'Error';
    return truncate(name + ': ' + error.message, MAX_MESSAGE_LENGTH);
  }
  return truncate(String(error), MAX_MESSAGE_LENGTH);
}

function isTimeoutError(error) {
  const message = String((error && error.message) || error);
  return (
    message.indexOf('Script execution timed out') !== -1 ||
    message.indexOf('execution was interrupted') !== -1
  );
}

/**
 * Structural deep equality over plain JSON values.
 * Array order matters; object key order does not; types are strict.
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    const key = aKeys[i];
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

/** Strict, type-aware comparison for primitive results. */
function exactEqual(actual, expected) {
  const actualIsPrimitive = actual === null || typeof actual !== 'object';
  const expectedIsPrimitive = expected === null || typeof expected !== 'object';
  if (!actualIsPrimitive || !expectedIsPrimitive) {
    return {
      passed: false,
      message:
        'EXACT compares primitive values only. Use DEEP_EQUAL for arrays and objects.',
    };
  }
  // No String() coercion on purpose: 42 and "42" must not be equal.
  return { passed: actual === expected, message: null };
}

function preview(value) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch (error) {
    text = String(value);
  }
  return truncate(text === undefined ? 'undefined' : text, 200);
}

// ---------------------------------------------------------------------------
// sandboxed realms
// ---------------------------------------------------------------------------

/**
 * A fresh V8 context holding one piece of executable challenge/player code.
 *
 * The context is created empty, so it gets only the standard JavaScript
 * built-ins - no require, no process, no fs, no network, no environment. The
 * only bridge in or out is JSON text.
 */
function createRealm(outputLimitBytes) {
  // The realm's global is a null-prototype object and NOTHING from this (host)
  // realm is ever placed inside it. Any host object or function would be an
  // escape hatch: `hostObject.constructor.constructor('return process')()`
  // yields this process, from which a submission could print a forged verdict
  // or read the hidden expectations in job.json. So console, the CommonJS
  // shell, the output counter and the bridge are all created by code evaluated
  // inside the realm, and only primitives (strings/numbers) cross the boundary.
  //
  // microtaskMode 'afterEvaluate' drains promise jobs inside each evaluation,
  // under its timeout; otherwise a self-scheduling promise chain would run
  // after the call returned, outside any per-test limit.
  const context = vm.createContext(Object.create(null), { microtaskMode: 'afterEvaluate' });

  vm.runInContext(
    `(function (limit) {
       'use strict';
       var state = { output: 0, overflowed: false };
       var record = function () {
         for (var i = 0; i < arguments.length; i++) {
           var a = arguments[i];
           state.output += typeof a === 'string' ? a.length : 8;
         }
         if (state.output > limit) state.overflowed = true;
       };
       var root = globalThis;
       root.console = { log: record, error: record, warn: record, info: record, debug: record };
       // Enough of a CommonJS shell that \`module.exports = solve\` also resolves.
       root.module = { exports: {} };
       root.exports = root.module.exports;
       Object.defineProperty(root, '__overflowed', {
         get: function () { return state.overflowed === true; },
       });
       root.__bridge = {
         target: null,
         resolve: function (namesJson) {
           var names = JSON.parse(namesJson);
           for (var i = 0; i < names.length; i++) {
             var name = names[i];
             var candidate;
             try { candidate = (0, eval)(name); } catch (e) { candidate = undefined; }
             if (typeof candidate === 'function') { root.__bridge.target = candidate; return name; }
           }
           var mod = root.module;
           if (mod && mod.exports) {
             var exported = mod.exports;
             if (typeof exported === 'function') { root.__bridge.target = exported; return 'module.exports'; }
             for (var j = 0; j < names.length; j++) {
               if (typeof exported[names[j]] === 'function') { root.__bridge.target = exported[names[j]]; return 'module.exports.' + names[j]; }
             }
             if (typeof exported.default === 'function') { root.__bridge.target = exported.default; return 'module.exports.default'; }
           }
           return null;
         },
         call: function (argsJson) {
           var args = JSON.parse(argsJson);
           var result = root.__bridge.target.apply(undefined, args);
           if (result && typeof result.then === 'function') return 'A';
           return 'V' + JSON.stringify({ v: result });
         },
       };
     })(${Number(outputLimitBytes) || 0});`,
    context,
    { filename: 'codeclash-bridge.js' },
  );

  return {
    context,
    // Read through the realm rather than holding a host-side reference the
    // realm could reach. The getter is non-configurable, so solution code
    // cannot redefine it.
    state: {
      get overflowed() {
        try {
          return vm.runInContext('__overflowed', context, { timeout: 100 }) === true;
        } catch (error) {
          return true;
        }
      },
    },
  };
}

function compile(code, filename) {
  try {
    // Parses without running: catches syntax errors before anything executes.
    new vm.Script(code, { filename: filename });
    return { ok: true, message: null };
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}

/**
 * Loads code into a realm and resolves the entry function.
 * Returns { ok, message, realm, resolvedAs }.
 */
function loadEntry(code, filename, names, limits, outputLimitBytes) {
  const syntax = compile(code, filename);
  if (!syntax.ok) return { ok: false, message: syntax.message, stage: 'SYNTAX' };

  const realm = createRealm(outputLimitBytes);
  try {
    vm.runInContext(code, realm.context, {
      filename: filename,
      timeout: limits.timeLimitMs,
    });
  } catch (error) {
    return {
      ok: false,
      stage: isTimeoutError(error) ? 'TIME_LIMIT' : 'RUNTIME',
      message: 'Initialization error: ' + describeError(error),
    };
  }

  let resolvedAs = null;
  try {
    // A JSON string, not the array itself: host arrays must never enter the realm.
    realm.context.__namesJson = JSON.stringify(names);
    resolvedAs = vm.runInContext('__bridge.resolve(__namesJson)', realm.context, {
      timeout: limits.timeLimitMs,
    });
  } catch (error) {
    return { ok: false, stage: 'RUNTIME', message: describeError(error) };
  }

  if (!resolvedAs) {
    return {
      ok: false,
      stage: 'RUNTIME',
      message: 'No function named "' + names[0] + '" was found.',
    };
  }
  return { ok: true, message: null, realm: realm, resolvedAs: resolvedAs };
}

/**
 * Invokes a loaded entry function with JSON-encoded arguments.
 * Returns { status, value, runtimeMs, message }.
 */
function invoke(entry, args, timeoutMs, outputLimitBytes) {
  const started = Date.now();
  let raw;
  try {
    entry.realm.context.__argsJson = JSON.stringify(args);
  } catch (error) {
    return {
      status: 'SYSTEM_ERROR',
      runtimeMs: 0,
      message: 'Test input could not be serialised: ' + describeError(error),
    };
  }

  try {
    raw = vm.runInContext('__bridge.call(__argsJson)', entry.realm.context, {
      timeout: timeoutMs,
    });
  } catch (error) {
    const runtimeMs = Date.now() - started;
    if (isTimeoutError(error)) {
      return { status: 'TIME_LIMIT', runtimeMs: runtimeMs, message: null };
    }
    return {
      status: 'RUNTIME_ERROR',
      runtimeMs: runtimeMs,
      message: describeError(error),
    };
  }

  const runtimeMs = Date.now() - started;

  if (entry.realm.state.overflowed) {
    return { status: 'OUTPUT_LIMIT', runtimeMs: runtimeMs, message: 'Console output limit exceeded.' };
  }
  if (raw === 'A') {
    return {
      status: 'RUNTIME_ERROR',
      runtimeMs: runtimeMs,
      message: 'Asynchronous solutions are not supported - return a value directly.',
    };
  }
  const json = String(raw).slice(1);
  if (json.length > outputLimitBytes) {
    return { status: 'OUTPUT_LIMIT', runtimeMs: runtimeMs, message: 'Returned value exceeds the output limit.' };
  }

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return {
      status: 'SYSTEM_ERROR',
      runtimeMs: runtimeMs,
      message: 'Result could not be decoded: ' + describeError(error),
    };
  }

  return {
    status: 'PASSED',
    value: Object.prototype.hasOwnProperty.call(parsed, 'v') ? parsed.v : undefined,
    runtimeMs: runtimeMs,
    message: null,
  };
}

// ---------------------------------------------------------------------------
// judging
// ---------------------------------------------------------------------------

/**
 * Runs the challenge-level custom checker in its own realm. It receives only
 * the test input, the actual value and the expected value - never the other
 * tests, the solution's realm, or anything from the host.
 */
function runChecker(checkerEntry, input, actual, expected) {
  const result = invoke(
    checkerEntry,
    [input, actual, expected === undefined ? null : expected],
    CHECKER_TIMEOUT_MS,
    64 * 1024,
  );

  if (result.status === 'TIME_LIMIT') {
    return { passed: false, systemError: true, message: 'Custom checker timed out.' };
  }
  if (result.status !== 'PASSED') {
    return {
      passed: false,
      systemError: true,
      message: 'Custom checker failed: ' + (result.message || result.status),
    };
  }

  const value = result.value;
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.passed !== 'boolean') {
    return {
      passed: false,
      systemError: true,
      message: 'Custom checker must return { passed: boolean, message: string | null }.',
    };
  }
  if (value.message !== undefined && value.message !== null && typeof value.message !== 'string') {
    return {
      passed: false,
      systemError: true,
      message: 'Custom checker message must be a string or null.',
    };
  }

  return {
    passed: value.passed,
    systemError: false,
    message: value.message ? truncate(value.message, MAX_MESSAGE_LENGTH) : null,
  };
}

function judge(job, test, actual, expected, checkerEntry) {
  switch (job.judgeMethod) {
    case 'EXACT': {
      const outcome = exactEqual(actual, expected);
      return {
        status: outcome.passed ? 'PASSED' : 'WRONG_ANSWER',
        message: outcome.passed ? null : outcome.message,
      };
    }
    case 'CUSTOM_CHECKER': {
      if (!checkerEntry) {
        return { status: 'SYSTEM_ERROR', message: 'No custom checker configured.' };
      }
      const outcome = runChecker(checkerEntry, test.input, actual, expected);
      if (outcome.systemError) return { status: 'SYSTEM_ERROR', message: outcome.message };
      return {
        status: outcome.passed ? 'PASSED' : 'WRONG_ANSWER',
        message: outcome.passed ? null : outcome.message,
      };
    }
    case 'DEEP_EQUAL':
    case 'REFERENCE':
    default: {
      // REFERENCE resolves `expected` from the reference solution before we get
      // here, then compares structurally like DEEP_EQUAL.
      return {
        status: deepEqual(actual, expected) ? 'PASSED' : 'WRONG_ANSWER',
        message: null,
      };
    }
  }
}

/** Builds the positional argument list from the declared parameter order. */
function buildArgs(contract, input) {
  const parameters = (contract && contract.parameters) || [];
  if (!parameters.length) return [input];
  return parameters.map(function (parameter) {
    return input === null || typeof input !== 'object' ? undefined : input[parameter.name];
  });
}

// ---------------------------------------------------------------------------
// generator
// ---------------------------------------------------------------------------

function generateInput(generatorEntry, seed) {
  const result = invoke(generatorEntry, [seed], GENERATOR_TIMEOUT_MS, 256 * 1024);
  if (result.status !== 'PASSED') {
    return { ok: false, message: result.message || result.status };
  }
  const value = result.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      message: 'generate(seed) must return an object keyed by parameter name.',
    };
  }
  return { ok: true, input: value };
}

// ---------------------------------------------------------------------------
// job execution
// ---------------------------------------------------------------------------

/**
 * @param preferStoredExpected when true, a test's stored expectedOutput wins
 *   over the reference solution's output. Validation sets this so that a
 *   hand-entered expectation is actually checked against the reference rather
 *   than being silently replaced by it.
 */
function runTests(job, tests, solutionEntry, referenceEntry, checkerEntry, preferStoredExpected) {
  const outputLimitBytes = job.limits.outputLimitKb * 1024;
  const results = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const base = { testId: test.id, hidden: !!test.hidden, order: test.order };

    let expected = test.expectedOutput;
    const missingExpectation = expected === undefined || expected === null;

    // REFERENCE (and any test with no stored expectation) derives the expected
    // value by running the trusted reference solution on the same input.
    if (referenceEntry && (missingExpectation || (job.judgeMethod === 'REFERENCE' && !preferStoredExpected))) {
      const referenceRun = invoke(
        referenceEntry,
        buildArgs(job.functionContract, test.input),
        job.limits.timeLimitMs,
        outputLimitBytes,
      );
      if (referenceRun.status !== 'PASSED') {
        results.push(
          Object.assign({}, base, {
            status: 'SYSTEM_ERROR',
            runtimeMs: referenceRun.runtimeMs || 0,
            message: 'Reference solution failed on this input: ' + (referenceRun.message || referenceRun.status),
          }),
        );
        continue;
      }
      expected = referenceRun.value;
    }

    const run = invoke(
      solutionEntry,
      buildArgs(job.functionContract, test.input),
      job.limits.timeLimitMs,
      outputLimitBytes,
    );

    if (run.status !== 'PASSED') {
      results.push(
        Object.assign({}, base, {
          status: run.status,
          runtimeMs: run.runtimeMs || 0,
          memoryKb: Math.round(process.memoryUsage().heapUsed / 1024),
          message: run.message || null,
          actualOutput: null,
          expectedOutput: expected === undefined ? null : expected,
          input: test.input,
        }),
      );
      continue;
    }

    const verdict = judge(job, test, run.value, expected, checkerEntry);
    results.push(
      Object.assign({}, base, {
        status: verdict.status,
        runtimeMs: run.runtimeMs || 0,
        memoryKb: Math.round(process.memoryUsage().heapUsed / 1024),
        message: verdict.message,
        actualOutput: run.value === undefined ? null : run.value,
        expectedOutput: expected === undefined ? null : expected,
        input: test.input,
      }),
    );
  }

  return results;
}

function loadSolutionEntry(job, code, filename, name) {
  return loadEntry(
    code,
    filename,
    [name, 'solve', 'solution', 'main'],
    job.limits,
    job.limits.outputLimitKb * 1024,
  );
}

function runSubmission(job) {
  const contract = job.functionContract || {};
  const solutionEntry = loadSolutionEntry(job, job.sourceCode || '', 'solution.js', contract.functionName);

  if (!solutionEntry.ok) {
    const status = solutionEntry.stage === 'TIME_LIMIT' ? 'TIME_LIMIT' : 'RUNTIME_ERROR';
    const tests = (job.tests || []).map(function (test) {
      return {
        testId: test.id,
        hidden: !!test.hidden,
        order: test.order,
        status: status,
        runtimeMs: 0,
        message: solutionEntry.message,
      };
    });
    return {
      ok: true,
      tests: tests,
      passedTests: 0,
      totalTests: tests.length,
      runtimeMs: 0,
    };
  }

  let referenceEntry = null;
  if (job.referenceSolutionCode) {
    const loaded = loadSolutionEntry(job, job.referenceSolutionCode, 'reference.js', contract.functionName);
    referenceEntry = loaded.ok ? loaded : null;
  }

  let checkerEntry = null;
  if (job.judgeMethod === 'CUSTOM_CHECKER' && job.customCheckerCode) {
    const loaded = loadEntry(job.customCheckerCode, 'checker.js', ['check', 'checker'], job.limits, 64 * 1024);
    checkerEntry = loaded.ok ? loaded : null;
  }

  const tests = (job.tests || []).slice();

  // Optional generated hidden tests. Only possible when both a deterministic
  // generator and a trusted reference solution exist - the reference is what
  // supplies the expected output for a generated input.
  if (job.generatorCode && referenceEntry && Array.isArray(job.generatorSeeds) && job.generatorSeeds.length) {
    const generatorLoaded = loadEntry(job.generatorCode, 'generator.js', ['generate'], job.limits, 256 * 1024);
    if (generatorLoaded.ok) {
      for (let i = 0; i < job.generatorSeeds.length; i++) {
        const generated = generateInput(generatorLoaded, job.generatorSeeds[i]);
        if (!generated.ok) break;
        tests.push({
          id: 'generated-' + job.generatorSeeds[i],
          input: generated.input,
          expectedOutput: undefined,
          hidden: true,
          order: 10000 + i,
        });
      }
    }
  }

  const results = runTests(job, tests, solutionEntry, referenceEntry, checkerEntry, false);
  const passed = results.filter(function (r) { return r.status === 'PASSED'; }).length;
  const runtimeMs = results.reduce(function (sum, r) { return sum + (r.runtimeMs || 0); }, 0);

  return {
    ok: true,
    // Inputs/expected values are stripped here: a SUBMISSION result travels
    // back towards a player, and hidden expectations must never leave. For a
    // public (sample) test the player already sees the input and expected
    // output, so their own function's output is returned as a short preview -
    // the difference is what lets them debug a wrong answer.
    tests: results.map(function (r) {
      return {
        testId: r.testId,
        hidden: r.hidden,
        order: r.order,
        status: r.status,
        runtimeMs: r.runtimeMs,
        memoryKb: r.memoryKb,
        message: r.hidden ? null : r.message,
        actualOutput: r.hidden ? null : previewValue(r.actualOutput),
      };
    }),
    passedTests: passed,
    totalTests: results.length,
    runtimeMs: runtimeMs,
  };
}

/** JSON preview of a returned value, capped so a huge result stays a hint. */
function previewValue(value) {
  if (value === undefined || value === null) return value === null ? 'null' : null;
  let json;
  try {
    json = JSON.stringify(value);
  } catch (error) {
    return null;
  }
  return json === undefined ? null : truncate(json, ACTUAL_OUTPUT_PREVIEW_LENGTH);
}

function failureDetail(result) {
  return {
    order: result.order,
    hidden: result.hidden,
    status: result.status,
    input: result.input === undefined ? null : result.input,
    expectedOutput: result.expectedOutput === undefined ? null : result.expectedOutput,
    actualOutput: result.actualOutput === undefined ? null : result.actualOutput,
    message: result.message || null,
  };
}

function runValidation(job) {
  const checks = [];
  const contract = job.functionContract || {};

  const push = function (name, passed, extra) {
    checks.push(Object.assign({ name: name, passed: passed, message: null }, extra || {}));
  };

  // 1. starter code must at least parse
  if (job.starterCode) {
    const starter = compile(job.starterCode, 'starter.js');
    push('STARTER_CODE', starter.ok, { message: starter.message });
  } else {
    push('STARTER_CODE', true, { skipped: true, message: 'No starter code provided.' });
  }

  // 2. reference solution
  let referenceEntry = null;
  if (job.referenceSolutionCode) {
    const loaded = loadSolutionEntry(job, job.referenceSolutionCode, 'reference.js', contract.functionName);
    if (loaded.ok) {
      referenceEntry = loaded;
      push('REFERENCE_SOLUTION', true, { message: 'Compiled and entry function resolved.' });
    } else {
      push('REFERENCE_SOLUTION', false, { message: loaded.message });
    }
  } else if (job.judgeMethod === 'REFERENCE') {
    push('REFERENCE_SOLUTION', false, {
      message: 'The REFERENCE judge method requires a reference solution.',
    });
  } else {
    push('REFERENCE_SOLUTION', true, { skipped: true, message: 'No reference solution configured.' });
  }

  // 3. custom checker
  let checkerEntry = null;
  if (job.customCheckerCode) {
    const loaded = loadEntry(job.customCheckerCode, 'checker.js', ['check', 'checker'], job.limits, 64 * 1024);
    if (!loaded.ok) {
      push('CUSTOM_CHECKER', false, { message: loaded.message });
    } else {
      checkerEntry = loaded;
      // Smoke-test the contract on the first test so a checker that returns the
      // wrong shape is caught here rather than mid-match.
      const sample = (job.tests || [])[0];
      if (!sample) {
        push('CUSTOM_CHECKER', true, { message: 'Compiled. No test case available to smoke-test it.' });
      } else {
        const probe = runChecker(
          checkerEntry,
          sample.input,
          sample.expectedOutput === undefined ? null : sample.expectedOutput,
          sample.expectedOutput === undefined ? null : sample.expectedOutput,
        );
        push('CUSTOM_CHECKER', !probe.systemError, {
          message: probe.systemError
            ? probe.message
            : 'Compiled and returned a valid result structure.',
        });
      }
    }
  } else if (job.judgeMethod === 'CUSTOM_CHECKER') {
    push('CUSTOM_CHECKER', false, {
      message: 'The CUSTOM_CHECKER judge method requires checker code.',
    });
  } else {
    push('CUSTOM_CHECKER', true, { skipped: true, message: 'No custom checker configured.' });
  }

  // 4. public/hidden tests, executed through the reference solution
  const allTests = job.tests || [];
  const publicTests = allTests.filter(function (t) { return !t.hidden; });
  const hiddenTests = allTests.filter(function (t) { return !!t.hidden; });

  if (!referenceEntry) {
    const reason =
      'Expected outputs were not machine-verified: no reference solution is configured.';
    push('PUBLIC_TESTS', true, { skipped: true, message: reason, passedCount: 0, totalCount: publicTests.length });
    push('HIDDEN_TESTS', true, { skipped: true, message: reason, passedCount: 0, totalCount: hiddenTests.length });
  } else {
    const evaluate = function (name, tests) {
      if (!tests.length) {
        push(name, true, { skipped: true, message: 'No test cases in this group.', passedCount: 0, totalCount: 0 });
        return;
      }
      // The reference solution stands in for a player's submission: if it
      // cannot reproduce the stored expectations, the test data is wrong.
      const results = runTests(job, tests, referenceEntry, referenceEntry, checkerEntry, true);
      const failures = results.filter(function (r) { return r.status !== 'PASSED'; });
      push(name, failures.length === 0, {
        passedCount: results.length - failures.length,
        totalCount: results.length,
        message:
          failures.length === 0
            ? null
            : 'Reference solution failed test #' +
              (failures[0].order + 1) +
              ' (' + failures[0].status + '). Expected ' +
              preview(failures[0].expectedOutput) +
              ', reference returned ' +
              preview(failures[0].actualOutput) + '.',
        failures: failures.slice(0, 5).map(failureDetail),
      });
    };
    evaluate('PUBLIC_TESTS', publicTests);
    evaluate('HIDDEN_TESTS', hiddenTests);
  }

  // 5. generator (optional) + determinism
  if (job.generatorCode) {
    const loaded = loadEntry(job.generatorCode, 'generator.js', ['generate'], job.limits, 256 * 1024);
    if (!loaded.ok) {
      push('GENERATOR', false, { message: loaded.message });
      push('GENERATOR_DETERMINISM', false, { message: 'Generator did not load.' });
    } else {
      const seeds = Array.isArray(job.generatorSeeds) && job.generatorSeeds.length
        ? job.generatorSeeds
        : [1, 2, 3];
      const declared = (contract.parameters || []).map(function (p) { return p.name; });
      let generatorOk = true;
      let generatorMessage = 'Generated ' + seeds.length + ' input(s) matching the function contract.';

      const firstRun = [];
      for (let i = 0; i < seeds.length && generatorOk; i++) {
        const generated = generateInput(loaded, seeds[i]);
        if (!generated.ok) {
          generatorOk = false;
          generatorMessage = 'generate(' + seeds[i] + ') failed: ' + generated.message;
          break;
        }
        for (let d = 0; d < declared.length; d++) {
          if (!Object.prototype.hasOwnProperty.call(generated.input, declared[d])) {
            generatorOk = false;
            generatorMessage =
              'generate(' + seeds[i] + ') did not return a value for parameter "' + declared[d] + '".';
            break;
          }
        }
        firstRun.push(generated.input);
      }
      push('GENERATOR', generatorOk, { message: generatorMessage });

      if (!generatorOk) {
        push('GENERATOR_DETERMINISM', false, { message: 'Skipped: the generator did not produce valid inputs.' });
      } else {
        // A second, freshly loaded realm: a generator that seeds a module-level
        // PRNG on first use would otherwise appear deterministic.
        const reloaded = loadEntry(job.generatorCode, 'generator.js', ['generate'], job.limits, 256 * 1024);
        let deterministic = reloaded.ok;
        let determinismMessage = reloaded.ok ? 'generate(seed) is reproducible.' : reloaded.message;
        for (let i = 0; i < seeds.length && deterministic; i++) {
          const again = generateInput(reloaded, seeds[i]);
          if (!again.ok || !deepEqual(again.input, firstRun[i])) {
            deterministic = false;
            determinismMessage =
              'generate(' + seeds[i] + ') produced different input on a second run. ' +
              'Seed the randomness instead of using Math.random().';
          }
        }
        push('GENERATOR_DETERMINISM', deterministic, { message: determinismMessage });
      }
    }
  } else {
    push('GENERATOR', true, { skipped: true, message: 'No test generator configured.' });
    push('GENERATOR_DETERMINISM', true, { skipped: true, message: 'No test generator configured.' });
  }

  return {
    ok: true,
    checks: checks,
  };
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

function main() {
  let job;
  try {
    job = JSON.parse(fs.readFileSync('./job.json', 'utf8'));
  } catch (error) {
    process.stdout.write(
      JSON.stringify({ ok: false, error: 'Could not read job payload: ' + describeError(error) }) + '\n',
    );
    return;
  }

  job.limits = job.limits || {};
  job.limits.timeLimitMs = Math.max(50, Math.min(Number(job.limits.timeLimitMs) || 2000, 10000));
  job.limits.outputLimitKb = Math.max(1, Math.min(Number(job.limits.outputLimitKb) || 64, 1024));

  let result;
  try {
    result =
      job.jobType === 'CHALLENGE_VALIDATION' ? runValidation(job) : runSubmission(job);
  } catch (error) {
    result = { ok: false, error: describeError(error) };
  }

  process.stdout.write(
    JSON.stringify(
      Object.assign({ jobId: job.jobId, jobType: job.jobType, challengeId: job.challengeId }, result),
    ) + '\n',
  );
}

main();
