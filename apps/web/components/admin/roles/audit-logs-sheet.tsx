"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { format } from "date-fns"
import { ClipboardList } from "lucide-react"

export type LocalPermissionAudit = {
  id: string
  roleName: string
  adminName: string
  added: string[]
  removed: string[]
  at: Date
}

export function AuditLogsSheet({
  open,
  onOpenChange,
  entries,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: LocalPermissionAudit[]
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader className="border-b pb-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" aria-hidden />
            Audit Logs
          </SheetTitle>
          <SheetDescription>
            Server-side permission changes (
            <code className="rounded bg-muted px-1 text-[11px]">ROLE_PERMISSIONS_UPDATED</code>) for the selected role,
            plus any saves from this session.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-1 py-4">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
              No permission change audits for this role yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-xl border bg-card px-4 py-3 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{entry.roleName}</p>
                    <Badge variant="outline" className="rounded-md text-[10px] tabular-nums">
                      {format(entry.at, "MMM d, yyyy · HH:mm")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Admin: {entry.adminName}</p>
                  <Separator className="my-2" />
                  <div className="space-y-1 text-xs">
                    {entry.added.length ? (
                      <p>
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">Added:</span>{" "}
                        <span className="font-mono">{entry.added.join(", ")}</span>
                      </p>
                    ) : null}
                    {entry.removed.length ? (
                      <p>
                        <span className="font-medium text-rose-700 dark:text-rose-300">Removed:</span>{" "}
                        <span className="font-mono">{entry.removed.join(", ")}</span>
                      </p>
                    ) : null}
                    {!entry.added.length && !entry.removed.length ? (
                      <p className="text-muted-foreground">No net permission delta.</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t pt-4">
          <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
