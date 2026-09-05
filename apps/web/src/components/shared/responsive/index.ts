// Responsive foundation (Phase 1).
//
// Import from here rather than the individual files, so a later move does not
// touch every call site.
//
// Companion hooks live in `@/hooks/use-breakpoint`.

export {
  FormBody,
  FormRow,
  FormSection,
  StickyActionBar,
} from "@/components/shared/responsive/form-layout";
export {
  PageContainer,
  type PageContainerProps,
} from "@/components/shared/responsive/page-container";
export {
  RecordCard,
  type RecordCardField,
  type RecordCardProps,
} from "@/components/shared/responsive/record-card";
export {
  ActionStrip,
  type ResponsiveAction,
  ResponsiveActions,
  type ResponsiveActionsProps,
  splitActions,
} from "@/components/shared/responsive/responsive-actions";
export {
  ResponsiveDialog,
  type ResponsiveDialogProps,
} from "@/components/shared/responsive/responsive-dialog";
export {
  ResponsiveGrid,
  ResponsiveGridMain,
  type ResponsiveGridProps,
} from "@/components/shared/responsive/responsive-grid";
export {
  type ResponsiveTabItem,
  ResponsiveTabs,
  type ResponsiveTabsProps,
} from "@/components/shared/responsive/responsive-tabs";
export {
  StateView,
  type StateViewProps,
} from "@/components/shared/responsive/state-view";

// ── Phase 2 additions ────────────────────────────────────────────────
export {
  BottomSheet,
  BottomSheetClose,
  type BottomSheetProps,
} from "@/components/shared/responsive/bottom-sheet";
export {
  DataCard,
  type DataCardProps,
} from "@/components/shared/responsive/data-card";
export {
  FilterBar,
  type FilterBarProps,
  FilterChip,
  type FilterChipProps,
  FilterGroup,
  type FilterGroupProps,
  type FilterOption,
  FilterSheet,
  type FilterSheetProps,
  useFilterDraft,
} from "@/components/shared/responsive/filters";
export {
  FileField,
  type FileFieldProps,
  FormFieldShell,
  type FormFieldShellProps,
} from "@/components/shared/responsive/form-field";
export {
  CardSkeleton,
  InlineLoader,
  ListSkeleton,
  LoadingButton,
  type LoadingButtonProps,
  PageSkeleton,
} from "@/components/shared/responsive/loading";
export {
  SearchInput,
  type SearchInputProps,
} from "@/components/shared/responsive/search-input";
export {
  normalizeStatus,
  prettifyStatus,
  StatusBadge,
  type StatusBadgeProps,
  type StatusTone,
  statusTone,
} from "@/components/shared/responsive/status-badge";
