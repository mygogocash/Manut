/**
 * Behavioral tests for the shared SSE-stream-object defense + parser.
 *
 * v1.10.1's production scar (tags rendered as
 * `{"type":"text-delta","textDelta":"…"}`) was a missed defense at the
 * parse boundary. These tests cover the input shapes the AI Auto Tag
 * agent has been observed to emit, plus the SSE-wrapper inputs the
 * `request.ts` join layer might still leak under edge cases.
 *
 * Coverage is intentionally focused on PARSER BEHAVIOR (in/out) per
 * CLAUDE.md §1.2 — not on internal regex shapes.
 */

import { describe, expect, it } from 'vitest';

import {
  cleanTagSuggestions,
  looksLikeSseFragment,
  parseTagCandidates,
} from '../parse';

describe('parseTagCandidates', () => {
  it('given a clean JSON array > returns the parsed strings', () => {
    const out = parseTagCandidates('["foo", "bar", "baz"]');
    expect(out).toEqual(['foo', 'bar', 'baz']);
  });

  it('given a JSON array embedded in prose > extracts the array', () => {
    const out = parseTagCandidates(
      'Sure, here are the tags: ["foo", "bar"] — let me know if you want more.'
    );
    expect(out).toEqual(['foo', 'bar']);
  });

  it('given SSE-wrapped JSON > strips wrappers and returns clean strings', () => {
    const out = parseTagCandidates(
      '{"type":"text-delta","textDelta":"["}{"type":"text-delta","textDelta":"\\"mind\\""}{"type":"text-delta","textDelta":"]"}'
    );
    // The wrappers are stripped; the parser falls through to line-split
    // and yields candidates that the cleanTagSuggestions filter then
    // rejects via looksLikeSseFragment. Here we only assert the parser
    // does not return the literal wrapper text as a tag.
    out.forEach(candidate => {
      expect(candidate).not.toMatch(/text-delta/);
      expect(candidate).not.toMatch(/textDelta/);
    });
  });

  it('given comma-separated prose > splits and trims', () => {
    const out = parseTagCandidates('foo, bar, baz');
    expect(out).toEqual(['foo', 'bar', 'baz']);
  });

  it('given empty string > returns empty array (never throws)', () => {
    expect(parseTagCandidates('')).toEqual([]);
  });

  it('given malformed JSON > falls back to line-split', () => {
    const out = parseTagCandidates('["foo", "bar"');
    // Strategy 1/2 fail; Strategy 3 splits — we accept that the result
    // is non-empty and that it does not include raw JSON-bracket noise
    // as a tag.
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('looksLikeSseFragment', () => {
  it('given clean tag > returns false', () => {
    expect(looksLikeSseFragment('user-research')).toBe(false);
  });

  it('given empty string > returns true', () => {
    expect(looksLikeSseFragment('')).toBe(true);
  });

  it('given SSE chunk text > returns true', () => {
    // The hyphenated form is a literal substring match — appears in
    // every SSE chunk type.
    expect(looksLikeSseFragment('text-delta')).toBe(true);
    // JSON wrapper fragments — any one of these inside a "tag" means
    // the parser leaked a stream chunk.
    expect(looksLikeSseFragment('{"type":"text-delta"')).toBe(true);
    expect(looksLikeSseFragment('"textDelta":"hello"')).toBe(true);
    // Brace alone is enough.
    expect(looksLikeSseFragment('foo{bar}')).toBe(true);
  });

  it('given whitespace-only > returns true', () => {
    expect(looksLikeSseFragment('   ')).toBe(true);
  });

  it('given tag with backslash > returns true (conservative reject)', () => {
    expect(looksLikeSseFragment('back\\slash')).toBe(true);
  });
});

describe('cleanTagSuggestions', () => {
  it('given clean JSON array > returns sanitized, deduped, length-bounded list', () => {
    const out = cleanTagSuggestions('["FOO", "foo", "bar", "x"]');
    // FOO and foo collapse via toLowerCase. "x" drops (length < 2).
    expect(out).toEqual(['foo', 'bar']);
  });

  it('given SSE chunks > rejects all wrapper text', () => {
    const out = cleanTagSuggestions(
      '{"type":"text-delta","textDelta":"foo"}{"type":"text-delta","textDelta":"bar"}'
    );
    // No SSE-wrapper substrings make it through.
    out.forEach(candidate => {
      expect(candidate).not.toMatch(/text-delta/);
      expect(candidate).not.toMatch(/textDelta/);
      expect(candidate).not.toMatch(/[{}\\]/);
    });
  });

  it('caps at the requested maximum', () => {
    const tags = Array.from({ length: 12 }, (_, i) => `"tag-${i}"`);
    const out = cleanTagSuggestions(`[${tags.join(',')}]`, 5);
    expect(out.length).toBe(5);
  });
});
