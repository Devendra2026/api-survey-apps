"use client"

import { StatusBadge } from "@/components/shared/page-elements"
import { useNotifications } from "@/hooks/use-api"
import { Button } from "@workspace/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Bell } from "lucide-react"
import Link from "next/link"

export function NotificationsPopover() {
  const { data, isLoading } = useNotifications(1)
  const items = data?.items ?? []
  const count = items.length

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative size-9 cursor-pointer rounded-lg text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
              aria-label={count > 0 ? `Notifications, ${count} recent` : "Notifications"}
            >
              <Bell className="size-4" />
              {count > 0 ? (
                <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-semibold text-white dark:bg-indigo-500">
                  {count > 9 ? "9+" : count}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 border-slate-100 p-0 shadow-lg dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Notifications</p>
          <span className="text-xs text-slate-500 dark:text-slate-400">{count} recent</span>
        </div>
        <ScrollArea className="h-72">
          <div className="space-y-0.5 p-1.5">
            {isLoading ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            ) : null}
            {!isLoading && count === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No recent activity</p>
            ) : null}
            {items.map((n) => (
              <Link
                key={n.id}
                href={`/surveys/${n.surveyId}`}
                className="block cursor-pointer rounded-lg px-2.5 py-2 transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm text-slate-900 dark:text-slate-50">{n.message}</p>
                  <StatusBadge status={n.surveyStatus} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
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
