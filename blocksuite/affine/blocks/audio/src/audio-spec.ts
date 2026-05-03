import {
  type StoreExtensionContext,
  StoreExtensionProvider,
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine-ext-loader';
import {
  AudioBlockSchema,
  AudioBlockSchemaExtension,
} from '@blocksuite/affine-model';
import { SlashMenuConfigExtension } from '@blocksuite/affine-widget-slash-menu';
import { BlockViewExtension, FlavourExtension } from '@blocksuite/std';
import { literal } from 'lit/static-html.js';

import { effects } from './effects.js';
import { audioSlashMenuConfig } from './slash-menu.js';

const flavour = AudioBlockSchema.model.flavour;

export class AudioStoreExtension extends StoreExtensionProvider {
  override name = 'affine-audio-block';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(AudioBlockSchemaExtension);
  }
}

export class AudioViewExtension extends ViewExtensionProvider {
  override name = 'affine-audio-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      FlavourExtension(flavour),
      BlockViewExtension(flavour, () => literal`affine-audio`),
      SlashMenuConfigExtension(flavour, audioSlashMenuConfig),
    ]);
  }
}

/** Convenience flat array for use with BlockSuite spec arrays */
export const AudioBlockSpec = [AudioStoreExtension, AudioViewExtension];
