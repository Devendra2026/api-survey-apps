"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { PageHeader } from "@/components/shared/page-elements"
import { useStates } from "@/hooks/use-api"
import { apiGetPaginated } from "@/lib/api/client"

export default function AdminGeographyPage() {
  const { data: states } = useStates({ limit: 50 })
  const { data: districts } = useQuery({
    queryKey: ["districts", "all"],
    queryFn: () => apiGetPaginated<{ id: string; name: string; stateId: string }>("/districts?limit=100"),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Geography" description="State → District → ULB → Ward hierarchy" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>States ({states?.meta.total ?? 0})</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {states?.items.map((s) => (
              <div key={s.id} className="flex justify-between border-b pb-2">
                <span>{s.name}</span>
                <span className="text-muted-foreground">{s.code}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Districts ({districts?.meta.total ?? 0})</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {districts?.items.map((d) => (
              <div key={d.id} className="border-b pb-2">{d.name}</div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
