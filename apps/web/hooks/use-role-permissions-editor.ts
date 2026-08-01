"use client"

import { diffPermissionIds, rolePermissionIdSet, setsEqual } from "@/components/admin/roles/permission-utils"
import { canModifyPermissions, roleCategory } from "@/components/admin/roles/system-role-policy"
import { usePermissionsCatalog, useRole, useRoleUsers, useSetRolePermissions } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  onDirtyChange,
}: {
  roleId: string | null | undefined
  canManage: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const {
    data: permissionsPage,
    isLoading: permsLoading,
    isError: permsError,
    error: permsErr,
    refetch: refetchPermissions,
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
  const [baselineIds, setBaselineIds] = useState<Set<string>>(new Set())
  const hydratedKeyRef = useRef<string | null>(null)
  const permissionIds = form.watch("permissionIds")
  const draftIds = useMemo(() => new Set(permissionIds ?? []), [permissionIds])
  const dirty = !setsEqual(draftIds, baselineIds)

  const { granted: grantedIds, revoked: revokedIds } = useMemo(
    () => diffPermissionIds(baselineIds, draftIds),
    [baselineIds, draftIds]
  )

  const idToName = useMemo(() => {
    const map = new Map<string, string>()
    for (const perm of catalog) map.set(perm.id, perm.name)
    return map
  }, [catalog])

  const grantedNames = useMemo(() => grantedIds.map((id) => idToName.get(id) ?? id), [grantedIds, idToName])
  const revokedNames = useMemo(() => revokedIds.map((id) => idToName.get(id) ?? id), [revokedIds, idToName])

  const editorReady =
    !permsLoading && !permsError && catalog.length > 0 && !roleLoading && !roleError && Boolean(roleDetail)

  const roleName = roleDetail?.name ?? ""
  const category = roleName ? roleCategory(roleName) : "CUSTOM"
  const fullyLocked = false
  const canEditMatrix = Boolean(canManage && roleDetail && canModifyPermissions(roleName))
  const protectedIds = useMemo(() => new Set<string>(), [])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  // Hydrate once per role + permission payload signature (not on dirty).
  useEffect(() => {
    if (!roleDetail?.id || catalog.length === 0) return
    const ids = [...rolePermissionIdSet(roleDetail)].sort()
    const key = `${roleDetail.id}:${ids.join(",")}`
    if (hydratedKeyRef.current === key) return
    hydratedKeyRef.current = key
    const nextBaseline = new Set(ids)
    baselineRef.current = nextBaseline
    setBaselineIds(nextBaseline)
    form.reset({ permissionIds: ids })
  }, [roleDetail, catalog, form])

  const applyDraft = (next: Set<string>) => {
    if (!canEditMatrix) return
    form.setValue("permissionIds", [...next], {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    })
  }

  const cancel = () => {
    form.reset({ permissionIds: [...baselineIds] })
    toast.message("Changes discarded")
  }

  const reset = () => {
    form.reset({ permissionIds: [...baselineIds] })
    toast.message("Permissions reset to last saved state")
  }

  const refetch = useCallback(async () => {
    const tasks: Array<Promise<unknown>> = []
    if (permsError) tasks.push(refetchPermissions())
    if (roleError) tasks.push(refetchRole())
    if (tasks.length === 0) {
      tasks.push(refetchPermissions(), refetchRole())
    }
    await Promise.all(tasks)
  }, [permsError, roleError, refetchPermissions, refetchRole])

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
      const nextBaseline = new Set(next)
      baselineRef.current = nextBaseline
      setBaselineIds(nextBaseline)
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
    baselineIds,
    grantedIds,
    revokedIds,
    grantedNames,
    revokedNames,
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
    refetch,
    saving: setPermissions.isPending,
  }
}
