import { NotFoundException } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { AuthenticationRequired } from '../../base';
import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import {
  ImportMnHandoverInput,
  ImportMnHandoverResult,
} from './manut.dto';
import { MnHandoverService } from './manut-handover.service';

@Resolver()
export class MnHandoverResolver {
  constructor(
    private readonly handover: MnHandoverService,
    private readonly ac: AccessController
  ) {}

  @Mutation(() => ImportMnHandoverResult, {
    description:
      'Import a Manut release handover JSON payload into a workspace doc.',
  })
  async importMnHandover(
    @CurrentUser() user: CurrentUser | null,
    @Args('workspaceId', { type: () => String }) workspaceId: string,
    @Args('input', { type: () => ImportMnHandoverInput })
    input: ImportMnHandoverInput
  ): Promise<ImportMnHandoverResult> {
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
