import { type MnCrmAccount } from '../../../../modules/manut-crm';
interface AccountEditModalProps {
    account: MnCrmAccount;
    onClose: () => void;
    onSaved: () => Promise<void> | void;
}
export declare const AccountEditModal: ({ account, onClose, onSaved, }: AccountEditModalProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=account-edit-modal.d.ts.map