"use client"

import { DataTable } from "@/components/data-table/data-table"
import { EmptyState, PageHeader } from "@/components/shared/page-elements"
import { useUsers } from "@/hooks/use-api"
import type { AuthenticatedProfile } from "@/lib/api/types"
import { tenantRoleDisplayName } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { useMemo, useState } from "react"

export default function AdminUsersPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("user:view")
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<AuthenticatedProfile | null>(null)
  const { data, isLoading } = useUsers({ page, limit: 20, search: search || undefined })

  const columns = useMemo<ColumnDef<AuthenticatedProfile>[]>(
    () => [
      {
        accessorKey: "fullName",
        id: "name",
        header: "Name",
        cell: ({ row }) => (
          <button
            type="button"
            className="cursor-pointer font-medium text-primary hover:underline"
            onClick={() => setSelected(row.original)}
          >
            {row.original.fullName}
          </button>
        ),
      },
      { accessorKey: "email", header: "Email" },
      {
        id: "roles",
        header: "Roles / assignments",
        cell: ({ row }) => {
          const roles = row.original.tenantRoles?.filter((r) => r.isActive) ?? []
          if (!roles.length) return "—"
          return (
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <Badge key={role.id} variant="secondary" className="rounded-md font-normal">
                  {tenantRoleDisplayName(role)}
                </Badge>
              ))}
            </div>
          )
        },
      },
      {
        id: "scope",
        header: "Tenant mapping",
        cell: ({ row }) => {
          const roles = row.original.tenantRoles?.filter((r) => r.isActive) ?? []
          const scopes = roles
            .map((role) =>
              [
                role.stateId ? "State" : null,
                role.districtId ? "District" : null,
                role.ulbId ? "ULB" : null,
                role.wardId ? "Ward" : null,
              ]
                .filter(Boolean)
                .join("/")
            )
            .filter(Boolean)
          return scopes.length ? scopes.join(", ") : "Global / unset"
        },
      },
      {
        accessorKey: "isActive",
        id: "active",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "secondary" : "outline"} className="rounded-md">
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
    ],
    []
  )

  if (!canView) {
    return <EmptyState title="Users unavailable" description="You need user:view permission." />
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="User management"
        description="Premium admin directory for roles, tenant assignments, ward/district/municipality mapping, and audit-ready profiles"
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Directory</CardTitle>
            <CardDescription>{data?.meta.total ?? 0} users in tenant scope</CardDescription>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
            <CardDescription>Roles are granted only via UserTenantRole</CardDescription>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Audit posture</CardTitle>
            <CardDescription>SecurityAudit captures role assign/deactivate events</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        searchPlaceholder="Search users…"
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        stickyFirstColumns={1}
        emptyTitle="No users found"
        pagination={
          data?.meta
            ? {
                page: data.meta.page,
                totalPages: data.meta.totalPages,
                total: data.meta.total,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.fullName}</SheetTitle>
            <SheetDescription>{selected?.email}</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="mt-6 space-y-4">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
                    <span>{selected.isActive ? "Active" : "Inactive"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{selected.phone ?? "—"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Last login</span>
                    <span>{selected.lastLoginAt ? new Date(selected.lastLoginAt).toLocaleString() : "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Role assignments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(selected.tenantRoles ?? []).filter((role) => role.isActive).length ? (
                    (selected.tenantRoles ?? [])
                      .filter((role) => role.isActive)
                      .map((role) => (
                        <div key={role.id} className="rounded-lg border px-3 py-2 text-sm">
                          <p className="font-medium">{tenantRoleDisplayName(role)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Scope:{" "}
                            {[
                              role.stateId ? `state=${role.stateId}` : null,
                              role.districtId ? `district=${role.districtId}` : null,
                              role.ulbId ? `ulb=${role.ulbId}` : null,
                              role.wardId ? `ward=${role.wardId}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "global"}
                          </p>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No active assignments</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
