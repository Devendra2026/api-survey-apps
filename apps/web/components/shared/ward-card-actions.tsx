"use client"

import { buildWardActionHref, type WardActionIds } from "@/lib/ward-action-links"
import { Button } from "@workspace/ui/components/button"
import { ClipboardCheck, FileBarChart, LayoutGrid, Ticket } from "lucide-react"
import Link from "next/link"

function formatNum(n: number) {
  return new Intl.NumberFormat("en-IN").format(n)
}

export function WardCardActions({
  ids,
  pendingCount,
  startQcLabel = "Start QC",
}: {
  ids: WardActionIds
  pendingCount: number
  startQcLabel?: string
}) {
  const canLink = Boolean(ids.wardId && ids.ulbId)

  if (!canLink) return null

  return (
    <div className="space-y-2">
      <Button
        asChild
        className="h-9 w-full cursor-pointer bg-linear-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-700 hover:to-cyan-700"
      >
        <Link href={buildWardActionHref("startQc", ids)}>
          <ClipboardCheck className="size-3.5" />
          {startQcLabel} ({formatNum(pendingCount)} pending)
        </Link>
      </Button>
      <div className="grid grid-cols-3 gap-1.5">
        <Button asChild variant="outline" size="sm" className="h-8 cursor-pointer px-1.5 text-xs">
          <Link href={buildWardActionHref("registry", ids)}>
            <LayoutGrid className="size-3" />
            Registry
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-8 cursor-pointer px-1.5 text-xs">
          <Link href={buildWardActionHref("report", ids)}>
            <FileBarChart className="size-3" />
            Report
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer border-emerald-200 px-1.5 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
        >
          <Link href={buildWardActionHref("demand", ids)}>
            <Ticket className="size-3" />
            Demand
          </Link>
        </Button>
      </div>
    </div>
  )
}
