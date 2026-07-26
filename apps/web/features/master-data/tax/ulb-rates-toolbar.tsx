"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { History, MoreHorizontal, RefreshCw, Save } from "lucide-react"

export function UlbRatesToolbar({
  ulbName,
  districtName,
  wardCount,
  status,
  canManage,
  canPublish,
  hasConfig,
  hasVersions,
  busy,
  onResetUlb,
  onSaveAll,
  onHistory,
  onRollback,
  onPublish,
}: {
  ulbName: string
  districtName: string
  wardCount: number
  status?: string
  canManage: boolean
  canPublish: boolean
  hasConfig: boolean
  hasVersions: boolean
  busy?: boolean
  onResetUlb: () => void
  onSaveAll: () => void
  onHistory: () => void
  onRollback: () => void
  onPublish: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950/40">
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">ULB rates</p>
        <h3 className="truncate text-base font-semibold text-foreground">{ulbName}</h3>
        <p className="text-sm text-muted-foreground">
          {districtName} · {wardCount} wards · select a ward below to edit rates
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status ? (
          <Badge
            className={cn(
              "font-normal",
              status === "PUBLISHED"
                ? "border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                : "border-transparent bg-amber-500/15 text-amber-900 dark:text-amber-300"
            )}
          >
            {status}
          </Badge>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer bg-background"
          disabled={!canManage || busy}
          onClick={onResetUlb}
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Reset ULB
        </Button>
        <Button
          type="button"
          size="sm"
          className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
          disabled={!canManage || !hasConfig || busy}
          onClick={onSaveAll}
        >
          <Save className="size-3.5" aria-hidden />
          Save All Wards
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 cursor-pointer bg-background"
              aria-label="More ULB actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="cursor-pointer" disabled={!hasConfig} onClick={onHistory}>
              <History className="size-3.5" aria-hidden />
              Version history
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" disabled={!canPublish || !hasVersions} onClick={onRollback}>
              Rollback
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" disabled={!canPublish || !hasConfig} onClick={onPublish}>
              Publish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
