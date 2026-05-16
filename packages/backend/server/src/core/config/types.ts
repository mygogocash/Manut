import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

import { DeploymentType } from '../../env';

export enum ServerFeature {
  Captcha = 'captcha',
  Copilot = 'copilot',
  CopilotEmbedding = 'copilot_embedding',
  Payment = 'payment',
  OAuth = 'oauth',
  Indexer = 'indexer',
  Comment = 'comment',
  LocalWorkspace = 'local_workspace',
  // Manut PM + CRM + Reminders modules are gated by
  // `ENABLE_MANUT_MODULE=true` (legacy `ENABLE_SUPERFLOW_MODULE` is also
  // honored for BC). The frontend reads this flag from
  // `ServerService.server.features` to decide whether to surface the
  // Projects / CRM / Reminders nav entries and pages.
  //
  // The enum identifier `Manut` and string value 'manut' replaced the
  // historical `Superflow` / 'superflow' in the v1.12.1 rename pass.
  // This is a coordinated FE+BE change: the bundled frontend updated
  // in the same image looks for `ServerFeature.Manut` so the contract
  // stays whole on every deploy.
  Manut = 'manut',
}

registerEnumType(ServerFeature, {
  name: 'ServerFeature',
});

registerEnumType(DeploymentType, {
  name: 'ServerDeploymentType',
});

@ObjectType()
export class ServerConfigType {
  @Field({
    description:
      'server identical name could be shown as badge on user interface',
  })
  name!: string;

  @Field({ description: 'server version' })
  version!: string;

  @Field({ description: 'server base url' })
  baseUrl!: string;

  @Field(() => DeploymentType, { description: 'server type' })
  type!: DeploymentType;

  @Field(() => [ServerFeature], { description: 'enabled server features' })
  features!: ServerFeature[];
}
