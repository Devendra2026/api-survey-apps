"use client"

import { StatusBadge } from "@/components/shared/page-elements"
import { useNotifications } from "@/hooks/use-api"
import { Button } from "@workspace/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Bell } from "lucide-react"
import Link from "next/link"

export function NotificationsPopover() {
  const { data, isLoading } = useNotifications(1)
  const items = data?.items ?? []

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {items.length > 0 ? <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-medium">Notifications</p>
          <span className="text-xs text-muted-foreground">{items.length} recent</span>
        </div>
        <ScrollArea className="h-72">
          <div className="space-y-0.5 p-1.5">
            {isLoading ? <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</p> : null}
            {!isLoading && items.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No recent activity</p>
            ) : null}
            {items.map((n) => (
              <Link
                key={n.id}
                href={`/surveys/${n.surveyId}`}
                className="block rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm">{n.message}</p>
                  <StatusBadge status={n.surveyStatus} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {n.changedBy.fullName} · {new Date(n.changedAt).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
