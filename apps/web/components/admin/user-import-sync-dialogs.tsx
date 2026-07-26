"use client"

import { downloadUsersImportTemplate, useImportUsers, useSyncUsersFromClerk } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import type { UserImportResult, UserImportRowPreview } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { CloudDownload, FileUp, Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

function statusClass(status: UserImportRowPreview["status"]) {
  if (status === "error") return "text-destructive"
  if (status === "warn") return "text-amber-700 dark:text-amber-300"
  return "text-emerald-700 dark:text-emerald-300"
}

export function UserImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const importUsers = useImportUsers()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<UserImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setPreview(null)
      setDragOver(false)
    }
  }, [open])

  const runDryRun = useCallback(
    async (next: File) => {
      setFile(next)
      setPreview(null)
      try {
        const result = await importUsers.mutateAsync({ file: next, dryRun: true })
        setPreview(result)
      } catch (e) {
        toast.error(getApiErrorMessage(e))
      }
    },
    [importUsers]
  )

  const onPick = (list: FileList | null) => {
    const next = list?.[0]
    if (!next) return
    const lower = next.name.toLowerCase()
    if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      toast.error("Choose a .csv or .xlsx file")
      return
    }
    void runDryRun(next)
  }

  const confirmImport = async () => {
    if (!file || !preview) return
    if (preview.errors > 0 && preview.created + preview.updated === 0) {
      toast.error("Fix row errors before importing")
      return
    }
    try {
      const result = await importUsers.mutateAsync({ file, dryRun: false })
      toast.success(
        `Imported ${result.created} created, ${result.updated} updated` +
          (result.errors ? `, ${result.errors} skipped` : "")
      )
      onOpenChange(false)
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    }
  }

  const busy = importUsers.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
          <DialogTitle>Import users</DialogTitle>
          <DialogDescription>
            Upload a Clerk export or template CSV/XLSX. Rows are upserted into the app database only — Clerk is not
            modified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer rounded-xl"
              disabled={busy}
              onClick={() => {
                void downloadUsersImportTemplate().catch((e) => toast.error(getApiErrorMessage(e)))
              }}
            >
              Download template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer rounded-xl"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="mr-1.5 size-3.5" aria-hidden />
              Choose file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => onPick(e.target.files)}
            />
          </div>

          <button
            type="button"
            className={cn(
              "flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 bg-muted/20",
              busy && "pointer-events-none opacity-60"
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              onPick(e.dataTransfer.files)
            }}
            onClick={() => inputRef.current?.click()}
          >
            {busy && !preview ? (
              <Loader2 className="mb-2 size-5 animate-spin text-muted-foreground" />
            ) : (
              <FileUp className="mb-2 size-5 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{file ? file.name : "Drop CSV or Excel here"}</span>
            <span className="mt-1 text-xs text-muted-foreground">Max 5,000 rows · UTF-8 CSV or first XLSX sheet</span>
          </button>

          {preview ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Dry-run: <span className="font-medium text-foreground">{preview.created}</span> create ·{" "}
                <span className="font-medium text-foreground">{preview.updated}</span> update ·{" "}
                <span className="font-medium text-foreground">{preview.errors}</span> error
              </p>
              <div className="max-h-56 overflow-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 100).map((row) => (
                      <tr key={row.rowNumber} className="border-t">
                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{row.rowNumber}</td>
                        <td className="max-w-[12rem] truncate px-3 py-1.5">{row.email || "—"}</td>
                        <td className="px-3 py-1.5 capitalize">{row.action}</td>
                        <td className={cn("px-3 py-1.5", statusClass(row.status))}>
                          {row.message}
                          {row.warnings[0] ? ` · ${row.warnings[0]}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 100 ? (
                <p className="text-[11px] text-muted-foreground">Showing first 100 of {preview.rows.length} rows</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer rounded-xl"
            disabled={!preview || busy || preview.created + preview.updated === 0}
            onClick={() => void confirmImport()}
          >
            {busy && preview ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Confirm import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UserSyncFromClerkDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const syncFromClerk = useSyncUsersFromClerk()

  const onConfirm = async () => {
    try {
      const result = await syncFromClerk.mutateAsync()
      toast.success(
        `Synced ${result.totalFetched} from Clerk · ${result.created} created, ${result.updated} updated` +
          (result.errors.length ? `, ${result.errors.length} issues` : "")
      )
      if (result.errors[0]) {
        toast.message(result.errors[0].message)
      }
      onOpenChange(false)
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 text-left">
          <DialogTitle>Sync from Clerk</DialogTitle>
          <DialogDescription>
            Fetch all users from the Clerk instance configured by this API&apos;s{" "}
            <span className="font-mono text-[11px]">CLERK_SECRET_KEY</span> and upsert them into the app database.
            Existing roles and disabled accounts are preserved; new users get PENDING_APPROVAL.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4 text-sm text-muted-foreground">
          This is a manual admin action — it does not create users in Clerk or run on a schedule.
        </div>
        <DialogFooter className="gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={syncFromClerk.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer rounded-xl"
            disabled={syncFromClerk.isPending}
            onClick={() => void onConfirm()}
          >
            {syncFromClerk.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <CloudDownload className="mr-1.5 size-3.5" aria-hidden />
            )}
            Sync now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
