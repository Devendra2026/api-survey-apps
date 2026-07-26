"use client"

import { Info } from "lucide-react"

export function TaxPercentagesCard({
  assessablePct,
  propertyPct,
  waterPct,
  drainagePct,
}: {
  assessablePct: number
  propertyPct: number
  waterPct: number
  drainagePct: number
}) {
  const combined = propertyPct + waterPct + drainagePct

  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 px-4 py-3.5">
      <p className="text-sm font-semibold text-foreground">
        Tax Percentages — Applied to Assessable ALV ({assessablePct}%)
      </p>
      <dl className="mt-2.5 space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Property Tax</dt>
          <dd className="font-mono tabular-nums">{propertyPct.toFixed(1)}%</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Water Tax</dt>
          <dd className="font-mono tabular-nums">{waterPct.toFixed(2)}%</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Drainage / Sewer</dt>
          <dd className="font-mono tabular-nums">{drainagePct.toFixed(2)}%</dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-border/50 pt-1.5 font-semibold">
          <dt>Combined</dt>
          <dd className="font-mono tabular-nums">{combined.toFixed(1)}%</dd>
        </div>
      </dl>
      <p className="mt-2.5 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        These percentages come from this ward’s tax config and feed demand notice calculation.
      </p>
    </div>
  )
}
