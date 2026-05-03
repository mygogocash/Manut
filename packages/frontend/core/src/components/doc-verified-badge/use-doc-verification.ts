import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { unverifyDocMutation, verifyDocMutation } from '@affine/graphql';
import { useCallback, useState } from 'react';

/**
 * Local-only GraphQL query for fetching a doc's verification state.
 *
 * Defined here rather than in `@affine/graphql` because the backend resolver
 * was added in the same release and the codegen pipeline hasn't been re-run.
 * Replace with a generated import once codegen catches up.
 */
interface DocVerificationFields {
  id: string;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verificationExpiresAt: string | null;
}

interface DocVerificationResponse {
  workspace: {
    doc: DocVerificationFields | null;
  } | null;
}

export const getDocVerificationQuery = {
  id: 'getDocVerificationQuery' as const,
  op: 'getDocVerification',
  query: `query getDocVerification($workspaceId: String!, $docId: String!) {
  workspace(id: $workspaceId) {
    doc(docId: $docId) {
      id
      isVerified
      verifiedAt
      verifiedBy
      verificationExpiresAt
    }
  }
}`,
};

export interface UseDocVerificationOptions {
  workspaceId: string;
  docId: string;
}

export interface UseDocVerificationResult {
  isVerified: boolean;
  verifiedAt: Date | undefined;
  verifiedBy: string | undefined;
  verificationExpiresAt: Date | undefined;
  /** True while the verification state is being fetched for the first time. */
  isLoading: boolean;
  /**
   * Latest error from either the query or a verify/unverify mutation.
   * Cleared at the start of each new mutation attempt.
   */
  error: Error | null;
  verify: (expiresAt?: Date) => Promise<void>;
  unverify: () => Promise<void>;
  isVerifying: boolean;
  isUnverifying: boolean;
}

export function useDocVerification({
  workspaceId,
  docId,
}: UseDocVerificationOptions): UseDocVerificationResult {
  const [mutationError, setMutationError] = useState<Error | null>(null);

  // The local query objects aren't part of the codegen'd `Queries` /
  // `Mutations` discriminated unions, so the framework hooks infer
  // `variables: undefined` for them. Cast at the boundary with a clear
  // reason. Replace with a typed import once codegen is re-run.
  const queryArg = {
    query: getDocVerificationQuery,
    variables: { workspaceId, docId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, error: queryError, isLoading, mutate } = useQuery(queryArg);

  const doc = (data as unknown as DocVerificationResponse | undefined)
    ?.workspace?.doc;
  const isVerified = doc?.isVerified ?? false;

  const verifiedAt = doc?.verifiedAt ? new Date(doc.verifiedAt) : undefined;
  const verifiedBy = doc?.verifiedBy ?? undefined;
  const verificationExpiresAt = doc?.verificationExpiresAt
    ? new Date(doc.verificationExpiresAt)
    : undefined;

  const { trigger: triggerVerify, isMutating: isVerifying } = useMutation({
    mutation: verifyDocMutation,
  });

  const { trigger: triggerUnverify, isMutating: isUnverifying } = useMutation({
    mutation: unverifyDocMutation,
  });

  const verify = useCallback(
    async (expiresAt?: Date) => {
      setMutationError(null);
      try {
        // Cast for the same reason as the useQuery call above — variables are
        // not codegen-typed yet for verifyDocMutation either.
        await (triggerVerify as (args: unknown) => Promise<unknown>)({
          workspaceId,
          docId,
          expiresAt,
        });
        await mutate();
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setMutationError(e);
        throw e;
      }
    },
    [triggerVerify, mutate, workspaceId, docId]
  );

  const unverify = useCallback(async () => {
    setMutationError(null);
    try {
      await (triggerUnverify as (args: unknown) => Promise<unknown>)({
        workspaceId,
        docId,
      });
      await mutate();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setMutationError(e);
      throw e;
    }
  }, [triggerUnverify, mutate, workspaceId, docId]);

  return {
    isVerified,
    verifiedAt,
    verifiedBy,
    verificationExpiresAt,
    isLoading,
    error: mutationError ?? (queryError as Error | undefined) ?? null,
    verify,
    unverify,
    isVerifying,
    isUnverifying,
  };
}
