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
  { icon: MindmapIcon(), text: 'Summarize docs and save the result' },
  { icon: PenIcon(), text: 'Create a proposal from notes' },
  { icon: SendIcon(), text: 'Extract tasks and owners from this doc' },
  { icon: MapPanelIcon(), text: 'Research this question with sources' },
  { icon: EditIcon(), text: 'Draft a weekly update with next steps' },
  { icon: CalendarPanelIcon(), text: 'Plan this task and show blockers' },
  { icon: ImageIcon(), text: 'Analyze PDFs or images' },
  { icon: LanguageIcon(), text: 'Translate and explain an article' },
];
