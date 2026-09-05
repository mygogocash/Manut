/**
 * Rich-block primitives that ARIA can emit inline inside an assistant
 * reply. The model writes a fenced code block whose language is the
 * block kind (e.g. ```aria-checklist) and the body is a JSON payload
 * matching the corresponding shape below.
 *
 * Examples (model output):
 *
 *   ```aria-checklist
 *   {
 *     "title": "Pre-flight checklist",
 *     "items": [
 *       { "label": "Visa expiry >= 90 days", "checked": true },
 *       { "label": "Itinerary booked", "checked": false },
 *       { "label": "Expense approver notified" }
 *     ]
 *   }
 *   ```
 *
 *   ```aria-kpi-tiles
 *   {
 *     "tiles": [
 *       { "label": "Booked time", "value": "11.6h" },
 *       { "label": "Events", "value": "16" },
 *       { "label": "Busiest day", "value": "Mon, 3h" }
 *     ]
 *   }
 *   ```
 *
 *   ```aria-actions
 *   {
 *     "actions": [
 *       { "label": "Rethink daily Mgmt mtg", "prompt": "Help me cut the daily management meeting from 5 to 3 days a week" },
 *       { "label": "Fix Tue conflict", "prompt": "Resolve the Tuesday 10:30 Mgmt vs OS catch-up overlap" }
 *     ]
 *   }
 *   ```
 *
 * All renderers are defensive: a malformed payload renders the raw
 * code block instead of crashing the bubble.
 */

export interface ChecklistItem {
  label: string;
  checked?: boolean;
}

export interface ChecklistPayload {
  title?: string;
  items: ChecklistItem[];
}

export interface KpiTile {
  label: string;
  value: string;
  hint?: string;
}

export interface KpiTilesPayload {
  tiles: KpiTile[];
}

export interface ActionItem {
  label: string;
  /** Prompt sent back into chat when the user clicks. */
  prompt: string;
  /**
   * Optional appearance hint. `default` (filled) | `outline`. Renderer
   * falls back to `outline` when the value is unknown.
   */
  variant?: "default" | "outline";
}

export interface ActionsPayload {
  actions: ActionItem[];
}

export interface CitationItem {
  /** Bracket number — `[1]` markers in the answer body align to this. */
  n: number;
  /** Knowledge article id, used to deep-link into the source. */
  id: string;
  title: string;
  category: string;
}

export interface CitationsPayload {
  citations: CitationItem[];
}

export interface ConfirmPayload {
  /** Stable action id matching the BE dispatcher. */
  action: string;
  /** HMAC-signed token — FE posts this verbatim to /aria/confirm-action. */
  token: string;
  /** One-line description shown above the params for the user to verify. */
  summary: string;
  /** Human-friendly key/value rows shown beneath the summary. */
  params: Record<string, unknown>;
}

export type AriaBlockKind =
  | "checklist"
  | "kpi-tiles"
  | "actions"
  | "citations"
  | "confirm";

export interface ParsedBlock<P> {
  kind: AriaBlockKind;
  payload: P;
}

const ARIA_BLOCK_CLASSNAME_PATTERN = /language-aria-([a-z-]+)/;

/**
 * Safe JSON parse. Returns `null` on syntax error, non-object
 * payload, or missing required arrays. Caller chooses what to do
 * with the failure (typically: render the raw fenced block so the
 * user can still see the data ARIA tried to format).
 */
export function parseAriaBlock(
  kind: AriaBlockKind,
  raw: string,
):
  | ParsedBlock<ChecklistPayload>
  | ParsedBlock<KpiTilesPayload>
  | ParsedBlock<ActionsPayload>
  | ParsedBlock<CitationsPayload>
  | ParsedBlock<ConfirmPayload>
  | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;

  if (kind === "checklist") {
    const items = (json as { items?: unknown[] }).items;
    if (!Array.isArray(items)) return null;
    const cleaned: ChecklistItem[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const label = (item as { label?: unknown }).label;
      if (typeof label !== "string" || !label.trim()) continue;
      cleaned.push({
        label: label.trim(),
        checked: Boolean((item as { checked?: unknown }).checked),
      });
    }
    if (cleaned.length === 0) return null;
    const titleRaw = (json as { title?: unknown }).title;
    return {
      kind: "checklist",
      payload: {
        title: typeof titleRaw === "string" ? titleRaw.trim() : undefined,
        items: cleaned,
      },
    };
  }

  if (kind === "kpi-tiles") {
    const tiles = (json as { tiles?: unknown[] }).tiles;
    if (!Array.isArray(tiles)) return null;
    const cleaned: KpiTile[] = [];
    for (const t of tiles) {
      if (!t || typeof t !== "object") continue;
      const label = (t as { label?: unknown }).label;
      const value = (t as { value?: unknown }).value;
      if (typeof label !== "string" || typeof value !== "string") continue;
      cleaned.push({
        label: label.trim(),
        value: value.trim(),
        hint:
          typeof (t as { hint?: unknown }).hint === "string"
            ? ((t as { hint?: string }).hint?.trim() ?? undefined)
            : undefined,
      });
    }
    if (cleaned.length === 0) return null;
    return { kind: "kpi-tiles", payload: { tiles: cleaned } };
  }

  if (kind === "actions") {
    const actions = (json as { actions?: unknown[] }).actions;
    if (!Array.isArray(actions)) return null;
    return buildActionsPayload(actions);
  }

  if (kind === "citations") {
    const citations = (json as { citations?: unknown[] }).citations;
    if (!Array.isArray(citations)) return null;
    const cleaned: CitationItem[] = [];
    for (const c of citations) {
      if (!c || typeof c !== "object") continue;
      const nRaw = (c as { n?: unknown }).n;
      const id = (c as { id?: unknown }).id;
      const title = (c as { title?: unknown }).title;
      const category = (c as { category?: unknown }).category;
      if (
        typeof nRaw !== "number" ||
        !Number.isFinite(nRaw) ||
        typeof id !== "string" ||
        !id.trim() ||
        typeof title !== "string" ||
        !title.trim()
      ) {
        continue;
      }
      cleaned.push({
        n: nRaw,
        id: id.trim(),
        title: title.trim(),
        category: typeof category === "string" ? category.trim() : "",
      });
    }
    if (cleaned.length === 0) return null;
    return { kind: "citations", payload: { citations: cleaned } };
  }

  if (kind === "confirm") {
    const action = (json as { action?: unknown }).action;
    const token = (json as { token?: unknown }).token;
    const summary = (json as { summary?: unknown }).summary;
    const params = (json as { params?: unknown }).params;
    if (
      typeof action !== "string" ||
      !action.trim() ||
      typeof token !== "string" ||
      !token.trim() ||
      typeof summary !== "string" ||
      !summary.trim()
    ) {
      return null;
    }
    return {
      kind: "confirm",
      payload: {
        action: action.trim(),
        token: token.trim(),
        summary: summary.trim(),
        params:
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {},
      },
    };
  }

  return null;
}

function buildActionsPayload(
  actions: unknown[],
): ParsedBlock<ActionsPayload> | null {
  const cleaned: ActionItem[] = [];
  for (const a of actions) {
    if (!a || typeof a !== "object") continue;
    const label = (a as { label?: unknown }).label;
    const prompt = (a as { prompt?: unknown }).prompt;
    if (
      typeof label !== "string" ||
      !label.trim() ||
      typeof prompt !== "string" ||
      !prompt.trim()
    ) {
      continue;
    }
    const variantRaw = (a as { variant?: unknown }).variant;
    const variant =
      variantRaw === "default" || variantRaw === "outline"
        ? variantRaw
        : "outline";
    cleaned.push({
      label: label.trim(),
      prompt: prompt.trim(),
      variant,
    });
  }
  if (cleaned.length === 0) return null;
  return { kind: "actions", payload: { actions: cleaned } };
}

/**
 * Recover complete `{...}` action objects from a partial/truncated
 * `aria-actions` body. The streaming pipeline can deliver the block
 * mid-array; strict `JSON.parse` rejects it and we fall back to a raw
 * code dump. Instead we walk the text with string + brace tracking,
 * capture each balanced top-level object inside the `actions` array,
 * and parse it on its own. Whatever completed renders as chips; the
 * tail-end partial object is dropped silently.
 */
export function extractPartialActions(
  raw: string,
): ParsedBlock<ActionsPayload> | null {
  const arrayStart = raw.indexOf("[");
  if (arrayStart < 0) return null;

  const objects: unknown[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escape = false;

  for (let i = arrayStart + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        const candidate = raw.slice(objStart, i + 1);
        try {
          objects.push(JSON.parse(candidate));
        } catch {
          // Skip malformed candidate, keep walking.
        }
        objStart = -1;
      }
      continue;
    }
    if (ch === "]" && depth === 0) break;
  }

  if (objects.length === 0) return null;
  return buildActionsPayload(objects);
}

/**
 * Map a fenced-block className (`language-aria-checklist`) into the
 * `AriaBlockKind` we recognise, or `null` if not one of ours.
 */
export function ariaBlockKindFromClassName(
  className: string | undefined,
): AriaBlockKind | null {
  if (!className) return null;
  const match = className.match(ARIA_BLOCK_CLASSNAME_PATTERN);
  if (!match) return null;
  const kind = match[1];
  if (
    kind === "checklist" ||
    kind === "kpi-tiles" ||
    kind === "actions" ||
    kind === "citations" ||
    kind === "confirm"
  ) {
    return kind;
  }
  return null;
}
