import test from 'ava';

import { runPromptEval } from '../eval/runner.js';

test('runPromptEval__given_current_chat_prompt__then_required_ai_chat_invariants_pass', t => {
  const report = runPromptEval();
  const failures = report.results
    .filter(result => !result.pass)
    .map(result => `${result.id}: ${result.message}`)
    .join('\n');

  t.true(report.ok, failures);
  t.is(report.failed, 0);
  t.is(report.passed, report.total);
});
