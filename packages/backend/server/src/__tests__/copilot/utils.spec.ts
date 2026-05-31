import test from 'ava';

import {
  CitationFootnoteFormatter,
  TextStreamParser,
} from '../../plugins/copilot/providers/utils';

test('CitationFootnoteFormatter should format sorted footnotes from citation events', t => {
  const formatter = new CitationFootnoteFormatter();

  formatter.consume({
    type: 'citation',
    index: 2,
    url: 'https://example.com/b',
  });
  formatter.consume({
    type: 'citation',
    index: 1,
    url: 'https://example.com/a',
  });

  t.is(
    formatter.end(),
    [
      '[^1]: {"type":"url","url":"https%3A%2F%2Fexample.com%2Fa"}',
      '[^2]: {"type":"url","url":"https%3A%2F%2Fexample.com%2Fb"}',
    ].join('\n')
  );
});

test('CitationFootnoteFormatter should overwrite duplicated index with latest url', t => {
  const formatter = new CitationFootnoteFormatter();

  formatter.consume({
    type: 'citation',
    index: 1,
    url: 'https://example.com/old',
  });
  formatter.consume({
    type: 'citation',
    index: 1,
    url: 'https://example.com/new',
  });

  t.is(
    formatter.end(),
    '[^1]: {"type":"url","url":"https%3A%2F%2Fexample.com%2Fnew"}'
  );
});

test('TextStreamParser should not throw on a doc_edit tool-result with no preceding tool-call', t => {
  const parser = new TextStreamParser();

  // Out-of-order / duplicated SSE: a doc_edit tool-result arrives without the
  // matching tool-call that would have pushed a docEditFootnotes entry. The
  // un-guarded index access used to throw a TypeError out of parse() and
  // surface a red chat-error banner.
  t.notThrows(() =>
    parser.parse({
      type: 'tool-result',
      toolCallId: 'orphan-call',
      toolName: 'doc_edit',
      input: {},
      output: { result: [{ changedContent: 'hello' }] },
    })
  );
});
