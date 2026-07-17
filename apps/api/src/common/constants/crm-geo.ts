/** Standard region picklist for Accounts. */
export const CRM_ACCOUNT_REGIONS = [
  "Africa",
  "Europe",
  "Asia",
  "Middle East",
] as const;

export type CrmAccountRegion = (typeof CRM_ACCOUNT_REGIONS)[number];
