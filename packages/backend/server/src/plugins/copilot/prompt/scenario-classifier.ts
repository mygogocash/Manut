import { Injectable } from '@nestjs/common';

import type { PromptAttachment } from '../providers/types';
import type { Scenario } from './prompts';

export type ScenarioKey = keyof typeof Scenario;

export interface ClassifyInput {
  content: string;
  attachments?: PromptAttachment[] | null;
}

const CODE_KEYWORDS: readonly string[] = [
  'function',
  'class ',
  'def ',
  'import ',
  'typescript',
  'python',
  'sql',
  '```',
  'fix bug',
  'refactor',
];

const IMAGE_EDIT_KEYWORDS: readonly string[] = [
  'edit',
  'style',
  'convert',
  'transform',
  'remove',
  'upscale',
  'generate image',
];

const SUMMARIZE_KEYWORDS: readonly string[] = [
  'summarize',
  'summary',
  'explain',
  'translate',
  'rephrase',
];

const COMPLEX_KEYWORDS: readonly string[] = [
  'outline',
  'brainstorm',
  'presentation',
  'plan',
  'draft',
];

function attachmentMimeType(a: PromptAttachment): string {
  if (typeof a === 'string') return '';
  if ('attachment' in a && typeof (a as { mimeType?: string }).mimeType === 'string') {
    return (a as { mimeType: string }).mimeType;
  }
  if ('mimeType' in a && typeof (a as { mimeType?: string }).mimeType === 'string') {
    return (a as { mimeType: string }).mimeType;
  }
  return '';
}

function hasAudioAttachment(attachments: PromptAttachment[]): boolean {
  return attachments.some(a => attachmentMimeType(a).startsWith('audio/'));
}

function hasImageAttachment(attachments: PromptAttachment[]): boolean {
  return attachments.some(a => {
    if (typeof a === 'string') return true;
    return attachmentMimeType(a).startsWith('image/');
  });
}

function containsAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some(kw => text.includes(kw));
}

/**
 * Heuristic v1 scenario classifier — no LLM call.
 *
 * Maps a user prompt + attachments to one of the configured scenarios so the
 * "Auto" model entry in the chat dropdown can dispatch to the right
 * scenario-mapped model. Rules evaluated in strict priority order:
 *
 *   1. Audio attachment → audio_transcribing
 *   2. Image attachment + image-edit keyword → image
 *   3. Code keywords → coding
 *   4. < 80 chars → quick_decision_making
 *   5. 80–300 chars + summarize/explain/translate keyword → polish_and_summarize
 *   6. > 300 chars + outline/brainstorm/presentation keyword → complex_text_generation
 *   7. 80–300 chars otherwise → quick_text_generation
 *   8. Default → chat
 *
 * If a future v2 wants better accuracy, run a Gemini-Flash classifier when
 * the heuristics produce a low-confidence result. For now the rules are
 * deterministic and zero-latency.
 */
@Injectable()
export class ScenarioClassifier {
  classify(input: ClassifyInput): ScenarioKey {
    const text = (input.content ?? '').toLowerCase();
    const len = (input.content ?? '').length;
    const atts = input.attachments ?? [];

    if (atts.length > 0 && hasAudioAttachment(atts)) {
      return 'audio_transcribing';
    }

    if (
      atts.length > 0 &&
      hasImageAttachment(atts) &&
      containsAny(text, IMAGE_EDIT_KEYWORDS)
    ) {
      return 'image';
    }

    if (containsAny(text, CODE_KEYWORDS)) {
      return 'coding';
    }

    if (len < 80) {
      return 'quick_decision_making';
    }

    if (len <= 300 && containsAny(text, SUMMARIZE_KEYWORDS)) {
      return 'polish_and_summarize';
    }

    if (len > 300 && containsAny(text, COMPLEX_KEYWORDS)) {
      return 'complex_text_generation';
    }

    if (len <= 300) {
      return 'quick_text_generation';
    }

    return 'chat';
  }
}
