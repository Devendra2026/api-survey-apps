"use client"

import { PermissionMatrix, rolePermissionIdSet } from "@/components/admin/permission-matrix"
import {
  assignmentGeoLabels,
  primaryAssignment,
  RoleBadge,
  StatusBadge,
  UserAvatar,
} from "@/components/admin/user-badges"
import { usePermissionsCatalog, useRoles, useUserAudits } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import type { AuthenticatedProfile } from "@/lib/api/types"
import { tenantRoleDisplayName } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { motion, useReducedMotion } from "framer-motion"
import { MapPin, MoreHorizontal, Shield } from "lucide-react"
import Link from "next/link"

export function UserProfileDrawer({
  user,
  open,
  onOpenChange,
  canUpdate,
  canAssign,
  canDelete,
  onEdit,
  onAssignRole,
  onToggleStatus,
  onDelete,
  onOnboard,
}: {
  user: AuthenticatedProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canUpdate?: boolean
  canAssign?: boolean
  canDelete?: boolean
  onEdit?: () => void
  onAssignRole?: () => void
  onToggleStatus?: () => void
  onDelete?: () => void
  onOnboard?: () => void
}) {
  const reduceMotion = useReducedMotion()
  const canManageRoles = useAuthStore((s) => s.hasPermission("role:assign"))
  const assignment = user ? primaryAssignment(user.tenantRoles) : undefined
  const geo = assignmentGeoLabels(assignment)
  const roleName = assignment?.role?.name ?? assignment?.roleName
  const isPending = roleName === "PENDING_APPROVAL"

  const { data: roles, isLoading: rolesLoading } = useRoles()
  const { data: permissions, isLoading: permsLoading } = usePermissionsCatalog()
  const {
    data: audits,
    isLoading: auditsLoading,
    isError: auditsError,
    error: auditsErr,
    refetch: refetchAudits,
  } = useUserAudits(user?.id)

  const matchedRole = roles?.items.find((r) => r.name === roleName || r.id === assignment?.roleId)
  const inheritedIds = rolePermissionIdSet(matchedRole)
  const catalogLoading = rolesLoading || permsLoading

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden border-l p-0 sm:max-w-lg">
        <motion.div
          className="flex h-full flex-col"
          initial={reduceMotion ? false : { x: 24, opacity: 0 }}
          animate={reduceMotion ? undefined : { x: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <SheetHeader className="space-y-4 border-b px-6 py-5 text-left">
            <div className="flex items-start gap-3">
              {user ? <UserAvatar name={user.fullName} className="size-12 text-sm" /> : null}
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg">{user?.fullName}</SheetTitle>
                <SheetDescription className="truncate">{user?.email}</SheetDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {assignment ? <RoleBadge role={assignment} /> : null}
              {user ? <StatusBadge isActive={user.isActive} /> : null}
              {isPending ? (
                <span className="inline-flex items-center rounded-md border border-amber-300/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                  Pending approval
                </span>
              ) : null}
            </div>
          </SheetHeader>

          {user ? (
            <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
              <div className="border-b px-4">
                <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
                  {(
                    [
                      ["overview", "Overview"],
                      ["access", "Access"],
                      ["activity", "Activity"],
                    ] as const
                  ).map(([value, label]) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="cursor-pointer rounded-none border-b-2 border-transparent px-3 py-2.5 text-xs transition-colors duration-200 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <TabsContent value="overview" className="mt-0 space-y-4">
                  <section className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Who they are</p>
                    <div className="space-y-2.5 text-sm">
                      <Row label="Mobile" value={user.phone ?? "—"} />
                      <Row label="Role" value={assignment ? tenantRoleDisplayName(assignment) : "—"} />
                      <Row
                        label="Last login"
                        value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Detailed sessions and MFA are managed in Clerk. Last API authentication is shown above.
                    </p>
                  </section>

                  <section className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-primary" aria-hidden />
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Working area
                      </p>
                    </div>
                    <div className="space-y-2.5 text-sm">
                      <Row label="State" value={geo.state} />
                      <Row label="District" value={geo.district} />
                      <Row label="ULB" value={geo.ulb} />
                      <Row label="Ward" value={geo.ward} />
                    </div>
                    {!assignment?.wardId && !assignment?.ulbId && !assignment?.districtId && !assignment?.stateId ? (
                      <p className="text-xs text-muted-foreground">Global scope (no geographic restriction).</p>
                    ) : null}
                  </section>
                </TabsContent>

                <TabsContent value="access" className="mt-0 space-y-3">
                  <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Shield className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      <p>
                        Effective permissions are inherited from the assigned role. Changing the matrix updates every
                        assignee of that role.
                      </p>
                    </div>
                    {canManageRoles && matchedRole ? (
                      <Button
                        asChild
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 rounded-lg text-xs"
                      >
                        <Link href={`/admin/roles?role=${matchedRole.id}`}>Open in Roles</Link>
                      </Button>
                    ) : null}
                  </div>
                  {catalogLoading ? (
                    <div className="space-y-2" aria-busy="true">
                      <Skeleton className="h-8 w-full rounded-lg" />
                      <Skeleton className="h-40 w-full rounded-lg" />
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-auto rounded-xl border">
                      <PermissionMatrix permissions={permissions?.items ?? []} selectedIds={inheritedIds} readOnly />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="mt-0 space-y-3">
                  {auditsError ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm"
                    >
                      <p className="font-medium text-destructive">Unable to load activity</p>
                      <p className="mt-1 text-xs text-muted-foreground">{getApiErrorMessage(auditsErr)}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 cursor-pointer rounded-lg"
                        onClick={() => void refetchAudits()}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <ActivityList loading={auditsLoading} items={audits ?? []} empty="No audit events for this user." />
                  )}
                </TabsContent>
              </div>

              <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur">
                {canUpdate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer rounded-xl transition-colors duration-200"
                    onClick={onEdit}
                  >
                    Edit
                  </Button>
                ) : null}
                {canAssign && isPending ? (
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer rounded-xl transition-colors duration-200"
                    onClick={onOnboard}
                  >
                    Onboard user
                  </Button>
                ) : null}
                {canAssign ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="cursor-pointer rounded-xl transition-colors duration-200"
                    onClick={onAssignRole}
                  >
                    Assign role
                  </Button>
                ) : null}
                {canUpdate ? (
                  <Button
                    type="button"
                    variant={user.isActive ? "destructive" : "secondary"}
                    size="sm"
                    className="cursor-pointer rounded-xl transition-colors duration-200"
                    onClick={onToggleStatus}
                  >
                    {user.isActive ? "Disable" : "Activate"}
                  </Button>
                ) : null}
                {canDelete ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer rounded-xl transition-colors duration-200"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="size-4" />
                        More
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onSelect={(e) => {
                          e.preventDefault()
                          queueMicrotask(() => onDelete?.())
                        }}
                      >
                        Delete user
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </Tabs>
          ) : null}
        </motion.div>
      </SheetContent>
    </Sheet>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  )
}

function ActivityList({
  loading,
  items,
  empty,
}: {
  loading: boolean
  items: Array<{ id: string; action: string; createdAt: string; actor?: { fullName: string } | null }>
  empty: string
}) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    )
  }
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border px-3 py-2.5 text-sm">
          <p className="font-medium">{item.action.replaceAll("_", " ")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(item.createdAt).toLocaleString()}
            {item.actor?.fullName ? ` · by ${item.actor.fullName}` : ""}
          </p>
        </li>
      ))}
    </ul>
  )
}
