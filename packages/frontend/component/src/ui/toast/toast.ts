// Copyright: https://github.com/toeverything/blocksuite/commit/8032ef3ab97aefce01664b36502fc392c5db8b78#diff-bf5b41be21936f9165a8400c7f20e24d3dbc49644ba57b9258e0943f0dc1c464
import { DebugLogger } from '@affine/debug';
import type { TemplateResult } from 'lit';
import { css, html } from 'lit';

const logger = new DebugLogger('toast');

export const sleep = (ms = 0) =>
  new Promise(resolve => setTimeout(resolve, ms));

let ToastContainer: HTMLDivElement | null = null;

/**
 * DO NOT USE FOR USER INPUT
 * See https://stackoverflow.com/questions/494143/creating-a-new-dom-element-from-an-html-string-using-built-in-dom-methods-or-pro/35385518#35385518
 */
const htmlToElement = <T extends ChildNode>(html: string | TemplateResult) => {
  const template = document.createElement('template');
  if (typeof html === 'string') {
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
  } else {
    const { strings, values } = html;
    const v = [...values, '']; // + last empty part
    template.innerHTML = strings.reduce((acc, cur, i) => acc + cur + v[i], '');
  }
  return template.content.firstChild as T;
};

const createToastContainer = (portal?: HTMLElement) => {
  portal = portal || document.body;
  // Manut motion polish — moved toast container to top-right and
  // stacked vertically so multiple toasts can slide in from the same
  // edge. Keeps the original API; existing callers see no behavior
  // change beyond the visual position. Pointer-events stay disabled
  // on the wrapper so the toast doesn't intercept clicks.
  const styles = css`
    position: fixed;
    z-index: 9999;
    top: 20px;
    right: 20px;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    max-width: calc(100vw - 40px);
  `;
  const template = html`<div
    style="${styles}"
    data-testid="affine-toast-container"
  ></div>`;
  const element = htmlToElement<HTMLDivElement>(template);
  portal.append(element);
  return element;
};

export type ToastOptions = {
  duration?: number;
  portal?: HTMLElement;
};

const animateToastOut = (toastElement: HTMLDivElement) => {
  toastElement.style.opacity = '0';
  // Slide out to the right matches the top-right entry direction so
  // the exit feels symmetrical. 200ms is enough that the fade is
  // perceived as deliberate, not abrupt.
  toastElement.style.transform = 'translateX(16px)';
  setTimeout(() => toastElement.remove(), 220);
};

// Honors the OS-level prefers-reduced-motion. When set, we kill the
// transform on both entry and exit and only fade.
const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const createAndShowNewToast = (
  message: string,
  duration: number,
  portal?: HTMLElement
) => {
  if (!ToastContainer || (portal && !portal.contains(ToastContainer))) {
    ToastContainer = createToastContainer(portal);
  }

  // Motion polish — slide in from the right edge with a SPRING_GENTLE-
  // matching cubic-bezier (0.34, 1.56, 0.64, 1 produces a small
  // overshoot; we pull it back to 0.22, 1, 0.36, 1 for a no-overshoot
  // snap that feels closer to Linear/Notion). Exit is a quick fade +
  // 16px slide to the right (see animateToastOut). pointer-events:
  // auto re-enables interaction so toasts can be clicked to dismiss
  // if a future iteration wires that up.
  const toastStyles = css`
    max-width: 480px;
    text-align: left;
    font-family: var(--affine-font-family);
    font-size: var(--affine-font-sm);
    padding: 10px 16px;
    margin: 0;
    color: var(--affine-white);
    background: var(--affine-tooltip);
    box-shadow: var(--affine-float-button-shadow);
    border-radius: 8px;
    opacity: 0;
    transform: translateX(32px);
    pointer-events: auto;
    transition:
      transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 220ms ease-out;
  `;

  const toastTemplate = html`<div
    style="${toastStyles}"
    data-testid="affine-toast"
  >
    ${message}
  </div>`;
  const toastElement = htmlToElement<HTMLDivElement>(toastTemplate);
  // message is not trusted
  toastElement.textContent = message;
  // Honor reduced-motion: skip the slide on entry and exit; only the
  // fade remains. This keeps the surface accessible while still
  // signalling "something new arrived".
  if (prefersReducedMotion()) {
    toastElement.style.transform = 'translateX(0)';
    toastElement.style.transition = 'opacity 200ms linear';
  }
  ToastContainer.append(toastElement);
  logger.debug(`toast with message: "${message}"`);
  window.dispatchEvent(
    new CustomEvent('affine-toast:emit', { detail: message })
  );

  // requestAnimationFrame instead of 100ms setTimeout — the browser
  // gets a real frame to commit the initial styles before applying
  // the transition target, which is the canonical way to trigger
  // a CSS transition without races.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toastElement.style.opacity = '1';
      toastElement.style.transform = 'translateX(0)';
    });
  });

  setTimeout(() => {
    animateToastOut(toastElement);
  }, duration);
};

/**
 * @example
 * ```ts
 * toast('Hello World');
 * ```
 */
export const toast = (
  message: string,
  { duration = 3000, portal }: ToastOptions = {}
) => {
  if (ToastContainer && ToastContainer.children.length >= 2) {
    // If there are already two toasts, remove the oldest one immediately
    const oldestToast = ToastContainer.children[0] as HTMLDivElement;
    oldestToast.remove();
  }

  // If there is one toast already, start its disappearing animation
  if (ToastContainer && ToastContainer.children.length === 1) {
    const currentToast = ToastContainer.children[0] as HTMLDivElement;
    animateToastOut(currentToast);
  }

  createAndShowNewToast(message, duration, portal);
};

export default toast;
