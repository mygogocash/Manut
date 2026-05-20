// Manut M2 E2.6 — inline AI mini-chat.
//
// A floating chat card anchored to the editor cursor. Opens on
// Cmd+Period / Ctrl+Period, lets the user prompt the AI without
// the full side panel, streams the response into a preview, then
// inserts the rendered markdown below the cursor on Accept.
//
// Architectural choices (judgment calls):
//   - Use AIProvider.actions.chat (same path as the chat panel +
//     peek view + side panel input). Gives us prompt registry,
//     auto model selection, abort, error mapping for free.
//   - SSE stream-object wrapper handling matches the chat-panel
//     pattern at chat-panel/message/assistant.ts:548 — every event
//     is a JSON-stringified StreamObject; text-delta chunks
//     contribute to the visible preview, everything else is
//     ignored. This is the v1.10.1 scar (see CLAUDE.md §6c).
//   - Insertion uses the existing insertBelow util — it threads
//     through insertFromMarkdown + markdown adapter machinery the
//     rest of the AI surface already relies on.
//   - Positioning is fixed-position with computed top/left from
//     the cursor's Range bounding rect (captured at open time).
//     We do NOT use floating-ui autoUpdate here because the
//     anchor is the moment-in-time cursor position, not a live
//     element.
//
// CRITICAL: no backticks inside the css ... / html ... template
// literals beyond the standard delimiter. The v1.9.0 blank-page
// scar in CLAUDE.md §6 was a single stray backtick inside a
// comment that closed the outer template and silently broke the
// build.

import {
  AIStarIconWithAnimation,
  AIStopIcon,
} from '@blocksuite/affine/components/icons';
import { WithDisposable } from '@blocksuite/affine/global/lit';
import { type EditorHost, TextSelection } from '@blocksuite/affine/std';
import { html, LitElement, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { StreamObjectSchema } from '../components/ai-chat-messages';
import { AIProvider } from '../provider';
import { insertBelow } from '../utils/editor-actions';
import { mergeStreamContent } from '../utils/stream-objects';
import { inlineChatStyles } from './inline-chat.styles';

type InlineChatState = 'input' | 'generating' | 'answer' | 'error';

export const AI_INLINE_CHAT_TAG = 'ai-inline-chat';

const QUOTE_MAX_LENGTH = 320;

export class AIInlineChat extends WithDisposable(LitElement) {
  static override styles = inlineChatStyles;

  @property({ attribute: false })
  accessor host!: EditorHost;

  /**
   * Snapshot of the cursor selection at open time. We don't track
   * it live — the cursor may move while the panel is open and we
   * specifically want to anchor to where the user invoked.
   */
  @property({ attribute: false })
  accessor selection: Range | null = null;

  /**
   * The currently-selected text, if any. Wrapped in the prompt as
   * a quoted block so the AI can reason over the selection.
   */
  @property({ attribute: false })
  accessor selectedText = '';

  /**
   * Anchor rect in viewport coordinates. Used to position the card
   * just below the cursor without re-querying the (possibly
   * moving) selection.
   */
  @property({ attribute: false })
  accessor anchorRect: DOMRect | null = null;

  @property({ attribute: false })
  accessor onCloseRequested: (() => void) | undefined = undefined;

  @state()
  private accessor _uiState: InlineChatState = 'input';

  @state()
  private accessor _previewText = '';

  @state()
  private accessor _hasContent = false;

  @state()
  private accessor _errorMessage = '';

  @query('textarea')
  private accessor _textarea!: HTMLTextAreaElement;

  private _abortController: AbortController | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.tabIndex = -1;
    this.disposables.addFromEvent(this, 'keydown', this._onHostKeyDown);
    // Focus the textarea on next paint so the entrance animation
    // doesn't fight the focus shift.
    requestAnimationFrame(() => {
      this._textarea?.focus();
    });
    this._applyAnchorPosition();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._abortController?.abort();
    this._abortController = null;
  }

  override updated(changed: Map<PropertyKey, unknown>) {
    super.updated(changed);
    if (changed.has('anchorRect')) {
      this._applyAnchorPosition();
    }
  }

  private _applyAnchorPosition() {
    const rect = this.anchorRect;
    if (!rect) return;
    // Position the panel just below the cursor line. The width is
    // 480px (see css). Clamp to viewport so we never render
    // off-screen.
    const desiredWidth = Math.min(480, window.innerWidth - 32);
    const margin = 12;
    let left = rect.left;
    if (left + desiredWidth + margin > window.innerWidth) {
      left = Math.max(margin, window.innerWidth - desiredWidth - margin);
    }
    const top = rect.bottom + 8;
    this.style.left = `${Math.max(margin, left)}px`;
    this.style.top = `${top}px`;
  }

  private readonly _onHostKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this._close();
      return;
    }
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.isComposing &&
      this._uiState === 'input'
    ) {
      event.preventDefault();
      event.stopPropagation();
      this._submit().catch(() => {
        // Errors are surfaced through this._uiState='error' inside
        // the submit handler; this catch only exists to satisfy the
        // no-floating-promises rule.
      });
    }
  };

  private readonly _onInput = () => {
    if (!this._textarea) return;
    // Auto-grow.
    this._textarea.style.height = 'auto';
    this._textarea.style.height = `${Math.min(140, this._textarea.scrollHeight)}px`;
    this._hasContent = this._textarea.value.trim().length > 0;
  };

  private readonly _submit = async () => {
    if (this._uiState !== 'input') return;
    const prompt = this._textarea?.value.trim() ?? '';
    if (!prompt) return;
    if (!AIProvider.actions.chat) {
      this._uiState = 'error';
      this._errorMessage = 'AI is not configured.';
      return;
    }

    const { store } = this.host;
    if (!store) {
      this._uiState = 'error';
      this._errorMessage = 'No active document.';
      return;
    }

    // Build the user input. When there's a selection, send the
    // markdown-flavoured quote followed by the prompt. Matches the
    // shape AI chat input uses in `ai-chat-input.ts:929`.
    const input = this.selectedText
      ? `${this.selectedText}\n\n${prompt}`
      : prompt;

    this._abortController = new AbortController();
    this._uiState = 'generating';
    this._previewText = '';
    this._errorMessage = '';

    let aggregated = '';
    const streamObjects: { type: string; textDelta?: string }[] = [];

    try {
      const stream = await AIProvider.actions.chat({
        input,
        docId: store.id,
        workspaceId: store.workspace.id,
        host: this.host,
        stream: true,
        signal: this._abortController.signal,
        where: 'inline-chat-panel',
        control: 'chat-send',
      });

      for await (const text of stream) {
        // SSE stream-object events are JSON-stringified. Parse and
        // pull text-delta chunks; other chunks (reasoning, tool
        // calls, tool results) are ignored for the inline preview
        // — same defensive parser pattern as
        // chat-panel/message/assistant.ts.
        try {
          const parsed = StreamObjectSchema.parse(JSON.parse(text));
          streamObjects.push(parsed as { type: string; textDelta?: string });
          // Use the canonical merge helper for textDelta extraction
          // — keeps the wire-format handling in one place.
          aggregated = mergeStreamContent(
            streamObjects as Parameters<typeof mergeStreamContent>[0]
          );
        } catch {
          // Non-JSON payload — append raw. This is the
          // pre-stream-object endpoint shape we still need to
          // tolerate (see CLAUDE.md §6c).
          aggregated += text;
        }
        this._previewText = aggregated;
      }

      this._uiState = aggregated ? 'answer' : 'input';
      this._previewText = aggregated;
    } catch (error: unknown) {
      if (this._abortController?.signal.aborted) {
        // Abort happened — return silently to input so the user
        // can retry. The textarea content is preserved.
        this._uiState = 'input';
        return;
      }
      this._uiState = 'error';
      this._errorMessage =
        error instanceof Error ? error.message : 'AI request failed.';
    } finally {
      this._abortController = null;
    }
  };

  private readonly _stop = () => {
    this._abortController?.abort();
  };

  private readonly _accept = async () => {
    const markdown = this._previewText.trim();
    if (!markdown) {
      this._close();
      return;
    }

    // Find the cursor's anchor block. The selection snapshot we
    // saved is a DOM Range — for insertion we want the BlockSuite
    // block component that owns the current text selection.
    const block = this._resolveAnchorBlock();
    if (!block) {
      this._uiState = 'error';
      this._errorMessage = 'Could not find an anchor block for insertion.';
      return;
    }

    try {
      await insertBelow(this.host, markdown, block);
      this._close();
    } catch (error: unknown) {
      this._uiState = 'error';
      this._errorMessage =
        error instanceof Error
          ? `Insert failed: ${error.message}`
          : 'Insert failed.';
    }
  };

  private _resolveAnchorBlock() {
    const textSelection = this.host.selection.find(TextSelection);
    const blockId = textSelection
      ? (textSelection.to?.blockId ?? textSelection.blockId)
      : null;
    if (!blockId) return null;
    return this.host.view.getBlock(blockId);
  }

  private readonly _reject = () => {
    this._close();
  };

  private readonly _retry = () => {
    this._previewText = '';
    this._errorMessage = '';
    this._uiState = 'input';
    requestAnimationFrame(() => this._textarea?.focus());
  };

  private _close() {
    this._abortController?.abort();
    this.onCloseRequested?.();
    this.remove();
  }

  private _renderQuote() {
    if (!this.selectedText) return nothing;
    const truncated = this.selectedText.length > QUOTE_MAX_LENGTH;
    const text = truncated
      ? this.selectedText.slice(0, QUOTE_MAX_LENGTH)
      : this.selectedText;
    return html`
      <div
        class="quote ${truncated ? 'quote-truncated' : ''}"
        data-testid="ai-inline-chat-quote"
      >
        ${text}
      </div>
    `;
  }

  private _renderInput() {
    return html`
      <div class="input-row">
        <textarea
          rows="1"
          placeholder="Ask AI to write, summarise, transform..."
          @input=${this._onInput}
          @click=${(e: Event) => e.stopPropagation()}
          data-testid="ai-inline-chat-input"
        ></textarea>
        <button
          class="send"
          data-active=${String(this._hasContent)}
          ?disabled=${!this._hasContent}
          @click=${this._submit}
          data-testid="ai-inline-chat-send"
          aria-label="Send"
        >
          ↩
        </button>
      </div>
    `;
  }

  private _renderGenerating() {
    return html`
      <div class="preview ${this._previewText ? '' : 'empty'}">
        ${this._previewText || 'Thinking…'}
      </div>
      <div class="status">
        <span class="dot"></span>
        <span>AI is generating…</span>
        <span style="flex:1 0 0"></span>
        <button
          class="send"
          data-active="true"
          @click=${this._stop}
          data-testid="ai-inline-chat-stop"
          aria-label="Stop"
        >
          ${AIStopIcon}
        </button>
      </div>
    `;
  }

  private _renderAnswer() {
    return html`
      <div class="preview" data-testid="ai-inline-chat-preview">
        ${this._previewText}
      </div>
      <div class="actions">
        <button @click=${this._reject} data-testid="ai-inline-chat-reject">
          Discard
        </button>
        <button
          class="primary"
          @click=${this._accept}
          data-testid="ai-inline-chat-accept"
        >
          Insert below
        </button>
      </div>
    `;
  }

  private _renderError() {
    return html`
      <div class="error" data-testid="ai-inline-chat-error">
        ${this._errorMessage || 'Something went wrong.'}
      </div>
      <div class="actions">
        <button @click=${this._close}>Close</button>
        <button class="primary" @click=${this._retry}>Try again</button>
      </div>
    `;
  }

  override render() {
    return html`
      <div class="root" data-testid="ai-inline-chat">
        <div class="header">
          <div class="title">
            ${AIStarIconWithAnimation}
            <span>Inline AI</span>
          </div>
          <span class="esc">Esc to close</span>
        </div>
        ${this._renderQuote()}
        ${this._uiState === 'input' ? this._renderInput() : nothing}
        ${this._uiState === 'generating' ? this._renderGenerating() : nothing}
        ${this._uiState === 'answer' ? this._renderAnswer() : nothing}
        ${this._uiState === 'error' ? this._renderError() : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-inline-chat': AIInlineChat;
  }
}
