/** Park-then-write reorder for @unique sortOrder columns (investor types, pipeline stages, fundraising entities). */
export const ORDER_PARK_OFFSET = 10_000;

export function planSortOrderCompaction(keys: string[]): Array<{ key: string; sortOrder: number }> {
  return keys.map((key, i) => ({ key, sortOrder: i + 1 }));
}

export function planSortOrderPark(keys: string[]): Array<{ key: string; sortOrder: number }> {
  return keys.map((key, i) => ({ key, sortOrder: ORDER_PARK_OFFSET + i }));
}
