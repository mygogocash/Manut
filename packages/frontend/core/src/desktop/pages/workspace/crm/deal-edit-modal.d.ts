import { type MnCrmAccount, type MnCrmDeal, type MnCrmDealStage } from '../../../../modules/manut-crm';
interface DealEditModalProps {
    deal: MnCrmDeal;
    accounts: readonly MnCrmAccount[];
    stages: readonly MnCrmDealStage[];
    onClose: () => void;
    onSaved: () => Promise<void> | void;
}
export declare const DealEditModal: ({ deal, accounts, stages, onClose, onSaved, }: DealEditModalProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=deal-edit-modal.d.ts.map