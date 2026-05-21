import { type MnCrmAccount, type MnCrmContact } from '../../../../modules/manut-crm';
interface ContactEditModalProps {
    contact: MnCrmContact;
    accounts: readonly MnCrmAccount[];
    onClose: () => void;
    onSaved: () => Promise<void> | void;
}
export declare const ContactEditModal: ({ contact, accounts, onClose, onSaved, }: ContactEditModalProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=contact-edit-modal.d.ts.map