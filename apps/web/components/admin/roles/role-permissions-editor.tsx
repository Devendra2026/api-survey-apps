"use client"

import { PermissionMatrixTable } from "@/components/admin/roles/permission-matrix-table"
import { RolePermissionSummary } from "@/components/admin/roles/role-permission-summary"
import { RolesUnsavedBar } from "@/components/admin/roles/roles-unsaved-bar"
import { useRolePermissionsEditor } from "@/hooks/use-role-permissions-editor"
import { AnimatePresence } from "framer-motion"
import { Controller } from "react-hook-form"

export function RolePermissionsEditor({
  roleId,
  canManage,
}: {
  roleId: string | null | undefined
  canManage: boolean
}) {
  const editor = useRolePermissionsEditor({ roleId, canManage })

  if (!roleId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Select a role to edit permissions
      </div>
    )
  }

  if (editor.loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-medium text-destructive">Unable to load permission editor</p>
        <p className="text-xs text-muted-foreground">{editor.loadError}</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full min-h-0 gap-2">
        <div className="min-h-0 min-w-0 flex-1">
          <Controller
            control={editor.form.control}
            name="permissionIds"
            render={({ field }) => (
              <PermissionMatrixTable
                permissions={editor.catalog}
                selectedIds={new Set(field.value ?? [])}
                loading={!editor.editorReady}
                readOnly={!editor.canEditMatrix}
                protectedIds={editor.protectedIds}
                onChange={
                  editor.canEditMatrix
                    ? (next) => {
                        // #region agent log
                        fetch("http://127.0.0.1:7363/ingest/7e05a85b-205b-4ccb-b81d-e5a353e86608", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "X-Debug-Session-Id": "792eec",
                          },
                          body: JSON.stringify({
                            sessionId: "792eec",
                            runId: "pre-fix",
                            hypothesisId: "E",
                            location: "role-permissions-editor.tsx:onChange",
                            message: "matrix onChange fired",
                            data: {
                              nextSize: next.size,
                              fieldLen: (field.value ?? []).length,
                              canEditMatrix: editor.canEditMatrix,
                            },
                            timestamp: Date.now(),
                          }),
                        }).catch(() => {})
                        // #endregion
                        const merged = new Set(next)
                        for (const id of editor.protectedIds) merged.add(id)
                        field.onChange([...merged])
                      }
                    : undefined
                }
              />
            )}
          />
        </div>
        {editor.roleDetail ? (
          <RolePermissionSummary
            className="hidden w-56 shrink-0 xl:flex"
            selectedIds={editor.draftIds}
            permissions={editor.catalog}
            assignedUsers={editor.roleDetail.assignedUsersCount ?? editor.roleUsers?.length ?? 0}
            roleType={editor.category}
            createdAt={editor.roleDetail.createdAt}
            updatedAt={editor.roleDetail.updatedAt}
          />
        ) : null}
      </div>

      <AnimatePresence>
        {editor.canEditMatrix && editor.dirty ? (
          <RolesUnsavedBar
            key="unsaved-bar"
            saving={editor.saving}
            dirty={editor.dirty}
            onSave={() => void editor.save()}
            onCancel={editor.cancel}
            onReset={editor.reset}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
