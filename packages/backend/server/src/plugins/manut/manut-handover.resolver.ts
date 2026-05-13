import { NotFoundException } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { AuthenticationRequired } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  ImportSuperflowHandoverInput,
  ImportSuperflowHandoverResult,
} from './manut.dto';
import { SuperflowHandoverService } from './manut-handover.service';

@Resolver()
export class SuperflowHandoverResolver {
  constructor(
    private readonly handover: SuperflowHandoverService,
    private readonly ac: AccessController
  ) {}

  @Mutation(() => ImportSuperflowHandoverResult, {
    description:
      'Import a Superflow release handover JSON payload into a workspace doc.',
  })
  async importSuperflowHandover(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => ImportSuperflowHandoverInput })
    input: ImportSuperflowHandoverInput
  ): Promise<ImportSuperflowHandoverResult> {
    if (!user) {
      throw new AuthenticationRequired();
    }

    if (input.targetDocId) {
      const canUpdate = await this.ac
        .user(user.id)
        .workspace(workspaceId)
        .doc(input.targetDocId)
        .can('Doc.Update');

      if (!canUpdate) {
        throw new NotFoundException('Document not found');
      }
    } else {
      await this.ac
        .user(user.id)
        .workspace(workspaceId)
        .assert('Workspace.CreateDoc');
    }

    return this.handover.importHandover(
      workspaceId,
      user.id,
      input.handoverJson,
      input.targetDocId
    );
  }
}
