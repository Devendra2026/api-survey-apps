"use client"

import { FormField } from "@/components/forms/form-field"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { useEffect } from "react"

export function RoleFormDialog({
  open,
  onOpenChange,
  title,
  description,
  name,
  descriptionValue,
  onNameChange,
  onDescriptionChange,
  onOpen,
  nameDisabled,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  name: string
  descriptionValue: string
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onOpen?: () => void
  nameDisabled?: boolean
  confirmLabel: string
  pending?: boolean
  onConfirm: () => Promise<void>
}) {
  useEffect(() => {
    if (open) onOpen?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when dialog opens
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
        <DialogHeader className="space-y-1.5 border-b bg-linear-to-br from-primary/8 to-transparent px-6 py-5 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <FormField label="Role code" required>
            <Input
              className="h-10 rounded-xl font-mono text-sm uppercase"
              value={name}
              disabled={nameDisabled}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="FIELD_AUDITOR"
              aria-label="Role code"
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              className="min-h-20 rounded-xl"
              value={descriptionValue}
              onChange={(e) => onDescriptionChange(e.target.value)}
              aria-label="Role description"
            />
          </FormField>
        </div>
        <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={pending || !name.trim()}
            onClick={() => void onConfirm()}
          >
            {pending ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
