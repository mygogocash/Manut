import { BlockModel, BlockSchemaExtension, defineBlockSchema } from '@blocksuite/store';

export type AudioBlockProps = {
  /**
   * Blob storage key — set after recording is saved.
   * `undefined` while recording is in progress.
   */
  sourceId?: string;
  /** Duration in milliseconds */
  duration?: number;
  /** MIME type, e.g. "audio/webm" */
  mimeType: string;
  /**
   * Auto-generated transcript text from the backend copilot job.
   * `undefined` until the backend transcription job completes.
   */
  transcript?: string;
  /** Copilot transcription job id – used to poll for results */
  transcriptionJobId?: string;
  caption?: string;
};

const defaultAudioProps: AudioBlockProps = {
  sourceId: undefined,
  duration: undefined,
  mimeType: 'audio/webm',
  transcript: undefined,
  transcriptionJobId: undefined,
  caption: undefined,
};

export const AudioBlockSchema = defineBlockSchema({
  flavour: 'affine:audio',
  props: (): AudioBlockProps => defaultAudioProps,
  metadata: {
    version: 1,
    role: 'content',
    parent: [
      'affine:note',
      'affine:edgeless-text',
      'affine:paragraph',
      'affine:list',
    ],
    children: [],
  },
  toModel: () => new AudioBlockModel(),
});

export const AudioBlockSchemaExtension = BlockSchemaExtension(AudioBlockSchema);

export class AudioBlockModel extends BlockModel<AudioBlockProps> {}
