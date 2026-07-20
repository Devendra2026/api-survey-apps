"use client"

import { FormField } from "@/components/forms/form-field"
import { PermissionMatrix, rolePermissionIdSet } from "@/components/admin/permission-matrix"
import {
  useAssignTenantRole,
  useDistricts,
  usePermissionsCatalog,
  useRoles,
  useStates,
  useUlbs,
  useWards,
} from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { ASSIGNABLE_ROLES, roleDisplayName, type AuthenticatedProfile } from "@/lib/api/types"
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
import { cn } from "@workspace/ui/lib/utils"
import { Check } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

const GEO_REQUIRED = new Set(["SURVEYOR", "FIELD_SUPERVISOR"])
const GEO_FORBIDDEN = new Set(["ADMIN", "PENDING_APPROVAL"])
const OPERATIONAL_ROLES = ASSIGNABLE_ROLES.filter((r) => r !== "PENDING_APPROVAL")

const STEPS = [
  { id: 1, title: "Confirm details" },
  { id: 2, title: "Assign role" },
  { id: 3, title: "Assign geography" },
  { id: 4, title: "Review permissions" },
  { id: 5, title: "Confirm" },
] as const

export function UserOnboardWizard({
  user,
  open,
  onOpenChange,
}: {
  user: AuthenticatedProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const assignRole = useAssignTenantRole()
  const { data: rolesData } = useRoles()
  const { data: permissions } = usePermissionsCatalog()

  const [step, setStep] = useState(1)
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
    const map = new Map<string, { id: string; name: string }>()
    for (const role of rolesData?.items ?? []) {
      map.set(role.name, role)
    }
    return map
  }, [rolesData?.items])

  const selectedRole = rolesData?.items.find((r) => r.name === roleName)
  const needsGeo = GEO_REQUIRED.has(roleName)
  const forbidGeo = GEO_FORBIDDEN.has(roleName)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setRoleName("SURVEYOR")
    setStateId("")
    setDistrictId("")
    setUlbId("")
    setWardId("")
  }, [open, user?.id])

  const canNext = () => {
    if (step === 2) return Boolean(roleName)
    if (step === 3) {
      if (forbidGeo) return true
      if (needsGeo) return Boolean(stateId && districtId && ulbId && wardId)
      return true
    }
    return true
  }

  const handleFinish = async () => {
    if (!user) return
    const role = roleByName.get(roleName)
    if (!role) {
      toast.error("Role catalog not loaded")
      return
    }
    if (needsGeo && (!stateId || !districtId || !ulbId || !wardId)) {
      toast.error("Surveyor and Supervisor require full geography")
      return
    }
    try {
      await assignRole.mutateAsync({
        userId: user.id,
        roleId: role.id,
        ...(forbidGeo
          ? {}
          : {
              stateId: stateId || undefined,
              districtId: districtId || undefined,
              ulbId: ulbId || undefined,
              wardId: wardId || undefined,
            }),
      })
      toast.success(`${user.fullName} onboarded as ${roleDisplayName(roleName)}`)
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-3 border-b px-6 py-5 text-left">
          <DialogTitle>Onboard user</DialogTitle>
          <DialogDescription>
            Approve {user?.fullName ?? "this pending user"} by assigning a role and working area. Identity is managed by
            Clerk — no password is created here.
          </DialogDescription>
          <ol className="flex flex-wrap gap-2 pt-1">
            {STEPS.map((s) => (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : step > s.id
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {step > s.id ? <Check className="size-3" aria-hidden /> : <span>{s.id}</span>}
                {s.title}
              </li>
            ))}
          </ol>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 py-5">
          {step === 1 ? (
            <div className="space-y-3 rounded-2xl border bg-muted/20 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Name · </span>
                <span className="font-medium">{user?.fullName}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Email · </span>
                <span className="font-medium">{user?.email}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Mobile · </span>
                <span className="font-medium">{user?.phone ?? "—"}</span>
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <FormField label="Role" required>
              <Select value={roleName} onValueChange={setRoleName}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATIONAL_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleDisplayName(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}

          {step === 3 ? (
            forbidGeo ? (
              <p className="rounded-xl border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                {roleName === "ADMIN" ? "Admin is assigned globally." : "This role does not require geography."}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="State" required={needsGeo}>
                  <Select
                    value={stateId || undefined}
                    onValueChange={(v) => {
                      setStateId(v)
                      setDistrictId("")
                      setUlbId("")
                      setWardId("")
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {(states?.items ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="District" required={needsGeo}>
                  <Select
                    value={districtId || undefined}
                    onValueChange={(v) => {
                      setDistrictId(v)
                      setUlbId("")
                      setWardId("")
                    }}
                    disabled={!stateId}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {(districts?.items ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="ULB" required={needsGeo}>
                  <Select
                    value={ulbId || undefined}
                    onValueChange={(v) => {
                      setUlbId(v)
                      setWardId("")
                    }}
                    disabled={!districtId}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Select ULB" />
                    </SelectTrigger>
                    <SelectContent>
                      {(ulbs?.items ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
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
                      {(wards?.items ?? []).map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.wardNumber}
                          {w.wardName ? ` · ${w.wardName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            )
          ) : null}

          {step === 4 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                These permissions will be inherited from <strong>{roleDisplayName(roleName)}</strong>. Adjust the role
                matrix on the Roles page if needed.
              </p>
              <PermissionMatrix
                permissions={permissions?.items ?? []}
                selectedIds={rolePermissionIdSet(selectedRole)}
                readOnly
              />
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-2 rounded-2xl border bg-muted/20 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">User · </span>
                {user?.fullName}
              </p>
              <p>
                <span className="text-muted-foreground">Role · </span>
                {roleDisplayName(roleName)}
              </p>
              <p>
                <span className="text-muted-foreground">Geography · </span>
                {forbidGeo
                  ? "Global"
                  : [stateId && "State", districtId && "District", ulbId && "ULB", wardId && "Ward"]
                      .filter(Boolean)
                      .join(" → ") || "Optional / unset"}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl"
            onClick={() => {
              if (step === 1) onOpenChange(false)
              else if (step === 4 && forbidGeo) setStep(2)
              else setStep((s) => s - 1)
            }}
          >
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="flex gap-2">
            {step < 5 ? (
              <Button
                type="button"
                className="rounded-xl"
                disabled={!canNext()}
                onClick={() => {
                  if (step === 2 && forbidGeo) setStep(4)
                  else setStep((s) => s + 1)
                }}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-xl"
                disabled={assignRole.isPending}
                onClick={() => void handleFinish()}
              >
                {assignRole.isPending ? "Saving…" : "Complete onboarding"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
