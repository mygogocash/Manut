/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

const WorkspaceServiceToken = vi.hoisted(() => class WorkspaceService {});

const SAMPLE_RUN = {
  id: 'run-1',
  workspaceId: 'workspace-test',
  ghRunId: '12345',
  ghRunUrl: 'https://github.com/example/example/actions/runs/12345',
  mode: 'release',
  status: 'success' as const,
  version: 'v1.11.0',
  shortSha: 'abc1234',
  headSha: 'abc1234def567',
  imageTag:
    'asia-southeast1-docker.pkg.dev/affine-495114/affine/affine-gogocash:v1.11.0',
  imageDigest: 'sha256:deadbeef',
  registry: 'asia-southeast1-docker.pkg.dev',
  deployUrl: 'https://manut.gogocash.co',
  actor: 'GoGoCash Deploy',
  generatedAt: '2026-05-13T10:00:00.000Z',
  tasks: [
    { slug: 'build', label: 'Build Linux amd64 image', sortOrder: 1 },
    { slug: 'verify', label: 'Verify bundle + GraphQL', sortOrder: 2 },
    { slug: 'deploy', label: 'Sidecar swap + smoke', sortOrder: 3 },
    { slug: 'observe', label: 'Watch logs for 5min', sortOrder: 4 },
    { slug: 'document', label: 'Update HANDOVER.md', sortOrder: 5 },
  ],
};

let queryData: unknown = { releaseRuns: [SAMPLE_RUN] };
let queryError: unknown = undefined;

vi.mock('@affine/core/modules/workspace', () => ({
  WorkspaceService: WorkspaceServiceToken,
}));

vi.mock('@affine/error', () => ({
  isGraphQLSchemaValidationError: () => false,
}));

vi.mock('@affine/core/modules/workbench', () => ({
  ViewBody: ({ children }: { children: React.ReactNode }) => (
    <div data-stub="ViewBody">{children}</div>
  ),
  ViewHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-stub="ViewHeader">{children}</div>
  ),
  ViewIcon: () => null,
  ViewTitle: () => null,
}));

vi.mock('../../layouts/all-doc-sidebar-tabs', () => ({
  AllDocSidebarTabs: () => null,
}));

vi.mock('../../../../../components/pure/header', () => ({
  Header: ({ left }: { left?: React.ReactNode }) => <header>{left}</header>,
}));

vi.mock('@affine/core/components/hooks/use-query', () => ({
  useQuery: () => ({
    data: queryData,
    error: queryError,
    mutate: vi.fn(),
  }),
}));

vi.mock('@toeverything/infra', () => ({
  useService: (token: unknown) => {
    if (token === WorkspaceServiceToken) {
      return { workspace: { id: 'workspace-test' } };
    }
    return {};
  },
}));

import { Component } from '../index';

describe('Manut release runs page', () => {
  afterEach(() => {
    cleanup();
  });

  test('renders the list of runs', () => {
    queryData = { releaseRuns: [SAMPLE_RUN] };
    queryError = undefined;
    render(<Component />);

    const rows = screen.getAllByTestId('release-run-row');
    expect(rows).toHaveLength(1);

    expect(screen.getByTestId('release-run-status').textContent).toBe(
      'success'
    );
    expect(screen.getByTestId('release-run-version').textContent).toBe(
      'v1.11.0'
    );
    expect(screen.getByTestId('release-run-sha').textContent).toBe('abc1234');
  });

  test('expanding a row reveals the 5 task entries', () => {
    queryData = { releaseRuns: [SAMPLE_RUN] };
    queryError = undefined;
    render(<Component />);

    const header = screen.getByTestId('release-run-row-header');
    fireEvent.click(header);

    expect(screen.getByTestId('release-run-body')).toBeTruthy();
    const tasks = screen.getAllByTestId('release-run-task');
    expect(tasks).toHaveLength(5);
    expect(tasks[0].textContent).toContain('build');
    expect(tasks[0].textContent).toContain('Build Linux amd64 image');
    expect(tasks[4].textContent).toContain('document');
  });

  test('expanded row exposes evidence links for GitHub and deploy URL', () => {
    queryData = { releaseRuns: [SAMPLE_RUN] };
    queryError = undefined;
    render(<Component />);

    fireEvent.click(screen.getByTestId('release-run-row-header'));

    const ghLink = screen.getByTestId(
      'release-run-evidence-github'
    ) as HTMLAnchorElement;
    expect(ghLink.href).toContain(
      'github.com/example/example/actions/runs/12345'
    );

    const deployLink = screen.getByTestId(
      'release-run-evidence-deploy'
    ) as HTMLAnchorElement;
    expect(deployLink.href).toContain('manut.gogocash.co');
  });

  test('renders the empty state when there are no runs', () => {
    queryData = { releaseRuns: [] };
    queryError = undefined;
    render(<Component />);

    const empty = screen.getByTestId('release-runs-empty');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('No release runs yet');
    expect(empty.textContent).toContain('Trigger a build');
  });
});
