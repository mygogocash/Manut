import { describe, expect, test } from 'vitest';

import type { WorkspaceMetadata } from '../metadata';
import {
  buildWorkspacePath,
  resolveWorkspaceMetadataByKey,
  slugifyWorkspaceName,
} from '../paths';

const workspaces: WorkspaceMetadata[] = [
  {
    id: '56c40ff9-9b0b-49ec-ad88-54ed60cd873d',
    flavour: 'affine-cloud',
    slug: 'gogocash',
  },
];

describe('workspace paths', () => {
  test('slugifyWorkspaceName', () => {
    expect(slugifyWorkspaceName('GoGoCash')).toBe('gogocash');
  });

  test('resolveWorkspaceMetadataByKey accepts id or slug', () => {
    expect(resolveWorkspaceMetadataByKey('gogocash', workspaces)?.id).toBe(
      '56c40ff9-9b0b-49ec-ad88-54ed60cd873d'
    );
    expect(
      resolveWorkspaceMetadataByKey(
        '56c40ff9-9b0b-49ec-ad88-54ed60cd873d',
        workspaces
      )?.slug
    ).toBe('gogocash');
  });

  test('buildWorkspacePath prefers slug', () => {
    expect(
      buildWorkspacePath(
        '56c40ff9-9b0b-49ec-ad88-54ed60cd873d',
        workspaces,
        '/all'
      )
    ).toBe('/workspace/gogocash/all');
  });
});
