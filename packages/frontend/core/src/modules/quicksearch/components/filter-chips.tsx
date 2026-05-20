import clsx from 'clsx';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as styles from './filter-chips.css';

// Notion-style filter chip row for the Cmd+K quick search modal.
//
// Per IMPLEMENTATION_PLAN.md §B4, state lives in the modal session — the
// filters are NOT persisted to disk; they reset every time the modal closes
// and reopens. The parent owns the QuickSearchFilters object and forwards
// changes via onChange so it can apply them to the result groups.

export type QuickSearchInScope =
  | 'current-doc'
  | 'current-folder'
  | 'parent-doc'
  | 'anywhere';

export interface QuickSearchFacet {
  id: string;
  label: string;
  enabled: boolean;
}

export interface QuickSearchFilters {
  titleOnly: boolean;
  createdBy: string | null; // workspace member id, or null = any
  inScope: QuickSearchInScope;
  facets: ReadonlyArray<QuickSearchFacet>;
}

export interface WorkspaceMemberOption {
  id: string;
  name: string;
}

export interface FilterChipsProps {
  filters: QuickSearchFilters;
  onChange: (next: QuickSearchFilters) => void;
  members?: ReadonlyArray<WorkspaceMemberOption>;
}

const IN_SCOPE_LABEL: Record<QuickSearchInScope, string> = {
  'current-doc': 'In current doc',
  'current-folder': 'In current folder',
  'parent-doc': 'In parent doc',
  anywhere: 'Anywhere',
};

interface ChipMenuOption {
  id: string;
  label: string;
  active: boolean;
  onSelect: () => void;
}

interface ChipMenuProps {
  options: ReadonlyArray<ChipMenuOption | { divider: true; id: string }>;
  onClose: () => void;
  anchorId: string;
}

function ChipMenu({ options, onClose, anchorId }: ChipMenuProps): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !ref.current) return;
      if (ref.current.contains(target)) return;
      const anchor = document.getElementById(anchorId);
      if (anchor && anchor.contains(target)) return;
      onClose();
    };
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    // Defer attach so the click that OPENED the menu doesn't immediately close it.
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    document.addEventListener('keydown', keyHandler);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose, anchorId]);

  return (
    <div
      ref={ref}
      role="menu"
      className={styles.chipMenu}
      onClick={event => event.stopPropagation()}
    >
      {options.map(opt =>
        'divider' in opt ? (
          <div key={opt.id} className={styles.chipMenuDivider} />
        ) : (
          <div
            key={opt.id}
            role="menuitem"
            tabIndex={0}
            className={clsx(styles.chipMenuItem, {
              [styles.chipMenuItemActive]: opt.active,
            })}
            onClick={opt.onSelect}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                opt.onSelect();
              }
            }}
          >
            {opt.label}
          </div>
        )
      )}
    </div>
  );
}

const ALL_FACET_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'has-attachment', label: 'Has attachment' },
  { id: 'has-image', label: 'Has image' },
  { id: 'has-link', label: 'Has link' },
  { id: 'has-comment', label: 'Has comment' },
];

export function FilterChips({
  filters,
  onChange,
  members,
}: FilterChipsProps): ReactNode {
  const [openMenu, setOpenMenu] = useState<
    'created-by' | 'in-scope' | 'add-filter' | null
  >(null);

  const createdByAnchorId = useId();
  const inScopeAnchorId = useId();
  const addFilterAnchorId = useId();

  const memberLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members ?? []) {
      map.set(m.id, m.name);
    }
    return map;
  }, [members]);

  const toggleTitleOnly = useCallback(() => {
    onChange({ ...filters, titleOnly: !filters.titleOnly });
  }, [filters, onChange]);

  const setCreatedBy = useCallback(
    (id: string | null) => {
      onChange({ ...filters, createdBy: id });
      setOpenMenu(null);
    },
    [filters, onChange]
  );

  const setInScope = useCallback(
    (scope: QuickSearchInScope) => {
      onChange({ ...filters, inScope: scope });
      setOpenMenu(null);
    },
    [filters, onChange]
  );

  const toggleFacet = useCallback(
    (id: string, label: string) => {
      const existing = filters.facets.find(f => f.id === id);
      let next: ReadonlyArray<QuickSearchFacet>;
      if (existing) {
        next = filters.facets.filter(f => f.id !== id);
      } else {
        next = [...filters.facets, { id, label, enabled: true }];
      }
      onChange({ ...filters, facets: next });
    },
    [filters, onChange]
  );

  const removeFacet = useCallback(
    (id: string) => {
      onChange({
        ...filters,
        facets: filters.facets.filter(f => f.id !== id),
      });
    },
    [filters, onChange]
  );

  const createdByLabel = useMemo(() => {
    if (!filters.createdBy) return 'Created by';
    const name = memberLookup.get(filters.createdBy);
    return `Created by · ${name ?? 'Member'}`;
  }, [filters.createdBy, memberLookup]);

  const inScopeLabel = useMemo(() => {
    if (filters.inScope === 'anywhere') return 'In · Anywhere';
    return IN_SCOPE_LABEL[filters.inScope];
  }, [filters.inScope]);

  const createdByOptions = useMemo<
    ReadonlyArray<ChipMenuOption | { divider: true; id: string }>
  >(() => {
    const anyOpt: ChipMenuOption = {
      id: '__any__',
      label: 'Anyone',
      active: filters.createdBy === null,
      onSelect: () => setCreatedBy(null),
    };
    const memberOpts: ChipMenuOption[] = (members ?? []).map(m => ({
      id: m.id,
      label: m.name,
      active: filters.createdBy === m.id,
      onSelect: () => setCreatedBy(m.id),
    }));
    if (memberOpts.length === 0) return [anyOpt];
    return [
      anyOpt,
      { divider: true, id: '__divider__' } as const,
      ...memberOpts,
    ];
  }, [filters.createdBy, members, setCreatedBy]);

  const inScopeOptions = useMemo<ReadonlyArray<ChipMenuOption>>(
    () =>
      (Object.keys(IN_SCOPE_LABEL) as QuickSearchInScope[]).map(scope => ({
        id: scope,
        label: IN_SCOPE_LABEL[scope],
        active: filters.inScope === scope,
        onSelect: () => setInScope(scope),
      })),
    [filters.inScope, setInScope]
  );

  const addFilterOptions = useMemo<ReadonlyArray<ChipMenuOption>>(
    () =>
      ALL_FACET_OPTIONS.map(opt => ({
        id: opt.id,
        label: opt.label,
        active: filters.facets.some(f => f.id === opt.id),
        onSelect: () => toggleFacet(opt.id, opt.label),
      })),
    [filters.facets, toggleFacet]
  );

  return (
    <div className={styles.chipsRow} data-testid="cmdk-filter-chips">
      <div className={styles.chipWrapper}>
        <button
          type="button"
          className={clsx(styles.chip, {
            [styles.chipActive]: filters.titleOnly,
          })}
          onClick={toggleTitleOnly}
          data-testid="cmdk-chip-title-only"
          aria-pressed={filters.titleOnly}
        >
          Title only
        </button>
      </div>

      <div className={styles.chipWrapper}>
        <button
          type="button"
          id={createdByAnchorId}
          className={clsx(styles.chip, {
            [styles.chipActive]: filters.createdBy !== null,
          })}
          onClick={() =>
            setOpenMenu(openMenu === 'created-by' ? null : 'created-by')
          }
          data-testid="cmdk-chip-created-by"
        >
          {createdByLabel}
          <span className={styles.chipCaret}>▾</span>
        </button>
        {openMenu === 'created-by' && (
          <ChipMenu
            anchorId={createdByAnchorId}
            options={createdByOptions}
            onClose={() => setOpenMenu(null)}
          />
        )}
      </div>

      <div className={styles.chipWrapper}>
        <button
          type="button"
          id={inScopeAnchorId}
          className={clsx(styles.chip, {
            [styles.chipActive]: filters.inScope !== 'anywhere',
          })}
          onClick={() =>
            setOpenMenu(openMenu === 'in-scope' ? null : 'in-scope')
          }
          data-testid="cmdk-chip-in-scope"
        >
          {inScopeLabel}
          <span className={styles.chipCaret}>▾</span>
        </button>
        {openMenu === 'in-scope' && (
          <ChipMenu
            anchorId={inScopeAnchorId}
            options={inScopeOptions}
            onClose={() => setOpenMenu(null)}
          />
        )}
      </div>

      {filters.facets.map(facet => (
        <div key={facet.id} className={styles.chipWrapper}>
          <button
            type="button"
            className={clsx(styles.chip, styles.chipActive)}
            onClick={() => removeFacet(facet.id)}
            data-testid={`cmdk-chip-facet-${facet.id}`}
            aria-label={`${facet.label} — click to remove`}
          >
            {facet.label}
            <span className={styles.chipCaret}>×</span>
          </button>
        </div>
      ))}

      <div className={styles.chipWrapper}>
        <button
          type="button"
          id={addFilterAnchorId}
          className={clsx(styles.chip, styles.chipAddFilter)}
          onClick={() =>
            setOpenMenu(openMenu === 'add-filter' ? null : 'add-filter')
          }
          data-testid="cmdk-chip-add-filter"
        >
          + Filter
        </button>
        {openMenu === 'add-filter' && (
          <ChipMenu
            anchorId={addFilterAnchorId}
            options={addFilterOptions}
            onClose={() => setOpenMenu(null)}
          />
        )}
      </div>
    </div>
  );
}
