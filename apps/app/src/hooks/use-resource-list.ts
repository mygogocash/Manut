import { useApiQuery } from "@/hooks/use-api-query";
import { unwrapList } from "@/lib/list";
import { queryKeys } from "@/lib/query-keys";

export function useResourceList<T>(path: string) {
  const query = useApiQuery<unknown>(queryKeys.resource(path), path);
  return {
    items: unwrapList<T>(query.data),
    loading: query.isLoading,
    error: query.error?.message ?? null,
    retry: () => {
      void query.refetch();
    },
  };
}
