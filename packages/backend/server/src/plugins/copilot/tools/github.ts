/**
 * GitHub AI tools — M2 E2.1.
 *
 * Four read-only tools that the AI can call once the user has
 * connected GitHub under Settings → Integrations:
 *
 *   - `github_search_issues` — search issues across a repo (or all
 *     repos the user can see), filter by state.
 *   - `github_read_issue`    — fetch a single issue's body + comment
 *     count + author.
 *   - `github_search_repos`  — discover repos by query, optionally
 *     filter by language.
 *   - `github_read_pr`       — fetch a single PR's body + head/base
 *     branches + mergeable status.
 *
 * Auth path:
 *   GithubOAuthService.getValidAccessToken(userId, workspaceId)
 *
 * Graceful degradation contract — every failure mode lands in a
 * `toolError`, never a thrown exception (would crash the chat stream):
 *  - OAuth client not configured  → "GitHub is not configured. …"
 *  - User/workspace not connected → "GitHub not connected. Connect …"
 *  - GitHub 401 / 403             → friendly "reconnect" copy + status
 *  - GitHub rate limit            → message includes reset hint
 *  - Malformed/empty response     → toolError with parse hint
 *
 * No new heavy deps — uses `globalThis.fetch` like every other AFFiNE
 * AI tool. The Octokit REST client would pull a ~50KB dep we don't
 * need for four GETs.
 */

import { Logger } from '@nestjs/common';
import { z } from 'zod';

import {
  GithubOAuthNotConfiguredError,
  GithubOAuthNotConnectedError,
  type GithubOAuthService,
  GithubOAuthTokenInvalidError,
} from '../../github-oauth/github-oauth.service';
import { toolError } from './error';
import { defineTool } from './tool';
import type { CopilotChatOptions } from './types';

const logger = new Logger('GithubTools');

const GITHUB_API_BASE = 'https://api.github.com';
const TOP_N = 5;
// Cap the body snippet to keep prompt budgets reasonable. Full bodies
// are still available via github_read_issue / github_read_pr — the
// search-result snippet is meant for the model to decide what to
// drill into.
const BODY_SNIPPET_MAX = 400;

// =============================================================
// Shared GitHub REST helpers
// =============================================================

interface GithubRequestOpts {
  accessToken: string;
  path: string;
  searchParams?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

interface GithubResponse<T> {
  ok: true;
  data: T;
}

interface GithubFailure {
  ok: false;
  /** Friendly toolError result the caller can return verbatim. */
  toolError: ReturnType<typeof toolError>;
}

/**
 * Single chokepoint for GitHub REST calls. Returns a discriminated
 * union so the caller can `if (!result.ok) return result.toolError;`
 * without rebuilding the friendly-error mapping per tool.
 */
async function githubRequest<T>(
  opts: GithubRequestOpts,
  failureTitle: string
): Promise<GithubResponse<T> | GithubFailure> {
  const url = new URL(opts.path, GITHUB_API_BASE);
  if (opts.searchParams) {
    for (const [k, v] of Object.entries(opts.searchParams)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: opts.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return {
      ok: false,
      toolError: toolError(failureTitle, `GitHub network error: ${message}`),
    };
  }

  if (response.status === 401) {
    return {
      ok: false,
      toolError: toolError(
        failureTitle,
        'GitHub credentials rejected (401). Reconnect from Settings > Integrations.'
      ),
    };
  }
  if (response.status === 403) {
    // GitHub returns 403 for both auth issues AND rate-limits. The
    // rate-limit-specific headers tell us which.
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    const detail =
      remaining === '0' && reset
        ? `Rate limit exceeded — resets at ${new Date(Number(reset) * 1000).toISOString()}`
        : 'GitHub access forbidden (403). The connected account may lack permission for this resource.';
    return { ok: false, toolError: toolError(failureTitle, detail) };
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      ok: false,
      toolError: toolError(
        failureTitle,
        `GitHub API ${response.status} on ${opts.path}: ${text.slice(0, 200)}`
      ),
    };
  }

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'parse error';
    return {
      ok: false,
      toolError: toolError(
        failureTitle,
        `Malformed GitHub response: ${message}`
      ),
    };
  }
  return { ok: true, data };
}

/**
 * Resolve the access token via the OAuth service, mapping typed
 * errors to friendly toolError payloads. Returns a discriminated
 * union so every tool's auth preamble is one if/else.
 */
async function resolveAccessToken(
  oauth: GithubOAuthService,
  options: CopilotChatOptions,
  failureTitle: string
): Promise<{ ok: true; token: string } | GithubFailure> {
  const userId = options?.user;
  const workspaceId = options?.workspace;
  if (!userId || !workspaceId) {
    return {
      ok: false,
      toolError: toolError(
        failureTitle,
        'GitHub tools require a user + workspace context.'
      ),
    };
  }

  try {
    const token = await oauth.getValidAccessToken(userId, workspaceId);
    return { ok: true, token };
  } catch (err) {
    if (err instanceof GithubOAuthNotConfiguredError) {
      return {
        ok: false,
        toolError: toolError(
          failureTitle,
          'GitHub is not configured. Ask your admin to set GITHUB_OAUTH_CLIENT_ID.'
        ),
      };
    }
    if (err instanceof GithubOAuthNotConnectedError) {
      return {
        ok: false,
        toolError: toolError(
          failureTitle,
          'GitHub not connected. Connect it from Settings > Integrations.'
        ),
      };
    }
    if (err instanceof GithubOAuthTokenInvalidError) {
      return {
        ok: false,
        toolError: toolError(
          failureTitle,
          'GitHub credentials expired. Reconnect from Settings > Integrations.'
        ),
      };
    }
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { ok: false, toolError: toolError(failureTitle, message) };
  }
}

function bodySnippet(body: string | null | undefined): string {
  if (!body) return '';
  const trimmed = body.trim();
  if (trimmed.length <= BODY_SNIPPET_MAX) return trimmed;
  return trimmed.slice(0, BODY_SNIPPET_MAX) + '…';
}

// =============================================================
// 1. github_search_issues
// =============================================================

const GithubSearchIssuesInputSchema = z.object({
  query: z
    .string()
    .min(1, 'query is required')
    .describe(
      'Free-text issue search query (e.g. "memory leak", "regression after upgrade"). ' +
        'Matched against issue title + body.'
    ),
  repo: z
    .string()
    .optional()
    .describe(
      'Optional `owner/repo` slug to scope the search. When omitted, ' +
        'searches across all repos visible to the connected user.'
    ),
  state: z
    .enum(['open', 'closed', 'all'])
    .optional()
    .describe('Issue state filter. Defaults to "open".'),
});

type GithubSearchIssuesInput = z.infer<typeof GithubSearchIssuesInputSchema>;

interface GithubSearchIssuesItem {
  number: number;
  title: string;
  state: string;
  body_snippet: string;
  url: string;
}

interface GithubSearchApiResponse {
  total_count?: number;
  items?: Array<{
    number?: number;
    title?: string;
    state?: string;
    body?: string;
    html_url?: string;
    // The search-issues endpoint can return PRs too — we filter via
    // `is:issue` on the query string, but the shape still carries
    // a `pull_request` discriminator we tolerate but ignore.
    pull_request?: unknown;
  }>;
}

export const buildGithubSearchIssuesHandler = (oauth: GithubOAuthService) => {
  return async (
    options: CopilotChatOptions,
    input: GithubSearchIssuesInput
  ): Promise<
    { issues: GithubSearchIssuesItem[] } | ReturnType<typeof toolError>
  > => {
    const failureTitle = 'GitHub Search Issues Failed';
    const auth = await resolveAccessToken(oauth, options, failureTitle);
    if (!auth.ok) return auth.toolError;

    const state = input.state ?? 'open';
    // GitHub's issue search uses qualifiers, e.g.
    //   "memory leak repo:foo/bar is:issue state:open"
    const qParts = [input.query.trim(), 'is:issue'];
    if (input.repo) qParts.push(`repo:${input.repo}`);
    if (state !== 'all') qParts.push(`state:${state}`);

    const result = await githubRequest<GithubSearchApiResponse>(
      {
        accessToken: auth.token,
        path: '/search/issues',
        searchParams: {
          q: qParts.join(' '),
          per_page: TOP_N,
          sort: 'updated',
          order: 'desc',
        },
        signal: options?.signal,
      },
      failureTitle
    );
    if (!result.ok) return result.toolError;

    const items = (result.data.items ?? [])
      // Defensive: drop PRs even though the `is:issue` qualifier
      // should've filtered them server-side.
      .filter(it => !it.pull_request)
      .slice(0, TOP_N)
      .map<GithubSearchIssuesItem>(it => ({
        number: it.number ?? 0,
        title: it.title ?? '',
        state: it.state ?? 'unknown',
        body_snippet: bodySnippet(it.body),
        url: it.html_url ?? '',
      }));

    logger.log(
      `github_search_issues ok workspace=${options?.workspace} query="${input.query.slice(0, 80)}" hits=${items.length}`
    );

    return { issues: items };
  };
};

export const createGithubSearchIssuesTool = (
  handler: (input: GithubSearchIssuesInput) => Promise<unknown>
) => {
  return defineTool({
    description:
      "Search GitHub issues across the user's connected GitHub account. Supports the standard " +
      'GitHub issue search query syntax in the `query` argument (e.g. `label:bug newer_than:30d`); ' +
      'use the `repo` argument for a more reliable `owner/repo` scope. Returns up to 5 issues — ' +
      'each with number, title, state, a body snippet, and the GitHub URL.',
    inputSchema: GithubSearchIssuesInputSchema,
    execute: async input => {
      try {
        return await handler(input);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unexpected error';
        logger.error(`github_search_issues tool execute failed: ${message}`);
        return toolError('GitHub Search Issues Failed', message);
      }
    },
  });
};

// =============================================================
// 2. github_read_issue
// =============================================================

const GithubReadIssueInputSchema = z.object({
  repo: z
    .string()
    .min(1, 'repo is required')
    .describe('`owner/repo` slug, e.g. `vercel/next.js`.'),
  number: z
    .number()
    .int()
    .positive()
    .describe('Issue number (the part after `#` in a GitHub URL).'),
});

type GithubReadIssueInput = z.infer<typeof GithubReadIssueInputSchema>;

interface GithubReadIssueResult {
  title: string;
  state: string;
  body: string;
  comments_count: number;
  author: string;
  url: string;
}

interface GithubIssueApiResponse {
  title?: string;
  state?: string;
  body?: string | null;
  comments?: number;
  user?: { login?: string };
  html_url?: string;
  pull_request?: unknown;
}

export const buildGithubReadIssueHandler = (oauth: GithubOAuthService) => {
  return async (
    options: CopilotChatOptions,
    input: GithubReadIssueInput
  ): Promise<GithubReadIssueResult | ReturnType<typeof toolError>> => {
    const failureTitle = 'GitHub Read Issue Failed';
    const auth = await resolveAccessToken(oauth, options, failureTitle);
    if (!auth.ok) return auth.toolError;

    const result = await githubRequest<GithubIssueApiResponse>(
      {
        accessToken: auth.token,
        path: `/repos/${input.repo}/issues/${input.number}`,
        signal: options?.signal,
      },
      failureTitle
    );
    if (!result.ok) return result.toolError;

    const data = result.data;
    logger.log(
      `github_read_issue ok workspace=${options?.workspace} repo=${input.repo}#${input.number}`
    );
    return {
      title: data.title ?? '',
      state: data.state ?? 'unknown',
      body: data.body ?? '',
      comments_count: data.comments ?? 0,
      author: data.user?.login ?? '',
      url: data.html_url ?? '',
    };
  };
};

export const createGithubReadIssueTool = (
  handler: (input: GithubReadIssueInput) => Promise<unknown>
) => {
  return defineTool({
    description:
      'Read the full body of a single GitHub issue by `owner/repo` slug and issue number. ' +
      'Returns title, state, body, comment count, author, and the GitHub URL. Use after ' +
      '`github_search_issues` returns a candidate to drill into.',
    inputSchema: GithubReadIssueInputSchema,
    execute: async input => {
      try {
        return await handler(input);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unexpected error';
        logger.error(`github_read_issue tool execute failed: ${message}`);
        return toolError('GitHub Read Issue Failed', message);
      }
    },
  });
};

// =============================================================
// 3. github_search_repos
// =============================================================

const GithubSearchReposInputSchema = z.object({
  query: z
    .string()
    .min(1, 'query is required')
    .describe(
      'Free-text repository search query (matched against name + description).'
    ),
  language: z
    .string()
    .optional()
    .describe(
      'Optional language filter (e.g. "typescript", "rust"). ' +
        'Maps to the `language:` qualifier server-side.'
    ),
});

type GithubSearchReposInput = z.infer<typeof GithubSearchReposInputSchema>;

interface GithubSearchReposItem {
  full_name: string;
  description: string;
  stars: number;
  url: string;
}

interface GithubSearchReposApiResponse {
  total_count?: number;
  items?: Array<{
    full_name?: string;
    description?: string | null;
    stargazers_count?: number;
    html_url?: string;
  }>;
}

export const buildGithubSearchReposHandler = (oauth: GithubOAuthService) => {
  return async (
    options: CopilotChatOptions,
    input: GithubSearchReposInput
  ): Promise<
    { repos: GithubSearchReposItem[] } | ReturnType<typeof toolError>
  > => {
    const failureTitle = 'GitHub Search Repos Failed';
    const auth = await resolveAccessToken(oauth, options, failureTitle);
    if (!auth.ok) return auth.toolError;

    const qParts = [input.query.trim()];
    if (input.language) qParts.push(`language:${input.language}`);

    const result = await githubRequest<GithubSearchReposApiResponse>(
      {
        accessToken: auth.token,
        path: '/search/repositories',
        searchParams: {
          q: qParts.join(' '),
          per_page: TOP_N,
          sort: 'stars',
          order: 'desc',
        },
        signal: options?.signal,
      },
      failureTitle
    );
    if (!result.ok) return result.toolError;

    const repos = (result.data.items ?? [])
      .slice(0, TOP_N)
      .map<GithubSearchReposItem>(it => ({
        full_name: it.full_name ?? '',
        description: it.description ?? '',
        stars: it.stargazers_count ?? 0,
        url: it.html_url ?? '',
      }));

    logger.log(
      `github_search_repos ok workspace=${options?.workspace} query="${input.query.slice(0, 80)}" hits=${repos.length}`
    );
    return { repos };
  };
};

export const createGithubSearchReposTool = (
  handler: (input: GithubSearchReposInput) => Promise<unknown>
) => {
  return defineTool({
    description:
      'Search public + accessible private GitHub repositories. Sorted by star count desc, ' +
      'returns up to 5 repos — each with `full_name`, description, star count, and the GitHub URL. ' +
      'Optional `language` argument narrows by primary language.',
    inputSchema: GithubSearchReposInputSchema,
    execute: async input => {
      try {
        return await handler(input);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unexpected error';
        logger.error(`github_search_repos tool execute failed: ${message}`);
        return toolError('GitHub Search Repos Failed', message);
      }
    },
  });
};

// =============================================================
// 4. github_read_pr
// =============================================================

const GithubReadPrInputSchema = z.object({
  repo: z
    .string()
    .min(1, 'repo is required')
    .describe('`owner/repo` slug, e.g. `vercel/next.js`.'),
  number: z
    .number()
    .int()
    .positive()
    .describe('Pull request number (the part after `#` in a GitHub URL).'),
});

type GithubReadPrInput = z.infer<typeof GithubReadPrInputSchema>;

interface GithubReadPrResult {
  title: string;
  state: string;
  body: string;
  head: string;
  base: string;
  /**
   * `true` / `false` / `null` — GitHub returns `null` while it's
   * still computing the mergeable state for a recent PR. We
   * passthrough verbatim so the model can decide whether to retry.
   */
  mergeable: boolean | null;
  author: string;
  url: string;
}

interface GithubPrApiResponse {
  title?: string;
  state?: string;
  body?: string | null;
  head?: { ref?: string };
  base?: { ref?: string };
  mergeable?: boolean | null;
  user?: { login?: string };
  html_url?: string;
}

export const buildGithubReadPrHandler = (oauth: GithubOAuthService) => {
  return async (
    options: CopilotChatOptions,
    input: GithubReadPrInput
  ): Promise<GithubReadPrResult | ReturnType<typeof toolError>> => {
    const failureTitle = 'GitHub Read PR Failed';
    const auth = await resolveAccessToken(oauth, options, failureTitle);
    if (!auth.ok) return auth.toolError;

    const result = await githubRequest<GithubPrApiResponse>(
      {
        accessToken: auth.token,
        path: `/repos/${input.repo}/pulls/${input.number}`,
        signal: options?.signal,
      },
      failureTitle
    );
    if (!result.ok) return result.toolError;

    const data = result.data;
    logger.log(
      `github_read_pr ok workspace=${options?.workspace} repo=${input.repo}#${input.number}`
    );
    return {
      title: data.title ?? '',
      state: data.state ?? 'unknown',
      body: data.body ?? '',
      head: data.head?.ref ?? '',
      base: data.base?.ref ?? '',
      mergeable: data.mergeable ?? null,
      author: data.user?.login ?? '',
      url: data.html_url ?? '',
    };
  };
};

export const createGithubReadPrTool = (
  handler: (input: GithubReadPrInput) => Promise<unknown>
) => {
  return defineTool({
    description:
      'Read a single GitHub pull request by `owner/repo` slug and PR number. Returns title, ' +
      'state, body, head branch, base branch, mergeable status (true/false/null while computing), ' +
      'author, and the GitHub URL.',
    inputSchema: GithubReadPrInputSchema,
    execute: async input => {
      try {
        return await handler(input);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unexpected error';
        logger.error(`github_read_pr tool execute failed: ${message}`);
        return toolError('GitHub Read PR Failed', message);
      }
    },
  });
};
