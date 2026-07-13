"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { PageHeader } from "@/components/shared/page-elements"
import { apiGetPaginated } from "@/lib/api/client"

export default function AdminRolesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () =>
      apiGetPaginated<{ id: string; name: string; description?: string | null }>("/roles?limit=50"),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Roles" description="Database-driven RBAC roles and permissions" />

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading roles...</p>
        ) : (
          data?.items.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <CardTitle className="text-base">{role.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{role.description ?? "No description"}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
