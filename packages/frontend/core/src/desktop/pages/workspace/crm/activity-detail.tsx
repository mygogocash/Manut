import { useI18n } from '@affine/i18n';

import type {
  MnCrmAccount,
  MnCrmActivity,
  MnCrmContact,
  MnCrmDeal,
} from '../../../../modules/manut-crm';
import { DetailField } from './detail-panel';

interface ActivityDetailBodyProps {
  activity: MnCrmActivity;
  account: MnCrmAccount | null;
  contact: MnCrmContact | null;
  deal: MnCrmDeal | null;
}

function fullName(contact: MnCrmContact): string {
  return contact.lastName
    ? `${contact.firstName} ${contact.lastName}`
    : contact.firstName;
}

export const ActivityDetailBody = ({
  activity,
  account,
  contact,
  deal,
}: ActivityDetailBodyProps) => {
  const t = useI18n();

  // The backend FKs are mutually independent — an activity can link to
  // any combination of account/contact/deal. We surface whichever links
  // exist; otherwise show the empty placeholder.
  const linkedLabel = [
    deal ? `${t['com.manut.crm.tab.deals']()}: ${deal.name}` : null,
    contact
      ? `${t['com.manut.crm.tab.contacts']()}: ${fullName(contact)}`
      : null,
    account ? `${t['com.manut.crm.tab.accounts']()}: ${account.name}` : null,
  ]
    .filter((s): s is string => Boolean(s))
    .join(' · ');

  return (
    <>
      <DetailField
        label={t['com.manut.crm.fields.type']()}
        value={activity.type}
        testId="activity-detail-type"
      />
      <DetailField
        label={t['com.manut.crm.fields.subject']()}
        value={activity.subject}
        testId="activity-detail-subject"
      />
      <DetailField
        label={t['com.manut.crm.fields.body']()}
        value={activity.body}
      />
      <DetailField
        label={t['com.manut.crm.detail.activity.linked']()}
        value={linkedLabel ? linkedLabel : null}
        testId="activity-detail-linked"
      />
    </>
  );
};
