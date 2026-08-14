"use client"

import { apiGet, apiPost, getApiErrorMessage } from "@/lib/api/client"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Copy, KeyRound } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export type UlbApiKeyCurrent = {
  keyPrefix: string
  createdAt: string
  isActive: boolean
}

type UlbApiKeyCreated = {
  rawKey: string
  keyPrefix: string
  ulbId: string
  createdAt: string
}

export function UlbPortalApiKeyCard({ ulbId, ulbName }: { ulbId: string; ulbName: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [revealOpen, setRevealOpen] = useState(false)
  const [rawKey, setRawKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const current = useQuery({
    queryKey: ["ulbs", ulbId, "api-keys", "current"],
    queryFn: () => apiGet<UlbApiKeyCurrent | null>(`/ulbs/${ulbId}/api-keys/current`),
  })

  const hasKey = Boolean(current.data?.isActive && current.data.keyPrefix)

  const rotate = async () => {
    setSaving(true)
    try {
      const created = await apiPost<UlbApiKeyCreated>(`/ulbs/${ulbId}/api-keys`)
      setConfirmOpen(false)
      setRawKey(created.rawKey)
      setRevealOpen(true)
      await current.refetch()
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const copyRawKey = async () => {
    if (!rawKey) return
    try {
      await navigator.clipboard.writeText(rawKey)
      toast.success("API key copied")
    } catch {
      toast.error("Could not copy the key")
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-4" aria-hidden />
          </div>
          <div className="space-y-1">
            <CardTitle>Portal API key</CardTitle>
            <CardDescription>
              Server-to-server key for {ulbName}. Nest returns this ULB’s surveys when the portal sends{" "}
              <code className="font-mono text-xs">X-API-Key</code>.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {current.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading key…</p>
            ) : hasKey && current.data ? (
              <div className="space-y-1">
                <p className="truncate font-mono text-sm">{current.data.keyPrefix}…</p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(current.data.createdAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active key</p>
            )}
          </div>
          <Button type="button" className="cursor-pointer" onClick={() => setConfirmOpen(true)} disabled={saving}>
            {hasKey ? "Rotate" : "Generate"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasKey ? "Rotate portal API key?" : "Generate portal API key?"}</DialogTitle>
            <DialogDescription>
              This replaces the current key. The previous key stops working immediately. The new secret is shown only
              once.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={saving}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" className="cursor-pointer" disabled={saving} onClick={() => void rotate()}>
              {saving ? "Saving…" : hasKey ? "Rotate key" : "Generate key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revealOpen}
        onOpenChange={(open) => {
          setRevealOpen(open)
          if (!open) setRawKey(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy this key now</DialogTitle>
            <DialogDescription>
              This is the only time the full key is shown. Store it as a server env on the portal. Closing this dialog
              cannot recover it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={rawKey ?? ""} className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 cursor-pointer"
              onClick={() => void copyRawKey()}
            >
              <Copy className="size-4" aria-hidden />
              Copy
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" className="cursor-pointer" onClick={() => setRevealOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
