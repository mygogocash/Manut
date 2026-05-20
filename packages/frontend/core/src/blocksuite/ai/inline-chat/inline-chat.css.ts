// Manut M2 E2.6 — inline AI mini-chat.
// Cursor-anchored chat that opens on Cmd+Period / Ctrl+Period.
// Lit CSS lives in this sibling so the styled tagged template
// stays small and (more importantly) free of backticks in comments
// or anywhere else — the v1.9.0 production blank-page scar
// taught us that a stray backtick inside css(html) ... breaks the
// build silently (see CLAUDE.md §6).

import { css } from 'lit';

export const inlineChatStyles = css`
  :host {
    position: fixed;
    top: 0;
    left: 0;
    z-index: var(--affine-z-index-popover);
    width: 480px;
    max-width: calc(100vw - 32px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* Manut design tokens — see ../chat-panel/message/assistant.ts
       and CLAUDE.md §6 design system notes. Fallbacks keep us safe
       if the token isn't defined (Vertex bundle drift, theme
       provider initialisation order, etc). */
    border-radius: var(--manut-radius-card, 12px);
    border: 1px solid
      var(--manut-accent-violet-border, var(--affine-border-color));
    background: var(
      --manut-surface-glass,
      var(--affine-background-overlay-panel-color)
    );
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    box-shadow: var(--affine-overlay-shadow);
    font-family: var(--affine-font-sans-family);
    outline: none;
  }

  @supports (not (backdrop-filter: blur(20px))) and
    (not (-webkit-backdrop-filter: blur(20px))) {
    :host {
      background: var(--affine-background-overlay-panel-color);
    }
  }

  /* Entrance animation — respects user motion preferences. */
  :host {
    animation: ai-inline-chat-in 160ms ease-out;
    transform-origin: top left;
  }

  @keyframes ai-inline-chat-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :host {
      animation: none;
    }
  }

  .root {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    box-sizing: border-box;
    width: 100%;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--affine-text-secondary-color);
    font-size: var(--affine-font-xs);
    font-weight: 500;
    line-height: 18px;
  }

  .header .title {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header .esc {
    color: var(--affine-text-placeholder-color);
    font-size: 11px;
    font-weight: 500;
  }

  .quote {
    padding: 6px 8px;
    border-left: 2px solid
      var(--manut-accent-violet-border, var(--affine-text-emphasis-color));
    background: var(--affine-hover-color);
    border-radius: 4px;
    font-size: var(--affine-font-xs);
    color: var(--affine-text-secondary-color);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 84px;
    overflow: hidden;
    position: relative;
  }

  .quote.quote-truncated::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 24px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--affine-hover-color)
    );
    pointer-events: none;
  }

  .input-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    border: 1px solid var(--affine-border-color);
    border-radius: 8px;
    padding: 8px 10px;
    background: var(--affine-background-primary-color);
    transition: border-color 120ms ease;
  }

  .input-row:focus-within {
    border-color: var(
      --manut-accent-violet-border,
      var(--affine-text-emphasis-color)
    );
  }

  textarea {
    flex: 1 0 0;
    border: none;
    outline: none;
    background: transparent;
    resize: none;
    overflow: hidden;
    padding: 0;
    max-height: 140px;
    color: var(--affine-text-primary-color);
    font-family: inherit;
    font-size: var(--affine-font-sm);
    font-weight: 400;
    line-height: 22px;
  }

  textarea::placeholder {
    color: var(--affine-text-placeholder-color);
  }

  .send {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    min-width: 24px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    color: var(--affine-pure-white);
    background: var(--affine-icon-disable);
    cursor: not-allowed;
    transition: background 120ms ease;
  }

  .send[data-active='true'] {
    background: var(--manut-accent-violet-bg, var(--affine-primary-color));
    cursor: pointer;
  }

  .send[data-active='true']:hover {
    filter: brightness(1.05);
  }

  .send svg {
    width: 14px;
    height: 14px;
  }

  .preview {
    max-height: 320px;
    overflow-y: auto;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--affine-hover-color);
    color: var(--affine-text-primary-color);
    font-size: var(--affine-font-sm);
    line-height: 22px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .preview.empty {
    color: var(--affine-text-secondary-color);
    font-style: italic;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--affine-text-secondary-color);
    font-size: var(--affine-font-xs);
  }

  .status .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--manut-accent-violet-bg, var(--affine-primary-color));
    animation: ai-inline-chat-pulse 1.2s ease-in-out infinite;
  }

  @keyframes ai-inline-chat-pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .status .dot {
      animation: none;
      opacity: 0.8;
    }
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  .actions button {
    height: 28px;
    padding: 0 12px;
    border-radius: 6px;
    font-size: var(--affine-font-xs);
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--affine-border-color);
    background: var(--affine-background-primary-color);
    color: var(--affine-text-primary-color);
    transition:
      background 120ms ease,
      border-color 120ms ease;
  }

  .actions button:hover {
    background: var(--affine-hover-color);
  }

  .actions button.primary {
    background: var(--manut-accent-violet-bg, var(--affine-primary-color));
    border-color: var(
      --manut-accent-violet-border,
      var(--affine-primary-color)
    );
    color: var(--affine-pure-white);
  }

  .actions button.primary:hover {
    filter: brightness(1.05);
  }

  .error {
    color: var(--affine-error-color, #eb4335);
    font-size: var(--affine-font-xs);
    padding: 4px 8px;
    border-radius: 4px;
    background: color-mix(
      in srgb,
      var(--affine-error-color, #eb4335) 10%,
      transparent
    );
  }
`;
