"use client"

import { BulkConfirmDialog } from "@/components/admin/bulk-confirm-dialog"
import { UserAssignRoleDialog } from "@/components/admin/user-assign-role-dialog"
import {
  assignmentGeoLabels,
  assignmentWardSummary,
  primaryAssignment,
  RoleBadge,
  StatusBadge,
  UserAvatar,
} from "@/components/admin/user-badges"
import { UserDeleteDialog } from "@/components/admin/user-delete-dialog"
import {
  EMPTY_USER_FILTERS,
  UserDirectoryFiltersBar,
  type UserDirectoryFilters,
} from "@/components/admin/user-directory-filters"
import { UserDirectoryKpis } from "@/components/admin/user-directory-kpis"
import { UserEditDialog } from "@/components/admin/user-edit-dialog"
import { UserImportDialog, UserSyncFromClerkDialog } from "@/components/admin/user-import-sync-dialogs"
import { UserOnboardWizard } from "@/components/admin/user-onboard-wizard"
import { UserProfileDrawer } from "@/components/admin/user-profile-drawer"
import { UserStatusDialog } from "@/components/admin/user-status-dialog"
import { DataTable, DataTableSelectColumn } from "@/components/data-table/data-table"
import { EmptyState, PageHeader, QueryErrorBanner } from "@/components/shared/page-elements"
import { useDeleteUser, useUpdateUser, useUsers, useUserStats } from "@/hooks/use-api"
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
import { CloudDownload, Download, FileSpreadsheet, MoreHorizontal, Shield, Upload, UserRound } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
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

function scopeSummary(user: AuthenticatedProfile): string {
  const assignment = primaryAssignment(user.tenantRoles)
  if (!assignment) return "—"
  const geo = assignmentGeoLabels(assignment)
  const parts = [geo.state, geo.district, geo.ulb, geo.ward].filter((part) => part && part !== "—")
  return parts.length ? parts.join(" → ") : "Full access"
}

type BulkAction = "activate" | "disable" | "delete" | null

function AdminUsersPage() {
  const reduceMotion = useReducedMotion()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const currentUserId = useAuthStore((s) => s.profile?.id)
  const canView = hasPermission("user:view")
  const canUpdate = hasPermission("user:update")
  const canDelete = hasPermission("user:delete")
  const canAssign = hasPermission("role:assign")
  const canCreate = hasPermission("user:create")
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()

  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get("page") ?? "1")
    return Number.isFinite(raw) && raw > 0 ? raw : 1
  })
  const [filters, setFilters] = useState<UserDirectoryFilters>(() => ({
    ...EMPTY_USER_FILTERS,
    search: searchParams.get("search") ?? "",
    roleName: searchParams.get("role") ?? "",
    isActive: searchParams.get("status") ?? "",
  }))
  const debouncedSearch = useDebouncedValue(filters.search, 300)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    phone: false,
    email: true,
    state: false,
    district: false,
    ulb: false,
    ward: false,
  })

  const [selected, setSelected] = useState<AuthenticatedProfile | null>(null)
  const [editUser, setEditUser] = useState<AuthenticatedProfile | null>(null)
  const [assignUser, setAssignUser] = useState<AuthenticatedProfile | null>(null)
  const [assignMode, setAssignMode] = useState<"role" | "location">("role")
  const [statusUser, setStatusUser] = useState<AuthenticatedProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AuthenticatedProfile | null>(null)
  const [onboardUser, setOnboardUser] = useState<AuthenticatedProfile | null>(null)
  const [bulkAction, setBulkAction] = useState<BulkAction>(null)
  const [bulkPending, setBulkPending] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const drawerDismissedRef = useRef(false)

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

  const { data, isLoading, isError, error, refetch } = useUsers(queryParams)
  const { data: stats, isLoading: statsLoading, isError: statsError } = useUserStats()

  const selectedUserId = searchParams.get("user")

  const replaceQuery = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      const next = params.toString()
      const current = searchParams.toString()
      if (next === current) return
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const closeProfileDrawer = useCallback(() => {
    drawerDismissedRef.current = true
    setSelected(null)
    // Clear ?user= immediately so a refetch cannot re-hydrate the drawer open.
    replaceQuery((params) => {
      params.delete("user")
    })
  }, [replaceQuery])

  const openProfileDrawer = useCallback((user: AuthenticatedProfile) => {
    drawerDismissedRef.current = false
    setSelected(user)
  }, [])

  /** Close the sheet before opening a dialog to avoid nested Sheet+Dialog focus traps. */
  const openDialogFromDrawer = useCallback(
    (user: AuthenticatedProfile, open: (u: AuthenticatedProfile) => void) => {
      closeProfileDrawer()
      queueMicrotask(() => open(user))
    },
    [closeProfileDrawer]
  )

  useEffect(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set("page", String(page))
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (filters.roleName) params.set("role", filters.roleName)
    if (filters.isActive) params.set("status", filters.isActive)
    if (selected?.id) params.set("user", selected.id)
    const next = params.toString()
    const current = searchParams.toString()
    if (next === current) return
    startTransition(() => {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    })
  }, [page, debouncedSearch, filters.roleName, filters.isActive, selected?.id, pathname, router, searchParams])

  // Deep-link / refresh: keep drawer user in sync with list data. Do not depend on
  // `selected` — closing sets selected=null while ?user= may briefly remain; depending
  // on selected would re-open the drawer.
  useEffect(() => {
    if (!selectedUserId) {
      drawerDismissedRef.current = false
      return
    }
    if (drawerDismissedRef.current || !data?.items) return
    const match = data.items.find((u) => u.id === selectedUserId)
    if (match) setSelected(match)
  }, [data?.items, selectedUserId])

  const selectedRows = useMemo(() => {
    const items = data?.items ?? []
    const byId = new Map(items.map((u) => [u.id, u]))
    return Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((key) => byId.get(key))
      .filter(Boolean) as AuthenticatedProfile[]
  }, [data?.items, rowSelection])

  const kpiActiveId = useMemo(() => {
    if (filters.roleName === "PENDING_APPROVAL") return "pending" as const
    if (filters.roleName === "ADMIN") return "admins" as const
    if (filters.isActive === "true") return "active" as const
    if (filters.isActive === "false") return "disabled" as const
    if (!filters.roleName && !filters.isActive) return "total" as const
    return null
  }, [filters.isActive, filters.roleName])

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
            className="group flex cursor-pointer items-center gap-3 text-left transition-colors duration-200"
            onClick={() => openProfileDrawer(row.original)}
          >
            <UserAvatar name={row.original.fullName} />
            <span className="min-w-0">
              <span className="block truncate font-medium group-hover:text-primary">{row.original.fullName}</span>
              <span className="block truncate text-xs text-muted-foreground">{row.original.email}</span>
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
        id: "scope",
        header: "Scope",
        cell: ({ row }) => (
          <span className="max-w-56 truncate text-xs text-muted-foreground">{scopeSummary(row.original)}</span>
        ),
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
        cell: ({ row }) => (
          <span className="max-w-48 truncate" title={assignmentWardSummary(row.original.tenantRoles, 99)}>
            {assignmentWardSummary(row.original.tenantRoles)}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const pending =
            primaryAssignment(row.original.tenantRoles)?.role?.name === "PENDING_APPROVAL" ||
            primaryAssignment(row.original.tenantRoles)?.roleName === "PENDING_APPROVAL"
          if (pending) {
            return (
              <span className="inline-flex items-center rounded-md border border-amber-300/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                Pending approval
              </span>
            )
          }
          return <StatusBadge isActive={row.original.isActive} />
        },
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
        enableHiding: false,
        cell: ({ row }) => {
          const user = row.original
          const pending = primaryAssignment(user.tenantRoles)?.role?.name === "PENDING_APPROVAL"
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 cursor-pointer rounded-lg"
                  aria-label={`Actions for ${user.fullName}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem className="cursor-pointer" onSelect={() => openProfileDrawer(user)}>
                  View profile
                </DropdownMenuItem>
                {canUpdate ? (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault()
                      queueMicrotask(() => setEditUser(user))
                    }}
                  >
                    Edit details
                  </DropdownMenuItem>
                ) : null}
                {canAssign && pending ? (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault()
                      queueMicrotask(() => setOnboardUser(user))
                    }}
                  >
                    Onboard user
                  </DropdownMenuItem>
                ) : null}
                {canAssign ? (
                  <>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault()
                        queueMicrotask(() => {
                          setAssignMode("role")
                          setAssignUser(user)
                        })
                      }}
                    >
                      Assign role
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault()
                        queueMicrotask(() => {
                          setAssignMode("location")
                          setAssignUser(user)
                        })
                      }}
                    >
                      Assign location
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canUpdate || canDelete ? <DropdownMenuSeparator /> : null}
                {canUpdate ? (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault()
                      queueMicrotask(() => setStatusUser(user))
                    }}
                  >
                    {user.isActive ? "Disable account" : "Activate account"}
                  </DropdownMenuItem>
                ) : null}
                {canDelete && user.id !== currentUserId ? (
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault()
                      queueMicrotask(() => setDeleteTarget(user))
                    }}
                  >
                    Delete user
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [canAssign, canDelete, canUpdate, currentUserId, openProfileDrawer]
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

  const runBulkAction = async () => {
    if (!bulkAction) return
    setBulkPending(true)
    try {
      if (bulkAction === "activate") {
        await Promise.all(selectedRows.map((u) => updateUser.mutateAsync({ id: u.id, body: { isActive: true } })))
        toast.success(`Activated ${selectedRows.length} user${selectedRows.length === 1 ? "" : "s"}`)
      } else if (bulkAction === "disable") {
        await Promise.all(selectedRows.map((u) => updateUser.mutateAsync({ id: u.id, body: { isActive: false } })))
        toast.success(`Disabled ${selectedRows.length} user${selectedRows.length === 1 ? "" : "s"}`)
      } else {
        const targets = selectedRows.filter((u) => u.id !== currentUserId)
        if (!targets.length) {
          toast.error("You cannot delete your own account")
          setBulkAction(null)
          return
        }
        await Promise.all(targets.map((u) => deleteUser.mutateAsync(u.id)))
        toast.success(
          targets.length === selectedRows.length
            ? `Deleted ${targets.length} user${targets.length === 1 ? "" : "s"}`
            : `Deleted ${targets.length} user${targets.length === 1 ? "" : "s"} (your account was skipped)`
        )
      }
      setRowSelection({})
      setBulkAction(null)
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setBulkPending(false)
    }
  }

  const bulkCopy =
    bulkAction === "activate"
      ? {
          title: "Activate selected users",
          description: `Activate ${selectedRows.length} selected account${selectedRows.length === 1 ? "" : "s"}. They will regain portal access.`,
          confirmWord: "ACTIVATE" as const,
          confirmLabel: "Activate users",
        }
      : bulkAction === "disable"
        ? {
            title: "Disable selected users",
            description: `Disable ${selectedRows.length} selected account${selectedRows.length === 1 ? "" : "s"}. They will be blocked from portal and API access.`,
            confirmWord: "DISABLE" as const,
            confirmLabel: "Disable users",
          }
        : {
            title: "Delete selected users",
            description: `Permanently delete ${selectedRows.filter((u) => u.id !== currentUserId).length} selected account${selectedRows.filter((u) => u.id !== currentUserId).length === 1 ? "" : "s"}. Users with linked surveys, audits, or jobs cannot be deleted — disable them instead.`,
            confirmWord: "DELETE" as const,
            confirmLabel: "Delete users",
          }

  return (
    <motion.div
      className="space-y-5"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <PageHeader
        title="Users"
        description={`${data?.meta.total ?? stats?.total ?? "—"} people in the directory · approvals, roles, geography, and lifecycle`}
        breadcrumbs={[{ label: "Administration", href: "/admin/users" }, { label: "Users" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer rounded-xl transition-colors duration-200"
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
            {canCreate ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer rounded-xl transition-colors duration-200"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="mr-1.5 size-3.5" aria-hidden />
                  Import
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer rounded-xl transition-colors duration-200"
                  onClick={() => setSyncOpen(true)}
                >
                  <CloudDownload className="mr-1.5 size-3.5" aria-hidden />
                  Sync from Clerk
                </Button>
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer rounded-xl transition-colors duration-200"
                >
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
                  CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {!statsError ? (
        <UserDirectoryKpis
          stats={stats}
          isLoading={statsLoading}
          activeId={kpiActiveId}
          onSelect={(id) => {
            if (id === "total") setFilterPreset({})
            if (id === "active") setFilterPreset({ isActive: "true" })
            if (id === "disabled") setFilterPreset({ isActive: "false" })
            if (id === "pending") setFilterPreset({ roleName: "PENDING_APPROVAL" })
            if (id === "admins") setFilterPreset({ roleName: "ADMIN" })
          }}
        />
      ) : null}

      <UserDirectoryFiltersBar
        filters={filters}
        onChange={(next) => {
          setFilters(next)
          setPage(1)
          setRowSelection({})
        }}
        onReset={() => setFilterPreset({})}
      />

      {isError ? (
        <QueryErrorBanner
          title="Unable to load users"
          message={getApiErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : null}

      {selectedRows.length > 0 && (canUpdate || canDelete) ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-2xl border bg-primary/5 px-4 py-3 text-sm"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="font-medium">{selectedRows.length} selected</span>
          {canUpdate ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer rounded-xl"
                onClick={() => setBulkAction("activate")}
              >
                Activate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="cursor-pointer rounded-xl"
                onClick={() => setBulkAction("disable")}
              >
                Disable
              </Button>
            </>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="cursor-pointer rounded-xl"
              onClick={() => setBulkAction("delete")}
            >
              Delete
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="cursor-pointer rounded-xl"
            onClick={() => setRowSelection({})}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      <div className="surface-elevated overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-5">
          <div>
            <p className="text-sm font-semibold tracking-tight">Directory</p>
            <p className="text-xs text-muted-foreground">
              {data?.meta.total != null ? `${data.meta.total} users` : isLoading ? "Loading…" : "No results"}
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
        onOpenChange={(open) => !open && closeProfileDrawer()}
        canUpdate={canUpdate}
        canAssign={canAssign}
        canDelete={canDelete && selected?.id !== currentUserId}
        onEdit={() => selected && openDialogFromDrawer(selected, setEditUser)}
        onAssignRole={() => {
          if (!selected) return
          openDialogFromDrawer(selected, (u) => {
            setAssignMode("role")
            setAssignUser(u)
          })
        }}
        onToggleStatus={() => selected && openDialogFromDrawer(selected, setStatusUser)}
        onDelete={() => {
          if (!selected) return
          openDialogFromDrawer(selected, setDeleteTarget)
        }}
        onOnboard={() => selected && openDialogFromDrawer(selected, setOnboardUser)}
      />

      <UserEditDialog user={editUser} open={Boolean(editUser)} onOpenChange={(o) => !o && setEditUser(null)} />
      <UserAssignRoleDialog
        user={assignUser}
        open={Boolean(assignUser)}
        mode={assignMode}
        onOpenChange={(o) => !o && setAssignUser(null)}
      />
      <UserStatusDialog user={statusUser} open={Boolean(statusUser)} onOpenChange={(o) => !o && setStatusUser(null)} />
      <UserDeleteDialog
        user={deleteTarget}
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onDeleted={(userId) => {
          if (selected?.id === userId) closeProfileDrawer()
          setRowSelection((prev) => {
            if (!prev[userId]) return prev
            const next = { ...prev }
            delete next[userId]
            return next
          })
        }}
      />
      <UserOnboardWizard
        user={onboardUser}
        open={Boolean(onboardUser)}
        onOpenChange={(o) => !o && setOnboardUser(null)}
      />
      <BulkConfirmDialog
        open={bulkAction !== null}
        onOpenChange={(open) => !open && setBulkAction(null)}
        title={bulkCopy.title}
        description={bulkCopy.description}
        confirmWord={bulkCopy.confirmWord}
        confirmLabel={bulkCopy.confirmLabel}
        pending={bulkPending}
        onConfirm={runBulkAction}
      />
      <UserImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <UserSyncFromClerkDialog open={syncOpen} onOpenChange={setSyncOpen} />
    </motion.div>
  )
}

export default function AdminUsersPageSuspense() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-1" aria-busy="true">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <AdminUsersPage />
    </Suspense>
  )
}
