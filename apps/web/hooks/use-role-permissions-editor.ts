"use client"

import { rolePermissionIdSet, setsEqual } from "@/components/admin/roles/permission-utils"
import {
  canModifyPermissions,
  isFullyLockedSystemRole,
  protectedPermissionIds,
  roleCategory,
} from "@/components/admin/roles/system-role-policy"
import { usePermissionsCatalog, useRole, useRoleUsers, useSetRolePermissions } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

const schema = z.object({
  permissionIds: z.array(z.string()),
})

export type RolePermissionsFormValues = z.infer<typeof schema>

export function useRolePermissionsEditor({
  roleId,
  canManage,
}: {
  roleId: string | null | undefined
  canManage: boolean
}) {
  const {
    data: permissionsPage,
    isLoading: permsLoading,
    isError: permsError,
    error: permsErr,
  } = usePermissionsCatalog()
  const {
    data: roleDetail,
    isLoading: roleLoading,
    isError: roleError,
    error: roleErr,
    refetch: refetchRole,
  } = useRole(roleId)
  const { data: roleUsers, isLoading: usersLoading } = useRoleUsers(roleId ?? undefined)
  const setPermissions = useSetRolePermissions()

  const catalog = permissionsPage?.items ?? []
  const form = useForm<RolePermissionsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { permissionIds: [] },
  })

  const baselineRef = useRef<Set<string>>(new Set())
  const hydratedKeyRef = useRef<string | null>(null)
  const permissionIds = form.watch("permissionIds")
  const draftIds = useMemo(() => new Set(permissionIds ?? []), [permissionIds])
  const dirty = !setsEqual(draftIds, baselineRef.current)

  const editorReady =
    !permsLoading && !permsError && catalog.length > 0 && !roleLoading && !roleError && Boolean(roleDetail)

  const roleName = roleDetail?.name ?? ""
  const category = roleName ? roleCategory(roleName) : "CUSTOM"
  const fullyLocked = roleName ? isFullyLockedSystemRole(roleName) : false
  const canEditMatrix = Boolean(canManage && roleDetail && canModifyPermissions(roleName) && !fullyLocked)
  const protectedIds = useMemo(
    () => (roleName ? protectedPermissionIds(roleName, catalog) : new Set<string>()),
    [roleName, catalog]
  )

  // #region agent log
  useEffect(() => {
    fetch("http://127.0.0.1:7363/ingest/7e05a85b-205b-4ccb-b81d-e5a353e86608", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "792eec" },
      body: JSON.stringify({
        sessionId: "792eec",
        runId: "pre-fix",
        hypothesisId: "A_B_C",
        location: "use-role-permissions-editor.ts:gate",
        message: "editor gate state",
        data: {
          roleId,
          roleName,
          canManage,
          fullyLocked,
          canEditMatrix,
          editorReady,
          catalogLen: catalog.length,
          permsLoading,
          roleLoading,
          permsError,
          roleError,
          assignedCount: roleDetail ? rolePermissionIdSet(roleDetail).size : 0,
          draftCount: draftIds.size,
          protectedCount: protectedIds.size,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [
    roleId,
    roleName,
    canManage,
    fullyLocked,
    canEditMatrix,
    editorReady,
    catalog.length,
    permsLoading,
    roleLoading,
    permsError,
    roleError,
    roleDetail,
    draftIds.size,
    protectedIds.size,
  ])
  // #endregion

  // Hydrate once per role + permission payload signature (not on dirty).
  useEffect(() => {
    if (!roleDetail?.id || catalog.length === 0) return
    const ids = [...rolePermissionIdSet(roleDetail)].sort()
    const key = `${roleDetail.id}:${ids.join(",")}`
    if (hydratedKeyRef.current === key) return
    hydratedKeyRef.current = key
    baselineRef.current = new Set(ids)
    form.reset({ permissionIds: ids })
    // #region agent log
    fetch("http://127.0.0.1:7363/ingest/7e05a85b-205b-4ccb-b81d-e5a353e86608", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "792eec" },
      body: JSON.stringify({
        sessionId: "792eec",
        runId: "pre-fix",
        hypothesisId: "D",
        location: "use-role-permissions-editor.ts:hydrate",
        message: "form reset hydrate",
        data: { roleId: roleDetail.id, roleName: roleDetail.name, idCount: ids.length, keyLen: key.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [roleDetail, catalog, form])

  const applyDraft = (next: Set<string>) => {
    if (!canEditMatrix) return
    // Never drop protected system permissions
    const merged = new Set(next)
    for (const id of protectedIds) merged.add(id)
    form.setValue("permissionIds", [...merged], {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    })
  }

  const cancel = () => {
    form.reset({ permissionIds: [...baselineRef.current] })
    toast.message("Changes discarded")
  }

  const reset = () => {
    form.reset({ permissionIds: [...baselineRef.current] })
    toast.message("Matrix reset to last saved state")
  }

  const save = async () => {
    if (!roleDetail || !canEditMatrix) return
    if (draftIds.size === 0) {
      toast.error("At least one permission is required")
      return
    }
    if (!dirty) {
      toast.message("No permission changes to save")
      return
    }
    try {
      const updated = await setPermissions.mutateAsync({
        roleId: roleDetail.id,
        permissionIds: [...draftIds],
      })
      const next = rolePermissionIdSet(updated)
      baselineRef.current = new Set(next)
      hydratedKeyRef.current = `${updated.id}:${[...next].sort().join(",")}`
      form.reset({ permissionIds: [...next] })
      await refetchRole()
      toast.success("Permissions saved")
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return {
    form,
    catalog,
    roleDetail,
    roleUsers,
    usersLoading,
    draftIds,
    dirty,
    editorReady,
    permsLoading,
    roleLoading,
    permsError,
    roleError,
    loadError: permsError
      ? getApiErrorMessage(permsErr) || "Failed to load permissions"
      : roleError
        ? getApiErrorMessage(roleErr) || "Failed to load role"
        : null,
    category,
    canEditMatrix,
    fullyLocked,
    protectedIds,
    applyDraft,
    cancel,
    reset,
    save,
    saving: setPermissions.isPending,
  }
}
