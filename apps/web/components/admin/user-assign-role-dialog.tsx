"use client"

import { primaryAssignment } from "@/components/admin/user-badges"
import { FormField } from "@/components/forms/form-field"
import { useAssignTenantRole, useDistricts, useRoles, useStates, useUlbs, useWards } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { ASSIGNABLE_ROLES, roleDisplayName, tenantRoleCode, type AuthenticatedProfile } from "@/lib/api/types"
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

const GEO_REQUIRED = new Set(["SURVEYOR", "FIELD_SUPERVISOR"])
const GEO_FORBIDDEN = new Set(["ADMIN", "PENDING_APPROVAL"])

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
  const [roleName, setRoleName] = useState("SURVEYOR")
  const [stateId, setStateId] = useState("")
  const [districtId, setDistrictId] = useState("")
  const [ulbId, setUlbId] = useState("")
  const [wardId, setWardId] = useState("")

  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(stateId || undefined)
  const { data: ulbs } = useUlbs(districtId || undefined)
  const { data: wards } = useWards(ulbId || undefined)

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
      defaultRoleName && ASSIGNABLE_ROLES.includes(defaultRoleName as (typeof ASSIGNABLE_ROLES)[number])
        ? defaultRoleName
        : null
    const code = preferred ?? (current ? tenantRoleCode(current) : "SURVEYOR")
    setRoleName(ASSIGNABLE_ROLES.includes(code as (typeof ASSIGNABLE_ROLES)[number]) ? code : "SURVEYOR")
    setStateId(current?.stateId ?? "")
    setDistrictId(current?.districtId ?? "")
    setUlbId(current?.ulbId ?? "")
    setWardId(current?.wardId ?? "")
  }, [user, open, defaultRoleName])

  const needsGeo = GEO_REQUIRED.has(roleName)
  const forbidGeo = GEO_FORBIDDEN.has(roleName)

  const handleSubmit = async () => {
    if (!user) return
    const roleId = roleByName.get(roleName)
    if (!roleId) {
      toast.error("Role catalog not loaded. Try again.")
      return
    }
    if (needsGeo && (!stateId || !districtId || !ulbId || !wardId)) {
      toast.error("Surveyor and Supervisor require State, District, ULB, and Ward")
      return
    }

    try {
      await assignRole.mutateAsync({
        userId: user.id,
        roleId,
        ...(forbidGeo
          ? {}
          : {
              stateId: stateId || undefined,
              districtId: districtId || undefined,
              ulbId: ulbId || undefined,
              wardId: wardId || undefined,
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
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
          <DialogTitle>{mode === "location" ? "Assign location" : "Assign role"}</DialogTitle>
          <DialogDescription>
            {user
              ? `Update access for ${user.fullName}. Previous active assignments are replaced.`
              : "Select a role and geographic scope."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <FormField label="Role" required>
            <Select
              value={roleName}
              onValueChange={(value) => {
                setRoleName(value)
                if (GEO_FORBIDDEN.has(value)) {
                  setStateId("")
                  setDistrictId("")
                  setUlbId("")
                  setWardId("")
                }
              }}
              disabled={mode === "location"}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleDisplayName(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {!forbidGeo ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="State" required={needsGeo}>
                <Select
                  value={stateId || undefined}
                  onValueChange={(value) => {
                    setStateId(value)
                    setDistrictId("")
                    setUlbId("")
                    setWardId("")
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

              <FormField label="District" required={needsGeo}>
                <Select
                  value={districtId || undefined}
                  onValueChange={(value) => {
                    setDistrictId(value)
                    setUlbId("")
                    setWardId("")
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

              <FormField label="ULB" required={needsGeo}>
                <Select
                  value={ulbId || undefined}
                  onValueChange={(value) => {
                    setUlbId(value)
                    setWardId("")
                  }}
                  disabled={!districtId}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select ULB" />
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

              <FormField label="Ward" required={needsGeo}>
                <Select value={wardId || undefined} onValueChange={setWardId} disabled={!ulbId}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select ward" />
                  </SelectTrigger>
                  <SelectContent>
                    {(wards?.items ?? []).map((ward) => (
                      <SelectItem key={ward.id} value={ward.id}>
                        {ward.wardNumber}
                        {ward.wardName ? ` · ${ward.wardName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          ) : (
            <p className="rounded-xl border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              {roleName === "ADMIN"
                ? "Admin is assigned globally (all geographies)."
                : "Pending User has no geographic assignment until approved."}
            </p>
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
