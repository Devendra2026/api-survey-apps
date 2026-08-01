"use client"

import {
  ALL_WARDS_SENTINEL,
  allotmentModeForRole,
  allotmentsComplete,
  allotmentsEqual,
  emptyAllotment,
  toAllotmentPayload,
  UserAllotmentsEditor,
  type AllotmentDraft,
} from "@/components/admin/user-allotments-editor"
import { activeAssignments, RoleBadge } from "@/components/admin/user-badges"
import { useAssignTenantRole, useRoles } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { roleDisplayName, tenantRoleCode, type AuthenticatedProfile } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

const FIELD_ROLES = new Set(["SURVEYOR", "FIELD_SUPERVISOR", "QC_SUPERVISOR"])

function draftsFromUser(user: AuthenticatedProfile | null): AllotmentDraft[] {
  const active = activeAssignments(user?.tenantRoles).filter((r) => r.ulbId)
  if (!active.length) return [emptyAllotment()]
  return active.map((r) => ({
    key: r.id,
    stateId: r.stateId ?? "",
    districtId: r.districtId ?? "",
    ulbId: r.ulbId ?? "",
    wardId: r.wardId ? r.wardId : ALL_WARDS_SENTINEL,
  }))
}

export function GrantPermissionModal({
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
  const reduceMotion = useReducedMotion()
  const [allotments, setAllotments] = useState<AllotmentDraft[]>([emptyAllotment()])
  const [baseline, setBaseline] = useState<AllotmentDraft[]>([emptyAllotment()])

  const activeRole = useMemo(() => {
    const field = activeAssignments(user?.tenantRoles).find((r) => FIELD_ROLES.has(tenantRoleCode(r)))
    return field ?? activeAssignments(user?.tenantRoles)[0]
  }, [user?.tenantRoles])

  const roleName = activeRole ? tenantRoleCode(activeRole) : ""
  const editorMode = allotmentModeForRole(roleName)
  const canEdit = FIELD_ROLES.has(roleName)

  useEffect(() => {
    if (!user || !open) return
    const drafts = draftsFromUser(user)
    setAllotments(drafts)
    setBaseline(drafts)
  }, [user, open])

  const isDirty = !allotmentsEqual(allotments, baseline)
  const canSave = canEdit && isDirty && allotmentsComplete(allotments, editorMode)

  const handleSave = async () => {
    if (!user || !activeRole) return
    const roleId = activeRole.roleId || activeRole.role?.id || rolesData?.items.find((r) => r.name === roleName)?.id
    if (!roleId) {
      toast.error("Role catalog not loaded. Try again.")
      return
    }
    try {
      await assignRole.mutateAsync({
        userId: user.id,
        roleId,
        allotments: toAllotmentPayload(allotments),
      })
      toast.success("Permissions granted")
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
            <DialogTitle>Grant permission</DialogTitle>
            <DialogDescription>
              {user ? `Edit location and ward access for ${user.fullName}.` : "Edit location and ward access."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            {roleName ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Role</span>
                <RoleBadge role={roleName} />
                <span className="text-muted-foreground">· {roleDisplayName(roleName)}</span>
              </div>
            ) : null}

            {!canEdit ? (
              <p className="rounded-xl border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                Location and ward allotments apply to Surveyor, Supervisor, and QC Supervisor roles.
              </p>
            ) : (
              <UserAllotmentsEditor value={allotments} onChange={setAllotments} mode={editorMode} />
            )}
          </div>

          <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer rounded-xl"
              onClick={() => void handleSave()}
              disabled={!canSave || assignRole.isPending}
            >
              {assignRole.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
