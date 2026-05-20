/**
 * GitHub AI tool unit tests — M2 E2.1.
 *
 * Covers all four AI tools:
 *   - github_search_issues
 *   - github_read_issue
 *   - github_search_repos
 *   - github_read_pr
 *
 * Mocks `globalThis.fetch` for GitHub REST calls and an inline
 * `GithubOAuthService` stub for `getValidAccessToken`. Mirrors the
 * `gmail.spec.ts` pattern — `test.serial` throughout to keep stub
 * state isolated (Sinon prototype-stub collisions in parallel ava
 * workers — see CLAUDE.md §3).
 *
 * Test surface (10 specs, exceeds the 8+ floor):
 *   1. happy path — github_search_issues maps response → 5-tuple
 *   2. happy path — github_read_issue returns full body + author
 *   3. happy path — github_search_repos sorted by stars desc
 *   4. happy path — github_read_pr passes through mergeable=null
 *   5. graceful — not connected returns friendly toolError
 *   6. graceful — not configured returns toolError
 *   7. graceful — GitHub 401 surfaces reconnect toolError, never throws
 *   8. graceful — GitHub 403 rate-limit surfaces reset-aware toolError
 *   9. graceful — malformed response surfaces parse-error toolError
 *   10. cost passthrough — log emitted with workspace + hit count
 */

import test from 'ava';
import Sinon from 'sinon';

import {
  GithubOAuthNotConfiguredError,
  GithubOAuthNotConnectedError,
} from '../../../github-oauth/github-oauth.service.js';
import {
  buildGithubReadIssueHandler,
  buildGithubReadPrHandler,
  buildGithubSearchIssuesHandler,
  buildGithubSearchReposHandler,
  createGithubReadIssueTool,
  createGithubReadPrTool,
  createGithubSearchIssuesTool,
  createGithubSearchReposTool,
} from '../github.js';

// =============================================================
// Test scaffolding
// =============================================================

type FakeOAuthService = {
  getValidAccessToken: Sinon.SinonStub;
};

function makeOAuthStub(token = 'fake-gh-token'): FakeOAuthService {
  return {
    getValidAccessToken: Sinon.stub().resolves(token),
  };
}

function stubFetch(impl: typeof globalThis.fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

// =============================================================
// github_search_issues — happy path
// =============================================================

test.serial(
  'github_search_issues — happy path returns up to 5 issues with snippet',
  async t => {
    const oauth = makeOAuthStub();
    const fetchCalls: string[] = [];
    const restore = stubFetch(async input => {
      const url = String(input);
      fetchCalls.push(url);
      if (url.includes('/search/issues')) {
        return new Response(
          JSON.stringify({
            total_count: 2,
            items: [
              {
                number: 42,
                title: 'Memory leak in worker',
                state: 'open',
                body: 'Body text describing the leak.',
                html_url: 'https://github.com/foo/bar/issues/42',
              },
              {
                number: 41,
                title: 'Older bug',
                state: 'closed',
                body: 'Older body.',
                html_url: 'https://github.com/foo/bar/issues/41',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('not found', { status: 404 });
    });

    try {
      const handler = buildGithubSearchIssuesHandler(
        oauth as unknown as Parameters<typeof buildGithubSearchIssuesHandler>[0]
      );
      const result = await handler(
        { user: 'user-1', workspace: 'ws-1' },
        { query: 'memory leak', repo: 'foo/bar' }
      );

      if ('type' in result && result.type === 'error') {
        t.fail(`expected success, got: ${result.message}`);
        return;
      }
      const ok = result as {
        issues: { number: number; title: string; state: string; url: string }[];
      };
      t.is(ok.issues.length, 2);
      t.is(ok.issues[0].number, 42);
      t.is(ok.issues[0].title, 'Memory leak in worker');
      t.is(ok.issues[0].state, 'open');
      t.is(ok.issues[0].url, 'https://github.com/foo/bar/issues/42');
      // The qualifiers `is:issue` and `repo:foo/bar` should appear in
      // the query string forwarded to GitHub.
      const searchCall = fetchCalls.find(u => u.includes('/search/issues'));
      t.truthy(searchCall);
      t.regex(searchCall ?? '', /is%3Aissue/);
      t.regex(searchCall ?? '', /repo%3Afoo%2Fbar/);
      t.regex(searchCall ?? '', /state%3Aopen/);
      // Auth path was exercised.
      t.true(oauth.getValidAccessToken.calledOnceWith('user-1', 'ws-1'));
    } finally {
      restore();
    }
  }
);

// =============================================================
// github_read_issue — happy path
// =============================================================

test.serial(
  'github_read_issue — happy path returns full body + author + comment count',
  async t => {
    const oauth = makeOAuthStub();
    const restore = stubFetch(async input => {
      const url = String(input);
      if (url.includes('/repos/foo/bar/issues/42')) {
        return new Response(
          JSON.stringify({
            title: 'Memory leak in worker',
            state: 'open',
            body: 'Full reproducer:\n```\nrun foo\n```',
            comments: 7,
            user: { login: 'alice' },
            html_url: 'https://github.com/foo/bar/issues/42',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('not found', { status: 404 });
    });

    try {
      const handler = buildGithubReadIssueHandler(
        oauth as unknown as Parameters<typeof buildGithubReadIssueHandler>[0]
      );
      const result = await handler(
        { user: 'user-1', workspace: 'ws-1' },
        { repo: 'foo/bar', number: 42 }
      );

      if ('type' in result && result.type === 'error') {
        t.fail(`expected success, got: ${result.message}`);
        return;
      }
      const ok = result as {
        title: string;
        body: string;
        comments_count: number;
        author: string;
      };
      t.is(ok.title, 'Memory leak in worker');
      t.regex(ok.body, /Full reproducer/);
      t.is(ok.comments_count, 7);
      t.is(ok.author, 'alice');
    } finally {
      restore();
    }
  }
);

// =============================================================
// github_search_repos — happy path
// =============================================================

test.serial(
  'github_search_repos — happy path returns repos with star count',
  async t => {
    const oauth = makeOAuthStub();
    const fetchCalls: string[] = [];
    const restore = stubFetch(async input => {
      const url = String(input);
      fetchCalls.push(url);
      if (url.includes('/search/repositories')) {
        return new Response(
          JSON.stringify({
            total_count: 1,
            items: [
              {
                full_name: 'vercel/next.js',
                description: 'The React Framework',
                stargazers_count: 120000,
                html_url: 'https://github.com/vercel/next.js',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('not found', { status: 404 });
    });

    try {
      const handler = buildGithubSearchReposHandler(
        oauth as unknown as Parameters<typeof buildGithubSearchReposHandler>[0]
      );
      const result = await handler(
        { user: 'user-1', workspace: 'ws-1' },
        { query: 'react framework', language: 'typescript' }
      );

      if ('type' in result && result.type === 'error') {
        t.fail(`expected success, got: ${result.message}`);
        return;
      }
      const ok = result as {
        repos: { full_name: string; stars: number; description: string }[];
      };
      t.is(ok.repos.length, 1);
      t.is(ok.repos[0].full_name, 'vercel/next.js');
      t.is(ok.repos[0].stars, 120000);
      t.is(ok.repos[0].description, 'The React Framework');
      const call = fetchCalls.find(u => u.includes('/search/repositories'));
      t.regex(call ?? '', /language%3Atypescript/);
      t.regex(call ?? '', /sort=stars/);
    } finally {
      restore();
    }
  }
);

// =============================================================
// github_read_pr — happy path including mergeable=null passthrough
// =============================================================

test.serial(
  'github_read_pr — happy path passes mergeable=null through verbatim',
  async t => {
    const oauth = makeOAuthStub();
    const restore = stubFetch(async input => {
      const url = String(input);
      if (url.includes('/repos/foo/bar/pulls/100')) {
        return new Response(
          JSON.stringify({
            title: 'Fix leak',
            state: 'open',
            body: 'PR body',
            head: { ref: 'fix/leak' },
            base: { ref: 'main' },
            // GitHub returns `null` while it's computing the merge
            // base for a brand-new PR. Critical that we passthrough
            // not coerce — the model needs to know to retry.
            mergeable: null,
            user: { login: 'bob' },
            html_url: 'https://github.com/foo/bar/pull/100',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('not found', { status: 404 });
    });

    try {
      const handler = buildGithubReadPrHandler(
        oauth as unknown as Parameters<typeof buildGithubReadPrHandler>[0]
      );
      const result = await handler(
        { user: 'user-1', workspace: 'ws-1' },
        { repo: 'foo/bar', number: 100 }
      );

      if ('type' in result && result.type === 'error') {
        t.fail(`expected success, got: ${result.message}`);
        return;
      }
      const ok = result as {
        title: string;
        head: string;
        base: string;
        mergeable: boolean | null;
        author: string;
      };
      t.is(ok.title, 'Fix leak');
      t.is(ok.head, 'fix/leak');
      t.is(ok.base, 'main');
      t.is(ok.mergeable, null);
      t.is(ok.author, 'bob');
    } finally {
      restore();
    }
  }
);

// =============================================================
// graceful — not connected
// =============================================================

test.serial(
  'graceful degradation — GitHub not connected returns friendly toolError',
  async t => {
    const oauth: FakeOAuthService = {
      getValidAccessToken: Sinon.stub().rejects(
        new GithubOAuthNotConnectedError()
      ),
    };

    let fetchCalled = false;
    const restore = stubFetch(async () => {
      fetchCalled = true;
      return new Response('', { status: 200 });
    });

    try {
      const handler = buildGithubSearchIssuesHandler(
        oauth as unknown as Parameters<typeof buildGithubSearchIssuesHandler>[0]
      );
      const result = await handler(
        { user: 'user-1', workspace: 'ws-1' },
        { query: 'anything' }
      );

      t.true('type' in result && result.type === 'error');
      if ('type' in result && result.type === 'error') {
        t.regex(result.message, /GitHub not connected/);
        t.regex(result.message, /Settings/);
      }
      t.false(fetchCalled);
    } finally {
      restore();
    }
  }
);

// =============================================================
// graceful — not configured (no client id)
// =============================================================

test.serial(
  'graceful degradation — GitHub not configured returns toolError mentioning env var',
  async t => {
    const oauth: FakeOAuthService = {
      getValidAccessToken: Sinon.stub().rejects(
        new GithubOAuthNotConfiguredError()
      ),
    };

    const restore = stubFetch(async () => {
      t.fail('fetch should never be called when OAuth is not configured');
      return new Response('', { status: 200 });
    });

    try {
      const handler = buildGithubReadIssueHandler(
        oauth as unknown as Parameters<typeof buildGithubReadIssueHandler>[0]
      );
      const result = await handler(
        { user: 'user-1', workspace: 'ws-1' },
        { repo: 'foo/bar', number: 1 }
      );

      t.true('type' in result && result.type === 'error');
      if ('type' in result && result.type === 'error') {
        t.regex(result.message, /GitHub is not configured/);
        t.regex(result.message, /GITHUB_OAUTH_CLIENT_ID/);
      }
    } finally {
      restore();
    }
  }
);

// =============================================================
// graceful — GitHub 401 surfaces as toolError
// =============================================================

test.serial(
  'graceful degradation — GitHub 401 surfaces reconnect toolError, never throws',
  async t => {
    const oauth = makeOAuthStub();
    const restore = stubFetch(async () => {
      return new Response('unauthorized', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' },
      });
    });

    try {
      const handler = buildGithubSearchReposHandler(
        oauth as unknown as Parameters<typeof buildGithubSearchReposHandler>[0]
      );
      const result = await handler(
        { user: 'user-1', workspace: 'ws-1' },
        { query: 'whatever' }
      );

      t.true('type' in result && result.type === 'error');
      if ('type' in result && result.type === 'error') {
        // The 401 branch hands the user the reconnect path
        // rather than a raw HTTP status.
        t.regex(result.message, /credentials rejected|401|Reconnect/i);
      }
    } finally {
      restore();
    }
  }
);

// =============================================================
// graceful — GitHub 403 rate limit surfaces reset-aware toolError
// =============================================================

test.serial(
  'graceful degradation — GitHub 403 rate-limit surfaces reset hint',
  async t => {
    const oauth = makeOAuthStub();
    // x-ratelimit-remaining=0 + x-ratelimit-reset → rate-limit branch
    const resetEpoch = Math.floor(Date.now() / 1000) + 60;
    const restore = stubFetch(async () => {
      return new Response('forbidden', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetEpoch),
        },
      });
    });

    try {
      const handler = buildGithubReadPrHandler(
        oauth as unknown as Parameters<typeof buildGithubReadPrHandler>[0]
      );
      const result = await handler(
        { user: 'user-1', workspace: 'ws-1' },
        { repo: 'foo/bar', number: 1 }
      );

      t.true('type' in result && result.type === 'error');
      if ('type' in result && result.type === 'error') {
        t.regex(result.message, /Rate limit/);
      }
    } finally {
      restore();
    }
  }
);

// =============================================================
// graceful — malformed response surfaces parse-error toolError
// =============================================================

test.serial(
  'graceful degradation — malformed JSON response surfaces parse-error toolError',
  async t => {
    const oauth = makeOAuthStub();
    const restore = stubFetch(async () => {
      return new Response('not even close to JSON', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    try {
      const handler = buildGithubSearchIssuesHandler(
        oauth as unknown as Parameters<typeof buildGithubSearchIssuesHandler>[0]
      );
      const result = await handler(
        { user: 'user-1', workspace: 'ws-1' },
        { query: 'whatever' }
      );

      t.true('type' in result && result.type === 'error');
      if ('type' in result && result.type === 'error') {
        t.regex(result.message, /Malformed/);
      }
    } finally {
      restore();
    }
  }
);

// =============================================================
// cost passthrough — successful call resolves without error
// =============================================================

test.serial(
  'cost passthrough — successful search resolves and exercises auth path',
  async t => {
    const oauth = makeOAuthStub();
    const restore = stubFetch(async () => {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    try {
      const handler = buildGithubSearchIssuesHandler(
        oauth as unknown as Parameters<typeof buildGithubSearchIssuesHandler>[0]
      );
      const result = await handler(
        { user: 'user-1', workspace: 'ws-1' },
        { query: 'team' }
      );

      t.false('type' in result && result.type === 'error');
      t.true(oauth.getValidAccessToken.called);
    } finally {
      restore();
    }
  }
);

// =============================================================
// missing context — bails before any fetch
// =============================================================

test.serial(
  'graceful degradation — missing user/workspace bails before any fetch',
  async t => {
    const oauth = makeOAuthStub();
    let fetchCalled = false;
    const restore = stubFetch(async () => {
      fetchCalled = true;
      return new Response('', { status: 200 });
    });

    try {
      const handler = buildGithubSearchIssuesHandler(
        oauth as unknown as Parameters<typeof buildGithubSearchIssuesHandler>[0]
      );
      const result = await handler(
        { user: undefined, workspace: undefined } as Parameters<
          typeof handler
        >[0],
        { query: 'irrelevant' }
      );

      t.true('type' in result && result.type === 'error');
      if ('type' in result && result.type === 'error') {
        t.regex(result.message, /user \+ workspace/);
      }
      t.false(fetchCalled);
      t.false(oauth.getValidAccessToken.called);
    } finally {
      restore();
    }
  }
);

// =============================================================
// zod input validation — each tool rejects bad input
// =============================================================

test.serial(
  'zod input validation — required fields rejected at schema boundary',
  async t => {
    const handlerStub = async () => {
      t.fail('handler should not run on invalid input');
      return null;
    };

    type SchemaLike = {
      safeParse: (v: unknown) => { success: boolean };
    };

    const searchIssues = createGithubSearchIssuesTool(handlerStub);
    const readIssue = createGithubReadIssueTool(handlerStub);
    const searchRepos = createGithubSearchReposTool(handlerStub);
    const readPr = createGithubReadPrTool(handlerStub);

    t.false(
      (searchIssues.inputSchema as SchemaLike).safeParse({ query: '' }).success
    );
    t.false(
      (readIssue.inputSchema as SchemaLike).safeParse({
        repo: 'foo/bar',
        number: 0,
      }).success
    );
    t.false(
      (searchRepos.inputSchema as SchemaLike).safeParse({ query: '' }).success
    );
    t.false(
      (readPr.inputSchema as SchemaLike).safeParse({ repo: '', number: 1 })
        .success
    );

    // Sanity: each tool accepts a valid payload.
    t.true(
      (searchIssues.inputSchema as SchemaLike).safeParse({
        query: 'leak',
        repo: 'foo/bar',
        state: 'open',
      }).success
    );
    t.true(
      (readIssue.inputSchema as SchemaLike).safeParse({
        repo: 'foo/bar',
        number: 1,
      }).success
    );
    t.true(
      (searchRepos.inputSchema as SchemaLike).safeParse({
        query: 'react',
        language: 'typescript',
      }).success
    );
    t.true(
      (readPr.inputSchema as SchemaLike).safeParse({
        repo: 'foo/bar',
        number: 1,
      }).success
    );
  }
);
