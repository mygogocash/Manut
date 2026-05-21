import type { ReactNode } from 'react';
/**
 * Shared side-drawer that hosts the per-entity detail bodies.
 *
 * We reuse the Modal primitive with the built-in `slideRight` animation
 * so this looks like a right-side drawer without dragging in a separate
 * dependency. The internal layout (header / body / actions) is consistent
 * across all four entity types — the per-entity files supply the body
 * content and an `actions` slot via the `onEdit` / `onDelete` props.
 */
export interface DetailPanelProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string | null;
    /** Optional Edit action shown next to the close button. */
    onEdit?: () => void;
    /**
     * Optional Delete action. The backend currently exposes no `delete*`
     * mutations for any CRM entity — this prop exists so callers can wire
     * delete later without another structural change. When omitted the
     * trash button is hidden.
     */
    onDelete?: () => void;
    /** Disabled when a mutation is in flight. */
    busy?: boolean;
    children: ReactNode;
    /** data-testid override so caller tests can find the right panel. */
    testId?: string;
}
export declare const DetailPanel: ({ open, onClose, title, subtitle, onEdit, onDelete, busy, children, testId, }: DetailPanelProps) => import("react/jsx-runtime").JSX.Element;
/**
 * Helper for rendering a labelled field inside a detail panel. Renders the
 * "—" placeholder when value is null/empty so the panel doesn't look
 * broken on records with missing fields.
 */
export declare const DetailField: ({ label, value, testId, }: {
    label: string;
    value: string | null | undefined;
    testId?: string;
}) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=detail-panel.d.ts.map