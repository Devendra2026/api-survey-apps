"use client"

import { ROLE_PERMISSION_HINTS } from "@/components/admin/roles/matrix-config"
import {
  canModifyPermissions,
  canRenameRole,
  isDepartmentRole,
  isSystemRole,
} from "@/components/admin/roles/system-role-policy"
import { UserAvatar } from "@/components/admin/user-badges"
import { EmptyState } from "@/components/shared/page-elements"
import { roleDisplayName, type CatalogRole } from "@/lib/api/types"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { AlertTriangle, Copy, Pencil, Trash2, UserPlus, Users } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

export type RoleUserRow = {
  id: string
  user: {
    id: string
    fullName: string
    email: string
    phone?: string | null
    isActive: boolean
    lastLoginAt?: string | null
  }
  state?: { name: string } | null
  district?: { name: string } | null
  ulb?: { name: string } | null
  ward?: { wardNumber: string; wardName: string } | null
}

export function RoleDetailPanel({
  role,
  tab,
  onTabChange,
  canManage,
  isEditing,
  onEdit,
  onClone,
  onAssign,
  onDelete,
  onStartEditPermissions,
  onSaveMetadata,
  roleUsers,
  roleUsersLoading,
  matrix,
  templateReadOnly = false,
}: {
  role: CatalogRole
  tab: string
  onTabChange: (tab: string) => void
  canManage: boolean
  isEditing: boolean
  onEdit: () => void
  onClone: () => void
  onAssign: () => void
  onDelete: () => void
  onStartEditPermissions: () => void
  onSaveMetadata?: (values: { name?: string; description: string }) => Promise<void>
  roleUsers?: RoleUserRow[]
  roleUsersLoading?: boolean
  matrix: ReactNode
  /** Municipal viewers: show permission checklist, assign users, no matrix edits */
  templateReadOnly?: boolean
}) {
  const isSystem = isSystemRole(role.name)
  const isDept = isDepartmentRole(role.name)
  const canEditPerms = canModifyPermissions(role.name) && !templateReadOnly
  const canRename = canRenameRole(role.name) && !templateReadOnly
  const permCount = role.permissionCount ?? role.permissions?.length ?? 0
  const assigned = role.assignedUsersCount ?? roleUsers?.length ?? 0
  const typeBadge = isDept ? "DEPT" : isSystem ? "SYS" : "CUSTOM"

  const [displayName, setDisplayName] = useState(roleDisplayName(role.name))
  const [description, setDescription] = useState(role.description ?? "")
  const [metaSaving, setMetaSaving] = useState(false)

  useEffect(() => {
    setDisplayName(roleDisplayName(role.name))
    setDescription(role.description ?? "")
  }, [role.id, role.name, role.description])

  const metaDirty =
    description !== (role.description ?? "") || (canRename && displayName !== roleDisplayName(role.name))

  const saveMetadata = async () => {
    if (!onSaveMetadata || !canManage || templateReadOnly) return
    setMetaSaving(true)
    try {
      await onSaveMetadata({
        name: canRename ? displayName.trim().toUpperCase().replace(/\s+/g, "_") : undefined,
        description: description.trim(),
      })
    } finally {
      setMetaSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-card shadow-xs">
      <div className="shrink-0 space-y-2 border-b bg-linear-to-r from-primary/5 to-transparent px-3 py-2.5">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-base font-semibold tracking-tight">{roleDisplayName(role.name)}</h2>
              <Badge
                variant="outline"
                className={cn(
                  "h-5 rounded-md px-1.5 text-[10px] font-medium uppercase",
                  isDept
                    ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100"
                    : isSystem
                      ? "border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
                      : "border-primary/30 bg-primary/5 text-primary"
                )}
              >
                {typeBadge}
              </Badge>
              <Badge
                variant="outline"
                className="h-5 rounded-md border-emerald-300/60 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-800 dark:text-emerald-200"
              >
                Active
              </Badge>
              {isEditing ? (
                <Badge className="h-5 rounded-md bg-amber-500/15 px-1.5 text-[10px] text-amber-800 dark:text-amber-200">
                  Editing
                </Badge>
              ) : null}
            </div>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {role.description ?? ROLE_PERMISSION_HINTS[role.name] ?? "No description"}
            </p>
          </div>

          {canManage ? (
            <TooltipProvider delayDuration={200}>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                {!templateReadOnly ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 cursor-pointer rounded-md text-xs"
                    variant={isEditing ? "secondary" : "default"}
                    onClick={onStartEditPermissions}
                  >
                    <Pencil className="mr-1 size-3" aria-hidden />
                    {isEditing ? "Editing" : canEditPerms ? "Edit Role" : "View"}
                  </Button>
                ) : null}
                {!templateReadOnly ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 cursor-pointer rounded-md text-xs"
                    onClick={onClone}
                  >
                    <Copy className="mr-1 size-3" aria-hidden />
                    Clone
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 cursor-pointer rounded-md text-xs"
                  onClick={onAssign}
                >
                  <UserPlus className="mr-1 size-3" aria-hidden />
                  Assign Users
                </Button>
                {!templateReadOnly ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 cursor-pointer rounded-md text-xs"
                    onClick={onEdit}
                  >
                    Metadata
                  </Button>
                ) : null}
                {!templateReadOnly && !isSystem ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={onDelete}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        <span className="sr-only">Delete Role</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete custom role</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </TooltipProvider>
          ) : null}
        </div>

        {isSystem && !templateReadOnly ? (
          <div
            className="flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <p>
              Editing a system role – Custom permission changes will be overwritten if you click Refresh system RBAC.
            </p>
          </div>
        ) : null}

        <div className="grid gap-2 rounded-md border border-border/50 bg-muted/20 p-2.5 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Display name
            </span>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!canManage || !canRename || templateReadOnly}
              className="h-8 rounded-lg text-sm"
              aria-label="Display name"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Key</span>
            <Input
              value={role.name}
              readOnly
              className="h-8 rounded-lg font-mono text-sm text-muted-foreground"
              aria-label="Role key"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Description</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canManage || templateReadOnly}
              className="min-h-16 rounded-lg text-sm"
              aria-label="Role description"
            />
          </label>
          {canManage && !templateReadOnly && onSaveMetadata ? (
            <div className="flex justify-end sm:col-span-2">
              <Button
                type="button"
                size="sm"
                className="h-7 cursor-pointer rounded-md text-xs"
                disabled={!metaDirty || metaSaving}
                onClick={() => void saveMetadata()}
              >
                {metaSaving ? "Saving…" : "Save details"}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border border-border/50 bg-muted/25 px-2.5 py-1 text-[11px] text-muted-foreground">
          <MetaItem label="Type" value={typeBadge} />
          <Sep />
          <MetaItem label="Permissions" value={String(permCount)} />
          <Sep />
          <MetaItem label="Assigned" value={String(assigned)} />
          <Sep />
          <MetaItem label="Status" value="Active" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b px-2.5 pt-1.5">
          <TabsList className="h-7 rounded-md bg-muted/60 p-0.5">
            <TabsTrigger value="permissions" className="h-6 cursor-pointer rounded px-2.5 text-xs">
              Permissions
            </TabsTrigger>
            <TabsTrigger value="users" className="h-6 cursor-pointer rounded px-2.5 text-xs">
              Assigned users ({assigned})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="permissions"
          className="mt-0 min-h-0 flex-1 overflow-hidden px-2.5 py-2 data-[state=inactive]:hidden"
        >
          <div className="h-full min-h-0 overflow-hidden">{matrix}</div>
        </TabsContent>

        <TabsContent
          value="users"
          className="mt-0 min-h-0 flex-1 overflow-auto px-2.5 py-2 data-[state=inactive]:hidden"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Users inherit this role&apos;s permissions. Geography applies for Surveyor / Supervisor.
            </p>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                className="h-7 shrink-0 cursor-pointer rounded-md text-xs"
                onClick={onAssign}
              >
                <UserPlus className="mr-1 size-3" />
                Assign
              </Button>
            ) : null}
          </div>
          <Separator className="mb-2" />
          {roleUsersLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          ) : roleUsers?.length ? (
            <ul className="space-y-1">
              {roleUsers.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/70 px-2.5 py-1.5 transition-colors duration-200 hover:bg-muted/30"
                >
                  <UserAvatar name={row.user.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.user.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.user.email}</p>
                  </div>
                  <Badge variant="outline" className="rounded-md text-[10px]">
                    {[row.state?.name, row.district?.name, row.ulb?.name, row.ward?.wardNumber]
                      .filter(Boolean)
                      .join(" · ") || "Global"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No users assigned"
              description="Assign this role to pending users. They inherit permissions automatically."
              icon={<Users className="size-5" />}
              className="py-8"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <strong className="font-semibold text-foreground tabular-nums">{value}</strong>
    </span>
  )
}

function Sep() {
  return (
    <span className="hidden text-border sm:inline" aria-hidden>
      |
    </span>
  )
}
