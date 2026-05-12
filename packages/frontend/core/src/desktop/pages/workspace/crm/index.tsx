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
import { CollaborationIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { Suspense, useCallback, useMemo, useState } from 'react';
import type { FallbackProps } from 'react-error-boundary';

import { Header } from '../../../../components/pure/header';
import {
  type CreateSfCrmAccountInput,
  createSfCrmAccountMutation,
  type CreateSfCrmAccountResponse,
  type CreateSfCrmActivityInput,
  createSfCrmActivityMutation,
  type CreateSfCrmActivityResponse,
  type CreateSfCrmContactInput,
  createSfCrmContactMutation,
  type CreateSfCrmContactResponse,
  type CreateSfCrmDealInput,
  createSfCrmDealMutation,
  type CreateSfCrmDealResponse,
  type CreateSfCrmDealStageInput,
  createSfCrmDealStageMutation,
  type CreateSfCrmDealStageResponse,
  SF_CRM_ACTIVITY_TYPES,
  type SfCrmAccount,
  sfCrmAccountsQuery,
  type SfCrmAccountsResponse,
  sfCrmActivitiesQuery,
  type SfCrmActivitiesResponse,
  type SfCrmActivity,
  type SfCrmActivityType,
  type SfCrmContact,
  sfCrmContactsQuery,
  type SfCrmContactsResponse,
  type SfCrmDeal,
  sfCrmDealsQuery,
  type SfCrmDealsResponse,
  type SfCrmDealStage,
  sfCrmDealStagesQuery,
  type SfCrmDealStagesResponse,
} from '../../../../modules/superflow-crm';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './styles.css';

// The Superflow CRM operations are not part of the codegen'd
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
    | 'com.superflow.crm.tab.accounts'
    | 'com.superflow.crm.tab.contacts'
    | 'com.superflow.crm.tab.deals'
    | 'com.superflow.crm.tab.activities';
}

const TABS: readonly TabDef[] = [
  { key: 'accounts', i18nKey: 'com.superflow.crm.tab.accounts' },
  { key: 'contacts', i18nKey: 'com.superflow.crm.tab.contacts' },
  { key: 'deals', i18nKey: 'com.superflow.crm.tab.deals' },
  { key: 'activities', i18nKey: 'com.superflow.crm.tab.activities' },
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

function contactFullName(contact: SfCrmContact): string {
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
          <CollaborationIcon /> {t['com.superflow.crm.title']()}
        </span>
      }
    />
  );
};

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
  accounts: readonly SfCrmAccount[];
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
  stages: readonly SfCrmDealStage[];
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
  value: SfCrmActivityType;
  onChange: (value: SfCrmActivityType) => void;
}

const ActivityTypePicker = ({ value, onChange }: ActivityTypePickerProps) => {
  return (
    <Menu
      items={
        <>
          {SF_CRM_ACTIVITY_TYPES.map(type => (
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

  const { data, mutate } = useQuery(
    toQueryArg(sfCrmAccountsQuery, { workspaceId })
  );
  const accounts = ((data as unknown as SfCrmAccountsResponse | undefined)
    ?.sfCrmAccounts ?? []) as readonly SfCrmAccount[];

  const handleCreated = useCallback(async () => {
    setCreating(false);
    await mutate();
  }, [mutate]);

  return (
    <>
      <div className={styles.actionRow}>
        <div className={styles.placeholderText}>
          {t['com.superflow.crm.accounts.subtitle']()}
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          {t['com.superflow.crm.accounts.create']()}
        </Button>
      </div>
      {accounts.length === 0 ? (
        <div className={styles.emptyState} data-testid="crm-accounts-empty">
          {t['com.superflow.crm.accounts.empty']()}
        </div>
      ) : (
        <div className={styles.listWrapper} data-testid="crm-accounts-list">
          {accounts.map(account => (
            <div key={account.id} className={styles.listRow}>
              <div>
                <div className={styles.rowTitle}>{account.name}</div>
                {account.industry ? (
                  <div className={styles.rowSubtitle}>{account.industry}</div>
                ) : null}
                {account.website ? (
                  <div className={styles.rowSubtitle}>{account.website}</div>
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
          { retryLabel: t['com.superflow.crm.error.retry']() },
          t['com.superflow.crm.error.unknown'](),
          t['com.superflow.crm.error.message']()
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

  const { trigger } = useMutation({ mutation: createSfCrmAccountMutation });

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: CreateSfCrmAccountInput = {
        name: name.trim(),
        industry: industry.trim() ? industry.trim() : null,
        website: website.trim() ? website.trim() : null,
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      })) as CreateSfCrmAccountResponse;
      if (!response?.createSfCrmAccount) {
        throw new Error('Account creation returned no record');
      }
      notify.success({ title: t['com.superflow.crm.accounts.created']() });
      await onCreated();
    } catch (err) {
      notify.error({
        title: t['com.superflow.crm.accounts.create.error'](),
        message: getErrorMessage(err, t['com.superflow.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, industry, name, onCreated, t, trigger, website, workspaceId]);

  return (
    <Modal
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title={t['com.superflow.crm.accounts.create']()}
      width={420}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.name']()}
        </label>
        <Input
          value={name}
          onChange={setName}
          placeholder={t['com.superflow.crm.fields.name.placeholder']()}
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.industry']()}
        </label>
        <Input value={industry} onChange={setIndustry} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.website']()}
        </label>
        <Input value={website} onChange={setWebsite} placeholder="https://" />
      </div>
      <div className={styles.formActions}>
        <Button onClick={onClose} disabled={submitting}>
          {t['com.superflow.crm.action.cancel']()}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
        >
          {t['com.superflow.crm.action.create']()}
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

  const { data: contactsData, mutate } = useQuery(
    toQueryArg(sfCrmContactsQuery, { workspaceId })
  );
  const { data: accountsData } = useQuery(
    toQueryArg(sfCrmAccountsQuery, { workspaceId })
  );

  const contacts = useMemo(
    () =>
      ((contactsData as unknown as SfCrmContactsResponse | undefined)
        ?.sfCrmContacts ?? []) as readonly SfCrmContact[],
    [contactsData]
  );
  const accounts = useMemo(
    () =>
      ((accountsData as unknown as SfCrmAccountsResponse | undefined)
        ?.sfCrmAccounts ?? []) as readonly SfCrmAccount[],
    [accountsData]
  );

  const accountById = useMemo(
    () => new Map(accounts.map(account => [account.id, account])),
    [accounts]
  );

  const handleCreated = useCallback(async () => {
    setCreating(false);
    await mutate();
  }, [mutate]);

  return (
    <>
      <div className={styles.actionRow}>
        <div className={styles.placeholderText}>
          {t['com.superflow.crm.contacts.subtitle']()}
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          {t['com.superflow.crm.contacts.create']()}
        </Button>
      </div>
      {contacts.length === 0 ? (
        <div className={styles.emptyState} data-testid="crm-contacts-empty">
          {t['com.superflow.crm.contacts.empty']()}
        </div>
      ) : (
        <div className={styles.listWrapper} data-testid="crm-contacts-list">
          {contacts.map(contact => {
            const account = contact.accountId
              ? accountById.get(contact.accountId)
              : null;
            return (
              <div key={contact.id} className={styles.listRow}>
                <div>
                  <div className={styles.rowTitle}>
                    {contactFullName(contact)}
                  </div>
                  {contact.email ? (
                    <div className={styles.rowSubtitle}>{contact.email}</div>
                  ) : null}
                  {contact.phone ? (
                    <div className={styles.rowSubtitle}>{contact.phone}</div>
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
          { retryLabel: t['com.superflow.crm.error.retry']() },
          t['com.superflow.crm.error.unknown'](),
          t['com.superflow.crm.error.message']()
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
  accounts: readonly SfCrmAccount[];
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

  const { trigger } = useMutation({ mutation: createSfCrmContactMutation });
  const canSubmit = firstName.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: CreateSfCrmContactInput = {
        firstName: firstName.trim(),
        lastName: lastName.trim() ? lastName.trim() : null,
        email: email.trim() ? email.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        accountId,
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      })) as CreateSfCrmContactResponse;
      if (!response?.createSfCrmContact) {
        throw new Error('Contact creation returned no record');
      }
      notify.success({ title: t['com.superflow.crm.contacts.created']() });
      await onCreated();
    } catch (err) {
      notify.error({
        title: t['com.superflow.crm.contacts.create.error'](),
        message: getErrorMessage(err, t['com.superflow.crm.error.unknown']()),
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
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title={t['com.superflow.crm.contacts.create']()}
      width={420}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.firstName']()}
        </label>
        <Input value={firstName} onChange={setFirstName} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.lastName']()}
        </label>
        <Input value={lastName} onChange={setLastName} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.email']()}
        </label>
        <Input value={email} onChange={setEmail} type="email" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.phone']()}
        </label>
        <Input value={phone} onChange={setPhone} type="tel" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.account']()}
        </label>
        <AccountPicker
          accounts={accounts}
          value={accountId}
          onChange={setAccountId}
          noneLabel={t['com.superflow.crm.fields.account.none']()}
        />
      </div>
      <div className={styles.formActions}>
        <Button onClick={onClose} disabled={submitting}>
          {t['com.superflow.crm.action.cancel']()}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
        >
          {t['com.superflow.crm.action.create']()}
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

const DealsTabInner = ({ workspaceId }: DealsTabProps) => {
  const t = useI18n();
  const [creating, setCreating] = useState(false);

  const { data: dealsData, mutate } = useQuery(
    toQueryArg(sfCrmDealsQuery, { workspaceId })
  );
  const { data: stagesData, mutate: mutateStages } = useQuery(
    toQueryArg(sfCrmDealStagesQuery, { workspaceId })
  );
  const { data: accountsData } = useQuery(
    toQueryArg(sfCrmAccountsQuery, { workspaceId })
  );

  const deals = useMemo(
    () =>
      ((dealsData as unknown as SfCrmDealsResponse | undefined)?.sfCrmDeals ??
        []) as readonly SfCrmDeal[],
    [dealsData]
  );
  const stages = useMemo(
    () =>
      ((stagesData as unknown as SfCrmDealStagesResponse | undefined)
        ?.sfCrmDealStages ?? []) as readonly SfCrmDealStage[],
    [stagesData]
  );
  const accounts = useMemo(
    () =>
      ((accountsData as unknown as SfCrmAccountsResponse | undefined)
        ?.sfCrmAccounts ?? []) as readonly SfCrmAccount[],
    [accountsData]
  );

  const stagesSorted = useMemo(
    () => [...stages].sort((a, b) => a.sortOrder - b.sortOrder),
    [stages]
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, SfCrmDeal[]>();
    for (const stage of stagesSorted) {
      map.set(stage.id, []);
    }
    for (const deal of deals) {
      const bucket = map.get(deal.stageId);
      if (bucket) bucket.push(deal);
    }
    return map;
  }, [deals, stagesSorted]);

  const accountById = useMemo(
    () => new Map(accounts.map(account => [account.id, account])),
    [accounts]
  );

  const handleCreated = useCallback(async () => {
    setCreating(false);
    await mutate();
  }, [mutate]);

  const handleStageCreated = useCallback(async () => {
    await mutateStages();
  }, [mutateStages]);

  return (
    <>
      <div className={styles.actionRow}>
        <div className={styles.placeholderText}>
          {t['com.superflow.crm.deals.subtitle']()}
        </div>
        <Button
          variant="primary"
          onClick={() => setCreating(true)}
          disabled={stagesSorted.length === 0}
        >
          {t['com.superflow.crm.deals.create']()}
        </Button>
      </div>
      {stagesSorted.length === 0 ? (
        <div className={styles.emptyState} data-testid="crm-deals-empty">
          {t['com.superflow.crm.deals.noStages']()}
          <Button onClick={() => setCreating(true)}>
            {t['com.superflow.crm.deals.addStage']()}
          </Button>
        </div>
      ) : deals.length === 0 ? (
        <div className={styles.emptyState} data-testid="crm-deals-empty">
          {t['com.superflow.crm.deals.empty']()}
        </div>
      ) : (
        <div className={styles.groupedList} data-testid="crm-deals-list">
          {stagesSorted.map(stage => {
            const bucket = dealsByStage.get(stage.id) ?? [];
            if (bucket.length === 0) return null;
            return (
              <div key={stage.id}>
                <div className={styles.sectionLabel}>{stage.name}</div>
                <div className={styles.listWrapper}>
                  {bucket.map(deal => {
                    const account = deal.accountId
                      ? accountById.get(deal.accountId)
                      : null;
                    return (
                      <div key={deal.id} className={styles.listRow}>
                        <div>
                          <div className={styles.rowTitle}>{deal.name}</div>
                          {account ? (
                            <div className={styles.rowSubtitle}>
                              {account.name}
                            </div>
                          ) : null}
                        </div>
                        <div className={styles.rowMeta}>
                          {formatCurrency(deal.value, deal.currency)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
          { retryLabel: t['com.superflow.crm.error.retry']() },
          t['com.superflow.crm.error.unknown'](),
          t['com.superflow.crm.error.message']()
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
  stages: readonly SfCrmDealStage[];
  accounts: readonly SfCrmAccount[];
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

  const { trigger } = useMutation({ mutation: createSfCrmDealMutation });

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
      const input: CreateSfCrmDealInput = {
        name: name.trim(),
        stageId,
        value: numericValue,
        accountId,
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      })) as CreateSfCrmDealResponse;
      if (!response?.createSfCrmDeal) {
        throw new Error('Deal creation returned no record');
      }
      notify.success({ title: t['com.superflow.crm.deals.created']() });
      await onCreated();
    } catch (err) {
      notify.error({
        title: t['com.superflow.crm.deals.create.error'](),
        message: getErrorMessage(err, t['com.superflow.crm.error.unknown']()),
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
    async (stage: SfCrmDealStage) => {
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
        onOpenChange={open => {
          if (!open) onClose();
        }}
        title={t['com.superflow.crm.deals.create']()}
        width={420}
      >
        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            {t['com.superflow.crm.fields.name']()}
          </label>
          <Input value={name} onChange={setName} />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            {t['com.superflow.crm.fields.value']()}
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
            {t['com.superflow.crm.fields.stage']()}
          </label>
          <StagePicker
            stages={stages}
            value={stageId}
            onChange={setStageId}
            onCreateStage={() => setStageDialogOpen(true)}
            placeholder={t['com.superflow.crm.fields.stage.placeholder']()}
            createLabel={t['com.superflow.crm.deals.addStage']()}
          />
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            {t['com.superflow.crm.fields.account']()}
          </label>
          <AccountPicker
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
            noneLabel={t['com.superflow.crm.fields.account.none']()}
          />
        </div>
        <div className={styles.formActions}>
          <Button onClick={onClose} disabled={submitting}>
            {t['com.superflow.crm.action.cancel']()}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            loading={submitting}
          >
            {t['com.superflow.crm.action.create']()}
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
  onCreated: (stage: SfCrmDealStage) => Promise<void> | void;
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
    mutation: createSfCrmDealStageMutation,
  });

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: CreateSfCrmDealStageInput = { name: name.trim() };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      } as {
        workspaceId: string;
        input: CreateSfCrmDealStageInput;
      })) as CreateSfCrmDealStageResponse;
      if (!response?.createSfCrmDealStage) {
        throw new Error('No stage returned');
      }
      notify.success({ title: t['com.superflow.crm.deals.stage.created']() });
      await onCreated(response.createSfCrmDealStage);
    } catch (err) {
      notify.error({
        title: t['com.superflow.crm.deals.stage.create.error'](),
        message: getErrorMessage(err, t['com.superflow.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, name, onCreated, t, trigger, workspaceId]);

  return (
    <Modal
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title={t['com.superflow.crm.deals.addStage']()}
      width={360}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.stage.name']()}
        </label>
        <Input value={name} onChange={setName} />
      </div>
      <div className={styles.formActions}>
        <Button onClick={onClose} disabled={submitting}>
          {t['com.superflow.crm.action.cancel']()}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
        >
          {t['com.superflow.crm.action.create']()}
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

const ACTIVITY_ICONS: Record<SfCrmActivityType, string> = {
  CALL: 'C',
  MEETING: 'M',
  EMAIL: 'E',
  NOTE: 'N',
  OTHER: 'O',
};

const ActivitiesTabInner = ({ workspaceId }: ActivitiesTabProps) => {
  const t = useI18n();
  const [creating, setCreating] = useState(false);

  const { data, mutate } = useQuery(
    toQueryArg(sfCrmActivitiesQuery, { workspaceId })
  );
  const activities = useMemo(
    () =>
      ((data as unknown as SfCrmActivitiesResponse | undefined)
        ?.sfCrmActivities ?? []) as readonly SfCrmActivity[],
    [data]
  );

  const sorted = useMemo(
    () =>
      [...activities].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [activities]
  );

  const handleCreated = useCallback(async () => {
    setCreating(false);
    await mutate();
  }, [mutate]);

  return (
    <>
      <div className={styles.actionRow}>
        <div className={styles.placeholderText}>
          {t['com.superflow.crm.activities.subtitle']()}
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          {t['com.superflow.crm.activities.create']()}
        </Button>
      </div>
      {sorted.length === 0 ? (
        <div className={styles.emptyState} data-testid="crm-activities-empty">
          {t['com.superflow.crm.activities.empty']()}
        </div>
      ) : (
        <div className={styles.listWrapper} data-testid="crm-activities-list">
          {sorted.map(activity => (
            <div key={activity.id} className={styles.listRow}>
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
          { retryLabel: t['com.superflow.crm.error.retry']() },
          t['com.superflow.crm.error.unknown'](),
          t['com.superflow.crm.error.message']()
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
  const [type, setType] = useState<SfCrmActivityType>('NOTE');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { trigger } = useMutation({ mutation: createSfCrmActivityMutation });

  const canSubmit = subject.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: CreateSfCrmActivityInput = {
        type,
        subject: subject.trim(),
        body: body.trim() ? body.trim() : null,
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      })) as CreateSfCrmActivityResponse;
      if (!response?.createSfCrmActivity) {
        throw new Error('Activity creation returned no record');
      }
      notify.success({ title: t['com.superflow.crm.activities.created']() });
      await onCreated();
    } catch (err) {
      notify.error({
        title: t['com.superflow.crm.activities.create.error'](),
        message: getErrorMessage(err, t['com.superflow.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [body, canSubmit, onCreated, subject, t, trigger, type, workspaceId]);

  return (
    <Modal
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title={t['com.superflow.crm.activities.create']()}
      width={420}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.type']()}
        </label>
        <ActivityTypePicker value={type} onChange={setType} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.subject']()}
        </label>
        <Input value={subject} onChange={setSubject} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.superflow.crm.fields.body']()}
        </label>
        <textarea
          className={styles.textarea}
          value={body}
          onChange={event => setBody(event.target.value)}
        />
      </div>
      <div className={styles.formActions}>
        <Button onClick={onClose} disabled={submitting}>
          {t['com.superflow.crm.action.cancel']()}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
        >
          {t['com.superflow.crm.action.create']()}
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
      <ViewTitle title={t['com.superflow.crm.title']()} />
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
