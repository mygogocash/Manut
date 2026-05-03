/**
 * β-AI-11: Auto-transcribe audio blobs saved by the affine:audio block.
 *
 * When the frontend saves an audio recording to blob storage
 * (`workspace.blob.sync` event), this service:
 *   1. Checks if the blob MIME type is an audio type.
 *   2. Enqueues a transcription job via the existing CopilotTranscriptionService.
 *   3. After the job succeeds, emits `copilot.audio.transcribed` so the
 *      frontend can poll / be notified.
 *
 * Note: Direct doc/CRDT mutation from the backend is non-trivial.
 * The result is therefore stored on the job record (queryable via the
 * existing `audioTranscription` GraphQL field with `blobId`) and the
 * frontend AudioBlockComponent can poll for it by blobId and then write
 * the `transcript` prop onto the model itself.
 */

import { Readable } from 'node:stream';

import { Injectable, Logger } from '@nestjs/common';

import {
  Config,
  EventBus,
  JobQueue,
  OnEvent,
  OnJob,
  type StorageProvider,
  StorageProviderFactory,
} from '../../base';
import { Models } from '../../models';
import { CopilotTranscriptionService } from './transcript';

/** MIME type prefixes considered "audio" */
const AUDIO_MIME_PREFIX = 'audio/';

/**
 * Extend the global job/event registry with the auto-transcription types.
 */
declare global {
  interface Jobs {
    'copilot.audio.autoTranscribe': {
      workspaceId: string;
      blobKey: string;
      mimeType: string;
      /** The user id that originally uploaded the blob. */
      userId: string;
    };
  }
  interface Events {
    'copilot.audio.transcribed': {
      workspaceId: string;
      blobKey: string;
      jobId: string;
    };
  }
}

@Injectable()
export class AudioAutoTranscriptionService {
  private readonly logger = new Logger(AudioAutoTranscriptionService.name);

  private blobProvider!: StorageProvider;

  constructor(
    private readonly affineConfig: Config,
    private readonly storageFactory: StorageProviderFactory,
    private readonly event: EventBus,
    private readonly jobs: JobQueue,
    private readonly models: Models,
    private readonly transcriptionService: CopilotTranscriptionService
  ) {}

  private get blobStorageConfig() {
    return this.affineConfig.storages.blob;
  }

  @OnEvent('config.init')
  async onConfigInit() {
    this.blobProvider = this.storageFactory.create(
      this.blobStorageConfig.storage
    );
  }

  @OnEvent('config.changed')
  async onConfigChanged(event: Events['config.changed']) {
    if (event.updates?.storages?.blob?.storage) {
      this.blobProvider = this.storageFactory.create(
        this.blobStorageConfig.storage
      );
    }
  }

  /**
   * React to every blob being stored.
   *
   * We look up the blob's MIME type from the database; if it is an audio
   * blob we enqueue an auto-transcription job.
   */
  @OnEvent('workspace.blob.sync')
  async onBlobSynced({
    workspaceId,
    key,
  }: Events['workspace.blob.sync']): Promise<void> {
    try {
      // Fetch blob metadata from the DB (already upserted by WorkspaceBlobStorage)
      const blobMeta = await this.models.blob.get(workspaceId, key);
      if (!blobMeta) return;

      if (!blobMeta.mime?.startsWith(AUDIO_MIME_PREFIX)) return;

      // The workspace owner acts as the "requester" for the auto-transcription
      // job. The Workspace row has no owner column; ownership lives in the
      // WorkspaceUserRole table and is resolved via WorkspaceUserModel.
      // getOwner returns the public user shape ({id, name, email, avatarUrl}).
      let userId: string;
      try {
        const owner = await this.models.workspaceUser.getOwner(workspaceId);
        userId = owner.id;
      } catch {
        // Workspace has no owner (orphaned or just-deleted). Nothing to do.
        return;
      }

      // Check whether a job already exists for this blob to avoid duplicates.
      const existing = await this.models.copilotJob.has(
        userId,
        workspaceId,
        key
      );
      if (existing) return;

      this.logger.log(
        `Scheduling auto-transcription for audio blob ${key} in workspace ${workspaceId}`
      );

      await this.jobs.add('copilot.audio.autoTranscribe', {
        workspaceId,
        blobKey: key,
        mimeType: blobMeta.mime,
        userId,
      });
    } catch (err) {
      // Never propagate — we must not break the blob-sync event chain.
      this.logger.error('Failed to schedule audio auto-transcription', err);
    }
  }

  /**
   * Job handler: download the audio blob and submit it to the
   * CopilotTranscriptionService.
   */
  @OnJob('copilot.audio.autoTranscribe')
  async autoTranscribeAudio(
    params: Jobs['copilot.audio.autoTranscribe']
  ): Promise<void> {
    const { workspaceId, blobKey, mimeType, userId } = params;

    try {
      // Retrieve the raw audio buffer from blob storage.
      const object = await this.blobProvider.get(`${workspaceId}/${blobKey}`);
      if (!object.body) {
        this.logger.warn(
          `Audio blob ${blobKey} not found in storage, skipping transcription`
        );
        return;
      }

      // Collect all chunks into a Buffer.
      const chunks: Buffer[] = [];
      for await (const chunk of object.body) {
        chunks.push(chunk as Buffer);
      }
      const buffer = Buffer.concat(chunks);

      // Build a minimal FileUpload-compatible object.
      const fileUpload = {
        filename: blobKey,
        mimetype: mimeType,
        encoding: 'binary',
        createReadStream: () => {
          return Readable.from(buffer);
        },
      };

      // Delegate to the existing transcription service.
      const job = await this.transcriptionService.submitJob(
        userId,
        workspaceId,
        blobKey,
        [fileUpload as any],
        { sourceAudio: { mimeType } }
      );

      this.logger.log(
        `Auto-transcription job ${job.id} submitted for blob ${blobKey}`
      );

      this.event.emit('copilot.audio.transcribed', {
        workspaceId,
        blobKey,
        jobId: job.id,
      });
    } catch (err) {
      this.logger.error(
        `Auto-transcription failed for blob ${blobKey}: ${String(err)}`
      );
    }
  }
}
