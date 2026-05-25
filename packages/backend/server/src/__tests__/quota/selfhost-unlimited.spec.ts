import test from 'ava';

import { AiBudgetService } from '../../core/quota/ai-budget.service';
import { QuotaService } from '../../core/quota/service';
import { DeploymentType } from '../../env';

const withDeploymentType = async (
  deploymentType: typeof env.DEPLOYMENT_TYPE,
  run: () => Promise<void>
) => {
  const previous = env.DEPLOYMENT_TYPE;
  try {
    // @ts-expect-error DEPLOYMENT_TYPE is readonly in production code.
    env.DEPLOYMENT_TYPE = deploymentType;
    await run();
  } finally {
    // @ts-expect-error DEPLOYMENT_TYPE is readonly in production code.
    env.DEPLOYMENT_TYPE = previous;
  }
};

test('ai budget > given selfhosted deployment > then does not throw over free cap', async t => {
  await withDeploymentType(DeploymentType.Selfhosted, async () => {
    const service = new AiBudgetService({
      mnAiBudgetUsage: {
        findUnique: async () => ({ spentCents: 500 }),
      },
    } as any);

    await t.notThrowsAsync(() => service.assertWithinCap('w1', 10_000));
  });
});

test('quota > given selfhosted deployment > then copilot action limit is unlimited', async t => {
  await withDeploymentType(DeploymentType.Selfhosted, async () => {
    const service = new QuotaService(
      {
        userFeature: {
          getQuota: async () => ({
            configs: {
              name: 'Pro',
              blobLimit: 1,
              businessBlobLimit: 1,
              storageQuota: 1,
              historyPeriod: 1,
              memberLimit: 1,
              copilotActionLimit: 10,
            },
          }),
          has: async () => false,
        },
      } as any,
      {} as any
    );

    const quota = await service.getUserQuota('u1');

    t.is(quota.copilotActionLimit, undefined);
    t.is(quota.storageQuota, Number.MAX_SAFE_INTEGER);
  });
});

test('workspace quota > given selfhosted deployment > then storage quota is practical unlimited', async t => {
  await withDeploymentType(DeploymentType.Selfhosted, async () => {
    const service = new QuotaService(
      {
        workspaceFeature: {
          getQuota: async () => ({
            configs: {
              name: 'Team Workspace',
              blobLimit: 1,
              storageQuota: 1,
              historyPeriod: 1,
              memberLimit: 1,
            },
          }),
        },
        workspace: {
          get: async () => ({ plan: null }),
        },
      } as any,
      {} as any
    );

    const quota = await service.getWorkspaceQuota('w1');

    t.is(quota.storageQuota, Number.MAX_SAFE_INTEGER);
  });
});
