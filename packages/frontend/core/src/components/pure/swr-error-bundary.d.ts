import type { ErrorBoundaryProps } from 'react-error-boundary';
/**
 * If we use suspense mode in SWR, we need to preload or delete cache to retry request.
 * Or the error will be cached and the request will not be retried.
 *
 * Reference:
 * https://github.com/vercel/swr/issues/2740
 * https://github.com/vercel/swr/blob/main/core/src/use-swr.ts#L690
 * https://github.com/vercel/swr/tree/main/examples/suspense-retry
 */
export declare const SWRErrorBoundary: (props: ErrorBoundaryProps) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=swr-error-bundary.d.ts.map