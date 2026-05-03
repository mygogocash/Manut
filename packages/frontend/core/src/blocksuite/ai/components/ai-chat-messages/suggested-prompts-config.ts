import {
  CalendarPanelIcon,
  EditIcon,
  ImageIcon,
  LanguageIcon,
  MapPanelIcon,
  MindmapIcon,
  PenIcon,
  SendIcon,
} from '@blocksuite/icons/lit';
import type { TemplateResult } from 'lit';

export interface SuggestedPrompt {
  icon: TemplateResult;
  text: string;
}

// Defaults shown on the empty-state of the AI chat panel. Click fills the
// chat input (does not auto-submit), matching Notion's pattern. Hardcoded
// for v1 — workspace-level customization can be added later.
export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { icon: CalendarPanelIcon(), text: 'Schedule time with teammates' },
  { icon: EditIcon(), text: 'Write a meeting agenda' },
  { icon: ImageIcon(), text: 'Analyze PDFs or images' },
  { icon: MapPanelIcon(), text: 'Draft a project roadmap' },
  { icon: MindmapIcon(), text: 'Summarize my recent docs' },
  { icon: PenIcon(), text: 'Write a weekly team update' },
  { icon: SendIcon(), text: 'Generate action items from notes' },
  { icon: LanguageIcon(), text: 'Translate and explain an article' },
];
