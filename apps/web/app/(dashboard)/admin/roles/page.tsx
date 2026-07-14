"use client"

import { EmptyState, PageHeader } from "@/components/shared/page-elements"
import { apiGetPaginated } from "@/lib/api/client"
import { useAuthStore } from "@/stores/app-store"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { KeyRound, Shield } from "lucide-react"

interface RoleItem {
  id: string
  name: string
  description?: string | null
  permissions?: Array<{ permission?: { name: string; description?: string | null } | null }>
}

interface PermissionItem {
  id: string
  name: string
  description?: string | null
}

export default function AdminRolesPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission("role:assign")

  const { data, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiGetPaginated<RoleItem>("/roles?limit=50"),
    enabled: canManage,
  })

  const { data: permissions } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      try {
        return await apiGetPaginated<PermissionItem>("/permissions?limit=100")
      } catch {
        return { items: [] as PermissionItem[], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } }
      }
    },
    enabled: canManage,
  })

  if (!canManage) {
    return <EmptyState title="Roles unavailable" description="You need role:assign permission." />
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roles & permissions"
        description="Database-driven RBAC with tenant-scoped assignments and fine-grained permission catalogs"
      />

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">Roles ({data?.meta.total ?? 0})</TabsTrigger>
          <TabsTrigger value="permissions">
            Permissions ({permissions?.meta.total ?? permissions?.items.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="mapping">Assignment model</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
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
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{role.description ?? "No description"}</p>
                      {role.permissions?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.slice(0, 8).map((entry, index) => (
                            <Badge key={`${role.id}-${index}`} variant="secondary" className="font-mono text-[10px]">
                              {entry.permission?.name ?? "permission"}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Permission catalog</CardTitle>
              <CardDescription>Fine-grained API capabilities used by guards and navigation</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {(permissions?.items ?? []).map((permission) => (
                <div key={permission.id} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-3.5 text-muted-foreground" />
                    <p className="font-mono text-xs font-medium">{permission.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{permission.description ?? "—"}</p>
                </div>
              ))}
              {!permissions?.items.length ? (
                <p className="text-sm text-muted-foreground">
                  Permissions are attached through RolePermission. Open a role detail API if the catalog endpoint is
                  empty.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Tenant assignment rules</CardTitle>
              <CardDescription>Preserved business logic for municipal multi-tenancy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Users never receive a direct role FK — assignments live on UserTenantRole.</p>
              <p>• Optional stateId / districtId / ulbId / wardId define hierarchy mapping.</p>
              <p>• Approval workflows remain permission-gated (survey:approve / survey:reject).</p>
              <p>• SecurityAudit records assigner, deactivator, and mutation metadata.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
