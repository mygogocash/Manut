import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import z from 'zod';

import { BaseModel } from './base';

export const UserSettingsSchema = z.object({
  receiveInvitationEmail: z.boolean().default(true),
  receiveMentionEmail: z.boolean().default(true),
  receiveCommentEmail: z.boolean().default(true),
  personalize: z.string().max(4000).default(''),
});

export type UserSettingsInput = z.input<typeof UserSettingsSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;

/**
 * UserSettings Model
 */
@Injectable()
export class UserSettingsModel extends BaseModel {
  @Transactional()
  async set(userId: string, setting: UserSettingsInput) {
    const existsSetting = await this.get(userId);
    const payload = UserSettingsSchema.parse({
      ...existsSetting,
      ...setting,
    });
    await this.db.userSettings.upsert({
      where: {
        userId,
      },
      update: {
        payload,
      },
      create: {
        userId,
        payload,
      },
    });
    this.logger.debug(`UserSettings updated for user ${userId}`);
    return payload;
  }

  async get(userId: string): Promise<UserSettings> {
    const row = await this.db.userSettings.findUnique({
      where: {
        userId,
      },
    });
    // Defensive parse: if a row has a legacy/corrupted payload that no
    // longer satisfies the schema (e.g. older deploys before `personalize`
    // was added wrote `null` for a field that's now non-nullable), fall
    // back to defaults so the Settings → Notifications panel stays
    // usable instead of throwing INTERNAL_SERVER_ERROR. The schema has
    // `.default(...)` on every field, so an empty object always parses.
    const result = UserSettingsSchema.safeParse(row?.payload ?? {});
    if (result.success) {
      return result.data;
    }
    this.logger.warn(
      `UserSettings payload for ${userId} failed schema parse, returning defaults: ${result.error.message}`
    );
    return UserSettingsSchema.parse({});
  }
}
