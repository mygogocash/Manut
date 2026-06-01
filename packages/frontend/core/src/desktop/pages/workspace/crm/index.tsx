import {
  Button,
  Input,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  notify,
  Skeleton,
  Tabs,
} from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { SWRErrorBoundary } from '@affine/core/components/pure/swr-error-bundary';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { CollaborationIcon, DownloadIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { FallbackProps } from 'react-error-boundary';

import { Header } from '../../../../components/pure/header';
import {
  type CreateMnCrmAccountInput,
  createMnCrmAccountMutation,
  type CreateMnCrmAccountResponse,
  type CreateMnCrmActivityInput,
  createMnCrmActivityMutation,
  type CreateMnCrmActivityResponse,
  type CreateMnCrmContactInput,
  createMnCrmContactMutation,
  type CreateMnCrmContactResponse,
  type CreateMnCrmDealInput,
  createMnCrmDealMutation,
  type CreateMnCrmDealResponse,
  type CreateMnCrmDealStageInput,
  createMnCrmDealStageMutation,
  type CreateMnCrmDealStageResponse,
  MN_CRM_ACTIVITY_TYPES,
  type MnCrmAccount,
  mnCrmAccountsQuery,
  type MnCrmAccountsResponse,
  mnCrmActivitiesQuery,
  type MnCrmActivitiesResponse,
  type MnCrmActivity,
  type MnCrmActivityType,
  type MnCrmContact,
  mnCrmContactsQuery,
  type MnCrmContactsResponse,
  type MnCrmDeal,
  mnCrmDealsQuery,
  type MnCrmDealsResponse,
  type MnCrmDealStage,
  mnCrmDealStagesQuery,
  type MnCrmDealStagesResponse,
  type UpdateMnCrmDealInput,
  updateMnCrmDealMutation,
  type UpdateMnCrmDealResponse,
} from '../../../../modules/manut-crm';
import {
  KanbanBoard,
  type KanbanColumn,
  type KanbanOnMoveArgs,
} from '../../../../modules/manut-shared';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import { AccountDetailBody } from './account-detail';
import { AccountEditModal } from './account-edit-modal';
import { ActivityDetailBody } from './activity-detail';
import { ActivityEditModal } from './activity-edit-modal';
import { ContactDetailBody } from './contact-detail';
import { ContactEditModal } from './contact-edit-modal';
import {
  buildCrmAccountsCsv,
  buildCrmActivitiesCsv,
  buildCrmContactsCsv,
  buildCrmDealsCsv,
  crmExportFilename,
  downloadCsv,
} from './csv-export';
import { DealDetailBody } from './deal-detail';
import { DealEditModal } from './deal-edit-modal';
import { summarizeDealColumn, toExternalHref } from './deal-totals';
import { DetailPanel } from './detail-panel';
import * as styles from './styles.css';

// The Manut CRM operations are not part of the codegen'd
// discriminated union, so we cast at the boundary — same trick the
// reminders / Gmail / Drive panels use.
type UseQueryArg = NonNullable<Parameters<typeof useQuery>[0]>;
const toQueryArg = (
  query: { id: string },
  variables: Record<string, unknown>
): UseQueryArg => ({ query, variables }) as unknown as UseQueryArg;

type TabKey = 'accounts' | 'contacts' | 'deals' | 'activities';

const TAB_KEYS: readonly TabKey[] = [
  'accounts',
  'contacts',
  'deals',
  'activities',
] as const;

interface TabDef {
  key: TabKey;
  i18nKey:
    | 'com.manut.crm.tab.accounts'
    | 'com.manut.crm.tab.contacts'
    | 'com.manut.crm.tab.deals'
    | 'com.manut.crm.tab.activities';
}

const TABS: readonly TabDef[] = [
  { key: 'accounts', i18nKey: 'com.manut.crm.tab.accounts' },
  { key: 'contacts', i18nKey: 'com.manut.crm.tab.contacts' },
  { key: 'deals', i18nKey: 'com.manut.crm.tab.deals' },
  { key: 'activities', i18nKey: 'com.manut.crm.tab.activities' },
] as const;

function formatDate(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString();
}

function formatCurrency(value: number | null, currency: string | null): string {
  if (value === null) return '';
  const code = currency ?? 'USD';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

function contactFullName(contact: MnCrmContact): string {
  return contact.lastName
    ? `${contact.firstName} ${contact.lastName}`
    : contact.firstName;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const CrmHeader = () => {
  const t = useI18n();
  return (
    <Header
      left={
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <CollaborationIcon /> {t['com.manut.crm.title']()}
        </span>
      }
    />
  );
};

type CrmExportEntity = 'accounts' | 'contacts' | 'deals' | 'activities';

interface CsvExportButtonProps {
  disabled: boolean;
  onClick: () => void;
  testId: string;
}

const CsvExportButton = ({
  disabled,
  onClick,
  testId,
}: CsvExportButtonProps) => (
  <Button
    disabled={disabled}
    prefix={<DownloadIcon />}
    onClick={onClick}
    data-testid={testId}
  >
    Export CSV
  </Button>
);

function exportCrmCsv(entity: CrmExportEntity, csv: string, rowCount: number) {
  try {
    downloadCsv(crmExportFilename(entity), csv);
    notify.success({
      title: 'CSV exported',
      message: `${rowCount} ${entity} row${rowCount === 1 ? '' : 's'} exported.`,
    });
  } catch (err) {
    notify.error({
      title: 'Could not export CSV',
      message: getErrorMessage(err, 'The browser blocked the download.'),
    });
  }
}

// ---------------------------------------------------------------------------
// Skeletons / fallbacks
// ---------------------------------------------------------------------------

const ListSkeleton = () => (
  <div className={styles.listWrapper} data-testid="crm-list-skeleton">
    {[0, 1, 2].map(key => (
      <Skeleton key={key} variant="rectangular" height={48} />
    ))}
  </div>
);

interface ErrorFallbackOptions {
  retryLabel: string;
}

const renderListErrorFallback = (
  { error, resetErrorBoundary }: FallbackProps,
  options: ErrorFallbackOptions,
  unknownMessage: string,
  messagePrefix: string
) => {
  const message =
    error instanceof Error && error.message ? error.message : unknownMessage;
  return (
    <div className={styles.errorState} data-testid="crm-list-error">
      <div>
        {messagePrefix}: {message}
      </div>
      <Button onClick={resetErrorBoundary} variant="primary">
        {options.retryLabel}
      </Button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Account-picker (used by Contacts, Deals)
// ---------------------------------------------------------------------------

interface AccountPickerProps {
  accounts: readonly MnCrmAccount[];
  value: string | null;
  onChange: (id: string | null) => void;
  noneLabel: string;
}

const AccountPicker = ({
  accounts,
  value,
  onChange,
  noneLabel,
}: AccountPickerProps) => {
  const selected = useMemo(
    () => accounts.find(account => account.id === value) ?? null,
    [accounts, value]
  );
  return (
    <Menu
      items={
        <>
          <MenuItem onSelect={() => onChange(null)}>{noneLabel}</MenuItem>
          {accounts.map(account => (
            <MenuItem key={account.id} onSelect={() => onChange(account.id)}>
              {account.name}
            </MenuItem>
          ))}
        </>
      }
    >
      <MenuTrigger className={styles.selectButton}>
        {selected ? selected.name : noneLabel}
      </MenuTrigger>
    </Menu>
  );
};

// ---------------------------------------------------------------------------
// Stage-picker (used by Deals; allows inline "create stage")
// ---------------------------------------------------------------------------

interface StagePickerProps {
  stages: readonly MnCrmDealStage[];
  value: string | null;
  onChange: (id: string) => void;
  onCreateStage: () => void;
  placeholder: string;
  createLabel: string;
}

const StagePicker = ({
  stages,
  value,
  onChange,
  onCreateStage,
  placeholder,
  createLabel,
}: StagePickerProps) => {
  const selected = useMemo(
    () => stages.find(stage => stage.id === value) ?? null,
    [stages, value]
  );
  return (
    <Menu
      items={
        <>
          {stages.map(stage => (
            <MenuItem key={stage.id} onSelect={() => onChange(stage.id)}>
              {stage.name}
            </MenuItem>
          ))}
          <MenuItem onSelect={onCreateStage}>{createLabel}</MenuItem>
        </>
      }
    >
      <MenuTrigger className={styles.selectButton}>
        {selected ? selected.name : placeholder}
      </MenuTrigger>
    </Menu>
  );
};

// ---------------------------------------------------------------------------
// Activity-type picker
// ---------------------------------------------------------------------------

interface ActivityTypePickerProps {
  value: MnCrmActivityType;
  onChange: (value: MnCrmActivityType) => void;
}

const ActivityTypePicker = ({ value, onChange }: ActivityTypePickerProps) => {
  return (
    <Menu
      items={
        <>
          {MN_CRM_ACTIVITY_TYPES.map(type => (
            <MenuItem key={type} onSelect={() => onChange(type)}>
              {type}
            </MenuItem>
          ))}
        </>
      }
    >
      <MenuTrigger className={styles.selectButton}>{value}</MenuTrigger>
    </Menu>
  );
};

// ---------------------------------------------------------------------------
// Accounts tab
// ---------------------------------------------------------------------------

interface AccountsTabProps {
  workspaceId: string;
}

const AccountsTabInner = ({ workspaceId }: AccountsTabProps) => {
  const t = useI18n();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // The detail panel needs linked contacts + deals to render its sub-lists,
  // so we co-load those queries in the accounts tab too. Each is small;
  // we also use the SWR cache so contacts/deals tabs hit the same fetch.
  const { data, mutate } = useQuery(
    toQueryArg(mnCrmAccountsQuery, { workspaceId })
  );
  const { data: contactsData, mutate: mutateContacts } = useQuery(
    toQueryArg(mnCrmContactsQuery, { workspaceId })
  );
  const { data: dealsData, mutate: mutateDeals } = useQuery(
    toQueryArg(mnCrmDealsQuery, { workspaceId })
  );

  const accounts = useMemo(
    () =>
      ((data as unknown as MnCrmAccountsResponse | undefined)?.mnCrmAccounts ??
        []) as readonly MnCrmAccount[],
    [data]
  );
  const contacts = useMemo(
    () =>
      ((contactsData as unknown as MnCrmContactsResponse | undefined)
        ?.mnCrmContacts ?? []) as readonly MnCrmContact[],
    [contactsData]
  );
  const deals = useMemo(
    () =>
      ((dealsData as unknown as MnCrmDealsResponse | undefined)?.mnCrmDeals ??
        []) as readonly MnCrmDeal[],
    [dealsData]
  );

  const selected = useMemo(
    () =>
      selectedId ? (accounts.find(a => a.id === selectedId) ?? null) : null,
    [accounts, selectedId]
  );

  const handleCreated = useCallback(async () => {
    setCreating(false);
    await mutate();
  }, [mutate]);

  const handleSaved = useCallback(async () => {
    setEditing(false);
    // Refresh accounts + linked-record lists so the detail panel reflects
    // any cascade effect (e.g. industry rename surfaces in contacts list).
    await Promise.all([mutate(), mutateContacts(), mutateDeals()]);
  }, [mutate, mutateContacts, mutateDeals]);

  const handleExport = useCallback(() => {
    exportCrmCsv('accounts', buildCrmAccountsCsv(accounts), accounts.length);
  }, [accounts]);

  const handleRowKey = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, accountId: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelectedId(accountId);
      }
    },
    []
  );

  return (
    <>
      <div className={styles.actionRow}>
        <div className={styles.placeholderText}>
          {t['com.manut.crm.accounts.subtitle']()}
        </div>
        <div className={styles.actionButtons}>
          <CsvExportButton
            disabled={accounts.length === 0}
            onClick={handleExport}
            testId="crm-export-accounts"
          />
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t['com.manut.crm.accounts.create']()}
          </Button>
        </div>
      </div>
      {accounts.length === 0 ? (
        <div className={styles.emptyState} data-testid="crm-accounts-empty">
          {t['com.manut.crm.accounts.empty']()}
        </div>
      ) : (
        <div className={styles.listWrapper} data-testid="crm-accounts-list">
          {accounts.map(account => (
            <div
              key={account.id}
              className={`${styles.listRow} ${styles.clickableRow}`}
              role="button"
              tabIndex={0}
              data-testid={`crm-account-row-${account.id}`}
              onClick={() => setSelectedId(account.id)}
              onKeyDown={event => handleRowKey(event, account.id)}
            >
              <div>
                <div className={styles.rowTitle}>{account.name}</div>
                {account.industry ? (
                  <div className={styles.rowSubtitle}>{account.industry}</div>
                ) : null}
                {account.website ? (
                  <a
                    className={styles.contactLink}
                    href={toExternalHref(account.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={event => event.stopPropagation()}
                  >
                    {account.website}
                  </a>
                ) : null}
              </div>
              <div className={styles.rowMeta}>
                {formatDate(account.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
      {creating ? (
        <AccountCreateModal
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      ) : null}
      {selected ? (
        <DetailPanel
          open={!editing}
          onClose={() => setSelectedId(null)}
          title={selected.name}
          subtitle={selected.industry}
          onEdit={() => setEditing(true)}
          testId="crm-account-detail"
        >
          <AccountDetailBody
            account={selected}
            contacts={contacts}
            deals={deals}
          />
        </DetailPanel>
      ) : null}
      {selected && editing ? (
        <AccountEditModal
          account={selected}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  );
};

const AccountsTab = ({ workspaceId }: AccountsTabProps) => {
  const t = useI18n();
  return (
    <SWRErrorBoundary
      fallbackRender={fallbackProps =>
        renderListErrorFallback(
          fallbackProps,
          { retryLabel: t['com.manut.crm.error.retry']() },
          t['com.manut.crm.error.unknown'](),
          t['com.manut.crm.error.message']()
        )
      }
    >
      <Suspense fallback={<ListSkeleton />}>
        <AccountsTabInner workspaceId={workspaceId} />
      </Suspense>
    </SWRErrorBoundary>
  );
};

// ---------------------------------------------------------------------------
// Account create modal
// ---------------------------------------------------------------------------

interface AccountCreateModalProps {
  workspaceId: string;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

const AccountCreateModal = ({
  workspaceId,
  onClose,
  onCreated,
}: AccountCreateModalProps) => {
  const t = useI18n();
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { trigger } = useMutation({ mutation: createMnCrmAccountMutation });

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: CreateMnCrmAccountInput = {
        name: name.trim(),
        industry: industry.trim() ? industry.trim() : null,
        website: website.trim() ? website.trim() : null,
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      })) as CreateMnCrmAccountResponse;
      if (!response?.createMnCrmAccount) {
        throw new Error('Account creation returned no record');
      }
      notify.success({ title: t['com.manut.crm.accounts.created']() });
      await onCreated();
    } catch (err) {
      notify.error({
        title: t['com.manut.crm.accounts.create.error'](),
        message: getErrorMessage(err, t['com.manut.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, industry, name, onCreated, t, trigger, website, workspaceId]);

  return (
    <Modal
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
      title={t['com.manut.crm.accounts.create']()}
      width={420}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.name']()}
        </label>
        <Input
          value={name}
          onChange={setName}
          placeholder={t['com.manut.crm.fields.name.placeholder']()}
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.industry']()}
        </label>
        <Input value={industry} onChange={setIndustry} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.website']()}
        </label>
        <Input value={website} onChange={setWebsite} placeholder="https://" />
      </div>
      <div className={styles.formActions}>
        <Button onClick={onClose} disabled={submitting}>
          {t['com.manut.crm.action.cancel']()}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
        >
          {t['com.manut.crm.action.create']()}
        </Button>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Contacts tab
// ---------------------------------------------------------------------------

interface ContactsTabProps {
  workspaceId: string;
}

const ContactsTabInner = ({ workspaceId }: ContactsTabProps) => {
  const t = useI18n();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { data: contactsData, mutate } = useQuery(
    toQueryArg(mnCrmContactsQuery, { workspaceId })
  );
  const { data: accountsData } = useQuery(
    toQueryArg(mnCrmAccountsQuery, { workspaceId })
  );

  const contacts = useMemo(
    () =>
      ((contactsData as unknown as MnCrmContactsResponse | undefined)
        ?.mnCrmContacts ?? []) as readonly MnCrmContact[],
    [contactsData]
  );
  const accounts = useMemo(
    () =>
      ((accountsData as unknown as MnCrmAccountsResponse | undefined)
        ?.mnCrmAccounts ?? []) as readonly MnCrmAccount[],
    [accountsData]
  );

  const accountById = useMemo(
    () => new Map(accounts.map(account => [account.id, account])),
    [accounts]
  );

  const selected = useMemo(
    () =>
      selectedId ? (contacts.find(c => c.id === selectedId) ?? null) : null,
    [contacts, selectedId]
  );
  const selectedAccount = useMemo(
    () =>
      selected && selected.accountId
        ? (accountById.get(selected.accountId) ?? null)
        : null,
    [accountById, selected]
  );

  const handleCreated = useCallback(async () => {
    setCreating(false);
    await mutate();
  }, [mutate]);

  const handleSaved = useCallback(async () => {
    setEditing(false);
    await mutate();
  }, [mutate]);

  const handleExport = useCallback(() => {
    exportCrmCsv(
      'contacts',
      buildCrmContactsCsv(contacts, accountById),
      contacts.length
    );
  }, [accountById, contacts]);

  const handleRowKey = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, contactId: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelectedId(contactId);
      }
    },
    []
  );

  return (
    <>
      <div className={styles.actionRow}>
        <div className={styles.placeholderText}>
          {t['com.manut.crm.contacts.subtitle']()}
        </div>
        <div className={styles.actionButtons}>
          <CsvExportButton
            disabled={contacts.length === 0}
            onClick={handleExport}
            testId="crm-export-contacts"
          />
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t['com.manut.crm.contacts.create']()}
          </Button>
        </div>
      </div>
      {contacts.length === 0 ? (
        <div className={styles.emptyState} data-testid="crm-contacts-empty">
          {t['com.manut.crm.contacts.empty']()}
        </div>
      ) : (
        <div className={styles.listWrapper} data-testid="crm-contacts-list">
          {contacts.map(contact => {
            const account = contact.accountId
              ? accountById.get(contact.accountId)
              : null;
            return (
              <div
                key={contact.id}
                className={`${styles.listRow} ${styles.clickableRow}`}
                role="button"
                tabIndex={0}
                data-testid={`crm-contact-row-${contact.id}`}
                onClick={() => setSelectedId(contact.id)}
                onKeyDown={event => handleRowKey(event, contact.id)}
              >
                <div>
                  <div className={styles.rowTitle}>
                    {contactFullName(contact)}
                  </div>
                  {contact.email ? (
                    <a
                      className={styles.contactLink}
                      href={`mailto:${contact.email}`}
                      onClick={event => event.stopPropagation()}
                    >
                      {contact.email}
                    </a>
                  ) : null}
                  {contact.phone ? (
                    <a
                      className={styles.contactLink}
                      href={`tel:${contact.phone}`}
                      onClick={event => event.stopPropagation()}
                    >
                      {contact.phone}
                    </a>
                  ) : null}
                </div>
                <div className={styles.rowMeta}>
                  {account ? account.name : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {creating ? (
        <ContactCreateModal
          workspaceId={workspaceId}
          accounts={accounts}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      ) : null}
      {selected ? (
        <DetailPanel
          open={!editing}
          onClose={() => setSelectedId(null)}
          title={contactFullName(selected)}
          subtitle={selected.email}
          onEdit={() => setEditing(true)}
          testId="crm-contact-detail"
        >
          <ContactDetailBody contact={selected} account={selectedAccount} />
        </DetailPanel>
      ) : null}
      {selected && editing ? (
        <ContactEditModal
          contact={selected}
          accounts={accounts}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  );
};

const ContactsTab = ({ workspaceId }: ContactsTabProps) => {
  const t = useI18n();
  return (
    <SWRErrorBoundary
      fallbackRender={fallbackProps =>
        renderListErrorFallback(
          fallbackProps,
          { retryLabel: t['com.manut.crm.error.retry']() },
          t['com.manut.crm.error.unknown'](),
          t['com.manut.crm.error.message']()
        )
      }
    >
      <Suspense fallback={<ListSkeleton />}>
        <ContactsTabInner workspaceId={workspaceId} />
      </Suspense>
    </SWRErrorBoundary>
  );
};

interface ContactCreateModalProps {
  workspaceId: string;
  accounts: readonly MnCrmAccount[];
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

const ContactCreateModal = ({
  workspaceId,
  accounts,
  onClose,
  onCreated,
}: ContactCreateModalProps) => {
  const t = useI18n();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { trigger } = useMutation({ mutation: createMnCrmContactMutation });
  const canSubmit = firstName.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: CreateMnCrmContactInput = {
        firstName: firstName.trim(),
        lastName: lastName.trim() ? lastName.trim() : null,
        email: email.trim() ? email.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        accountId,
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      })) as CreateMnCrmContactResponse;
      if (!response?.createMnCrmContact) {
        throw new Error('Contact creation returned no record');
      }
      notify.success({ title: t['com.manut.crm.contacts.created']() });
      await onCreated();
    } catch (err) {
      notify.error({
        title: t['com.manut.crm.contacts.create.error'](),
        message: getErrorMessage(err, t['com.manut.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    accountId,
    canSubmit,
    email,
    firstName,
    lastName,
    onCreated,
    phone,
    t,
    trigger,
    workspaceId,
  ]);

  return (
    <Modal
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
      title={t['com.manut.crm.contacts.create']()}
      width={420}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.firstName']()}
        </label>
        <Input value={firstName} onChange={setFirstName} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.lastName']()}
        </label>
        <Input value={lastName} onChange={setLastName} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.email']()}
        </label>
        <Input value={email} onChange={setEmail} type="email" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.phone']()}
        </label>
        <Input value={phone} onChange={setPhone} type="tel" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.account']()}
        </label>
        <AccountPicker
          accounts={accounts}
          value={accountId}
          onChange={setAccountId}
          noneLabel={t['com.manut.crm.fields.account.none']()}
        />
      </div>
      <div className={styles.formActions}>
        <Button onClick={onClose} disabled={submitting}>
          {t['com.manut.crm.action.cancel']()}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
        >
          {t['com.manut.crm.action.create']()}
        </Button>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Deals tab
// ---------------------------------------------------------------------------

interface DealsTabProps {
  workspaceId: string;
}

interface DealKanbanCard extends MnCrmDeal {
  accountName: string | null;
}

const DealsTabInner = ({ workspaceId }: DealsTabProps) => {
  const t = useI18n();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  /**
   * Optimistic overrides keyed by deal id. We apply these on top of the
   * SWR-fetched data so drag-drop feels instant; SWR's eventual revalidate
   * supersedes them once the server confirms the move.
   */
  const [dealOverrides, setDealOverrides] = useState<
    Record<string, { stageId: string }>
  >({});

  const { data: dealsData, mutate } = useQuery(
    toQueryArg(mnCrmDealsQuery, { workspaceId })
  );
  const { data: stagesData, mutate: mutateStages } = useQuery(
    toQueryArg(mnCrmDealStagesQuery, { workspaceId })
  );
  const { data: accountsData } = useQuery(
    toQueryArg(mnCrmAccountsQuery, { workspaceId })
  );
  // Activity history is rendered inline in the detail panel.
  const { data: activitiesData } = useQuery(
    toQueryArg(mnCrmActivitiesQuery, { workspaceId })
  );

  // Quick-action: move stage from the detail panel or kanban drag without
  // opening the edit modal. Shared mutation between both flows so refetch
  // is consistent.
  const { trigger: triggerUpdate } = useMutation({
    mutation: updateMnCrmDealMutation,
  });

  const deals = useMemo(
    () =>
      ((dealsData as unknown as MnCrmDealsResponse | undefined)?.mnCrmDeals ??
        []) as readonly MnCrmDeal[],
    [dealsData]
  );
  const stages = useMemo(
    () =>
      ((stagesData as unknown as MnCrmDealStagesResponse | undefined)
        ?.mnCrmDealStages ?? []) as readonly MnCrmDealStage[],
    [stagesData]
  );
  const accounts = useMemo(
    () =>
      ((accountsData as unknown as MnCrmAccountsResponse | undefined)
        ?.mnCrmAccounts ?? []) as readonly MnCrmAccount[],
    [accountsData]
  );
  const activities = useMemo(
    () =>
      ((activitiesData as unknown as MnCrmActivitiesResponse | undefined)
        ?.mnCrmActivities ?? []) as readonly MnCrmActivity[],
    [activitiesData]
  );

  const stagesSorted = useMemo(
    () => [...stages].sort((a, b) => a.sortOrder - b.sortOrder),
    [stages]
  );

  const accountById = useMemo(
    () => new Map(accounts.map(account => [account.id, account])),
    [accounts]
  );
  const stageById = useMemo(
    () => new Map(stages.map(stage => [stage.id, stage])),
    [stages]
  );

  const dealsWithOverrides = useMemo<DealKanbanCard[]>(() => {
    return deals.map(deal => {
      const override = dealOverrides[deal.id];
      const account = deal.accountId
        ? (accountById.get(deal.accountId) ?? null)
        : null;
      const merged: DealKanbanCard = {
        ...deal,
        accountName: account ? account.name : null,
      };
      if (override) {
        merged.stageId = override.stageId;
      }
      return merged;
    });
  }, [accountById, dealOverrides, deals]);

  const columns = useMemo<KanbanColumn<DealKanbanCard>[]>(() => {
    return stagesSorted.map(stage => {
      const cards = dealsWithOverrides
        .filter(deal => deal.stageId === stage.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      // Only show a currency-formatted total when every card in the column
      // shares one currency — a raw sum across mixed currencies formatted
      // with the first card's currency would be a bogus number.
      const { count, total, currency } = summarizeDealColumn(cards);
      const totalLabel =
        total !== null && currency
          ? formatCurrency(total, currency)
          : t['com.manut.crm.deals.mixedCurrencies']();
      const summary = `${count} • ${totalLabel}`;
      return {
        id: stage.id,
        label: stage.name,
        cards,
        meta: count > 0 ? summary : `${count}`,
      };
    });
  }, [dealsWithOverrides, stagesSorted, t]);

  // When the underlying deal's stage matches its override, drop the
  // override so we stop double-applying the same change.
  useEffect(() => {
    setDealOverrides(prev => {
      let changed = false;
      const next: Record<string, { stageId: string }> = {};
      for (const [dealId, override] of Object.entries(prev)) {
        const live = deals.find(d => d.id === dealId);
        if (live && live.stageId === override.stageId) {
          changed = true;
          continue;
        }
        next[dealId] = override;
      }
      return changed ? next : prev;
    });
  }, [deals]);

  const selected = useMemo(
    () => (selectedId ? (deals.find(d => d.id === selectedId) ?? null) : null),
    [deals, selectedId]
  );
  const selectedAccount = useMemo(
    () =>
      selected && selected.accountId
        ? (accountById.get(selected.accountId) ?? null)
        : null,
    [accountById, selected]
  );

  const handleCreated = useCallback(async () => {
    setCreating(false);
    await mutate();
  }, [mutate]);

  const handleStageCreated = useCallback(async () => {
    await mutateStages();
  }, [mutateStages]);

  const handleSaved = useCallback(async () => {
    setEditing(false);
    await mutate();
  }, [mutate]);

  const handleExport = useCallback(() => {
    exportCrmCsv(
      'deals',
      buildCrmDealsCsv(deals, { accounts: accountById, stages: stageById }),
      deals.length
    );
  }, [accountById, deals, stageById]);

  const handleMove = useCallback(
    async ({ cardId, fromColumn, toColumn }: KanbanOnMoveArgs) => {
      if (fromColumn === toColumn) return;
      setDealOverrides(prev => ({
        ...prev,
        [cardId]: { stageId: toColumn },
      }));
      try {
        const input: UpdateMnCrmDealInput = { stageId: toColumn };
        await (triggerUpdate as (args: unknown) => Promise<unknown>)({
          dealId: cardId,
          input,
        });
        await mutate();
      } catch (err) {
        notify.error({
          title: t['com.manut.crm.kanban.error.move'](),
          message:
            err instanceof Error && err.message
              ? err.message
              : t['com.manut.crm.error.unknown'](),
        });
        // Revert the override on failure.
        setDealOverrides(prev => {
          const { [cardId]: _omit, ...rest } = prev;
          return rest;
        });
      }
    },
    [mutate, t, triggerUpdate]
  );

  const handleMoveStage = useCallback(
    async (stageId: string) => {
      if (!selected || stageId === selected.stageId) return;
      setMoving(true);
      try {
        const input: UpdateMnCrmDealInput = { stageId };
        const response = (await (
          triggerUpdate as (args: unknown) => Promise<unknown>
        )({
          dealId: selected.id,
          input,
        })) as UpdateMnCrmDealResponse;
        if (!response?.updateMnCrmDeal) {
          throw new Error('Deal stage move returned no record');
        }
        notify.success({ title: t['com.manut.crm.deals.stage.moved']() });
        await mutate();
      } catch (err) {
        notify.error({
          title: t['com.manut.crm.deals.stage.move.error'](),
          message:
            err instanceof Error && err.message
              ? err.message
              : t['com.manut.crm.error.unknown'](),
        });
      } finally {
        setMoving(false);
      }
    },
    [mutate, selected, t, triggerUpdate]
  );

  const handleRowKey = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, dealId: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelectedId(dealId);
      }
    },
    []
  );

  return (
    <>
      <div className={styles.actionRow}>
        <div className={styles.placeholderText}>
          {t['com.manut.crm.deals.subtitle']()}
        </div>
        <div className={styles.actionButtons}>
          <CsvExportButton
            disabled={deals.length === 0}
            onClick={handleExport}
            testId="crm-export-deals"
          />
          <Button
            variant="primary"
            onClick={() => setCreating(true)}
            disabled={stagesSorted.length === 0}
          >
            {t['com.manut.crm.deals.create']()}
          </Button>
        </div>
      </div>
      {stagesSorted.length === 0 ? (
        <div className={styles.emptyState} data-testid="crm-deals-empty">
          {t['com.manut.crm.deals.noStages']()}
          <Button onClick={() => setCreating(true)}>
            {t['com.manut.crm.deals.addStage']()}
          </Button>
        </div>
      ) : (
        <div data-testid="crm-deals-list">
          <KanbanBoard<DealKanbanCard>
            columns={columns}
            onMove={handleMove}
            testIdPrefix="crm-deals-kanban"
            emptyText={t['com.manut.crm.kanban.column.empty']()}
            renderCard={card => (
              <div
                role="button"
                tabIndex={0}
                data-testid={`crm-deal-row-${card.id}`}
                onClick={() => setSelectedId(card.id)}
                onKeyDown={event => handleRowKey(event, card.id)}
              >
                <div className={styles.rowTitle}>{card.name}</div>
                {card.accountName ? (
                  <div className={styles.rowSubtitle}>{card.accountName}</div>
                ) : null}
                <div className={styles.rowSubtitle}>
                  {formatCurrency(card.value, card.currency)}
                </div>
              </div>
            )}
          />
        </div>
      )}
      {creating ? (
        <DealCreateModal
          workspaceId={workspaceId}
          stages={stagesSorted}
          accounts={accounts}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
          onStageCreated={handleStageCreated}
        />
      ) : null}
      {selected ? (
        <DetailPanel
          open={!editing}
          onClose={() => setSelectedId(null)}
          title={selected.name}
          subtitle={selectedAccount?.name ?? null}
          onEdit={() => setEditing(true)}
          busy={moving}
          testId="crm-deal-detail"
        >
          <DealDetailBody
            deal={selected}
            account={selectedAccount}
            stages={stagesSorted}
            activities={activities}
            onMoveStage={handleMoveStage}
            moving={moving}
          />
        </DetailPanel>
      ) : null}
      {selected && editing ? (
        <DealEditModal
          deal={selected}
          accounts={accounts}
          stages={stagesSorted}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  );
};

const DealsTab = ({ workspaceId }: DealsTabProps) => {
  const t = useI18n();
  return (
    <SWRErrorBoundary
      fallbackRender={fallbackProps =>
        renderListErrorFallback(
          fallbackProps,
          { retryLabel: t['com.manut.crm.error.retry']() },
          t['com.manut.crm.error.unknown'](),
          t['com.manut.crm.error.message']()
        )
      }
    >
      <Suspense fallback={<ListSkeleton />}>
        <DealsTabInner workspaceId={workspaceId} />
      </Suspense>
    </SWRErrorBoundary>
  );
};

interface DealCreateModalProps {
  workspaceId: string;
  stages: readonly MnCrmDealStage[];
  accounts: readonly MnCrmAccount[];
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  onStageCreated: () => Promise<void> | void;
}

const DealCreateModal = ({
  workspaceId,
  stages,
  accounts,
  onClose,
  onCreated,
  onStageCreated,
}: DealCreateModalProps) => {
  const t = useI18n();
  const [name, setName] = useState('');
  const [valueText, setValueText] = useState('');
  const [stageId, setStageId] = useState<string | null>(stages[0]?.id ?? null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { trigger } = useMutation({ mutation: createMnCrmDealMutation });

  const numericValue = useMemo(() => {
    if (!valueText.trim()) return null;
    const parsed = Number(valueText);
    return Number.isFinite(parsed) ? parsed : null;
  }, [valueText]);

  const canSubmit =
    name.trim().length > 0 &&
    stageId !== null &&
    (valueText.trim() === '' || numericValue !== null) &&
    !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || stageId === null) return;
    setSubmitting(true);
    try {
      const input: CreateMnCrmDealInput = {
        name: name.trim(),
        stageId,
        value: numericValue,
        accountId,
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      })) as CreateMnCrmDealResponse;
      if (!response?.createMnCrmDeal) {
        throw new Error('Deal creation returned no record');
      }
      notify.success({ title: t['com.manut.crm.deals.created']() });
      await onCreated();
    } catch (err) {
      notify.error({
        title: t['com.manut.crm.deals.create.error'](),
        message: getErrorMessage(err, t['com.manut.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    accountId,
    canSubmit,
    name,
    numericValue,
    onCreated,
    stageId,
    t,
    trigger,
    workspaceId,
  ]);

  const handleStageCreated = useCallback(
    async (stage: MnCrmDealStage) => {
      setStageId(stage.id);
      setStageDialogOpen(false);
      await onStageCreated();
    },
    [onStageCreated]
  );

  return (
    <>
      <Modal
        open
        onOpenChange={(open: boolean) => {
          if (!open) onClose();
        }}
        title={t['com.manut.crm.deals.create']()}
        width={420}
      >
        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            {t['com.manut.crm.fields.name']()}
          </label>
          <Input value={name} onChange={setName} />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            {t['com.manut.crm.fields.value']()}
          </label>
          <Input
            value={valueText}
            onChange={setValueText}
            type="number"
            inputMode="decimal"
            placeholder="0"
          />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            {t['com.manut.crm.fields.stage']()}
          </label>
          <StagePicker
            stages={stages}
            value={stageId}
            onChange={setStageId}
            onCreateStage={() => setStageDialogOpen(true)}
            placeholder={t['com.manut.crm.fields.stage.placeholder']()}
            createLabel={t['com.manut.crm.deals.addStage']()}
          />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            {t['com.manut.crm.fields.account']()}
          </label>
          <AccountPicker
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
            noneLabel={t['com.manut.crm.fields.account.none']()}
          />
        </div>
        <div className={styles.formActions}>
          <Button onClick={onClose} disabled={submitting}>
            {t['com.manut.crm.action.cancel']()}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            loading={submitting}
          >
            {t['com.manut.crm.action.create']()}
          </Button>
        </div>
      </Modal>
      {stageDialogOpen ? (
        <DealStageCreateModal
          workspaceId={workspaceId}
          onClose={() => setStageDialogOpen(false)}
          onCreated={handleStageCreated}
        />
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------------------
// Deal-stage create modal
// ---------------------------------------------------------------------------

interface DealStageCreateModalProps {
  workspaceId: string;
  onClose: () => void;
  onCreated: (stage: MnCrmDealStage) => Promise<void> | void;
}

const DealStageCreateModal = ({
  workspaceId,
  onClose,
  onCreated,
}: DealStageCreateModalProps) => {
  const t = useI18n();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { trigger } = useMutation({
    mutation: createMnCrmDealStageMutation,
  });

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: CreateMnCrmDealStageInput = { name: name.trim() };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      } as {
        workspaceId: string;
        input: CreateMnCrmDealStageInput;
      })) as CreateMnCrmDealStageResponse;
      if (!response?.createMnCrmDealStage) {
        throw new Error('No stage returned');
      }
      notify.success({ title: t['com.manut.crm.deals.stage.created']() });
      await onCreated(response.createMnCrmDealStage);
    } catch (err) {
      notify.error({
        title: t['com.manut.crm.deals.stage.create.error'](),
        message: getErrorMessage(err, t['com.manut.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, name, onCreated, t, trigger, workspaceId]);

  return (
    <Modal
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
      title={t['com.manut.crm.deals.addStage']()}
      width={360}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.stage.name']()}
        </label>
        <Input value={name} onChange={setName} />
      </div>
      <div className={styles.formActions}>
        <Button onClick={onClose} disabled={submitting}>
          {t['com.manut.crm.action.cancel']()}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
        >
          {t['com.manut.crm.action.create']()}
        </Button>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Activities tab
// ---------------------------------------------------------------------------

interface ActivitiesTabProps {
  workspaceId: string;
}

const ACTIVITY_ICONS: Record<MnCrmActivityType, string> = {
  CALL: 'C',
  MEETING: 'M',
  EMAIL: 'E',
  NOTE: 'N',
  OTHER: 'O',
};

const ActivitiesTabInner = ({ workspaceId }: ActivitiesTabProps) => {
  const t = useI18n();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { data, mutate } = useQuery(
    toQueryArg(mnCrmActivitiesQuery, { workspaceId })
  );
  // Co-load the link-resolution sources. The list of activities is bounded
  // at 200 server-side; accounts/contacts/deals are typically smaller and
  // already cached by the other tabs, so this is essentially free.
  const { data: accountsData } = useQuery(
    toQueryArg(mnCrmAccountsQuery, { workspaceId })
  );
  const { data: contactsData } = useQuery(
    toQueryArg(mnCrmContactsQuery, { workspaceId })
  );
  const { data: dealsData } = useQuery(
    toQueryArg(mnCrmDealsQuery, { workspaceId })
  );

  const activities = useMemo(
    () =>
      ((data as unknown as MnCrmActivitiesResponse | undefined)
        ?.mnCrmActivities ?? []) as readonly MnCrmActivity[],
    [data]
  );
  const accounts = useMemo(
    () =>
      ((accountsData as unknown as MnCrmAccountsResponse | undefined)
        ?.mnCrmAccounts ?? []) as readonly MnCrmAccount[],
    [accountsData]
  );
  const contacts = useMemo(
    () =>
      ((contactsData as unknown as MnCrmContactsResponse | undefined)
        ?.mnCrmContacts ?? []) as readonly MnCrmContact[],
    [contactsData]
  );
  const deals = useMemo(
    () =>
      ((dealsData as unknown as MnCrmDealsResponse | undefined)?.mnCrmDeals ??
        []) as readonly MnCrmDeal[],
    [dealsData]
  );

  const sorted = useMemo(
    () =>
      [...activities].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [activities]
  );

  const accountById = useMemo(
    () => new Map(accounts.map(a => [a.id, a])),
    [accounts]
  );
  const contactById = useMemo(
    () => new Map(contacts.map(c => [c.id, c])),
    [contacts]
  );
  const dealById = useMemo(() => new Map(deals.map(d => [d.id, d])), [deals]);

  const selected = useMemo(
    () =>
      selectedId ? (activities.find(a => a.id === selectedId) ?? null) : null,
    [activities, selectedId]
  );
  const selectedAccount = useMemo(
    () =>
      selected && selected.accountId
        ? (accountById.get(selected.accountId) ?? null)
        : null,
    [accountById, selected]
  );
  const selectedContact = useMemo(
    () =>
      selected && selected.contactId
        ? (contactById.get(selected.contactId) ?? null)
        : null,
    [contactById, selected]
  );
  const selectedDeal = useMemo(
    () =>
      selected && selected.dealId
        ? (dealById.get(selected.dealId) ?? null)
        : null,
    [dealById, selected]
  );

  const handleCreated = useCallback(async () => {
    setCreating(false);
    await mutate();
  }, [mutate]);

  const handleSaved = useCallback(async () => {
    setEditing(false);
    await mutate();
  }, [mutate]);

  const handleExport = useCallback(() => {
    exportCrmCsv(
      'activities',
      buildCrmActivitiesCsv(sorted, {
        accounts: accountById,
        contacts: contactById,
        deals: dealById,
      }),
      sorted.length
    );
  }, [accountById, contactById, dealById, sorted]);

  const handleRowKey = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, activityId: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelectedId(activityId);
      }
    },
    []
  );

  return (
    <>
      <div className={styles.actionRow}>
        <div className={styles.placeholderText}>
          {t['com.manut.crm.activities.subtitle']()}
        </div>
        <div className={styles.actionButtons}>
          <CsvExportButton
            disabled={sorted.length === 0}
            onClick={handleExport}
            testId="crm-export-activities"
          />
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t['com.manut.crm.activities.create']()}
          </Button>
        </div>
      </div>
      {sorted.length === 0 ? (
        <div className={styles.emptyState} data-testid="crm-activities-empty">
          {t['com.manut.crm.activities.empty']()}
        </div>
      ) : (
        <div className={styles.listWrapper} data-testid="crm-activities-list">
          {sorted.map(activity => (
            <div
              key={activity.id}
              className={`${styles.listRow} ${styles.clickableRow}`}
              role="button"
              tabIndex={0}
              data-testid={`crm-activity-row-${activity.id}`}
              onClick={() => setSelectedId(activity.id)}
              onKeyDown={event => handleRowKey(event, activity.id)}
            >
              <div>
                <div className={styles.rowTitle}>
                  [{ACTIVITY_ICONS[activity.type]}]{' '}
                  {activity.subject ?? activity.type}
                </div>
                {activity.body ? (
                  <div className={styles.rowSubtitle}>
                    {activity.body.length > 120
                      ? `${activity.body.slice(0, 117)}...`
                      : activity.body}
                  </div>
                ) : null}
              </div>
              <div className={styles.rowMeta}>
                {formatDate(activity.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
      {creating ? (
        <ActivityCreateModal
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      ) : null}
      {selected ? (
        <DetailPanel
          open={!editing}
          onClose={() => setSelectedId(null)}
          title={selected.subject ?? selected.type}
          subtitle={selected.type}
          onEdit={() => setEditing(true)}
          testId="crm-activity-detail"
        >
          <ActivityDetailBody
            activity={selected}
            account={selectedAccount}
            contact={selectedContact}
            deal={selectedDeal}
          />
        </DetailPanel>
      ) : null}
      {selected && editing ? (
        <ActivityEditModal
          activity={selected}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  );
};

const ActivitiesTab = ({ workspaceId }: ActivitiesTabProps) => {
  const t = useI18n();
  return (
    <SWRErrorBoundary
      fallbackRender={fallbackProps =>
        renderListErrorFallback(
          fallbackProps,
          { retryLabel: t['com.manut.crm.error.retry']() },
          t['com.manut.crm.error.unknown'](),
          t['com.manut.crm.error.message']()
        )
      }
    >
      <Suspense fallback={<ListSkeleton />}>
        <ActivitiesTabInner workspaceId={workspaceId} />
      </Suspense>
    </SWRErrorBoundary>
  );
};

interface ActivityCreateModalProps {
  workspaceId: string;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

const ActivityCreateModal = ({
  workspaceId,
  onClose,
  onCreated,
}: ActivityCreateModalProps) => {
  const t = useI18n();
  const [type, setType] = useState<MnCrmActivityType>('NOTE');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { trigger } = useMutation({ mutation: createMnCrmActivityMutation });

  const canSubmit = subject.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: CreateMnCrmActivityInput = {
        type,
        subject: subject.trim(),
        body: body.trim() ? body.trim() : null,
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      })) as CreateMnCrmActivityResponse;
      if (!response?.createMnCrmActivity) {
        throw new Error('Activity creation returned no record');
      }
      notify.success({ title: t['com.manut.crm.activities.created']() });
      await onCreated();
    } catch (err) {
      notify.error({
        title: t['com.manut.crm.activities.create.error'](),
        message: getErrorMessage(err, t['com.manut.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [body, canSubmit, onCreated, subject, t, trigger, type, workspaceId]);

  return (
    <Modal
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
      title={t['com.manut.crm.activities.create']()}
      width={420}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.type']()}
        </label>
        <ActivityTypePicker value={type} onChange={setType} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.subject']()}
        </label>
        <Input value={subject} onChange={setSubject} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.body']()}
        </label>
        <textarea
          className={styles.textarea}
          value={body}
          onChange={event => setBody(event.target.value)}
        />
      </div>
      <div className={styles.formActions}>
        <Button onClick={onClose} disabled={submitting}>
          {t['com.manut.crm.action.cancel']()}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
        >
          {t['com.manut.crm.action.create']()}
        </Button>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

const CrmPage = () => {
  const t = useI18n();
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const [activeTab, setActiveTab] = useState<TabKey>('accounts');

  const handleTabChange = useCallback((next: string) => {
    if ((TAB_KEYS as readonly string[]).includes(next)) {
      setActiveTab(next as TabKey);
    }
  }, []);

  return (
    <>
      <ViewTitle title={t['com.manut.crm.title']()} />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <CrmHeader />
      </ViewHeader>
      <ViewBody>
        <div className={styles.root} data-testid="crm-page">
          <Tabs.Root
            value={activeTab}
            onValueChange={handleTabChange}
            className={styles.tabsContent}
          >
            <Tabs.List className={styles.tabsList}>
              {TABS.map(tab => (
                <Tabs.Trigger
                  key={tab.key}
                  value={tab.key}
                  className={styles.tabTrigger}
                  data-testid={`crm-tab-${tab.key}`}
                >
                  {t[tab.i18nKey]()}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content value="accounts" className={styles.tabsContent}>
              <AccountsTab workspaceId={workspaceId} />
            </Tabs.Content>
            <Tabs.Content value="contacts" className={styles.tabsContent}>
              <ContactsTab workspaceId={workspaceId} />
            </Tabs.Content>
            <Tabs.Content value="deals" className={styles.tabsContent}>
              <DealsTab workspaceId={workspaceId} />
            </Tabs.Content>
            <Tabs.Content value="activities" className={styles.tabsContent}>
              <ActivitiesTab workspaceId={workspaceId} />
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => <CrmPage />;
