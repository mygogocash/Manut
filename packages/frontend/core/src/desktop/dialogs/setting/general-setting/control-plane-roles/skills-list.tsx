import { Button, RadioGroup, type RadioItem } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  type MnSkillDto,
  type MnSkillSource,
  mnSkillsQuery,
} from '@affine/core/modules/manut-control-plane';
import { isGraphQLSchemaValidationError } from '@affine/error';
import {
  type ChangeEvent,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { SkillEditorDrawer } from './skill-editor-drawer';
import * as styles from './skills-list.css';

const SKILLS_UNAVAILABLE_MESSAGE =
  'Skills are not enabled on this workspace. Ask your administrator to enable the Manut control plane.';

function errorBoxMessage(err: unknown): string {
  if (isGraphQLSchemaValidationError(err)) {
    return SKILLS_UNAVAILABLE_MESSAGE;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '-';
  return new Date(ms).toLocaleString();
}

type ArchiveFilter = 'active' | 'all' | 'archived';

const ARCHIVE_FILTER_ITEMS: RadioItem[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

interface SourcePillProps {
  source: MnSkillSource;
}

const SourcePill = ({ source }: SourcePillProps) => {
  const variant =
    source === 'CUSTOM'
      ? styles.sourceCustom
      : source === 'SEED'
        ? styles.sourceSeed
        : styles.sourceImported;
  return (
    <span
      className={`${styles.sourcePill} ${variant}`}
      data-testid="cp-skill-source-pill"
      data-source={source}
    >
      {source.toLowerCase()}
    </span>
  );
};

const SkeletonList = () => (
  <div className={styles.skeletonGroup}>
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
  </div>
);

interface SkillsTableProps {
  workspaceId: string;
  archiveFilter: ArchiveFilter;
  searchTerm: string;
  onOpenSkill: (skill: MnSkillDto) => void;
  onCreateSkill: () => void;
}

const SkillsTable = ({
  workspaceId,
  archiveFilter,
  searchTerm,
  onOpenSkill,
  onCreateSkill,
}: SkillsTableProps) => {
  // Always fetch the union (including archived) when the user might want to
  // see archived or all rows. The resolver supports `includeArchived` so we
  // narrow client-side based on the radio.
  const includeArchived = archiveFilter !== 'active';

  const queryArg = {
    query: mnSkillsQuery,
    variables: { workspaceId, includeArchived },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error } = useQuery(queryArg);

  const allSkills = useMemo(
    () =>
      (data as unknown as { mnSkills?: MnSkillDto[] } | undefined)?.mnSkills ??
      [],
    [data]
  );

  const filteredSkills = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return allSkills.filter(skill => {
      if (archiveFilter === 'archived' && skill.archivedAt == null) {
        return false;
      }
      if (archiveFilter === 'active' && skill.archivedAt != null) {
        return false;
      }
      if (term.length === 0) {
        return true;
      }
      return (
        skill.slug.toLowerCase().includes(term) ||
        skill.name.toLowerCase().includes(term)
      );
    });
  }, [allSkills, archiveFilter, searchTerm]);

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        Failed to load skills: {errorBoxMessage(error)}
      </div>
    );
  }

  if (filteredSkills.length === 0) {
    if (allSkills.length === 0) {
      return (
        <div className={styles.emptyState} data-testid="cp-skills-empty">
          <div style={{ marginBottom: 8 }}>
            No skills have been created for this workspace yet.
          </div>
          <Button
            variant="primary"
            onClick={onCreateSkill}
            data-testid="cp-skills-empty-create"
          >
            Create first skill
          </Button>
        </div>
      );
    }
    return (
      <div className={styles.emptyState} data-testid="cp-skills-empty-filtered">
        No skills match this filter.
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: '20%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '26%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.th}>Slug</th>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Version</th>
            <th className={styles.th}>Source</th>
            <th className={styles.th}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {filteredSkills.map((skill, index) => {
            const isLast = index === filteredSkills.length - 1;
            const archived = skill.archivedAt != null;
            const rowClass = archived
              ? `${styles.row} ${styles.rowArchived}`
              : styles.row;
            const tdClass = isLast
              ? `${styles.td} ${styles.lastRowTd}`
              : styles.td;
            return (
              <tr
                key={skill.id}
                data-testid="cp-skill-row"
                data-skill-id={skill.id}
                className={rowClass}
                onClick={() => onOpenSkill(skill)}
              >
                <td className={`${tdClass} ${styles.slugCell}`}>
                  {skill.slug}
                </td>
                <td className={`${tdClass} ${styles.nameCell}`}>
                  <span data-testid="cp-skill-name">{skill.name}</span>
                  {archived ? (
                    <span className={styles.archivedTag}>archived</span>
                  ) : null}
                </td>
                <td className={`${tdClass} ${styles.versionCell}`}>
                  {skill.version}
                </td>
                <td className={tdClass}>
                  <SourcePill source={skill.source} />
                </td>
                <td className={tdClass}>{formatTimestamp(skill.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface SkillsListPanelProps {
  workspaceId: string;
}

export const SkillsListPanel = ({ workspaceId }: SkillsListPanelProps) => {
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSkill, setEditingSkill] = useState<MnSkillDto | null>(null);
  const [creating, setCreating] = useState(false);

  const handleOpenSkill = useCallback((skill: MnSkillDto) => {
    setEditingSkill(skill);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditingSkill(null);
    setCreating(false);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingSkill(null);
    setCreating(true);
  }, []);

  const handleSaved = useCallback((skill: MnSkillDto) => {
    // Drawer stays open after a successful save so the user can keep editing
    // or close intentionally — matches the agent-create pattern of returning
    // to the detail view.
    setEditingSkill(skill);
    setCreating(false);
  }, []);

  const handleArchived = useCallback(() => {
    // No-op: the SWR query revalidates on mutation, so the table refreshes.
  }, []);

  const fallback = useMemo(() => <SkeletonList />, []);
  const drawerOpen = creating || editingSkill !== null;

  return (
    <div className={styles.root} data-testid="cp-skills-panel">
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>Skills</div>
          <div className={styles.muted}>
            Workspace-scoped markdown skill documents — versioned, archivable,
            and exported with the workspace snapshot. Click a row to edit.
          </div>
        </div>
        <Button
          variant="primary"
          onClick={handleCreate}
          data-testid="cp-skills-create-button"
        >
          Create skill
        </Button>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          value={searchTerm}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setSearchTerm(event.target.value)
          }
          placeholder="Search slug or name"
          data-testid="cp-skills-search"
          aria-label="Search skills"
        />
        <RadioGroup
          items={ARCHIVE_FILTER_ITEMS}
          value={archiveFilter}
          onChange={(value: string) => setArchiveFilter(value as ArchiveFilter)}
          width={260}
        />
      </div>

      <Suspense fallback={fallback}>
        <SkillsTable
          workspaceId={workspaceId}
          archiveFilter={archiveFilter}
          searchTerm={searchTerm}
          onOpenSkill={handleOpenSkill}
          onCreateSkill={handleCreate}
        />
      </Suspense>

      {drawerOpen ? (
        <SkillEditorDrawer
          open
          workspaceId={workspaceId}
          skill={editingSkill}
          onClose={handleCloseEditor}
          onSaved={handleSaved}
          onArchived={handleArchived}
        />
      ) : null}
    </div>
  );
};
