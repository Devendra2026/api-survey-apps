"use client"

import { FormField } from "@/components/forms/form-field"
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
import { Input } from "@workspace/ui/components/input"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export function UserEditDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AuthenticatedProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateUser = useUpdateUser()
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")

  useEffect(() => {
    if (user) {
      setFullName(user.fullName)
      setPhone(user.phone ?? "")
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    if (!fullName.trim()) {
      toast.error("Full name is required")
      return
    }
    try {
      await updateUser.mutateAsync({
        id: user.id,
        body: { fullName: fullName.trim(), phone: phone.trim() || null },
      })
      toast.success("User updated")
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update profile details. Email is managed in Clerk and cannot be changed here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <FormField label="Full name" htmlFor="edit-full-name" required>
            <Input
              id="edit-full-name"
              className="h-10 rounded-xl"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </FormField>
          <FormField label="Mobile number" htmlFor="edit-phone">
            <Input
              id="edit-phone"
              className="h-10 rounded-xl"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </FormField>
          <FormField label="Email" htmlFor="edit-email" description="Read-only · synced from Clerk">
            <Input id="edit-email" className="h-10 rounded-xl" value={user?.email ?? ""} disabled />
          </FormField>
        </div>
        <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => void handleSave()}
            disabled={updateUser.isPending}
          >
            {updateUser.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
