"use client"

import {
  assignmentGeoLabels,
  primaryAssignment,
  RoleBadge,
  StatusBadge,
  UserAvatar,
} from "@/components/admin/user-badges"
import { PermissionMatrix, rolePermissionIdSet } from "@/components/admin/permission-matrix"
import { usePermissionsCatalog, useRoles, useUserAudits } from "@/hooks/use-api"
import type { AuthenticatedProfile } from "@/lib/api/types"
import { tenantRoleDisplayName } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { motion, useReducedMotion } from "framer-motion"
import { Clock3, MapPin, Shield } from "lucide-react"

export function UserProfileDrawer({
  user,
  open,
  onOpenChange,
  canUpdate,
  canAssign,
  onEdit,
  onAssignRole,
  onToggleStatus,
  onOnboard,
}: {
  user: AuthenticatedProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canUpdate?: boolean
  canAssign?: boolean
  onEdit?: () => void
  onAssignRole?: () => void
  onToggleStatus?: () => void
  onOnboard?: () => void
}) {
  const reduceMotion = useReducedMotion()
  const assignment = user ? primaryAssignment(user.tenantRoles) : undefined
  const geo = assignmentGeoLabels(assignment)
  const roleName = assignment?.role?.name ?? assignment?.roleName
  const isPending = roleName === "PENDING_APPROVAL"

  const { data: roles } = useRoles()
  const { data: permissions } = usePermissionsCatalog()
  const { data: audits, isLoading: auditsLoading } = useUserAudits(user?.id)

  const matchedRole = roles?.items.find((r) => r.name === roleName || r.id === assignment?.roleId)
  const inheritedIds = rolePermissionIdSet(matchedRole)

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
            </div>
          </SheetHeader>

          {user ? (
            <Tabs defaultValue="profile" className="flex min-h-0 flex-1 flex-col">
              <div className="overflow-x-auto border-b px-4">
                <TabsList className="h-auto w-max justify-start gap-1 bg-transparent p-0">
                  {(
                    [
                      ["profile", "Profile"],
                      ["geography", "Geography"],
                      ["permissions", "Permissions"],
                      ["activity", "Activity"],
                      ["login", "Login"],
                      ["audit", "Audit"],
                    ] as const
                  ).map(([value, label]) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <TabsContent value="profile" className="mt-0 space-y-4">
                  <section className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Profile</p>
                    <div className="space-y-2.5 text-sm">
                      <Row label="Mobile" value={user.phone ?? "—"} />
                      <Row
                        label="Last login"
                        value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                      />
                      <Row label="Role" value={assignment ? tenantRoleDisplayName(assignment) : "—"} />
                    </div>
                  </section>
                </TabsContent>

                <TabsContent value="geography" className="mt-0 space-y-4">
                  <section className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-primary" aria-hidden />
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Assigned geography
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

                <TabsContent value="permissions" className="mt-0 space-y-3">
                  <div className="flex items-start gap-2 rounded-xl border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                    <Shield className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    <p>
                      Permissions are inherited from the assigned role. Edit the role matrix on the Roles page to change
                      capabilities for all users with this role.
                    </p>
                  </div>
                  <PermissionMatrix permissions={permissions?.items ?? []} selectedIds={inheritedIds} readOnly />
                </TabsContent>

                <TabsContent value="activity" className="mt-0 space-y-3">
                  <ActivityList
                    loading={auditsLoading}
                    items={(audits ?? []).filter((a) => a.action.includes("ROLE") || a.targetType === "UserTenantRole")}
                    empty="No role activity recorded yet."
                  />
                </TabsContent>

                <TabsContent value="login" className="mt-0 space-y-3">
                  <section className="rounded-2xl border bg-muted/20 p-4 text-sm">
                    <div className="mb-3 flex items-center gap-2 text-muted-foreground">
                      <Clock3 className="size-3.5" aria-hidden />
                      <span className="text-xs font-semibold tracking-wide uppercase">Login history</span>
                    </div>
                    <Row
                      label="Last successful login"
                      value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                    />
                    <p className="mt-3 text-xs text-muted-foreground">
                      Detailed session history is managed by Clerk. Last API authentication is shown above.
                    </p>
                  </section>
                </TabsContent>

                <TabsContent value="audit" className="mt-0 space-y-3">
                  <ActivityList loading={auditsLoading} items={audits ?? []} empty="No audit events for this user." />
                </TabsContent>
              </div>

              <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur">
                {canUpdate ? (
                  <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onEdit}>
                    Edit
                  </Button>
                ) : null}
                {canAssign && isPending ? (
                  <Button type="button" size="sm" className="rounded-xl" onClick={onOnboard}>
                    Onboard user
                  </Button>
                ) : null}
                {canAssign ? (
                  <Button type="button" size="sm" variant="secondary" className="rounded-xl" onClick={onAssignRole}>
                    Assign role
                  </Button>
                ) : null}
                {canUpdate ? (
                  <Button
                    type="button"
                    variant={user.isActive ? "destructive" : "secondary"}
                    size="sm"
                    className="rounded-xl"
                    onClick={onToggleStatus}
                  >
                    {user.isActive ? "Disable" : "Activate"}
                  </Button>
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
      <div className="space-y-2">
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
