/**
 * AI Autofill utilities for the table view (β-AI-6 and β-AI-7).
 *
 * This module contains pure helper functions for building the cell-context
 * payload and for coordinating parallel/batched AI fill requests. The actual
 * AI call is delegated to `DataViewRendererConfig.aiAutofill`, which is wired
 * by the host application (AFFiNE).
 */

import type { AiAutofillCallback } from '../../../core/data-view.js';
import type { Property } from '../../../core/view-manager/property.js';
import type { TableSingleView } from '../table-view-manager.js';

/** Maximum number of concurrent AI requests when bulk-filling a column. */
const MAX_CONCURRENT = 10;

/**
 * Build the `otherCells` context map for a given row: a record of
 * columnName → stringified cell value for all *non-empty* cells in the row,
 * excluding the target property.
 */
function buildOtherCells(
  view: TableSingleView,
  rowId: string,
  targetPropertyId: string
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const property of view.properties$.value) {
    if (property.id === targetPropertyId) continue;
    const value = property.stringValueGet(rowId);
    if (value != null && value.trim() !== '') {
      result[property.name$.value] = value;
    }
  }
  return result;
}

/**
 * Return true when the given cell is considered "empty" (null / undefined / whitespace).
 */
function isCellEmpty(view: TableSingleView, rowId: string, propertyId: string) {
  const prop = view.propertiesRaw$.value.find(p => p.id === propertyId);
  if (!prop) return false;
  const val = prop.stringValueGet(rowId);
  return val == null || val.trim() === '';
}

/**
 * β-AI-6: Auto-fill all empty cells in a single row.
 *
 * @param view        - The table view manager.
 * @param rowId       - ID of the row to fill.
 * @param aiAutofill  - The AI callback from the config.
 * @param onProgress  - Optional callback called after each cell is filled.
 * @returns Count of cells that were successfully filled.
 */
export async function autofillRow(
  view: TableSingleView,
  rowId: string,
  aiAutofill: AiAutofillCallback,
  onProgress?: (filled: number, total: number) => void
): Promise<number> {
  const emptyProperties = view.properties$.value.filter(
    property =>
      !property.readonly$.value && isCellEmpty(view, rowId, property.id)
  );

  if (emptyProperties.length === 0) return 0;

  let filled = 0;
  for (const property of emptyProperties) {
    const otherCells = buildOtherCells(view, rowId, property.id);
    const suggestedValue = await aiAutofill({
      rowId,
      propertyId: property.id,
      propertyName: property.name$.value,
      otherCells,
    });
    if (suggestedValue != null && suggestedValue.trim() !== '') {
      property.valueSetFromString(rowId, suggestedValue.trim());
      filled++;
    }
    onProgress?.(filled, emptyProperties.length);
  }
  return filled;
}

/**
 * β-AI-7: Fill all empty cells in a given column across all rows, with
 * bounded concurrency.
 *
 * @param view        - The table view manager.
 * @param property    - The column property to fill.
 * @param aiAutofill  - The AI callback from the config.
 * @param onProgress  - Optional callback called after each cell is filled.
 * @returns Count of cells that were successfully filled.
 */
export async function autofillColumn(
  view: TableSingleView,
  property: Property,
  aiAutofill: AiAutofillCallback,
  onProgress?: (filled: number, total: number) => void
): Promise<number> {
  if (property.readonly$.value) return 0;

  const rowIds = view.rows$.value
    .map(row => row.rowId)
    .filter(rowId => isCellEmpty(view, rowId, property.id));

  if (rowIds.length === 0) return 0;

  let filled = 0;

  // Process in batches of MAX_CONCURRENT to avoid overwhelming the API.
  for (let i = 0; i < rowIds.length; i += MAX_CONCURRENT) {
    const batch = rowIds.slice(i, i + MAX_CONCURRENT);
    await Promise.all(
      batch.map(async rowId => {
        const otherCells = buildOtherCells(view, rowId, property.id);
        const suggestedValue = await aiAutofill({
          rowId,
          propertyId: property.id,
          propertyName: property.name$.value,
          otherCells,
        });
        if (suggestedValue != null && suggestedValue.trim() !== '') {
          property.valueSetFromString(rowId, suggestedValue.trim());
          filled++;
        }
        onProgress?.(filled, rowIds.length);
      })
    );
  }

  return filled;
}
