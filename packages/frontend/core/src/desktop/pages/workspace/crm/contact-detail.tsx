import { useI18n } from '@affine/i18n';

import type { MnCrmAccount, MnCrmContact } from '../../../../modules/manut-crm';
import { DetailField } from './detail-panel';

interface ContactDetailBodyProps {
  contact: MnCrmContact;
  account: MnCrmAccount | null;
}

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
      <DetailField
        label={t['com.manut.crm.fields.email']()}
        value={contact.email}
      />
      <DetailField
        label={t['com.manut.crm.fields.phone']()}
        value={contact.phone}
      />
      <DetailField
        label={t['com.manut.crm.fields.title']()}
        value={contact.title}
      />
      <DetailField
        label={t['com.manut.crm.fields.account']()}
        value={account ? account.name : null}
        testId="contact-detail-account"
      />
    </>
  );
};
