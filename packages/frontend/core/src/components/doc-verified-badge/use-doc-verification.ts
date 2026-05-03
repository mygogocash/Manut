import { useQuery } from '@affine/core/components/hooks/use-query';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import {
  unverifyDocMutation,
  verifyDocMutation,
} from '@affine/graphql';
import { useCallback } from 'react';

/**
 * A local-only GraphQL query object (not code-generated) for fetching
 * doc verification state. The fields are exposed by the backend DocType.
 */
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
} as const;

export interface UseDocVerificationOptions {
  workspaceId: string;
  docId: string;
}

export function useDocVerification({
  workspaceId,
  docId,
}: UseDocVerificationOptions) {
  const { data, mutate } = useQuery({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: getDocVerificationQuery as any,
    variables: { workspaceId, docId },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (data as any)?.workspace?.doc;
  const isVerified: boolean = doc?.isVerified ?? false;

  const { trigger: triggerVerify, isMutating: isVerifying } = useMutation({
    mutation: verifyDocMutation,
  });

  const { trigger: triggerUnverify, isMutating: isUnverifying } = useMutation({
    mutation: unverifyDocMutation,
  });

  const verify = useCallback(
    async (expiresAt?: Date) => {
      await triggerVerify({ workspaceId, docId, expiresAt });
      await mutate();
    },
    [triggerVerify, mutate, workspaceId, docId]
  );

  const unverify = useCallback(async () => {
    await triggerUnverify({ workspaceId, docId });
    await mutate();
  }, [triggerUnverify, mutate, workspaceId, docId]);

  return {
    isVerified,
    verifiedAt: doc?.verifiedAt as Date | undefined,
    verifiedBy: doc?.verifiedBy as string | undefined,
    verificationExpiresAt: doc?.verificationExpiresAt as Date | undefined,
    verify,
    unverify,
    isVerifying,
    isUnverifying,
  };
}
