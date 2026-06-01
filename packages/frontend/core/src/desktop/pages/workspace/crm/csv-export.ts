import type {
  MnCrmAccount,
  MnCrmActivity,
  MnCrmContact,
  MnCrmDeal,
  MnCrmDealStage,
} from '../../../../modules/manut-crm';

type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]) {
  const header = columns.map(column => escapeCsvCell(column.header)).join(',');
  const body = rows.map(row =>
    columns.map(column => escapeCsvCell(column.value(row))).join(',')
  );
  return [header, ...body, ''].join('\r\n');
}

export function buildCrmAccountsCsv(accounts: readonly MnCrmAccount[]) {
  return toCsv(
    [
      { header: 'Name', value: account => account.name },
      { header: 'Website', value: account => account.website },
      { header: 'Industry', value: account => account.industry },
      { header: 'Notes', value: account => account.notes },
      { header: 'Created At', value: account => account.createdAt },
      { header: 'Updated At', value: account => account.updatedAt },
    ],
    accounts
  );
}

export function buildCrmContactsCsv(
  contacts: readonly MnCrmContact[],
  accounts: ReadonlyMap<string, MnCrmAccount>
) {
  return toCsv(
    [
      { header: 'First Name', value: contact => contact.firstName },
      { header: 'Last Name', value: contact => contact.lastName },
      {
        header: 'Account',
        value: contact =>
          contact.accountId ? accounts.get(contact.accountId)?.name : null,
      },
      { header: 'Email', value: contact => contact.email },
      { header: 'Phone', value: contact => contact.phone },
      { header: 'Title', value: contact => contact.title },
      { header: 'Created At', value: contact => contact.createdAt },
      { header: 'Updated At', value: contact => contact.updatedAt },
    ],
    contacts
  );
}

export function buildCrmDealsCsv(
  deals: readonly MnCrmDeal[],
  lookups: {
    accounts: ReadonlyMap<string, MnCrmAccount>;
    stages: ReadonlyMap<string, MnCrmDealStage>;
  }
) {
  return toCsv(
    [
      { header: 'Name', value: deal => deal.name },
      {
        header: 'Account',
        value: deal =>
          deal.accountId ? lookups.accounts.get(deal.accountId)?.name : null,
      },
      {
        header: 'Stage',
        value: deal => lookups.stages.get(deal.stageId)?.name,
      },
      { header: 'Value', value: deal => deal.value },
      { header: 'Currency', value: deal => deal.currency },
      { header: 'Probability', value: deal => deal.probability },
      { header: 'Expected Close At', value: deal => deal.expectedCloseAt },
      { header: 'Created At', value: deal => deal.createdAt },
      { header: 'Updated At', value: deal => deal.updatedAt },
    ],
    deals
  );
}

export function buildCrmActivitiesCsv(
  activities: readonly MnCrmActivity[],
  lookups: {
    accounts: ReadonlyMap<string, MnCrmAccount>;
    contacts: ReadonlyMap<string, MnCrmContact>;
    deals: ReadonlyMap<string, MnCrmDeal>;
  }
) {
  return toCsv(
    [
      { header: 'Type', value: activity => activity.type },
      { header: 'Subject', value: activity => activity.subject },
      {
        header: 'Account',
        value: activity =>
          activity.accountId
            ? lookups.accounts.get(activity.accountId)?.name
            : null,
      },
      {
        header: 'Contact',
        value: activity =>
          activity.contactId
            ? contactDisplayName(lookups.contacts.get(activity.contactId))
            : null,
      },
      {
        header: 'Deal',
        value: activity =>
          activity.dealId ? lookups.deals.get(activity.dealId)?.name : null,
      },
      { header: 'Due At', value: activity => activity.dueAt },
      { header: 'Completed At', value: activity => activity.completedAt },
      { header: 'Body', value: activity => activity.body },
      { header: 'Created At', value: activity => activity.createdAt },
      { header: 'Updated At', value: activity => activity.updatedAt },
    ],
    activities
  );
}

export function crmExportFilename(
  entity: 'accounts' | 'contacts' | 'deals' | 'activities',
  now = new Date()
) {
  return `manut-crm-${entity}-${now.toISOString().slice(0, 10)}.csv`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: CsvValue) {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const text = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw;
  const escaped = text.replaceAll('"', '""');
  if (/["\r\n,]/.test(escaped) || escaped.trim() !== escaped) {
    return `"${escaped}"`;
  }
  return escaped;
}

function contactDisplayName(contact: MnCrmContact | undefined) {
  if (!contact) return null;
  return contact.lastName
    ? `${contact.firstName} ${contact.lastName}`
    : contact.firstName;
}
