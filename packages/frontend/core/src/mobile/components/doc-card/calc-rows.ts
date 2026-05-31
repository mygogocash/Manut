/**
 * Deterministically derive a row count from a doc id, used to give masonry
 * cards a stable-but-varied preview height. `max` is INCLUSIVE — the span is
 * `max - min + 1` distinct values, so an id can map to `max` itself.
 *
 * The previous `% (max - min)` form had an off-by-one: with min=2, max=8 it
 * could only return [2, 7], never 8.
 */
export const calcRowsById = (id: string, min = 2, max = 8): number => {
  const code = id.charCodeAt(0);
  const span = max - min + 1;
  return Math.floor((code % span) + min);
};
