"use client"

import { UserAssignRoleDialog } from "@/components/admin/user-assign-role-dialog"
import {
  assignmentGeoLabels,
  primaryAssignment,
  RoleBadge,
  StatusBadge,
  UserAvatar,
} from "@/components/admin/user-badges"
import {
  EMPTY_USER_FILTERS,
  UserDirectoryFiltersBar,
  type UserDirectoryFilters,
} from "@/components/admin/user-directory-filters"
import { UserEditDialog } from "@/components/admin/user-edit-dialog"
import { UserOnboardWizard } from "@/components/admin/user-onboard-wizard"
import { UserProfileDrawer } from "@/components/admin/user-profile-drawer"
import { UserStatusDialog } from "@/components/admin/user-status-dialog"
import { DataTable, DataTableSelectColumn } from "@/components/data-table/data-table"
import { EmptyState, PageHeader, StatCard } from "@/components/shared/page-elements"
import { useUpdateUser, useUserStats, useUsers } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import type { AuthenticatedProfile } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import type { ColumnDef, RowSelectionState, VisibilityState } from "@tanstack/react-table"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { motion, useReducedMotion } from "framer-motion"
import {
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  Shield,
  UserCheck,
  UserCog,
  UserRound,
  Users,
  UserX,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import * as XLSX from "xlsx"

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function exportUsers(users: AuthenticatedProfile[], format: "xlsx" | "csv") {
  const rows = users.map((u) => {
    const a = primaryAssignment(u.tenantRoles)
    const geo = assignmentGeoLabels(a)
    return {
      Name: u.fullName,
      Mobile: u.phone ?? "",
      Email: u.email,
      Role: a?.role?.name ?? a?.roleName ?? "",
      State: geo.state,
      District: geo.district,
      ULB: geo.ulb,
      Ward: geo.ward,
      Status: u.isActive ? "Active" : "Disabled",
      "Last Login": u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "",
    }
  })
  const sheet = XLSX.utils.json_to_sheet(rows)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Users")
  XLSX.writeFile(book, `users-export.${format === "csv" ? "csv" : "xlsx"}`)
}

export default function AdminUsersPage() {
  const reduceMotion = useReducedMotion()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("user:view")
  const canUpdate = hasPermission("user:update")
  const canAssign = hasPermission("role:assign")
  const updateUser = useUpdateUser()

  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<UserDirectoryFilters>(EMPTY_USER_FILTERS)
  const debouncedSearch = useDebouncedValue(filters.search, 300)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const [selected, setSelected] = useState<AuthenticatedProfile | null>(null)
  const [editUser, setEditUser] = useState<AuthenticatedProfile | null>(null)
  const [assignUser, setAssignUser] = useState<AuthenticatedProfile | null>(null)
  const [assignMode, setAssignMode] = useState<"role" | "location">("role")
  const [statusUser, setStatusUser] = useState<AuthenticatedProfile | null>(null)
  const [onboardUser, setOnboardUser] = useState<AuthenticatedProfile | null>(null)

  const queryParams = useMemo(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      roleName: filters.roleName || undefined,
      stateId: filters.stateId || undefined,
      districtId: filters.districtId || undefined,
      ulbId: filters.ulbId || undefined,
      wardId: filters.wardId || undefined,
      isActive: filters.isActive === "" ? undefined : filters.isActive === "true",
      sortBy: "fullName",
      sortOrder: "asc" as const,
    }),
    [page, debouncedSearch, filters]
  )

  const { data, isLoading } = useUsers(queryParams)
  const { data: stats } = useUserStats()

  const selectedRows = useMemo(() => {
    const items = data?.items ?? []
    const byId = new Map(items.map((u) => [u.id, u]))
    return Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((key) => byId.get(key))
      .filter(Boolean) as AuthenticatedProfile[]
  }, [data?.items, rowSelection])

  const columns = useMemo<ColumnDef<AuthenticatedProfile>[]>(
    () => [
      DataTableSelectColumn<AuthenticatedProfile>(),
      {
        accessorKey: "fullName",
        id: "name",
        header: "User",
        cell: ({ row }) => (
          <button
            type="button"
            className="group flex cursor-pointer items-center gap-3 text-left"
            onClick={() => setSelected(row.original)}
          >
            <UserAvatar name={row.original.fullName} />
            <span className="min-w-0">
              <span className="block truncate font-medium group-hover:text-primary">{row.original.fullName}</span>
              <span className="block truncate text-xs text-muted-foreground md:hidden">{row.original.email}</span>
            </span>
          </button>
        ),
      },
      {
        accessorKey: "phone",
        header: "Mobile",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{row.original.phone ?? "—"}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.email}</span>,
      },
      {
        id: "role",
        header: "Role",
        cell: ({ row }) => {
          const assignment = primaryAssignment(row.original.tenantRoles)
          return assignment ? <RoleBadge role={assignment} /> : "—"
        },
      },
      {
        id: "state",
        header: "State",
        cell: ({ row }) => assignmentGeoLabels(primaryAssignment(row.original.tenantRoles)).state,
      },
      {
        id: "district",
        header: "District",
        cell: ({ row }) => assignmentGeoLabels(primaryAssignment(row.original.tenantRoles)).district,
      },
      {
        id: "ulb",
        header: "ULB",
        cell: ({ row }) => (
          <span className="max-w-40 truncate">
            {assignmentGeoLabels(primaryAssignment(row.original.tenantRoles)).ulb}
          </span>
        ),
      },
      {
        id: "ward",
        header: "Ward",
        cell: ({ row }) => assignmentGeoLabels(primaryAssignment(row.original.tenantRoles)).ward,
      },
      {
        accessorKey: "isActive",
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge isActive={row.original.isActive} />,
      },
      {
        accessorKey: "lastLoginAt",
        header: "Last login",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.lastLoginAt ? new Date(row.original.lastLoginAt).toLocaleString() : "Never"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original
          const pending = primaryAssignment(user.tenantRoles)?.role?.name === "PENDING_APPROVAL"
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="Actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem className="cursor-pointer" onClick={() => setSelected(user)}>
                  View profile
                </DropdownMenuItem>
                {canUpdate ? (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => setEditUser(user)}>
                    Edit details
                  </DropdownMenuItem>
                ) : null}
                {canAssign && pending ? (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => setOnboardUser(user)}>
                    Onboard user
                  </DropdownMenuItem>
                ) : null}
                {canAssign ? (
                  <>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        setAssignMode("role")
                        setAssignUser(user)
                      }}
                    >
                      Assign role
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        setAssignMode("location")
                        setAssignUser(user)
                      }}
                    >
                      Assign location
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canUpdate ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer" onClick={() => setStatusUser(user)}>
                      {user.isActive ? "Disable account" : "Activate account"}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [canAssign, canUpdate]
  )

  if (!canView) {
    return (
      <EmptyState
        title="Users unavailable"
        description="You need user:view permission to access the directory."
        icon={<Shield className="size-5" />}
      />
    )
  }

  const setFilterPreset = (next: Partial<UserDirectoryFilters>) => {
    setFilters({ ...EMPTY_USER_FILTERS, ...next })
    setPage(1)
    setRowSelection({})
  }

  return (
    <motion.div
      className="space-y-6"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <PageHeader
        title="User management"
        description="Enterprise directory for approvals, role assignment, geographic scope, and account lifecycle."
        breadcrumbs={[{ label: "Administration", href: "/admin/users" }, { label: "Users" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setFilterPreset({ roleName: "PENDING_APPROVAL" })}
            >
              <UserRound className="mr-1.5 size-3.5" aria-hidden />
              Pending
              {stats?.pending ? (
                <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                  {stats.pending}
                </span>
              ) : null}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="rounded-xl">
                  <Download className="mr-1.5 size-3.5" aria-hidden />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => exportUsers(selectedRows.length ? selectedRows : (data?.items ?? []), "xlsx")}
                >
                  <FileSpreadsheet className="mr-2 size-3.5" />
                  Excel ({selectedRows.length || data?.items.length || 0})
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => exportUsers(selectedRows.length ? selectedRows : (data?.items ?? []), "csv")}
                >
                  <Download className="mr-2 size-3.5" />
                  CSV / PDF-ready
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={stats?.total ?? "—"}
          hint="Directory size"
          icon={<Users className="size-4" />}
          active={!filters.roleName && !filters.isActive}
          onClick={() => setFilterPreset({})}
        />
        <StatCard
          label="Active"
          value={stats?.active ?? "—"}
          hint="Can sign in"
          icon={<UserCheck className="size-4" />}
          tone="success"
          active={filters.isActive === "true"}
          onClick={() => setFilterPreset({ isActive: "true" })}
        />
        <StatCard
          label="Disabled"
          value={stats?.disabled ?? "—"}
          hint="Login blocked"
          icon={<UserX className="size-4" />}
          tone="danger"
          active={filters.isActive === "false"}
          onClick={() => setFilterPreset({ isActive: "false" })}
        />
        <StatCard
          label="Pending approval"
          value={stats?.pending ?? "—"}
          hint="Awaiting onboarding"
          icon={<UserRound className="size-4" />}
          tone="warning"
          active={filters.roleName === "PENDING_APPROVAL"}
          onClick={() => setFilterPreset({ roleName: "PENDING_APPROVAL" })}
        />
        <StatCard
          label="Surveyors"
          value={stats?.surveyors ?? "—"}
          hint="Field capture"
          icon={<ClipboardCheck className="size-4" />}
          tone="info"
          active={filters.roleName === "SURVEYOR"}
          onClick={() => setFilterPreset({ roleName: "SURVEYOR" })}
        />
        <StatCard
          label="Supervisors"
          value={stats?.supervisors ?? "—"}
          hint="Field oversight"
          icon={<UserCog className="size-4" />}
          active={filters.roleName === "FIELD_SUPERVISOR"}
          onClick={() => setFilterPreset({ roleName: "FIELD_SUPERVISOR" })}
        />
        <StatCard
          label="QC Supervisors"
          value={stats?.qcSupervisors ?? "—"}
          hint="Quality control"
          icon={<Shield className="size-4" />}
          tone="info"
          active={filters.roleName === "QC_SUPERVISOR"}
          onClick={() => setFilterPreset({ roleName: "QC_SUPERVISOR" })}
        />
        <StatCard
          label="Admins"
          value={stats?.admins ?? "—"}
          hint="Full access"
          icon={<Shield className="size-4" />}
          active={filters.roleName === "ADMIN"}
          onClick={() => setFilterPreset({ roleName: "ADMIN" })}
        />
      </div>

      <UserDirectoryFiltersBar
        filters={filters}
        onChange={(next) => {
          setFilters(next)
          setPage(1)
          setRowSelection({})
        }}
        onReset={() => setFilterPreset({})}
      />

      {selectedRows.length > 0 && canUpdate ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-primary/5 px-4 py-3 text-sm">
          <span className="font-medium">{selectedRows.length} selected</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={async () => {
              try {
                await Promise.all(
                  selectedRows.map((u) => updateUser.mutateAsync({ id: u.id, body: { isActive: true } }))
                )
                toast.success("Selected users activated")
                setRowSelection({})
              } catch (e) {
                toast.error(getApiErrorMessage(e))
              }
            }}
          >
            Activate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="rounded-xl"
            onClick={async () => {
              try {
                await Promise.all(
                  selectedRows.map((u) => updateUser.mutateAsync({ id: u.id, body: { isActive: false } }))
                )
                toast.success("Selected users disabled")
                setRowSelection({})
              } catch (e) {
                toast.error(getApiErrorMessage(e))
              }
            }}
          >
            Disable
          </Button>
        </div>
      ) : null}

      <div className="surface-elevated overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-5">
          <div>
            <p className="text-sm font-semibold tracking-tight">Directory</p>
            <p className="text-xs text-muted-foreground">
              {data?.meta.total != null ? `${data.meta.total} users` : "Loading…"}
            </p>
          </div>
        </div>
        <div className="p-2 md:p-3">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            isLoading={isLoading}
            enableRowSelection
            getRowId={(row) => row.id}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            stickyFirstColumns={2}
            emptyTitle="No users found"
            emptyDescription="Adjust filters or wait for Clerk sign-ups to appear as Pending Users."
            pagination={
              data?.meta
                ? {
                    page: data.meta.page,
                    totalPages: data.meta.totalPages,
                    total: data.meta.total,
                    onPageChange: (p) => {
                      setPage(p)
                      setRowSelection({})
                    },
                  }
                : undefined
            }
          />
        </div>
      </div>

      <UserProfileDrawer
        user={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        canUpdate={canUpdate}
        canAssign={canAssign}
        onEdit={() => selected && setEditUser(selected)}
        onAssignRole={() => {
          if (!selected) return
          setAssignMode("role")
          setAssignUser(selected)
        }}
        onToggleStatus={() => selected && setStatusUser(selected)}
        onOnboard={() => selected && setOnboardUser(selected)}
      />

      <UserEditDialog user={editUser} open={Boolean(editUser)} onOpenChange={(o) => !o && setEditUser(null)} />
      <UserAssignRoleDialog
        user={assignUser}
        open={Boolean(assignUser)}
        mode={assignMode}
        onOpenChange={(o) => !o && setAssignUser(null)}
      />
      <UserStatusDialog user={statusUser} open={Boolean(statusUser)} onOpenChange={(o) => !o && setStatusUser(null)} />
      <UserOnboardWizard
        user={onboardUser}
        open={Boolean(onboardUser)}
        onOpenChange={(o) => !o && setOnboardUser(null)}
      />
    </motion.div>
  )
}
