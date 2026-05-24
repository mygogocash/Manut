import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import test from 'ava';

import { AccessController } from '../../core/permission';
import { Models } from '../../models';
import { AuthorizedRetrievalFilterService } from '../../plugins/copilot/security';

test('AuthorizedRetrievalFilterService > given NestJS injection tokens > then resolves readable docs', async t => {
  const ac = {
    user: () => ({
      workspace: () => ({
        docs: async (docs: Array<{ docId: string }>) => docs,
      }),
    }),
  };
  const models = {};

  const module = await Test.createTestingModule({
    providers: [
      AuthorizedRetrievalFilterService,
      { provide: AccessController, useValue: ac },
      { provide: Models, useValue: models },
    ],
  }).compile();
  const service = module.get(AuthorizedRetrievalFilterService);

  const readableDocIds = await service.resolveReadableDocIds({
    userId: 'user-1',
    workspaceId: 'workspace-1',
    candidateDocIds: ['doc-1'],
  });

  t.deepEqual(readableDocIds, ['doc-1']);

  await module.close();
});
