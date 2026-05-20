import { SPRING_TIGHT } from '@affine/core/utils/motion';
import * as Dialog from '@radix-ui/react-dialog';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import clsx from 'clsx';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { useTransition } from 'react-transition-state';

import * as styles from './modal.css';

// a QuickSearch modal that can be used to display a QuickSearch command
// it has a smooth animation and can be closed by clicking outside of the modal

export interface QuickSearchModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Wider variant for the Notion-style docs cmdk layout (split list +
   * preview pane). Defaults to false so action pickers and command
   * palettes keep their compact 640px width.
   */
  wide?: boolean;
}

const animationTimeout = 120;

export const QuickSearchModal = ({
  onOpenChange,
  open,
  wide = false,
  children,
}: React.PropsWithChildren<QuickSearchModalProps>) => {
  const [{ status }, toggle] = useTransition({
    timeout: animationTimeout,
  });
  // Manut motion polish — premium open/close. The original keyframe
  // animation (in modal.css.ts) already does a 0.96 → 1.0 scale, but
  // it rides a CSS cubic-bezier instead of a spring. Layering a
  // framer-motion SPRING_TIGHT on top gives the open a snappier feel
  // with no overshoot. Reduced-motion users skip the spring entirely
  // (the inner motion.div renders with the at-rest values).
  const prefersReducedMotion = useReducedMotion();
  useEffect(() => {
    toggle(open);
  }, [open]);
  return (
    <Dialog.Root modal open={status !== 'exited'} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.modalOverlay} />
        <div className={styles.modalContentWrapper}>
          <Dialog.Content
            style={assignInlineVars({
              [styles.animationTimeout]: `${animationTimeout}ms`,
            })}
            className={clsx(styles.modalContent, {
              [styles.modalContentWide]: wide,
            })}
            data-state={status}
          >
            {/* Inner motion layer adds a spring-physics scale on top of
                the CSS keyframe to make the entrance feel snappier. The
                CSS animation handles the bulk; the motion.div adds the
                "settle" bounce. Radix Dialog.Content keeps its ref +
                focus management intact because the motion.div sits as
                a regular child rather than via asChild. */}
            <motion.div
              initial={prefersReducedMotion ? { scale: 1 } : { scale: 0.98 }}
              animate={{ scale: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : SPRING_TIGHT}
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {children}
            </motion.div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
