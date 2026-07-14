"use client"

import { DataTable } from "@/components/data-table/data-table"
import { PageHeader } from "@/components/shared/page-elements"
import { useUsers } from "@/hooks/use-api"
import type { AuthenticatedProfile } from "@/lib/api/types"
import { tenantRoleDisplayName } from "@/lib/api/types"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { useMemo, useState } from "react"

export default function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const { data, isLoading } = useUsers({ page, limit: 20, search: search || undefined })

  const columns = useMemo<ColumnDef<AuthenticatedProfile>[]>(
    () => [
      { accessorKey: "fullName", id: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
      {
        id: "roles",
        header: "Roles",
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
        accessorKey: "isActive",
        id: "active",
        header: "Active",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "secondary" : "outline"} className="rounded-md">
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-5">
      <PageHeader title="Users" description="Manage application users and tenant role assignments" />

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
    </div>
  )
}
