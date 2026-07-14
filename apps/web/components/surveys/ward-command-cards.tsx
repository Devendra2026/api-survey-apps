"use client"

import type { WardCommandStat } from "@/lib/api/types"
import { statusLabels } from "@/lib/navigation"
import { cn } from "@workspace/ui/lib/utils"
import { motion, useReducedMotion } from "framer-motion"
import { MapPinned } from "lucide-react"

export function WardCommandCards({
  wards,
  selectedWardId,
  onSelect,
  isLoading,
}: {
  wards: WardCommandStat[]
  selectedWardId?: string
  onSelect: (wardId: string | undefined) => void
  isLoading?: boolean
}) {
  const reduceMotion = useReducedMotion()

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    )
  }

  if (!wards.length) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Ward command center</p>
        {selectedWardId ? (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => onSelect(undefined)}
          >
            Clear ward filter
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        {wards.map((ward, index) => {
          const active = selectedWardId === ward.id
          const submitted = ward.byStatus.SUBMITTED ?? 0
          const approved = ward.byStatus.APPROVED ?? 0
          const rejected = ward.byStatus.REJECTED ?? 0
          return (
            <motion.button
              key={ward.id}
              type="button"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              onClick={() => onSelect(active ? undefined : ward.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/5 shadow-sm"
                  : "bg-card hover:border-foreground/15 hover:bg-muted/30"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">{ward.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ward.wardNumber ? `Ward ${ward.wardNumber}` : "Ward"} · {ward.count.toLocaleString()} surveys
                  </p>
                </div>
                <MapPinned className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  {statusLabels.SUBMITTED}: {submitted}
                </span>
                <span>
                  {statusLabels.APPROVED}: {approved}
                </span>
                <span>
                  {statusLabels.REJECTED}: {rejected}
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
