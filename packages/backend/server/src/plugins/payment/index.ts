import './config';

import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { FeatureModule } from '../../core/features';
import { MailModule } from '../../core/mail';
import { PermissionModule } from '../../core/permission';
import { QuotaModule } from '../../core/quota';
import { UserModule } from '../../core/user';
import { WorkspaceModule } from '../../core/workspaces';
import { StripeWebhookController } from './controller';
import { SubscriptionCronJobs } from './cron';
import { PaymentEventHandlers } from './event';
import { LicenseController } from './license/controller';
import {
  SelfhostTeamSubscriptionManager,
  UserSubscriptionManager,
  WorkspaceSubscriptionManager,
} from './manager';
import { ManutProCheckoutResolver } from './manut-pro-checkout.resolver';
import { ManutProWebhook } from './manut-pro-webhook';
import {
  SubscriptionResolver,
  UserSubscriptionResolver,
  WorkspaceSubscriptionResolver,
} from './resolver';
import {
  RevenueCatService,
  RevenueCatWebhookController,
  RevenueCatWebhookHandler,
} from './revenuecat';
import { SubscriptionService } from './service';
import { StripeFactory, StripeProvider } from './stripe';
import { StripeWebhook } from './webhook';

@Module({
  imports: [
    FeatureModule,
    QuotaModule,
    UserModule,
    PermissionModule,
    WorkspaceModule,
    MailModule,
    ServerConfigModule,
  ],
  providers: [
    StripeFactory,
    StripeProvider,
    RevenueCatService,
    SubscriptionService,
    SubscriptionResolver,
    UserSubscriptionResolver,
    StripeWebhook,
    RevenueCatWebhookHandler,
    UserSubscriptionManager,
    WorkspaceSubscriptionManager,
    SelfhostTeamSubscriptionManager,
    SubscriptionCronJobs,
    WorkspaceSubscriptionResolver,
    PaymentEventHandlers,
    // Manut Pro tier (E3.3 / M3 — decision #19). Sits alongside the
    // existing AFFiNE subscription surface but uses a separate config
    // namespace, mutation, and webhook handler so the two flows don't
    // share price IDs, success URLs, or plan-flip logic.
    ManutProCheckoutResolver,
    ManutProWebhook,
  ],
  controllers: [
    StripeWebhookController,
    LicenseController,
    RevenueCatWebhookController,
  ],
})
export class PaymentModule {}
