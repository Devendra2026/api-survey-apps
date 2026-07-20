"use client"

import { ROLE_PERMISSION_HINTS } from "@/components/admin/roles/matrix-config"
import { SYSTEM_ROLE_CODES } from "@/components/admin/roles/permission-utils"
import { UserAvatar } from "@/components/admin/user-badges"
import { EmptyState } from "@/components/shared/page-elements"
import { roleDisplayName, type CatalogRole } from "@/lib/api/types"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { Copy, Pencil, Trash2, UserPlus, Users } from "lucide-react"
import type { ReactNode } from "react"

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
  roleUsers,
  roleUsersLoading,
  matrix,
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
  roleUsers?: RoleUserRow[]
  roleUsersLoading?: boolean
  matrix: ReactNode
}) {
  const isSystem = SYSTEM_ROLE_CODES.has(role.name)
  const permCount = role.permissionCount ?? role.permissions?.length ?? 0
  const assigned = role.assignedUsersCount ?? roleUsers?.length ?? 0

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
                  "h-5 rounded-md px-1.5 text-[10px]",
                  isSystem
                    ? "border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
                    : "border-primary/30 bg-primary/5 text-primary"
                )}
              >
                {isSystem ? "System" : "Custom"}
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
                <Button
                  type="button"
                  size="sm"
                  className="h-7 cursor-pointer rounded-md text-xs"
                  variant={isEditing ? "secondary" : "default"}
                  onClick={onStartEditPermissions}
                  disabled={isSystem}
                  title={isSystem ? "System role permissions are locked — clone to customize" : undefined}
                >
                  <Pencil className="mr-1 size-3" aria-hidden />
                  {isSystem ? "Locked" : isEditing ? "Editing" : "Edit Role"}
                </Button>
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
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 cursor-pointer rounded-md text-xs"
                  onClick={onEdit}
                >
                  Metadata
                </Button>
                {!isSystem ? (
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

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border border-border/50 bg-muted/25 px-2.5 py-1 text-[11px] text-muted-foreground">
          <MetaItem label="Type" value={isSystem ? "System" : "Custom"} />
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
              Permission matrix
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
              description="Assign this role to pending users. They inherit the matrix automatically."
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
