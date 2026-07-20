"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { format } from "date-fns"
import { useState } from "react"
import type { TaxConfigVersion } from "../lib/types"

export function PublishDialog({
  open,
  onOpenChange,
  saving,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  saving?: boolean
  onConfirm: (values: { reason?: string; effectiveFrom?: string }) => void
}) {
  const [reason, setReason] = useState("")
  const [effectiveFrom, setEffectiveFrom] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish tax configuration</DialogTitle>
          <DialogDescription>
            Creates an immutable version snapshot and marks this Ward × Assessment Year as published.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="publish-reason">Reason</Label>
            <Textarea id="publish-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="publish-effective">Future effective date (optional)</Label>
            <Input
              id="publish-effective"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={saving}
            onClick={() =>
              onConfirm({
                reason: reason || undefined,
                effectiveFrom: effectiveFrom || undefined,
              })
            }
          >
            {saving ? "Publishing…" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RollbackDialog({
  open,
  onOpenChange,
  versions,
  saving,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  versions: TaxConfigVersion[]
  saving?: boolean
  onConfirm: (values: { versionId: string; reason?: string }) => void
}) {
  const [versionId, setVersionId] = useState("")
  const [reason, setReason] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rollback tax configuration</DialogTitle>
          <DialogDescription>Restores a published snapshot into a new draft.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rollback-version">Version</Label>
            <select
              id="rollback-version"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
            >
              <option value="">Select version</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} — {format(new Date(v.createdAt), "dd MMM yyyy HH:mm")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rollback-reason">Reason</Label>
            <Textarea id="rollback-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={saving || !versionId}
            onClick={() => onConfirm({ versionId, reason: reason || undefined })}
          >
            {saving ? "Rolling back…" : "Rollback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function VersionHistoryDrawer({
  open,
  onOpenChange,
  versions,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  versions: TaxConfigVersion[]
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>Immutable snapshots created on publish.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-8rem)]">
          {!versions.length ? (
            <p className="text-sm text-muted-foreground">No published versions yet.</p>
          ) : (
            <ul className="space-y-3">
              {versions.map((v) => (
                <li key={v.id} className="rounded-lg border border-border/70 p-3">
                  <p className="font-medium">Version {v.version}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(v.createdAt), "dd MMM yyyy HH:mm")}</p>
                  {v.reason ? <p className="mt-1 text-sm">{v.reason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
