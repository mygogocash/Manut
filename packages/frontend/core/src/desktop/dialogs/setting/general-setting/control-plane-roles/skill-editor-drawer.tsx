import { Button, Input, Modal, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import {
  archiveMnSkillMutation,
  type CreateMnSkillInput,
  createMnSkillMutation,
  type MnSkillDto,
  type MnSkillSource,
  type UpdateMnSkillInput,
  updateMnSkillMutation,
} from '@affine/core/modules/manut-control-plane';
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

import * as styles from './skill-editor-drawer.css';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '-';
  return new Date(ms).toLocaleString();
}

const SOURCE_OPTIONS: ReadonlyArray<MnSkillSource> = [
  'CUSTOM',
  'SEED',
  'IMPORTED',
];

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

interface SkillEditorDrawerProps {
  open: boolean;
  workspaceId: string;
  /** When `null`, the drawer is in create mode. */
  skill: MnSkillDto | null;
  onClose: () => void;
  onSaved: (skill: MnSkillDto) => void;
  onArchived?: (skill: MnSkillDto) => void;
}

/**
 * Drawer for creating or editing a single `MnSkill`.
 *
 * Markdown editor is a styled textarea (monospace + tab-size 2) — the spec
 * explicitly calls for a simple editor here; a richer surface can land later
 * without touching the GraphQL contract.
 *
 * Modal is reused as the drawer wrapper, matching `AgentDetailDrawer`. We can
 * swap to a real drawer primitive once AFFiNE ships one.
 */
export const SkillEditorDrawer = ({
  open,
  workspaceId,
  skill,
  onClose,
  onSaved,
  onArchived,
}: SkillEditorDrawerProps) => {
  const isEditing = skill !== null;
  const isArchived = skill?.archivedAt != null;

  const [slug, setSlug] = useState(skill?.slug ?? '');
  const [name, setName] = useState(skill?.name ?? '');
  const [version, setVersion] = useState(skill?.version ?? '1.0.0');
  const [source, setSource] = useState<MnSkillSource>(
    skill?.source ?? 'CUSTOM'
  );
  const [body, setBody] = useState(skill?.body ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { trigger: triggerCreate } = useMutation({
    mutation: createMnSkillMutation,
  });
  const { trigger: triggerUpdate } = useMutation({
    mutation: updateMnSkillMutation,
  });
  const { trigger: triggerArchive } = useMutation({
    mutation: archiveMnSkillMutation,
  });

  // Reset form on open so the drawer doesn't leak state between sessions.
  useEffect(() => {
    if (!open) return;
    setSlug(skill?.slug ?? '');
    setName(skill?.name ?? '');
    setVersion(skill?.version ?? '1.0.0');
    setSource(skill?.source ?? 'CUSTOM');
    setBody(skill?.body ?? '');
    setSubmitting(false);
    setArchiving(false);
    setError(null);
  }, [open, skill]);

  const handleClose = useCallback(() => {
    if (submitting || archiving) return;
    onClose();
  }, [onClose, submitting, archiving]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedSlug = slug.trim();
      const trimmedName = name.trim();
      const trimmedVersion = version.trim();

      if (!trimmedName) {
        setError('Skill name is required.');
        return;
      }
      if (!trimmedVersion) {
        setError('Version is required.');
        return;
      }
      if (!isEditing && !SLUG_PATTERN.test(trimmedSlug)) {
        setError(
          'Slug must be lowercase letters, digits, or hyphens (1–64 chars).'
        );
        return;
      }

      setError(null);
      setSubmitting(true);

      try {
        if (isEditing && skill) {
          const input: UpdateMnSkillInput = {
            name: trimmedName,
            version: trimmedVersion,
            body,
            source,
          };
          const response = (await (
            triggerUpdate as (args: unknown) => Promise<unknown>
          )({
            id: skill.id,
            input,
          })) as { updateMnSkill?: MnSkillDto } | undefined;
          const updated = response?.updateMnSkill;
          if (!updated) {
            throw new Error('Server did not return the updated skill.');
          }
          notify.success({
            title: 'Skill saved',
            message: `${updated.name} v${updated.version}`,
          });
          onSaved(updated);
        } else {
          const input: CreateMnSkillInput = {
            workspaceId,
            slug: trimmedSlug,
            name: trimmedName,
            version: trimmedVersion,
            body,
            source,
          };
          const response = (await (
            triggerCreate as (args: unknown) => Promise<unknown>
          )({ input })) as { createMnSkill?: MnSkillDto } | undefined;
          const created = response?.createMnSkill;
          if (!created) {
            throw new Error('Server did not return the new skill.');
          }
          notify.success({
            title: 'Skill created',
            message: `${created.name} v${created.version}`,
          });
          onSaved(created);
        }
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        notify.error({
          title: isEditing ? 'Could not save skill' : 'Could not create skill',
          message,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [
      body,
      isEditing,
      name,
      onSaved,
      skill,
      slug,
      source,
      triggerCreate,
      triggerUpdate,
      version,
      workspaceId,
    ]
  );

  const handleArchive = useCallback(async () => {
    if (!skill) return;
    setArchiving(true);
    try {
      const response = (await (
        triggerArchive as (args: unknown) => Promise<unknown>
      )({ id: skill.id })) as { archiveMnSkill?: MnSkillDto } | undefined;
      const archived = response?.archiveMnSkill;
      if (!archived) {
        throw new Error('Server did not return the archived skill.');
      }
      notify.success({
        title: 'Skill archived',
        message: archived.name,
      });
      onArchived?.(archived);
      onClose();
    } catch (err) {
      notify.error({
        title: 'Could not archive skill',
        message: errorMessage(err),
      });
    } finally {
      setArchiving(false);
    }
  }, [onArchived, onClose, skill, triggerArchive]);

  const title = isEditing ? 'Edit skill' : 'Create skill';
  const description = isEditing
    ? `Update the markdown body, name, or version. Slug is immutable after creation.`
    : 'Create a new skill markdown document for this workspace.';

  return (
    <Modal
      open={open}
      onOpenChange={(value: boolean) => {
        if (!value) handleClose();
      }}
      title={title}
      description={description}
      width={760}
    >
      <form
        className={styles.root}
        onSubmit={event => void handleSubmit(event)}
      >
        {isEditing && skill ? (
          <div className={styles.headerBlock}>
            <div
              className={styles.headerMeta}
              data-testid="cp-skill-editor-meta"
            >
              Created {formatTimestamp(skill.createdAt)} · Updated{' '}
              {formatTimestamp(skill.updatedAt)}
            </div>
          </div>
        ) : null}

        {isArchived ? (
          <div
            className={styles.archivedBanner}
            data-testid="cp-skill-editor-archived-banner"
          >
            This skill is archived. Edits will save but it remains hidden from
            the default list view.
          </div>
        ) : null}

        <div className={styles.formGrid}>
          <div className={styles.fieldRowInline}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel} htmlFor="cp-skill-slug">
                Slug
              </label>
              {isEditing ? (
                <input
                  id="cp-skill-slug"
                  className={styles.slugInputDisabled}
                  value={slug}
                  disabled
                  data-testid="cp-skill-editor-slug-disabled"
                />
              ) : (
                <Input
                  id="cp-skill-slug"
                  value={slug}
                  placeholder="e.g. tdd-loop"
                  onChange={setSlug}
                  data-testid="cp-skill-editor-slug"
                />
              )}
              <div className={styles.fieldHint}>
                Stable identifier. Lowercase, hyphens, digits. Cannot change
                after creation.
              </div>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel} htmlFor="cp-skill-version">
                Version
              </label>
              <Input
                id="cp-skill-version"
                value={version}
                placeholder="1.0.0"
                onChange={setVersion}
                data-testid="cp-skill-editor-version"
              />
              <div className={styles.fieldHint}>
                Free-form. Semver recommended but not enforced.
              </div>
            </div>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="cp-skill-name">
              Name
            </label>
            <Input
              id="cp-skill-name"
              value={name}
              placeholder="Human-friendly title"
              onChange={setName}
              data-testid="cp-skill-editor-name"
            />
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="cp-skill-source">
              Source
            </label>
            <select
              id="cp-skill-source"
              className={styles.select}
              value={source}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setSource(event.target.value as MnSkillSource)
              }
              data-testid="cp-skill-editor-source"
            >
              {SOURCE_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className={styles.fieldHint}>
              CUSTOM: workspace-authored. SEED: shipped with Manut. IMPORTED:
              brought in via export/import.
            </div>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="cp-skill-body">
              Markdown body
            </label>
            <textarea
              id="cp-skill-body"
              className={styles.bodyEditor}
              value={body}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setBody(event.target.value)
              }
              placeholder="# Skill title\n\nWrite the skill content here as Markdown."
              spellCheck={false}
              data-testid="cp-skill-editor-body"
            />
            <div className={styles.fieldHint}>
              Markdown. No preview yet — paste from your editor or compose
              inline.
            </div>
          </div>
        </div>

        {error ? (
          <div className={styles.formError} data-testid="cp-skill-editor-error">
            {error}
          </div>
        ) : null}

        <div className={styles.formActions}>
          <div className={styles.formActionsLeft}>
            {isEditing && skill && !isArchived ? (
              <Button
                onClick={() => void handleArchive()}
                loading={archiving}
                disabled={submitting || archiving}
                data-testid="cp-skill-editor-archive"
              >
                Archive
              </Button>
            ) : null}
          </div>
          <div className={styles.formActionsRight}>
            <Button
              onClick={handleClose}
              disabled={submitting || archiving}
              data-testid="cp-skill-editor-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={submitting || archiving || !name.trim()}
              data-testid="cp-skill-editor-submit"
            >
              {isEditing ? 'Save changes' : 'Create skill'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
