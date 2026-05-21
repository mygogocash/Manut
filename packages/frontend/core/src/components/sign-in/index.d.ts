import { type Server } from '@affine/core/modules/cloud';
import type { AuthSessionStatus } from '@affine/core/modules/cloud/entities/session';
export type SignInStep = 'signIn' | 'signInWithPassword' | 'signInWithEmail';
export interface SignInState {
    step: SignInStep;
    server?: Server;
    initialServerBaseUrl?: string;
    email?: string;
    hasPassword?: boolean;
    redirectUrl?: string;
}
interface SignInPanelProps {
    onAuthenticated?: (status: AuthSessionStatus) => void;
    onSkip: () => void;
    server?: string;
    initStep?: SignInStep | undefined;
}
export declare const SignInPanel: ({ onSkip, server: initialServerBaseUrl, initStep, onAuthenticated, }: SignInPanelProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=index.d.ts.map