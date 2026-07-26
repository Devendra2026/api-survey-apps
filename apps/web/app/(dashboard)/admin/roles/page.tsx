"use client"

import { AuditLogsSheet, type LocalPermissionAudit } from "@/components/admin/roles/audit-logs-sheet"
import { SYSTEM_ROLE_CODES } from "@/components/admin/roles/permission-utils"
import { RbacKpiCards } from "@/components/admin/roles/rbac-kpi-cards"
import { RoleDetailPanel } from "@/components/admin/roles/role-detail-panel"
import { RoleFormDialog } from "@/components/admin/roles/role-form-dialog"
import { RoleListPanel } from "@/components/admin/roles/role-list-panel"
import { RolePermissionsEditor } from "@/components/admin/roles/role-permissions-editor"
import {
  canDeleteRole,
  canModifyPermissions,
  isDepartmentRole,
  isFullyLockedSystemRole,
  isSystemRole,
} from "@/components/admin/roles/system-role-policy"
import { UserAssignRoleDialog } from "@/components/admin/user-assign-role-dialog"
import { UserAvatar } from "@/components/admin/user-badges"
import { EmptyState, PageHeader, QueryErrorBanner } from "@/components/shared/page-elements"
import {
  useCloneRole,
  useCreateRole,
  useDeleteRole,
  usePermissionsCatalog,
  useRole,
  useRoleAudits,
  useRoleUsers,
  useRoles,
  useUpdateRole,
  useUserStats,
  useUsers,
} from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import {
  isDepartmentRoleName,
  roleDisplayName,
  tenantRoleCode,
  type AuthenticatedProfile,
  type SecurityAuditItem,
} from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { motion, useReducedMotion } from "framer-motion"
import { ClipboardList, Download, FileUp, Plus, Upload } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useRef, useState, useTransition } from "react"

import { toast } from "sonner"

function auditsToLocal(entries: SecurityAuditItem[], fallbackRoleName: string): LocalPermissionAudit[] {
  return entries.map((entry) => {
    const newValue = entry.newValue as
      { added?: string[]; removed?: string[]; permissionNames?: string[] } | null | undefined
    return {
      id: entry.id,
      roleName: fallbackRoleName,
      adminName: entry.actor?.fullName ?? "Admin",
      added: newValue?.added ?? [],
      removed: newValue?.removed ?? [],
      at: new Date(entry.createdAt),
    }
  })
}

function AdminRolesPage() {
  const reduceMotion = useReducedMotion()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const profile = useAuthStore((s) => s.profile)
  const canManage = hasPermission("role:assign")
  const canView = hasPermission("user:view") || canManage

  const actorIsDeptOnly = useMemo(() => {
    const active = profile?.tenantRoles?.filter((r) => r.isActive) ?? []
    if (!active.length) return false
    return active.every((r) => isDepartmentRoleName(tenantRoleCode(r)))
  }, [profile?.tenantRoles])

  const { data, isLoading, isError, error, refetch } = useRoles()
  const { data: permissions, isLoading: permsLoading } = usePermissionsCatalog()
  const { data: userStats, isLoading: statsLoading } = useUserStats()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const cloneRole = useCloneRole()
  const deleteRole = useDeleteRole()

  const [familyTab, setFamilyTab] = useState<"platform" | "department">(actorIsDeptOnly ? "department" : "platform")

  const allRoles = data?.items ?? []
  const roles = useMemo(() => {
    if (actorIsDeptOnly) {
      return allRoles.filter((r) => isDepartmentRole(r.name) || r.family === "DEPARTMENT")
    }
    if (familyTab === "department") {
      return allRoles.filter((r) => isDepartmentRole(r.name) || r.family === "DEPARTMENT")
    }
    return allRoles.filter((r) => !isDepartmentRole(r.name) && r.family !== "DEPARTMENT")
  }, [allRoles, familyTab, actorIsDeptOnly])
  const catalog = permissions?.items ?? []

  const roleFromUrl = searchParams.get("role")
  const [selectedId, setSelectedId] = useState<string | null>(roleFromUrl)
  const listSelected = useMemo(() => {
    if (selectedId) return roles.find((r) => r.id === selectedId) ?? null
    return roles[0] ?? null
  }, [roles, selectedId])
  const effectiveSelectedId = selectedId ?? listSelected?.id ?? null

  const { data: roleDetail, isLoading: detailLoading } = useRole(effectiveSelectedId)
  const selected = roleDetail ?? listSelected

  const [createOpen, setCreateOpen] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [assignUser, setAssignUser] = useState<AuthenticatedProfile | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [tab, setTab] = useState("permissions")
  const [matrixDirty, setMatrixDirty] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const importInputRef = useRef<HTMLInputElement>(null)

  const { data: roleUsers, isLoading: roleUsersLoading, refetch: refetchRoleUsers } = useRoleUsers(selected?.id)
  const { data: serverAudits } = useRoleAudits(auditOpen ? selected?.id : null)
  const { data: pendingUsers } = useUsers({
    page: 1,
    limit: 50,
    roleName: "PENDING_APPROVAL",
  })

  const userCounts = useMemo(() => {
    const map: Record<string, number> = { ...(userStats?.byRole ?? {}) }
    for (const role of roles) {
      if (typeof role.assignedUsersCount === "number") {
        map[role.id] = role.assignedUsersCount
        map[role.name] = role.assignedUsersCount
      }
    }
    return map
  }, [userStats?.byRole, roles])

  // When switching family tab, select first role in that family
  useEffect(() => {
    if (!roles.length) return
    if (selectedId && roles.some((r) => r.id === selectedId)) return
    setSelectedId(roles[0]?.id ?? null)
  }, [familyTab, roles, selectedId])

  useEffect(() => {
    if (selectedId) return
    if (roleFromUrl && roles.some((r) => r.id === roleFromUrl)) {
      setSelectedId(roleFromUrl)
      return
    }
    const firstCustom = roles.find((r) => !SYSTEM_ROLE_CODES.has(r.name))
    const fallback = firstCustom ?? roles[0]
    if (fallback) setSelectedId(fallback.id)
  }, [roles, selectedId, roleFromUrl])

  useEffect(() => {
    if (!effectiveSelectedId) return
    const params = new URLSearchParams(searchParams.toString())
    if (params.get("role") === effectiveSelectedId) return
    params.set("role", effectiveSelectedId)
    const next = params.toString()
    startTransition(() => {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    })
  }, [effectiveSelectedId, pathname, router, searchParams])

  const auditEntries = useMemo(() => {
    const serverLocal = serverAudits
      ? auditsToLocal(serverAudits, selected ? roleDisplayName(selected.name) : "Role")
      : []
    return serverLocal.sort((a, b) => b.at.getTime() - a.at.getTime())
  }, [serverAudits, selected])

  if (!canView) {
    return <EmptyState title="Roles unavailable" description="You need user:view or role:assign permission." />
  }

  const selectRole = (id: string) => {
    if (matrixDirty && id !== effectiveSelectedId) {
      const confirmed = window.confirm("You have unsaved permission changes. Switch roles anyway?")
      if (!confirmed) return
    }
    setSelectedId(id)
    setTab("permissions")
  }

  const exportRoles = () => {
    const payload = roles.map((role) => ({
      name: role.name,
      description: role.description,
      permissionCount: role.permissionCount ?? role.permissions?.length ?? 0,
      permissions: (role.permissions ?? []).map((p) => p.permission?.name).filter(Boolean),
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rbac-roles-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Roles exported")
  }

  const importRolesFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Array<{ name?: string; description?: string }>
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of roles")
      let created = 0
      for (const item of parsed) {
        if (!item.name || SYSTEM_ROLE_CODES.has(item.name)) continue
        try {
          await createRole.mutateAsync({
            name: item.name.trim().toUpperCase().replace(/\s+/g, "_"),
            description: item.description,
          })
          created += 1
        } catch {
          // skip duplicates
        }
      }
      toast.success(created ? `Imported ${created} custom role(s)` : "No new custom roles imported")
      await refetch()
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Invalid import file")
    }
  }

  const canEditMatrix = canManage && !actorIsDeptOnly

  const isEditingMatrix = Boolean(
    selected && canEditMatrix && canModifyPermissions(selected.name) && !isFullyLockedSystemRole(selected.name)
  )

  const renderDetail = (key: string) => {
    if (!selected) return null
    return (
      <RoleDetailPanel
        key={key}
        role={selected}
        tab={tab}
        onTabChange={setTab}
        canManage={canManage}
        isEditing={isEditingMatrix}
        onEdit={() => {
          setName(selected.name)
          setDescription(selected.description ?? "")
          setEditOpen(true)
        }}
        onClone={() => {
          setName(`${selected.name}_COPY`)
          setDescription(selected.description ?? "")
          setCloneOpen(true)
        }}
        onAssign={() => setAssignOpen(true)}
        onDelete={() => {
          if (!canDeleteRole(selected.name) || actorIsDeptOnly) return
          setDeleteConfirm("")
          setDeleteOpen(true)
        }}
        onStartEditPermissions={() => {
          if (!canEditMatrix || isFullyLockedSystemRole(selected.name)) return
          setTab("permissions")
        }}
        roleUsers={roleUsers}
        roleUsersLoading={roleUsersLoading || detailLoading}
        matrix={<RolePermissionsEditor roleId={selected.id} canManage={canEditMatrix} onDirtyChange={setMatrixDirty} />}
        templateReadOnly={actorIsDeptOnly}
      />
    )
  }

  return (
    <motion.div
      className="flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col gap-2 overflow-hidden pb-16 md:h-[calc(100dvh-8rem)] md:pb-2"
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <PageHeader
        title="Roles"
        description={
          actorIsDeptOnly
            ? "Department roles for your municipal ULB — view what Admin, Clerk, and Operator can do"
            : "Platform RBAC and municipal department permission template"
        }
        breadcrumbs={[{ label: "Administration", href: "/admin/users" }, { label: "Roles" }]}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {canManage && !actorIsDeptOnly ? (
              <Button
                type="button"
                size="sm"
                className="h-8 cursor-pointer rounded-lg shadow-xs"
                onClick={() => {
                  setName("")
                  setDescription("")
                  setCreateOpen(true)
                }}
              >
                <Plus className="mr-1.5 size-3.5" aria-hidden />
                Create Role
              </Button>
            ) : null}
            {canManage && !actorIsDeptOnly ? (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void importRolesFile(file)
                    e.target.value = ""
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 cursor-pointer rounded-lg"
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 size-3.5" aria-hidden />
                  Import
                </Button>
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer rounded-lg">
                  <Download className="mr-1.5 size-3.5" aria-hidden />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem className="cursor-pointer" onClick={exportRoles}>
                  <FileUp className="mr-2 size-3.5" />
                  Export roles JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer rounded-lg"
              onClick={() => setAuditOpen(true)}
            >
              <ClipboardList className="mr-1.5 size-3.5" aria-hidden />
              Audit Logs
            </Button>
          </div>
        }
      />

      {isError ? (
        <QueryErrorBanner
          title="Unable to load roles"
          message={getApiErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : null}

      <div className="shrink-0">
        <RbacKpiCards
          roles={roles}
          permissions={catalog}
          userStats={userStats}
          isLoading={isLoading || permsLoading || statsLoading}
        />
      </div>

      {!actorIsDeptOnly ? (
        <Tabs
          value={familyTab}
          onValueChange={(v) => setFamilyTab(v as "platform" | "department")}
          className="shrink-0"
        >
          <TabsList className="h-9 rounded-lg bg-muted/60 p-0.5">
            <TabsTrigger value="platform" className="h-8 cursor-pointer rounded-md px-3 text-xs">
              Platform roles
            </TabsTrigger>
            <TabsTrigger value="department" className="h-8 cursor-pointer rounded-md px-3 text-xs">
              Department template
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : (
        <p className="shrink-0 text-sm text-muted-foreground">
          Permissions are managed by SDV Edutech. You can view each role&apos;s access below.
        </p>
      )}

      <div className="hidden min-h-0 flex-1 grid-cols-[minmax(260px,28%)_minmax(0,1fr)] gap-2 lg:grid">
        <RoleListPanel
          roles={roles}
          selectedId={selected?.id ?? null}
          userCounts={userCounts}
          isLoading={isLoading}
          onSelect={selectRole}
          canCreate={canManage && !actorIsDeptOnly && familyTab === "platform"}
          onCreateRole={() => {
            setName("")
            setDescription("")
            setCreateOpen(true)
          }}
        />
        {selected ? (
          renderDetail("desktop")
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border bg-card">
            <EmptyState
              title="Select a role"
              description="Choose a role to manage its permission matrix."
              className="py-10"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto lg:hidden">
        <RoleListPanel
          roles={roles}
          selectedId={selected?.id ?? null}
          userCounts={userCounts}
          isLoading={isLoading}
          onSelect={selectRole}
          canCreate={canManage && !actorIsDeptOnly && familyTab === "platform"}
          onCreateRole={() => {
            setName("")
            setDescription("")
            setCreateOpen(true)
          }}
        />
        {selected ? <div className="min-h-120">{renderDetail("mobile")}</div> : null}
      </div>

      <AuditLogsSheet open={auditOpen} onOpenChange={setAuditOpen} entries={auditEntries} />

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
          <DialogHeader className="space-y-1.5 border-b bg-linear-to-br from-primary/8 to-transparent px-6 py-5 text-left">
            <DialogTitle>Assign users</DialogTitle>
            <DialogDescription>
              Select a pending user to assign <strong>{selected ? roleDisplayName(selected.name) : "this role"}</strong>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto px-6 py-4">
            {(pendingUsers?.items ?? []).length ? (
              pendingUsers?.items.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                  onClick={() => {
                    setAssignUser(user)
                    setAssignOpen(false)
                  }}
                >
                  <UserAvatar name={user.fullName} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{user.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No pending users.</p>
            )}
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setAssignOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserAssignRoleDialog
        user={assignUser}
        open={Boolean(assignUser)}
        mode="role"
        defaultRoleName={selected?.name}
        onOpenChange={(open) => {
          if (!open) {
            setAssignUser(null)
            void refetchRoleUsers()
          }
        }}
      />

      <RoleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create role"
        description="Create a custom role, then configure permissions in the matrix."
        name={name}
        descriptionValue={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onOpen={() => {
          setName("")
          setDescription("")
        }}
        confirmLabel="Create"
        pending={createRole.isPending}
        onConfirm={async () => {
          try {
            const role = await createRole.mutateAsync({
              name: name.trim().toUpperCase().replace(/\s+/g, "_"),
              description: description.trim() || undefined,
            })
            toast.success("Role created — configure permissions below")
            setSelectedId(role.id)
            setCreateOpen(false)
            setTab("permissions")
          } catch (error) {
            toast.error(getApiErrorMessage(error))
          }
        }}
      />

      <RoleFormDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        title="Clone role"
        description={`Duplicate ${selected ? roleDisplayName(selected.name) : "role"} including its permission set.`}
        name={name}
        descriptionValue={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        confirmLabel="Clone"
        pending={cloneRole.isPending}
        onConfirm={async () => {
          if (!selected) return
          try {
            const role = await cloneRole.mutateAsync({
              id: selected.id,
              body: {
                name: name.trim().toUpperCase().replace(/\s+/g, "_"),
                description: description.trim() || undefined,
              },
            })
            toast.success("Role cloned")
            setSelectedId(role.id)
            setCloneOpen(false)
            setTab("permissions")
          } catch (error) {
            toast.error(getApiErrorMessage(error))
          }
        }}
      />

      <RoleFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit role metadata"
        description="Update role description. System role codes cannot be renamed."
        name={name}
        descriptionValue={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        nameDisabled={selected ? isSystemRole(selected.name) : false}
        confirmLabel="Save"
        pending={updateRole.isPending}
        onConfirm={async () => {
          if (!selected) return
          try {
            await updateRole.mutateAsync({
              id: selected.id,
              body: {
                ...(isSystemRole(selected.name) ? {} : { name: name.trim().toUpperCase().replace(/\s+/g, "_") }),
                description: description.trim() || undefined,
              },
            })
            toast.success("Role updated")
            setEditOpen(false)
          } catch (error) {
            toast.error(getApiErrorMessage(error))
          }
        }}
      />

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeleteConfirm("")
        }}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
          <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              {selected
                ? `Permanently delete ${roleDisplayName(selected.name)}? Users must be reassigned first. Type DELETE to confirm.`
                : "Permanently delete this role?"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-6 py-4">
            <label htmlFor="delete-role-confirm" className="text-xs font-medium text-muted-foreground">
              Confirmation
            </label>
            <Input
              id="delete-role-confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE"
              className="rounded-xl"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setDeleteOpen(false)
                setDeleteConfirm("")
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={deleteConfirm !== "DELETE" || deleteRole.isPending || !selected}
              onClick={async () => {
                if (!selected) return
                try {
                  await deleteRole.mutateAsync(selected.id)
                  toast.success("Role deleted")
                  setDeleteOpen(false)
                  setDeleteConfirm("")
                  setSelectedId(null)
                } catch (err) {
                  toast.error(getApiErrorMessage(err))
                }
              }}
            >
              {deleteRole.isPending ? "Deleting…" : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

export default function AdminRolesPageSuspense() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground" aria-busy="true">
          Loading roles…
        </div>
      }
    >
      <AdminRolesPage />
    </Suspense>
  )
}
