"use client"

import { Badge } from "@workspace/ui/components/badge"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { format } from "date-fns"
import type { ConfigAuditLog } from "../lib/types"

export function AuditTimeline({
  open,
  onOpenChange,
  title = "Audit history",
  logs,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  logs?: ConfigAuditLog[]
  loading?: boolean
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Who changed what, with old and new values.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-8rem)] pr-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading audit trail…</p>
          ) : !logs?.length ? (
            <p className="text-sm text-muted-foreground">No audit events yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-4">
              {logs.map((log) => (
                <li key={log.id} className="relative">
                  <span className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{log.action}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.createdAt), "dd MMM yyyy HH:mm")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">
                    {log.entityType} <span className="font-mono text-xs">{log.entityId.slice(0, 8)}…</span>
                  </p>
                  {log.reason ? <p className="text-xs text-muted-foreground">Reason: {log.reason}</p> : null}
                  {log.actorId ? <p className="text-xs text-muted-foreground">Actor: {log.actorId}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
