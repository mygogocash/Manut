import { useI18n } from '@affine/i18n';
import { useMemo } from 'react';

import type {
  MnCrmAccount,
  MnCrmContact,
  MnCrmDeal,
} from '../../../../modules/manut-crm';
import { DetailField } from './detail-panel';
import * as styles from './styles.css';

interface AccountDetailBodyProps {
  account: MnCrmAccount;
  contacts: readonly MnCrmContact[];
  deals: readonly MnCrmDeal[];
}

function fullName(contact: MnCrmContact): string {
  return contact.lastName
    ? `${contact.firstName} ${contact.lastName}`
    : contact.firstName;
}

function formatCurrency(value: number | null, currency: string | null): string {
  if (value === null) return '—';
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

export const AccountDetailBody = ({
  account,
  contacts,
  deals,
}: AccountDetailBodyProps) => {
  const t = useI18n();

  // Filter linked records to just this account; deals listed under
  // "active" stages aren't separated from won/lost since the v0 stage
  // model has no archived flag yet — show all so users see history.
  const linkedContacts = useMemo(
    () => contacts.filter(contact => contact.accountId === account.id),
    [contacts, account.id]
  );
  const linkedDeals = useMemo(
    () => deals.filter(deal => deal.accountId === account.id),
    [deals, account.id]
  );

  return (
    <>
      <DetailField
        label={t['com.manut.crm.fields.name']()}
        value={account.name}
        testId="account-detail-name"
      />
      <DetailField
        label={t['com.manut.crm.fields.industry']()}
        value={account.industry}
      />
      <DetailField
        label={t['com.manut.crm.fields.website']()}
        value={account.website}
      />
      <DetailField
        label={t['com.manut.crm.fields.notes']()}
        value={account.notes}
      />

      <div className={styles.detailSection}>
        <span className={styles.detailLabel}>
          {t['com.manut.crm.detail.account.contacts']()}
        </span>
        {linkedContacts.length === 0 ? (
          <span className={styles.detailEmpty}>
            {t['com.manut.crm.detail.linked.none']()}
          </span>
        ) : (
          <div
            className={styles.detailLinkedList}
            data-testid="account-detail-contacts"
          >
            {linkedContacts.map(contact => (
              <div key={contact.id} className={styles.detailLinkedRow}>
                <span>{fullName(contact)}</span>
                {contact.email ? (
                  <span className={styles.detailLinkedMeta}>
                    {contact.email}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.detailSection}>
        <span className={styles.detailLabel}>
          {t['com.manut.crm.detail.account.deals']()}
        </span>
        {linkedDeals.length === 0 ? (
          <span className={styles.detailEmpty}>
            {t['com.manut.crm.detail.linked.none']()}
          </span>
        ) : (
          <div
            className={styles.detailLinkedList}
            data-testid="account-detail-deals"
          >
            {linkedDeals.map(deal => (
              <div key={deal.id} className={styles.detailLinkedRow}>
                <span>{deal.name}</span>
                <span className={styles.detailLinkedMeta}>
                  {formatCurrency(deal.value, deal.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
