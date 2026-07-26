"use client"

import { formatCurrency } from "@/features/configuration/lib/formulas"
import { cn } from "@workspace/ui/lib/utils"

export function PreviewMetric({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string
  value: string
  hint?: string
  emphasize?: boolean
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-semibold tabular-nums",
          emphasize ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function PreviewMetricRow({
  zoneLabel,
  annualRateLabel,
  areaSqFt,
  grossAlv,
  assessablePct,
  propertyTaxLabel,
  propertyTaxValue,
}: {
  zoneLabel: string
  annualRateLabel: string
  areaSqFt: number
  grossAlv: string
  assessablePct?: string
  propertyTaxLabel: string
  propertyTaxValue: string
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <PreviewMetric label="Selected Zone" value={zoneLabel} />
      <PreviewMetric label="Annual Rate" value={annualRateLabel} />
      <PreviewMetric label={`Gross ALV @ ${areaSqFt} SQFT`} value={grossAlv} hint={assessablePct} />
      <PreviewMetric label={propertyTaxLabel} value={propertyTaxValue} emphasize />
    </div>
  )
}

export function formatPreviewCurrency(amount: number | undefined): string {
  if (amount == null) return "—"
  return formatCurrency(amount)
}
