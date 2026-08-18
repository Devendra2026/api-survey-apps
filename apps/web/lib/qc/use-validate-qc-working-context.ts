"use client"

import { isWorkingContextWithinAllotment } from "@/lib/qc/allotment-scope"
import { useAuthStore } from "@/stores/app-store"
import { useQcWorkingContext } from "@/stores/qc-working-context"
import { useEffect } from "react"

/** Clear persisted QC ward context when it falls outside the user's current allotment. */
export function useValidateQcWorkingContext() {
  const tenantRoles = useAuthStore((s) => s.profile?.tenantRoles)
  const activeWardId = useQcWorkingContext((s) => s.activeWardId)
  const activeUlbId = useQcWorkingContext((s) => s.activeUlbId)
  const clearActiveWard = useQcWorkingContext((s) => s.clearActiveWard)

  useEffect(() => {
    if (!tenantRoles?.length) return
    if (!activeUlbId && !activeWardId) return
    if (!isWorkingContextWithinAllotment({ activeWardId, activeUlbId }, tenantRoles)) {
      clearActiveWard()
    }
  }, [tenantRoles, activeWardId, activeUlbId, clearActiveWard])
}
