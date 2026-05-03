import { Logger } from '@nestjs/common';
import { z } from 'zod';

import { toolError } from './error';
import { defineTool } from './tool';
import type { CopilotProviderFactory, PromptService } from './types';

const logger = new Logger('DataViewFilterTool');

// ---------------------------------------------------------------------------
// Column descriptor (what the LLM receives to understand the view schema)
// ---------------------------------------------------------------------------

export type ColumnDescriptor = {
  /** Property / column id used as the filter ref name */
  id: string;
  /** Human-readable name */
  name: string;
  /** Blocksuite property type tag, e.g. "text", "number", "date", "checkbox" */
  type: string;
};

// ---------------------------------------------------------------------------
// FilterGroup type mirrors blocksuite/affine/data-view/src/core/filter/types.ts
// ---------------------------------------------------------------------------

export type SingleFilter = {
  type: 'filter';
  left: { type: 'ref'; name: string };
  function?: string;
  args: { type: 'literal'; value: unknown }[];
};

export type FilterGroup = {
  type: 'group';
  op: 'and' | 'or';
  conditions: Filter[];
};

export type Filter = SingleFilter | FilterGroup;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the prompt string that instructs the LLM to produce a FilterGroup JSON
 * object from natural language and the view's column schema.
 */
function buildFilterPrompt(
  columns: ColumnDescriptor[],
  naturalLanguage: string
): string {
  const columnDesc = columns
    .map(c => `  - id: "${c.id}", name: "${c.name}", type: "${c.type}"`)
    .join('\n');

  return `The database view has these columns:
${columnDesc}

Convert the following natural-language filter request into a JSON object that
matches this TypeScript type exactly:

type SingleFilter = {
  type: "filter";
  left: { type: "ref"; name: string }; // name = column id
  function?: string;  // e.g. "contains", "equals", "startsWith", "greaterThan", "lessThan", "isEmpty", "isNotEmpty"
  args: { type: "literal"; value: unknown }[];
};

type FilterGroup = {
  type: "group";
  op: "and" | "or";
  conditions: (SingleFilter | FilterGroup)[];
};

Rules:
- The top-level object must always be a FilterGroup.
- Use "and" by default unless the user explicitly says "or".
- Pick the most suitable filter function for each condition based on the column type.
- For text columns prefer "contains" or "equals".
- For number columns prefer "equals", "greaterThan", or "lessThan".
- For date columns prefer "equals", "greaterThan", or "lessThan".
- For checkbox columns use "equals" with a boolean value (true or false).
- If the request cannot be converted, return: {"type":"group","op":"and","conditions":[]}.

User request: ${naturalLanguage}`;
}

/**
 * Attempt to parse the LLM text response as a FilterGroup.
 * Falls back to an empty group on any parse or validation failure.
 */
function parseFilterGroupResponse(text: string): FilterGroup {
  const emptyGroup: FilterGroup = { type: 'group', op: 'and', conditions: [] };
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      (parsed as FilterGroup).type === 'group' &&
      Array.isArray((parsed as FilterGroup).conditions)
    ) {
      return parsed as FilterGroup;
    }
  } catch {
    // intentional: return empty group on any error
  }
  return emptyGroup;
}

// ---------------------------------------------------------------------------
// Tool factory — follows the same pattern as doc-compose.ts
// ---------------------------------------------------------------------------

/**
 * Create the `data_view_filter` copilot tool.
 *
 * The tool accepts a list of view columns and a natural-language filter
 * description, calls the LLM to translate it, and returns an AFFiNE
 * FilterGroup JSON object.
 *
 * @param promptService  Used to resolve the prompt template (falls back to a
 *                       built-in prompt if no named template is found).
 * @param factory        The provider factory used to obtain an LLM provider.
 */
export const createDataViewFilterTool = (
  promptService: PromptService,
  factory: CopilotProviderFactory
) => {
  return defineTool({
    description:
      'Convert a natural-language filter description into an AFFiNE data-view FilterGroup expression. ' +
      'Provide the view columns (id, name, type) and the user request; the tool returns a FilterGroup JSON ' +
      'that can be applied directly via view.filterTrait.filterSet(filterGroup).',
    inputSchema: z.object({
      columns: z
        .array(
          z.object({
            id: z.string().describe('Column/property ID used as the ref name'),
            name: z.string().describe('Human-readable column name'),
            type: z
              .string()
              .describe(
                'Column type tag, e.g. "text", "number", "date", "checkbox"'
              ),
          })
        )
        .describe('The list of columns available in the current view'),
      naturalLanguage: z
        .string()
        .describe(
          'Natural-language filter description, e.g. "status is Done and priority is High"'
        ),
    }),
    execute: async ({
      columns,
      naturalLanguage,
    }: {
      columns: ColumnDescriptor[];
      naturalLanguage: string;
    }) => {
      try {
        if (!naturalLanguage.trim()) {
          return toolError(
            'Data View Filter Failed',
            'naturalLanguage must not be empty.'
          );
        }
        if (!columns.length) {
          return toolError(
            'Data View Filter Failed',
            'columns array must not be empty.'
          );
        }

        // Borrow any available prompt to obtain the configured model ID.
        // The actual prompt messages are overridden below.
        const prompt = await promptService.get('Write an article about this');
        if (!prompt) {
          return toolError(
            'Data View Filter Failed',
            'Required prompt configuration is not available.'
          );
        }

        const provider = await factory.getProviderByModel(prompt.model);
        if (!provider) {
          return toolError(
            'Data View Filter Failed',
            'AI provider is not available for the configured model.'
          );
        }

        const userPrompt = buildFilterPrompt(columns, naturalLanguage);

        const responseText = await provider.text(
          { modelId: prompt.model },
          [
            {
              role: 'system',
              content:
                'You are a database filter assistant. ' +
                'Reply with ONLY a valid JSON object — no markdown fences, ' +
                'no explanation.',
            },
            { role: 'user', content: userPrompt },
          ]
        );

        const filterGroup = parseFilterGroupResponse(responseText);
        return filterGroup;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to generate data-view filter', err);
        return toolError('Data View Filter Failed', message);
      }
    },
  });
};
