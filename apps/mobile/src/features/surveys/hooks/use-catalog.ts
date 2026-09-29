import { catalogLoadMessage, listActiveCatalogOptions, type CatalogOption } from "@/services/api/catalog"
import { useQuery } from "@tanstack/react-query"

export function useCatalogOptions(categoryCode: string) {
  const query = useQuery({
    queryKey: ["configuration", "entries", categoryCode, "ACTIVE"],
    queryFn: () => listActiveCatalogOptions(categoryCode),
    staleTime: 30 * 60_000,
  })

  const options: CatalogOption[] = query.data ?? []
  return {
    options,
    loading: query.isPending,
    error: query.isError ? catalogLoadMessage(query.error) : null,
    empty: query.isSuccess && options.length === 0,
    retry: () => {
      void query.refetch()
    },
  }
}
