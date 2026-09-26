"use client"

import { useDeleteUser } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { ROLE_LABELS, tenantRoleCode, type AuthenticatedProfile } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { toast } from "sonner"

function primaryRoleLabel(user: AuthenticatedProfile | null): string {
  const active = user?.tenantRoles?.find((r) => r.isActive)
  if (!active) return "No role"
  const code = tenantRoleCode(active)
  return ROLE_LABELS[code] ?? code
}

export function UserDeleteDialog({
  user,
  open,
  onOpenChange,
  onDeleted,
}: {
  user: AuthenticatedProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: (userId: string) => void
}) {
  const deleteUser = useDeleteUser()

  const handleConfirm = async () => {
    if (!user) return
    const userId = user.id
    try {
      const result = await deleteUser.mutateAsync(userId)
      if (result && typeof result === "object" && "historyRetained" in result && result.historyRetained) {
        toast.success("Access revoked. Historical survey records were retained.")
      } else {
        toast.success("User permanently deleted.")
      }
      onDeleted?.(userId)
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <dl className="space-y-1 rounded-xl border bg-muted/40 px-3 py-2.5 text-foreground">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{user?.fullName ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate font-medium">{user?.email ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="font-medium">{primaryRoleLabel(user)}</dd>
                </div>
              </dl>
              <p>
                Deleting this account revokes application access and removes the Clerk identity when possible. If the
                user has survey, QC, or audit history, that history is retained and the account is deactivated instead
                of permanently removed.
              </p>
              <p className="text-xs">Prefer Disable if you only need to block access temporarily.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending ? "Deleting…" : "Delete user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
