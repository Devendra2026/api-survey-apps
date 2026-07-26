"use client"

import { useDeleteUser } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import type { AuthenticatedProfile } from "@/lib/api/types"
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
      await deleteUser.mutateAsync(userId)
      toast.success("User permanently deleted.")
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
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            {`${user?.fullName ?? "This user"} will be permanently removed from the directory and will no longer be able to sign in. This cannot be undone. Prefer Disable if you only need to block access temporarily.`}
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
