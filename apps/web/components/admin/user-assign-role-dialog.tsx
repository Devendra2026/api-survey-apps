"use client"

import {
  allotmentsComplete,
  emptyAllotment,
  toAllotmentPayload,
  UserAllotmentsEditor,
  type AllotmentDraft,
} from "@/components/admin/user-allotments-editor"
import { activeAssignments, primaryAssignment } from "@/components/admin/user-badges"
import { FormField } from "@/components/forms/form-field"
import { useAssignTenantRole, useDistricts, useRoles, useStates, useUlbs } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import {
  ASSIGNABLE_ROLES,
  DEPARTMENT_ASSIGNABLE_ROLES,
  isDepartmentRoleName,
  roleDisplayName,
  tenantRoleCode,
  type AuthenticatedProfile,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

const GEO_REQUIRED_FULL = new Set(["SURVEYOR", "FIELD_SUPERVISOR", "QC_SUPERVISOR"])
const GEO_FORBIDDEN = new Set(["ADMIN", "PENDING_APPROVAL"])
const GEO_ULB_ONLY = new Set(["DEPT_ADMIN", "DEPT_CLERK", "DEPT_OPERATOR"])

function draftsFromUser(user: AuthenticatedProfile | null): AllotmentDraft[] {
  const active = activeAssignments(user?.tenantRoles).filter((r) => r.wardId && r.ulbId)
  if (!active.length) return [emptyAllotment()]
  return active.map((r) => ({
    key: r.id,
    stateId: r.stateId ?? "",
    districtId: r.districtId ?? "",
    ulbId: r.ulbId ?? "",
    wardId: r.wardId ?? "",
  }))
}

export function UserAssignRoleDialog({
  user,
  open,
  onOpenChange,
  mode = "role",
  defaultRoleName,
}: {
  user: AuthenticatedProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: "role" | "location"
  /** Prefer this role when opening (e.g. Assign Users from Roles page) */
  defaultRoleName?: string
}) {
  const assignRole = useAssignTenantRole()
  const { data: rolesData } = useRoles()
  const profile = useAuthStore((s) => s.profile)
  const [roleName, setRoleName] = useState("SURVEYOR")
  const [allotments, setAllotments] = useState<AllotmentDraft[]>([emptyAllotment()])
  const [stateId, setStateId] = useState("")
  const [districtId, setDistrictId] = useState("")
  const [ulbId, setUlbId] = useState("")

  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(stateId || undefined)
  const { data: ulbs } = useUlbs(districtId || undefined)

  const actorIsDeptOnly = useMemo(() => {
    const active = profile?.tenantRoles?.filter((r) => r.isActive) ?? []
    if (!active.length) return false
    return active.every((r) => isDepartmentRoleName(tenantRoleCode(r)))
  }, [profile?.tenantRoles])

  const assignableRoles = useMemo(() => {
    if (actorIsDeptOnly) return [...DEPARTMENT_ASSIGNABLE_ROLES].filter((r) => r !== "DEPT_ADMIN")
    return [...ASSIGNABLE_ROLES]
  }, [actorIsDeptOnly])

  const roleByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const role of rolesData?.items ?? []) {
      map.set(role.name, role.id)
    }
    return map
  }, [rolesData?.items])

  useEffect(() => {
    if (!user || !open) return
    const current = primaryAssignment(user.tenantRoles)
    const preferred =
      defaultRoleName && assignableRoles.includes(defaultRoleName as (typeof assignableRoles)[number])
        ? defaultRoleName
        : null
    const fallback = actorIsDeptOnly ? "DEPT_CLERK" : "SURVEYOR"
    const code = preferred ?? (current ? tenantRoleCode(current) : fallback)
    setRoleName(assignableRoles.includes(code as (typeof assignableRoles)[number]) ? code : fallback)
    setAllotments(draftsFromUser(user))
    setStateId(current?.stateId ?? "")
    setDistrictId(current?.districtId ?? "")
    setUlbId(current?.ulbId ?? "")
  }, [user, open, defaultRoleName, assignableRoles, actorIsDeptOnly])

  const needsFullGeo = GEO_REQUIRED_FULL.has(roleName)
  const needsUlbOnly = GEO_ULB_ONLY.has(roleName)
  const forbidGeo = GEO_FORBIDDEN.has(roleName)

  const handleSubmit = async () => {
    if (!user) return
    const roleId = roleByName.get(roleName)
    if (!roleId) {
      toast.error("Role catalog not loaded. Try again.")
      return
    }
    if (needsFullGeo && !allotmentsComplete(allotments)) {
      toast.error("Surveyor, Supervisor, and QC Supervisor require State, District, ULB, and Ward on every allotment")
      return
    }
    if (needsUlbOnly && !ulbId) {
      toast.error("Department roles require a ULB (municipal client)")
      return
    }

    try {
      await assignRole.mutateAsync({
        userId: user.id,
        roleId,
        ...(forbidGeo
          ? {}
          : needsFullGeo
            ? { allotments: toAllotmentPayload(allotments) }
            : needsUlbOnly
              ? { ulbId }
              : {
                  stateId: stateId || undefined,
                  districtId: districtId || undefined,
                  ulbId: ulbId || undefined,
                }),
      })
      toast.success(mode === "location" ? "Location assigned" : "Role assigned")
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
          <DialogTitle>{mode === "location" ? "Assign location" : "Assign role"}</DialogTitle>
          <DialogDescription>
            {user
              ? `Update access for ${user.fullName}. Previous active assignments are replaced.`
              : "Select a role and geographic scope."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
          <FormField label="Role" required>
            <Select
              value={roleName}
              onValueChange={(value) => {
                setRoleName(value)
                if (GEO_FORBIDDEN.has(value)) {
                  setAllotments([emptyAllotment()])
                  setStateId("")
                  setDistrictId("")
                  setUlbId("")
                }
                if (GEO_ULB_ONLY.has(value)) {
                  setAllotments([emptyAllotment()])
                }
                if (GEO_REQUIRED_FULL.has(value) && allotments.length === 0) {
                  setAllotments([emptyAllotment()])
                }
              }}
              disabled={mode === "location"}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleDisplayName(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {forbidGeo ? (
            <p className="rounded-xl border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              {roleName === "ADMIN"
                ? "Admin is assigned globally (all geographies)."
                : "Pending User has no geographic assignment until approved."}
            </p>
          ) : needsUlbOnly ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="State" required>
                <Select
                  value={stateId || undefined}
                  onValueChange={(value) => {
                    setStateId(value)
                    setDistrictId("")
                    setUlbId("")
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {(states?.items ?? []).map((state) => (
                      <SelectItem key={state.id} value={state.id}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="District" required>
                <Select
                  value={districtId || undefined}
                  onValueChange={(value) => {
                    setDistrictId(value)
                    setUlbId("")
                  }}
                  disabled={!stateId}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent>
                    {(districts?.items ?? []).map((district) => (
                      <SelectItem key={district.id} value={district.id}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="ULB (client)" required className="sm:col-span-2">
                <Select value={ulbId || undefined} onValueChange={setUlbId} disabled={!districtId}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select municipal ULB" />
                  </SelectTrigger>
                  <SelectContent>
                    {(ulbs?.items ?? []).map((ulb) => (
                      <SelectItem key={ulb.id} value={ulb.id}>
                        {ulb.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Department roles are scoped to the ULB (municipal client). No ward required.
              </p>
            </div>
          ) : needsFullGeo ? (
            <UserAllotmentsEditor value={allotments} onChange={setAllotments} />
          ) : (
            <p className="text-sm text-muted-foreground">Geography is optional for this role.</p>
          )}
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => void handleSubmit()}
            disabled={assignRole.isPending}
          >
            {assignRole.isPending ? "Saving…" : "Confirm assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
