import { Text } from '@blocksuite/affine/store';
import type { Workspace } from '@blocksuite/affine/store';

import type { DocsService } from '../doc';

const WELCOME_DOC_TITLE = 'Getting started with GoGoCash AFFiNE';

interface SeedSection {
  heading: string;
  paragraphs: string[];
  /**
   * Optional extra block to insert after the paragraphs in this section.
   */
  extraFlavour?: 'affine:database';
}

const WELCOME_SECTIONS: SeedSection[] = [
  {
    heading: 'Welcome',
    paragraphs: [
      'Welcome to GoGoCash AFFiNE - your all-in-one workspace for docs, tasks, whiteboards, and AI.',
      'This document is a quick tour. Edit it freely, or delete it when you are ready.',
    ],
  },
  {
    heading: 'Try the database',
    paragraphs: [
      'Databases turn a list of items into a structured table you can sort, filter, and group.',
      'A starter database has been added below. Add a row, switch to the kanban view, or type "/" to insert another one anywhere in your docs.',
    ],
    extraFlavour: 'affine:database',
  },
  {
    heading: 'Try AI chat',
    paragraphs: [
      'Open the Intelligence button (bottom-right) to chat with the AI about anything in this workspace.',
      'Tips: ask "Summarise this doc", "Draft a follow-up email from these notes", or "What did I write about X last week?".',
      'Type "/" inside any block for inline AI actions, or use the journal sidebar entry to write a daily entry the AI can reason over.',
    ],
  },
  {
    heading: 'Invite your team',
    paragraphs: [
      'Workspaces are better with collaborators. Open Settings -> Members to invite your teammates by email.',
      'You can grant Read, Comment, or Edit access per person, and revoke at any time.',
    ],
  },
];

/**
 * Detects whether a workspace is "fresh" - i.e. has no user-visible docs yet.
 * Used to decide whether to seed the welcome doc.
 */
export function workspaceIsEmpty(docCollection: Workspace): boolean {
  return docCollection.meta.docMetas.length === 0;
}

/**
 * Creates the welcome / getting-started doc with section headings and primer
 * blocks. Returns the new doc id, or null if the workspace already has docs.
 */
export function seedWelcomeDoc(
  docCollection: Workspace,
  docsService: DocsService
): string | null {
  if (!workspaceIsEmpty(docCollection)) {
    return null;
  }

  const docRecord = docsService.createDoc({
    title: WELCOME_DOC_TITLE,
    docProps: {
      page: { title: new Text(WELCOME_DOC_TITLE) },
      onStoreLoad: (loadedStore, { noteId }) => {
        // initDocFromProps already created one empty paragraph in the note;
        // append our content after it.
        for (const section of WELCOME_SECTIONS) {
          loadedStore.addBlock(
            'affine:paragraph',
            {
              type: 'h2',
              text: new Text(section.heading),
            },
            noteId
          );
          for (const paragraph of section.paragraphs) {
            loadedStore.addBlock(
              'affine:paragraph',
              {
                type: 'text',
                text: new Text(paragraph),
              },
              noteId
            );
          }
          if (section.extraFlavour === 'affine:database') {
            try {
              loadedStore.addBlock('affine:database' as never, {}, noteId);
            } catch {
              // database block may not be registered in some build configs;
              // fall back to a hint paragraph.
              loadedStore.addBlock(
                'affine:paragraph',
                {
                  type: 'text',
                  text: new Text(
                    '(Type "/database" to insert a database here.)'
                  ),
                },
                noteId
              );
            }
          }
        }
      },
    },
  });

  return docRecord.id;
}

export const FIRST_RUN_WELCOME_DOC_TITLE = WELCOME_DOC_TITLE;
