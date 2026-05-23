import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import {
  createVar,
  generateIdentifier,
  globalStyle,
  keyframes,
  style,
} from '@vanilla-extract/css';

import { animationToken } from '../../theme/animation';
import {
  manutGlass,
  manutMotion,
  manutPrimary,
  manutRadius,
  manutSurface,
} from '../../theme/manut-tokens';
import { vtScopeSelector } from '../../utils/view-transition';
export const widthVar = createVar('widthVar');
export const heightVar = createVar('heightVar');
export const minHeightVar = createVar('minHeightVar');

export const modalVTScope = generateIdentifier('modal');

const overlayShow = keyframes({
  from: {
    opacity: 0,
  },
  to: {
    opacity: 1,
  },
});
const contentShowFadeScaleTop = keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(8px) scale(0.98)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
  },
});
const contentHideFadeScaleTop = keyframes({
  to: {
    opacity: 0,
    transform: 'translateY(8px) scale(0.98)',
  },
  from: {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
  },
});
const contentShowSlideBottom = keyframes({
  from: { transform: 'translateY(100%)' },
  to: { transform: 'translateY(0)' },
});
const contentHideSlideBottom = keyframes({
  from: { transform: 'translateY(0)' },
  to: { transform: 'translateY(100%)' },
});
const contentShowSlideRight = keyframes({
  from: { transform: 'translateX(100%)' },
  to: { transform: 'translateX(0)' },
});
const contentHideSlideRight = keyframes({
  from: { transform: 'translateX(0)' },
  to: { transform: 'translateX(100%)' },
});
const modalContentViewTransitionNameFadeScaleTop = generateIdentifier(
  'modal-content-fade-scale-top'
);
const modalContentViewTransitionNameSlideBottom = generateIdentifier(
  'modal-content-slide-bottom'
);
const modalContentViewTransitionNameSlideRight = generateIdentifier(
  'modal-content-slide-right'
);
export const modalOverlay = style({
  position: 'fixed',
  inset: 0,
  background: [
    'radial-gradient(circle at 50% 44%, rgba(124, 58, 237, 0.18), transparent 34%)',
    'rgba(14, 14, 16, 0.66)',
  ].join(', '),
  backdropFilter: 'blur(2px)',
  WebkitBackdropFilter: 'blur(2px)',
  zIndex: cssVar('zIndexModal'),
  animation: `${overlayShow} ${animationToken.durationSlow} ${animationToken.curveDefault} forwards`,
  selectors: {
    '&.anim-none': {
      animation: 'none',
    },
    '&.mobile': {
      background: [
        'radial-gradient(circle at 50% 44%, rgba(124, 58, 237, 0.16), transparent 34%)',
        cssVarV2('layer/background/mobile/modal'),
      ].join(', '),
    },
  },
});
export const modalContentWrapper = style({
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: cssVar('zIndexModal'),

  selectors: {
    '&[data-mobile]': {
      alignItems: 'flex-end',
      paddingBottom: 'env(safe-area-inset-bottom, 20px)',
    },
    '&[data-full-screen="true"]': {
      padding: '0 !important',
    },
    '&.anim-none': {
      animation: 'none',
    },
    '&.anim-fadeScaleTop': {
      animation: `${contentShowFadeScaleTop} ${animationToken.durationSlow} ${manutMotion.curveSpring}`,
      animationFillMode: 'forwards',
    },
    [`${vtScopeSelector(modalVTScope)} &.anim-fadeScaleTop.vt-active`]: {
      viewTransitionName: modalContentViewTransitionNameFadeScaleTop,
    },
    '&.anim-slideBottom': {
      animation: `${contentShowSlideBottom} ${animationToken.durationSlow} ${animationToken.curveDefault}`,
      animationFillMode: 'forwards',
    },
    [`${vtScopeSelector(modalVTScope)} &.anim-slideBottom.vt-active`]: {
      viewTransitionName: modalContentViewTransitionNameSlideBottom,
    },
    '&.anim-slideRight': {
      animation: `${contentShowSlideRight} ${animationToken.durationSlow} ${animationToken.curveDefault}`,
      animationFillMode: 'forwards',
    },
    [`${vtScopeSelector(modalVTScope)} &.anim-slideRight.vt-active`]: {
      viewTransitionName: modalContentViewTransitionNameSlideRight,
    },
  },
});
globalStyle(
  `::view-transition-old(${modalContentViewTransitionNameFadeScaleTop})`,
  {
    animation: `${contentHideFadeScaleTop} ${animationToken.durationBase} ${animationToken.curveIn}`,
    animationFillMode: 'forwards',
  }
);
globalStyle(
  `::view-transition-old(${modalContentViewTransitionNameSlideBottom})`,
  {
    animation: `${contentHideSlideBottom} ${animationToken.durationBase} ${animationToken.curveIn}`,
    animationFillMode: 'forwards',
  }
);
globalStyle(
  `::view-transition-old(${modalContentViewTransitionNameSlideRight})`,
  {
    animation: `${contentHideSlideRight} ${animationToken.durationBase} ${animationToken.curveIn}`,
    animationFillMode: 'forwards',
  }
);

export const modalContent = style({
  vars: {
    [widthVar]: '',
    [heightVar]: '',
    [minHeightVar]: '',
  },
  width: widthVar,
  height: heightVar,
  minHeight: minHeightVar,
  maxHeight: 'calc(100dvh - 32px)',
  maxWidth: 'calc(100dvw - 20px)',
  boxSizing: 'border-box',
  fontSize: cssVar('fontBase'),
  fontWeight: '400',
  lineHeight: '1.6',
  padding: '20px 24px',
  position: 'relative',
  color: manutSurface.ink,
  background: [
    `linear-gradient(135deg, ${manutPrimary.bg}, transparent 54%)`,
    manutGlass.surfaceStrong,
  ].join(', '),
  backdropFilter: manutGlass.backdropFilter,
  WebkitBackdropFilter: manutGlass.backdropFilter,
  border: `1px solid ${manutPrimary.border}`,
  boxShadow: [
    '0 24px 70px rgba(14, 14, 16, 0.22)',
    `0 0 0 1px ${manutPrimary.border}`,
    'inset 0 1px 0 rgba(255, 255, 255, 0.56)',
  ].join(', '),
  borderRadius: manutRadius.modal,
  // :focus-visible will set outline
  outline: 'none',

  '@supports': {
    'not (backdrop-filter: blur(20px))': {
      background: [
        `linear-gradient(135deg, ${manutPrimary.bg}, transparent 54%)`,
        manutSurface.paper,
      ].join(', '),
    },
  },

  selectors: {
    '[data-full-screen="true"] &': {
      vars: {
        [widthVar]: '100dvw',
        [heightVar]: '100dvh',
        [minHeightVar]: '100dvh',
      },
      maxWidth: '100dvw',
      maxHeight: '100dvh',
      borderRadius: 0,
      border: 0,
    },
  },
});
export const closeButton = style({
  position: 'absolute',
  top: '22px',
  right: '20px',
  zIndex: cssVar('zIndexModal'),
});
export const modalHeader = style({
  fontSize: cssVar('fontH6'),
  fontWeight: '600',
  lineHeight: '1.45',
  marginBottom: '12px',
  color: manutSurface.ink,
});
export const modalDescription = style({
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  color: manutSurface.inkSoft,
});

globalStyle(`[data-modal="false"]${modalContentWrapper}`, {
  pointerEvents: 'none',
});

globalStyle(`[data-modal="false"] ${modalContent}`, {
  pointerEvents: 'auto',
});
