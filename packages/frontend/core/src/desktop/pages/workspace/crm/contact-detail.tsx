import { useI18n } from '@affine/i18n';
import type { ReactNode } from 'react';

import type { MnCrmAccount, MnCrmContact } from '../../../../modules/manut-crm';
import { toExternalHref } from './deal-totals';
import { DetailField } from './detail-panel';
import * as styles from './styles.css';

interface ContactDetailBodyProps {
  contact: MnCrmContact;
  account: MnCrmAccount | null;
}

/**
 * A labelled detail field whose value is an actionable link (mailto:, tel:,
 * or an external website). Falls back to the plain {@link DetailField}
 * placeholder rendering when the value is empty so the panel stays
 * consistent with the other rows.
 */
const DetailLinkField = ({
  label,
  value,
  href,
  external,
  testId,
}: {
  label: string;
  value: string | null | undefined;
  href: (value: string) => string;
  external?: boolean;
  testId?: string;
}): ReactNode => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return <DetailField label={label} value={value} testId={testId} />;
  }
  return (
    <div className={styles.detailSection} data-testid={testId}>
      <span className={styles.detailLabel}>{label}</span>
      <a
        className={styles.detailLink}
        href={href(trimmed)}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {trimmed}
      </a>
    </div>
  );
};

export const ContactDetailBody = ({
  contact,
  account,
}: ContactDetailBodyProps) => {
  const t = useI18n();

  return (
    <>
      <DetailField
        label={t['com.manut.crm.fields.firstName']()}
        value={contact.firstName}
        testId="contact-detail-firstName"
      />
      <DetailField
        label={t['com.manut.crm.fields.lastName']()}
        value={contact.lastName}
      />
      <DetailLinkField
        label={t['com.manut.crm.fields.email']()}
        value={contact.email}
        href={email => `mailto:${email}`}
        testId="contact-detail-email"
      />
      <DetailLinkField
        label={t['com.manut.crm.fields.phone']()}
        value={contact.phone}
        href={phone => `tel:${phone}`}
        testId="contact-detail-phone"
      />
      <DetailField
        label={t['com.manut.crm.fields.title']()}
        value={contact.title}
      />
      {account && account.website ? (
        <DetailLinkField
          label={t['com.manut.crm.fields.account']()}
          value={account.name}
          href={() => toExternalHref(account.website ?? '')}
          external
          testId="contact-detail-account"
        />
      ) : (
        <DetailField
          label={t['com.manut.crm.fields.account']()}
          value={account ? account.name : null}
          testId="contact-detail-account"
        />
      )}
    </>
  );
};
