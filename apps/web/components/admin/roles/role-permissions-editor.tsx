"use client"

import { PermissionChangePreview } from "@/components/admin/roles/permission-change-preview"
import { PermissionGroupsPanel } from "@/components/admin/roles/permission-groups-panel"
import { RolePermissionSummary } from "@/components/admin/roles/role-permission-summary"
import { RolesUnsavedBar } from "@/components/admin/roles/roles-unsaved-bar"
import { useRolePermissionsEditor } from "@/hooks/use-role-permissions-editor"
import { Button } from "@workspace/ui/components/button"
import { AnimatePresence } from "framer-motion"
import { Controller } from "react-hook-form"

export function RolePermissionsEditor({
  roleId,
  canManage,
  onDirtyChange,
}: {
  roleId: string | null | undefined
  canManage: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const editor = useRolePermissionsEditor({ roleId, canManage, onDirtyChange })

  if (!roleId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Select a role to edit permissions
      </div>
    )
  }

  if (editor.loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-medium text-destructive">Unable to load permission editor</p>
        <p className="text-xs text-muted-foreground">{editor.loadError}</p>
        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void editor.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const assignedUsers = editor.roleDetail?.assignedUsersCount ?? editor.roleUsers?.length ?? 0

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-2 xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {editor.dirty ? (
            <PermissionChangePreview
              grantedNames={editor.grantedNames}
              revokedNames={editor.revokedNames}
              assignedUsers={assignedUsers}
            />
          ) : null}
          <Controller
            control={editor.form.control}
            name="permissionIds"
            render={({ field }) => (
              <PermissionGroupsPanel
                permissions={editor.catalog}
                selectedIds={new Set(field.value ?? [])}
                loading={!editor.editorReady}
                readOnly={!editor.canEditMatrix}
                onChange={
                  editor.canEditMatrix
                    ? (next) => {
                        field.onChange([...next])
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
            assignedUsers={assignedUsers}
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
