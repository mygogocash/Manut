import { Logger } from '@nestjs/common';
import { z } from 'zod';

import { toolError } from './error';
import { defineTool } from './tool';
import type { CopilotProviderFactory, PromptService } from './types';

const logger = new Logger('DataViewAutofillColumnTool');

/**
 * β-AI-5: Copilot tool that generates a suggested cell value for an empty
 * column in a data-view table row, using the sibling cells as context.
 */
export const createDataViewAutofillColumnTool = (
  promptService: PromptService,
  factory: CopilotProviderFactory
) => {
  return defineTool({
    description: `
Suggest a value for an empty cell in a data-view table row.
Given the other cell values in the same row and an optional instruction,
the tool returns a concise suggested value for the target column.

The returned \`suggestedValue\` is a plain string that the caller writes
into the cell via the data-view property API.
    `.trim(),
    inputSchema: z.object({
      rowId: z
        .string()
        .describe('The unique identifier of the row being filled.'),
      propertyId: z
        .string()
        .describe(
          'The unique identifier of the property (column) to generate a value for.'
        ),
      propertyName: z
        .string()
        .describe('The human-readable column name, e.g. "Status" or "Tags".'),
      instruction: z
        .string()
        .optional()
        .describe(
          'Optional user instruction that guides what value to generate, ' +
            'e.g. "Use a single word". When omitted the model uses best judgment.'
        ),
      otherCells: z
        .record(z.string(), z.string())
        .describe(
          'A map of columnName → stringified value for the other cells in the ' +
            'same row, used as context. Empty-string values indicate empty cells.'
        ),
    }),
    execute: async ({ propertyName, instruction, otherCells }) => {
      try {
        // Reuse the "Write an article about this" prompt only to borrow its
        // model ID.  We override the messages entirely below.
        const prompt = await promptService.get('Write an article about this');
        if (!prompt) {
          return toolError(
            'DataView Autofill Failed',
            'Required prompt configuration is not available.'
          );
        }

        const provider = await factory.getProviderByModel(prompt.model);
        if (!provider) {
          return toolError(
            'DataView Autofill Failed',
            'AI provider is not available for the configured model.'
          );
        }

        const contextLines = Object.entries(otherCells)
          .filter(([, v]) => v.trim() !== '')
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n');

        const systemMessage =
          'You are a data-entry assistant. ' +
          'Reply with a single concise value for the requested cell. ' +
          'Do NOT include any explanation, labels, or extra punctuation — ' +
          'output only the value itself.';

        const userMessage =
          `Row context (other cells in the same row):\n` +
          `${contextLines || '(no other cell values available)'}\n\n` +
          `Generate a suitable value for the column: "${propertyName}".` +
          (instruction ? `\n\nAdditional instruction: ${instruction}` : '');

        const result = await provider.text({ modelId: prompt.model }, [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ]);

        return { suggestedValue: result?.trim() ?? '' };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown error occurred';
        logger.error('DataView autofill column failed', err);
        return toolError('DataView Autofill Failed', message);
      }
    },
  });
};
