import type { MnCrmAccount, MnCrmActivity, MnCrmDeal, MnCrmDealStage } from '../../../../modules/manut-crm';
interface DealDetailBodyProps {
    deal: MnCrmDeal;
    account: MnCrmAccount | null;
    stages: readonly MnCrmDealStage[];
    activities: readonly MnCrmActivity[];
    /** Quick-move stage handler — calls updateMnCrmDeal with the new stageId. */
    onMoveStage: (stageId: string) => Promise<void> | void;
    /** Disabled when a mutation is in flight. */
    moving?: boolean;
}
export declare const DealDetailBody: ({ deal, account, stages, activities, onMoveStage, moving, }: DealDetailBodyProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=deal-detail.d.ts.map