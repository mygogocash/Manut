/**
 * @vitest-environment happy-dom
 *
 * `approval-detail-drawer.tsx` transitively imports `@affine/component`
 * (Button/Modal → lit-react), which references `HTMLElement` at module
 * scope. The helper under test is pure, but importing the module needs a
 * DOM global, so this spec runs under happy-dom.
 */
import { describe, expect, it } from 'vitest';

import { matchesCommentsCacheKey } from '../approval-detail-drawer';

// M10: after posting a comment the drawer revalidates the comments query
// that CommentsTable reads. useQuery keys SWR on
// `['cloud', query.id, variables]`. The revalidation uses a key predicate
// that must match that shape on `query.id` regardless of the variables or
// the leading 'cloud' prefix — and must NOT match unrelated keys.

describe('matchesCommentsCacheKey', () => {
  it('given the cloud-prefixed comments key > then matches', () => {
    const key = [
      'cloud',
      'mnApprovalCommentsQuery',
      { workspaceId: 'w', approvalId: 'a' },
    ];
    expect(matchesCommentsCacheKey(key)).toBe(true);
  });

  it('given a different query id at index 1 > then does not match', () => {
    const key = ['cloud', 'mnApprovals', { workspaceId: 'w' }];
    expect(matchesCommentsCacheKey(key)).toBe(false);
  });

  it('given a non-array key (string) > then does not match', () => {
    expect(matchesCommentsCacheKey('mnApprovalCommentsQuery')).toBe(false);
  });

  it('given a null key > then does not match', () => {
    expect(matchesCommentsCacheKey(null)).toBe(false);
  });

  it('given an array without the id at index 1 > then does not match', () => {
    expect(matchesCommentsCacheKey(['mnApprovalCommentsQuery'])).toBe(false);
  });
});
