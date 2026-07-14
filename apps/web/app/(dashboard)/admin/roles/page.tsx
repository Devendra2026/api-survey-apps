"use client"

import { PageHeader } from "@/components/shared/page-elements"
import { apiGetPaginated } from "@/lib/api/client"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Shield } from "lucide-react"

export default function AdminRolesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiGetPaginated<{ id: string; name: string; description?: string | null }>("/roles?limit=50"),
  })

  return (
    <div className="space-y-5">
      <PageHeader title="Roles" description="Database-driven RBAC roles and permissions" />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : data?.items.map((role) => (
              <Card key={role.id} className="shadow-none">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-accent">
                      <Shield className="size-3.5 text-accent-foreground" />
                    </div>
                    <CardTitle className="text-sm font-medium">{role.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className="rounded-md font-normal">
                    Role
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{role.description ?? "No description"}</p>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  )
}
