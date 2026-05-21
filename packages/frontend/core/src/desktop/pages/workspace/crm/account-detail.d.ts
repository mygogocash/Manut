import type { MnCrmAccount, MnCrmContact, MnCrmDeal } from '../../../../modules/manut-crm';
interface AccountDetailBodyProps {
    account: MnCrmAccount;
    contacts: readonly MnCrmContact[];
    deals: readonly MnCrmDeal[];
}
export declare const AccountDetailBody: ({ account, contacts, deals, }: AccountDetailBodyProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=account-detail.d.ts.map