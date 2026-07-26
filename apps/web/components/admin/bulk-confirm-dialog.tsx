"use client"

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
import { Label } from "@workspace/ui/components/label"
import { useEffect, useState } from "react"

export function BulkConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmWord,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmWord: "DISABLE" | "DELETE" | "ACTIVATE"
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void | Promise<void>
}) {
  const [typed, setTyped] = useState("")

  useEffect(() => {
    if (!open) setTyped("")
  }, [open])

  const matched = typed.trim().toUpperCase() === confirmWord

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 px-6 py-4">
          <Label htmlFor="bulk-confirm-input" className="text-xs font-medium text-muted-foreground">
            Type <span className="font-mono font-semibold text-foreground">{confirmWord}</span> to confirm
          </Label>
          <Input
            id="bulk-confirm-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-10 rounded-xl font-mono"
            aria-describedby="bulk-confirm-hint"
          />
          <p id="bulk-confirm-hint" className="text-[11px] text-muted-foreground">
            This protects against accidental bulk changes.
          </p>
        </div>
        <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmWord === "ACTIVATE" ? "default" : "destructive"}
            className="cursor-pointer rounded-xl"
            disabled={!matched || pending}
            onClick={() => void onConfirm()}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
