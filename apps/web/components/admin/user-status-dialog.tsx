"use client"

import { useUpdateUser } from "@/hooks/use-api"
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

export function UserStatusDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AuthenticatedProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateUser = useUpdateUser()
  const activating = user ? !user.isActive : false

  const handleConfirm = async () => {
    if (!user) return
    try {
      await updateUser.mutateAsync({
        id: user.id,
        body: { isActive: activating },
      })
      toast.success(activating ? "User activated" : "User disabled")
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
          <DialogTitle>{activating ? "Activate user" : "Disable user"}</DialogTitle>
          <DialogDescription>
            {activating
              ? `${user?.fullName ?? "This user"} will be able to sign in again.`
              : `${user?.fullName ?? "This user"} will be blocked from portal and API access with the message: “Your account has been disabled. Please contact the system administrator.”`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            variant={activating ? "default" : "destructive"}
            onClick={() => void handleConfirm()}
            disabled={updateUser.isPending}
          >
            {updateUser.isPending ? "Updating…" : activating ? "Activate" : "Disable"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
