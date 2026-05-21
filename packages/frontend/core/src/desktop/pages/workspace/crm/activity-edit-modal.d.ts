import { type MnCrmActivity } from '../../../../modules/manut-crm';
interface ActivityEditModalProps {
    activity: MnCrmActivity;
    onClose: () => void;
    onSaved: () => Promise<void> | void;
}
export declare const ActivityEditModal: ({ activity, onClose, onSaved, }: ActivityEditModalProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=activity-edit-modal.d.ts.map