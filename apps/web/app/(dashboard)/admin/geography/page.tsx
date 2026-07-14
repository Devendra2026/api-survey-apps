"use client"

import { PageHeader } from "@/components/shared/page-elements"
import { useStates } from "@/hooks/use-api"
import { apiGetPaginated } from "@/lib/api/client"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

export default function AdminGeographyPage() {
  const { data: states } = useStates({ limit: 50 })
  const { data: districts } = useQuery({
    queryKey: ["districts", "all"],
    queryFn: () => apiGetPaginated<{ id: string; name: string; stateId: string }>("/districts?limit=100"),
  })

  return (
    <div className="space-y-5">
      <PageHeader title="Geography" description="State → District → ULB → Ward hierarchy masters" />

      <Tabs defaultValue="states" className="space-y-4">
        <TabsList>
          <TabsTrigger value="states">States ({states?.meta.total ?? 0})</TabsTrigger>
          <TabsTrigger value="districts">Districts ({districts?.meta.total ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="states">
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">States</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-1 pr-3">
                  {states?.items.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="districts">
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Districts</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-1 pr-3">
                  {districts?.items.map((d) => (
                    <div key={d.id} className="rounded-lg border px-3 py-2 text-sm font-medium">
                      {d.name}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
