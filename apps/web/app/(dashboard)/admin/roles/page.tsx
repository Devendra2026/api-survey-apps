"use client"

import { AuditLogsSheet, type LocalPermissionAudit } from "@/components/admin/roles/audit-logs-sheet"
import { PermissionMatrixTable } from "@/components/admin/roles/permission-matrix-table"
import { SYSTEM_ROLE_CODES, rolePermissionIdSet, setsEqual } from "@/components/admin/roles/permission-utils"
import { RbacKpiCards } from "@/components/admin/roles/rbac-kpi-cards"
import { RoleDetailPanel } from "@/components/admin/roles/role-detail-panel"
import { RoleFormDialog } from "@/components/admin/roles/role-form-dialog"
import { RoleListPanel } from "@/components/admin/roles/role-list-panel"
import { RolePermissionSummary } from "@/components/admin/roles/role-permission-summary"
import { RolesUnsavedBar } from "@/components/admin/roles/roles-unsaved-bar"
import { UserAssignRoleDialog } from "@/components/admin/user-assign-role-dialog"
import { UserAvatar } from "@/components/admin/user-badges"
import { EmptyState } from "@/components/shared/page-elements"
import {
  useCloneRole,
  useCreateRole,
  useDeleteRole,
  usePermissionsCatalog,
  useRole,
  useRoleAudits,
  useRoleUsers,
  useRoles,
  useSetRolePermissions,
  useUpdateRole,
  useUserStats,
  useUsers,
} from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { roleDisplayName, type AuthenticatedProfile, type SecurityAuditItem } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
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
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ClipboardList, Download, FileUp, Plus, Upload } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

const permissionsFormSchema = z.object({
  permissionIds: z.array(z.string()),
})

type PermissionsFormValues = z.infer<typeof permissionsFormSchema>

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

export default function AdminRolesPage() {
  const reduceMotion = useReducedMotion()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const profile = useAuthStore((s) => s.profile)
  const canManage = hasPermission("role:assign")
  const canView = hasPermission("user:view") || canManage

  const { data, isLoading, refetch } = useRoles()
  const { data: permissions, isLoading: permsLoading } = usePermissionsCatalog()
  const { data: userStats, isLoading: statsLoading } = useUserStats()
  const setPermissions = useSetRolePermissions()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const cloneRole = useCloneRole()
  const deleteRole = useDeleteRole()

  const roles = data?.items ?? []
  const catalog = permissions?.items ?? []

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const listSelected = useMemo(() => {
    if (selectedId) return roles.find((r) => r.id === selectedId) ?? null
    return roles[0] ?? null
  }, [roles, selectedId])
  const effectiveSelectedId = selectedId ?? listSelected?.id ?? null

  const { data: roleDetail, isLoading: detailLoading } = useRole(effectiveSelectedId)
  const selected = roleDetail ?? listSelected

  const form = useForm<PermissionsFormValues>({
    resolver: zodResolver(permissionsFormSchema),
    defaultValues: { permissionIds: [] },
  })

  const permissionIds = form.watch("permissionIds")
  const draftIds = useMemo(() => new Set(permissionIds), [permissionIds])
  const baselineRef = useRef<Set<string>>(new Set())
  const dirty = !setsEqual(draftIds, baselineRef.current)
  const [isEditing, setIsEditing] = useState(false)
  const keepEditingRef = useRef(false)
  const hydratedRoleIdRef = useRef<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [assignUser, setAssignUser] = useState<AuthenticatedProfile | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [tab, setTab] = useState("permissions")
  const [sessionAudits, setSessionAudits] = useState<LocalPermissionAudit[]>([])
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

  const isSystemRole = selected ? SYSTEM_ROLE_CODES.has(selected.name) : false
  /** Custom roles with role:assign — matrix is always interactive (Create/Edit parity). */
  const canEditMatrix = Boolean(canManage && selected && !isSystemRole)
  const matrixLoading = permsLoading || (Boolean(effectiveSelectedId) && detailLoading && !roleDetail)
  const matrixReady = !permsLoading && catalog.length > 0 && Boolean(selected?.id)

  // Hydrate form when the selected role identity or its permission payload changes.
  useEffect(() => {
    if (!selected?.id) return
    const source = roleDetail ?? selected
    // Wait for detail when list row has no permissions include (should be rare).
    if (!roleDetail && !(selected.permissions && selected.permissions.length >= 0) && detailLoading) {
      return
    }

    const next = rolePermissionIdSet(source)
    const roleChanged = hydratedRoleIdRef.current !== selected.id

    if (roleChanged) {
      baselineRef.current = new Set(next)
      form.reset({ permissionIds: [...next] })
      hydratedRoleIdRef.current = selected.id
      if (keepEditingRef.current) {
        setIsEditing(true)
        keepEditingRef.current = false
      } else if (SYSTEM_ROLE_CODES.has(source.name)) {
        setIsEditing(false)
      } else if (canManage) {
        // Custom roles open ready to edit — same as Create after save.
        setIsEditing(true)
      } else {
        setIsEditing(false)
      }
      return
    }

    // Same role: sync from server only when not dirty
    if (!dirty) {
      baselineRef.current = new Set(next)
      form.reset({ permissionIds: [...next] })
    }
  }, [selected?.id, roleDetail, selected, form, dirty, detailLoading, canManage])

  useEffect(() => {
    if (selectedId) return
    // Prefer first custom role so the matrix is immediately editable.
    const firstCustom = roles.find((r) => !SYSTEM_ROLE_CODES.has(r.name))
    const fallback = firstCustom ?? roles[0]
    if (fallback) setSelectedId(fallback.id)
  }, [roles, selectedId])

  if (!canView) {
    return <EmptyState title="Roles unavailable" description="You need user:view or role:assign permission." />
  }

  const handleCancelEdit = () => {
    form.reset({ permissionIds: [...baselineRef.current] })
    setIsEditing(false)
    toast.message("Changes discarded")
  }

  const handleReset = () => {
    form.reset({ permissionIds: [...baselineRef.current] })
    toast.message("Matrix reset to last saved state")
  }

  const handleSave = async () => {
    if (!selected || !canManage || isSystemRole) return
    if (draftIds.size === 0) {
      toast.error("At least one permission is required")
      return
    }
    const previousNames = new Set(
      (selected.permissions ?? []).map((p) => p.permission?.name).filter(Boolean) as string[]
    )
    try {
      const updated = await setPermissions.mutateAsync({
        roleId: selected.id,
        permissionIds: [...draftIds],
      })
      const next = rolePermissionIdSet(updated)
      baselineRef.current = new Set(next)
      form.reset({ permissionIds: [...next] })
      setIsEditing(false)
      await refetch()

      const nextNames = new Set((updated.permissions ?? []).map((p) => p.permission?.name).filter(Boolean) as string[])
      const added = [...nextNames].filter((n) => !previousNames.has(n))
      const removed = [...previousNames].filter((n) => !nextNames.has(n))
      setSessionAudits((prev) => [
        {
          id: `${Date.now()}`,
          roleName: roleDisplayName(selected.name),
          adminName: profile?.fullName ?? "Admin",
          added,
          removed,
          at: new Date(),
        },
        ...prev,
      ])
      toast.success(`Permissions saved for ${roleDisplayName(selected.name)}`)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const selectRole = (id: string) => {
    if (dirty && canEditMatrix) {
      const leave = window.confirm("You have unsaved changes. Discard them and switch roles?")
      if (!leave) return
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
          // skip duplicates / validation errors
        }
      }
      toast.success(created ? `Imported ${created} custom role(s)` : "No new custom roles imported")
      await refetch()
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Invalid import file")
    }
  }

  const auditEntries = useMemo(() => {
    const serverLocal = serverAudits
      ? auditsToLocal(serverAudits, selected ? roleDisplayName(selected.name) : "Role")
      : []
    const seen = new Set(serverLocal.map((e) => e.id))
    const merged = [...serverLocal]
    for (const entry of sessionAudits) {
      if (!seen.has(entry.id)) merged.push(entry)
    }
    return merged.sort((a, b) => b.at.getTime() - a.at.getTime())
  }, [serverAudits, sessionAudits, selected])

  const matrixNode = selected ? (
    <div className="flex h-full min-h-0 gap-2">
      <div className="min-h-0 min-w-0 flex-1">
        <Controller
          control={form.control}
          name="permissionIds"
          render={({ field }) => (
            <PermissionMatrixTable
              permissions={catalog}
              selectedIds={new Set(field.value ?? [])}
              loading={!matrixReady || matrixLoading}
              readOnly={!canEditMatrix}
              onChange={
                canEditMatrix
                  ? (next) => {
                      field.onChange([...next])
                      setIsEditing(true)
                    }
                  : undefined
              }
            />
          )}
        />
      </div>
      <RolePermissionSummary
        className="hidden w-52 shrink-0 xl:flex"
        selectedIds={draftIds}
        permissions={catalog}
        assignedUsers={selected.assignedUsersCount ?? roleUsers?.length ?? 0}
        roleType={isSystemRole ? "System" : "Custom"}
      />
    </div>
  ) : null

  const renderDetailPanel = (extraKey: string) => {
    if (!selected) return null
    return (
      <RoleDetailPanel
        key={extraKey}
        role={selected}
        tab={tab}
        onTabChange={setTab}
        canManage={canManage}
        isEditing={canEditMatrix && (isEditing || dirty)}
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
        onDelete={async () => {
          try {
            await deleteRole.mutateAsync(selected.id)
            toast.success("Role deleted")
            setSelectedId(null)
          } catch (error) {
            toast.error(getApiErrorMessage(error))
          }
        }}
        onStartEditPermissions={() => {
          if (!canEditMatrix) return
          setIsEditing(true)
          setTab("permissions")
        }}
        roleUsers={roleUsers}
        roleUsersLoading={roleUsersLoading || detailLoading}
        matrix={matrixNode}
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
      <div className="flex shrink-0 flex-col gap-2 border-b border-border/50 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin/users">Administration</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Roles & Permissions</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <h1 className="text-lg font-semibold tracking-tight md:text-xl">Roles & Permissions</h1>
            <p className="text-xs text-muted-foreground">Enterprise RBAC</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {canManage ? (
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
          {canManage ? (
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
      </div>

      <div className="shrink-0">
        <RbacKpiCards
          roles={roles}
          permissions={catalog}
          userStats={userStats}
          isLoading={isLoading || permsLoading || statsLoading}
        />
      </div>

      <div className="hidden min-h-0 flex-1 grid-cols-[minmax(260px,28%)_minmax(0,1fr)] gap-2 lg:grid">
        <RoleListPanel
          roles={roles}
          selectedId={selected?.id ?? null}
          userCounts={userCounts}
          isLoading={isLoading}
          onSelect={selectRole}
          canCreate={canManage}
          onCreateRole={() => {
            setName("")
            setDescription("")
            setCreateOpen(true)
          }}
        />
        {selected ? (
          renderDetailPanel("desktop")
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
          canCreate={canManage}
          onCreateRole={() => {
            setName("")
            setDescription("")
            setCreateOpen(true)
          }}
        />
        {selected ? <div className="min-h-120">{renderDetailPanel("mobile")}</div> : null}
      </div>

      <AnimatePresence>
        {canEditMatrix && dirty ? (
          <RolesUnsavedBar
            key="unsaved-bar"
            saving={setPermissions.isPending}
            dirty={dirty}
            onSave={() => void handleSave()}
            onCancel={handleCancelEdit}
            onReset={handleReset}
          />
        ) : null}
      </AnimatePresence>

      <AuditLogsSheet open={auditOpen} onOpenChange={setAuditOpen} entries={auditEntries} />

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
          <DialogHeader className="space-y-1.5 border-b bg-linear-to-br from-primary/8 to-transparent px-6 py-5 text-left">
            <DialogTitle>Assign users</DialogTitle>
            <DialogDescription>
              Select a pending user to assign <strong>{selected ? roleDisplayName(selected.name) : "this role"}</strong>
              . Geography (State → District → ULB → Ward) is required for Surveyor / Supervisor.
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
              <p className="py-8 text-center text-sm text-muted-foreground">
                No pending users. New Clerk sign-ups appear here as Pending User.
              </p>
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
            keepEditingRef.current = true
            setSelectedId(role.id)
            setCreateOpen(false)
            setIsEditing(true)
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
            keepEditingRef.current = true
            setSelectedId(role.id)
            setCloneOpen(false)
            setIsEditing(true)
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
        nameDisabled={selected ? SYSTEM_ROLE_CODES.has(selected.name) : false}
        confirmLabel="Save"
        pending={updateRole.isPending}
        onConfirm={async () => {
          if (!selected) return
          try {
            await updateRole.mutateAsync({
              id: selected.id,
              body: {
                ...(SYSTEM_ROLE_CODES.has(selected.name)
                  ? {}
                  : { name: name.trim().toUpperCase().replace(/\s+/g, "_") }),
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
    </motion.div>
  )
}
