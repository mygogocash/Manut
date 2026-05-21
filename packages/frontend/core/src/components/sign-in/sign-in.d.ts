import type { AuthSessionStatus } from '@affine/core/modules/cloud/entities/session';
import { type Dispatch, type SetStateAction } from 'react';
import type { SignInState } from '.';
interface SignInStepProps {
    state: SignInState;
    changeState: Dispatch<SetStateAction<SignInState>>;
    onSkip: () => void;
    onAuthenticated?: (status: AuthSessionStatus) => void;
}
export declare const SignInStep: ({ state, changeState, onAuthenticated, }: SignInStepProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=sign-in.d.ts.map