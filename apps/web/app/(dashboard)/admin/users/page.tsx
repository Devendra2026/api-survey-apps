"use client"

import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Input } from "@workspace/ui/components/input"
import { PageHeader, EmptyState } from "@/components/shared/page-elements"
import { useUsers } from "@/hooks/use-api"
import type { AuthenticatedProfile } from "@/lib/api/types"

export default function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const { data, isLoading } = useUsers({ page, limit: 20, search: search || undefined })

  const columns = useMemo<ColumnDef<AuthenticatedProfile>[]>(
    () => [
      { accessorKey: "fullName", header: "Name" },
      { accessorKey: "email", header: "Email" },
      {
        id: "roles",
        header: "Roles",
        cell: ({ row }) =>
          row.original.tenantRoles
            ?.filter((r) => r.isActive)
            .map((r) => r.role.name)
            .join(", ") || "—",
      },
      {
        accessorKey: "isActive",
        header: "Active",
        cell: ({ row }) => (row.original.isActive ? "Yes" : "No"),
      },
    ],
    []
  )

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Manage application users and tenant role assignments" />

      <Input
        placeholder="Search users..."
        className="max-w-sm"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
      />

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4}>Loading...</TableCell></TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={4}><EmptyState title="No users found" /></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data?.meta ? (
        <p className="text-muted-foreground text-sm">Page {page} of {data.meta.totalPages}</p>
      ) : null}
    </div>
  )
}
