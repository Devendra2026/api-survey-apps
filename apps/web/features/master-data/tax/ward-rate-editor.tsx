"use client"

import { TaxMatrix } from "@/features/configuration/components/TaxMatrix"
import { num } from "@/features/configuration/lib/formulas"
import type { ReferenceEntry, TaxConfig, TaxPreviewResult } from "@/features/configuration/lib/types"
import { formatPreviewCurrency, PreviewMetricRow } from "@/features/master-data/tax/preview-metric-row"
import { TaxPercentagesCard } from "@/features/master-data/tax/tax-percentages-card"
import type { GeoWard } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Copy, Save } from "lucide-react"

export function WardRateEditor({
  ward,
  config,
  isLoading,
  canManage,
  busy,
  roads,
  constructions,
  resolvedRoadId,
  resolvedConstructionId,
  areaSqFt,
  preview,
  onRoadChange,
  onConstructionChange,
  onAreaChange,
  onCellChange,
  onSaveWard,
  onUlbDefault,
  onSystemDefault,
  onCopyToAll,
}: {
  ward?: GeoWard
  config?: TaxConfig | null
  isLoading: boolean
  canManage: boolean
  busy?: boolean
  roads: ReferenceEntry[]
  constructions: ReferenceEntry[]
  resolvedRoadId: string
  resolvedConstructionId: string
  areaSqFt: number
  preview: TaxPreviewResult | null
  onRoadChange: (id: string) => void
  onConstructionChange: (id: string) => void
  onAreaChange: (v: number) => void
  onCellChange: (cell: { roadWidthEntryId: string; constructionEntryId: string; annualRatePerSqFt: number }) => void
  onSaveWard: () => void
  onUlbDefault: () => void
  onSystemDefault: () => void
  onCopyToAll: () => void
}) {
  if (!ward) {
    return <p className="text-sm text-muted-foreground">Select a ward and assessment year.</p>
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tax matrix…</p>
  }

  if (!config) {
    return <p className="text-sm text-muted-foreground">No tax configuration for this ward and year yet.</p>
  }

  const roadLabel = roads.find((r) => r.id === resolvedRoadId)?.name ?? "—"
  const constructionLabel = constructions.find((c) => c.id === resolvedConstructionId)?.name ?? "—"
  const annualRate = preview?.rates?.annualRate
  const propertyPct = num(config.propertyTaxPct)

  return (
    <div className="min-w-0 flex-1 space-y-5">
      <div className="sticky top-0 z-20 -mx-1 space-y-3 border-b border-border/50 bg-background/95 px-1 pb-3 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
              Editing
            </p>
            <h4 className="text-base font-semibold text-foreground">
              Ward {ward.wardNumber} — {ward.wardName}
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={!canManage || busy}
              onClick={onUlbDefault}
            >
              ULB Default
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={!canManage || busy}
              onClick={onSystemDefault}
            >
              System Default
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={!canManage || busy}
              onClick={onCopyToAll}
            >
              <Copy className="size-3.5" aria-hidden />
              Copy to All Wards
            </Button>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={!canManage || busy}
              onClick={onSaveWard}
            >
              <Save className="size-3.5" aria-hidden />
              Save Ward {ward.wardNumber}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Road width</Label>
          <Select value={resolvedRoadId} onValueChange={onRoadChange}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roads.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Construction</Label>
          <Select value={resolvedConstructionId} onValueChange={onConstructionChange}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {constructions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-xs text-muted-foreground">Ward {ward.wardNumber} preview · matches demand notice lookup</p>
          <div className="w-28 space-y-1">
            <Label htmlFor="preview-area" className="text-xs">
              Preview area
            </Label>
            <Input
              id="preview-area"
              type="number"
              min={0}
              value={areaSqFt}
              onChange={(e) => onAreaChange(Number(e.target.value))}
              className="h-9 font-mono"
            />
          </div>
        </div>
        <PreviewMetricRow
          zoneLabel={`${roadLabel} · ${constructionLabel}`}
          annualRateLabel={annualRate != null ? `₹${Number(annualRate).toFixed(2)}/sqft` : preview ? "See matrix" : "—"}
          areaSqFt={areaSqFt}
          grossAlv={formatPreviewCurrency(preview?.calculation.grossAlv)}
          assessablePct={preview ? `Taxable ${num(config.assessablePct)}%` : undefined}
          propertyTaxLabel={`Property Tax (${propertyPct}%)`}
          propertyTaxValue={formatPreviewCurrency(preview?.calculation.propertyTax)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Annual rate matrix (₹ / sq ft)
        </p>
        <div className="overflow-x-auto">
          <TaxMatrix config={config} onCellChange={onCellChange} disabled={!canManage || busy} />
        </div>
        <p className="text-xs text-muted-foreground">
          Rates feed ALV = area × annual rate. Property / water / drainage % apply to assessable ALV below.
        </p>
      </div>

      <TaxPercentagesCard
        assessablePct={num(config.assessablePct)}
        propertyPct={propertyPct}
        waterPct={num(config.waterTaxPct)}
        drainagePct={num(config.drainageTaxPct)}
      />
    </div>
  )
}
