"use client"

import { Button } from "@workspace/ui/components/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { formatWardPillLabel } from "../lib/geo-display"
import type { GeographyTreeNode } from "../lib/types"

const PAGE_SIZE = 24

export function WardPillGrid({
  wards,
  onWardClick,
  disabled,
}: {
  wards: GeographyTreeNode[]
  onWardClick?: (ward: GeographyTreeNode) => void
  disabled?: boolean
}) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(wards.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)

  const slice = useMemo(() => {
    const start = safePage * PAGE_SIZE
    return wards.slice(start, start + PAGE_SIZE)
  }, [wards, safePage])

  if (wards.length === 0) {
    return <p className="text-sm text-muted-foreground">No wards yet.</p>
  }

  const from = safePage * PAGE_SIZE + 1
  const to = Math.min(wards.length, (safePage + 1) * PAGE_SIZE)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {slice.map((ward) => {
          const label = formatWardPillLabel(ward.wardNumber ?? "", ward.name)
          return (
            <button
              key={ward.id}
              type="button"
              disabled={disabled}
              onClick={() => onWardClick?.(ward)}
              className="cursor-pointer rounded-md border border-border/70 bg-muted/50 px-2.5 py-1 font-mono text-xs text-foreground transition-colors duration-200 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              title={label}
            >
              {label}
            </button>
          )
        })}
      </div>
      {wards.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {from}–{to} of {wards.length} wards
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7 cursor-pointer"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Previous ward page"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="tabular-nums">
              {safePage + 1}/{pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7 cursor-pointer"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              aria-label="Next ward page"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
