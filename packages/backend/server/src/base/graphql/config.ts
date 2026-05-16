import { ApolloDriverConfig } from '@nestjs/apollo';

import { NodeEnv } from '../../env';
import { defineModuleConfig } from '../config';

declare global {
  interface AppConfigSchema {
    graphql: {
      apolloDriverConfig: ConfigItem<ApolloDriverConfig>;
    };
  }
}

defineModuleConfig('graphql', {
  apolloDriverConfig: {
    desc: 'The config for underlying nestjs GraphQL and apollo driver engine.',
    default: {
      // @TODO(@forehalo): need a flag to tell user `Restart Required` configs
      // Pentest C3: gate introspection to development env only (matches graphiql pattern in index.ts)
      introspection: env.NODE_ENV === NodeEnv.Development,
    },
    link: 'https://docs.nestjs.com/graphql/quick-start',
  },
});
