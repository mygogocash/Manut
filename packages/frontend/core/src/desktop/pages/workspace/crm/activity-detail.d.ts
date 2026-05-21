import type { MnCrmAccount, MnCrmActivity, MnCrmContact, MnCrmDeal } from '../../../../modules/manut-crm';
interface ActivityDetailBodyProps {
    activity: MnCrmActivity;
    account: MnCrmAccount | null;
    contact: MnCrmContact | null;
    deal: MnCrmDeal | null;
}
export declare const ActivityDetailBody: ({ activity, account, contact, deal, }: ActivityDetailBodyProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=activity-detail.d.ts.map