"use client"

import { buildWardActionHref, type WardActionIds } from "@/lib/ward-action-links"
import { Button } from "@workspace/ui/components/button"
import { ClipboardCheck, LayoutGrid } from "lucide-react"
import Link from "next/link"

function formatNum(n: number) {
  return new Intl.NumberFormat("en-IN").format(n)
}

export type WardCardActionsMode = "startQc" | "registry"

export function WardCardActions({
  ids,
  pendingCount,
  startQcLabel = "Start QC",
  mode = "startQc",
}: {
  ids: WardActionIds
  pendingCount: number
  startQcLabel?: string
  /** Survey Command Center uses registry-only; QC Command Center uses Start QC only. */
  mode?: WardCardActionsMode
}) {
  const canLink = Boolean(ids.wardId && ids.ulbId)

  if (!canLink) return null

  if (mode === "registry") {
    return (
      <Button asChild variant="outline" className="h-9 w-full cursor-pointer">
        <Link href={buildWardActionHref("registry", ids)}>
          <LayoutGrid className="size-3.5" />
          Survey Registry
        </Link>
      </Button>
    )
  }

  return (
    <Button
      asChild
      className="h-9 w-full cursor-pointer bg-linear-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-700 hover:to-cyan-700"
    >
      <Link href={buildWardActionHref("startQc", ids)}>
        <ClipboardCheck className="size-3.5" />
        {startQcLabel} ({formatNum(pendingCount)} pending)
      </Link>
    </Button>
  )
}
