"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { formatCurrency, TAX_FORMULAS } from "../lib/formulas"
import type { ReferenceEntry, TaxPreviewResult } from "../lib/types"

export function FormulaPreview({ formulas = TAX_FORMULAS }: { formulas?: readonly string[] }) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Formula inspector</CardTitle>
        <CardDescription>Parameterized government ALV / demand engine</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 font-mono text-xs text-muted-foreground">
          {formulas.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function FormulaBuilder({
  propertyTaxPct,
  waterTaxPct,
  drainageTaxPct,
  penaltyPct,
  assessablePct,
  onChange,
  disabled,
}: {
  propertyTaxPct: number
  waterTaxPct: number
  drainageTaxPct: number
  penaltyPct: number
  assessablePct: number
  disabled?: boolean
  onChange: (patch: Record<string, number>) => void
}) {
  const fields: Array<{ key: string; label: string; value: number }> = [
    { key: "assessablePct", label: "Assessable %", value: assessablePct },
    { key: "propertyTaxPct", label: "Property Tax %", value: propertyTaxPct },
    { key: "waterTaxPct", label: "Water Tax %", value: waterTaxPct },
    { key: "drainageTaxPct", label: "Drainage Tax %", value: drainageTaxPct },
    { key: "penaltyPct", label: "Penalty %", value: penaltyPct },
  ]

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tax parameters</CardTitle>
        <CardDescription>Edit percentages used by the demand formula</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={field.key}>{field.label}</Label>
            <Input
              id={field.key}
              type="number"
              min={0}
              step="0.01"
              disabled={disabled}
              value={field.value}
              className="font-mono tabular-nums"
              onChange={(e) => onChange({ [field.key]: Number(e.target.value) })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function CalculationPreview({
  areaSqFt,
  onAreaChange,
  roads,
  constructions,
  roadWidthEntryId,
  constructionEntryId,
  onRoadChange,
  onConstructionChange,
  result,
}: {
  areaSqFt: number
  onAreaChange: (v: number) => void
  roads: ReferenceEntry[]
  constructions: ReferenceEntry[]
  roadWidthEntryId: string
  constructionEntryId: string
  onRoadChange: (id: string) => void
  onConstructionChange: (id: string) => void
  result?: TaxPreviewResult | null
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Calculation preview</CardTitle>
        <CardDescription>Example property for live ALV / tax check</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="area">Area (sq ft)</Label>
          <Input
            id="area"
            type="number"
            min={0}
            value={areaSqFt}
            onChange={(e) => onAreaChange(Number(e.target.value))}
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Road width</Label>
          <Select value={roadWidthEntryId} onValueChange={onRoadChange}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select" />
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
          <Label>Construction</Label>
          <Select value={constructionEntryId} onValueChange={onConstructionChange}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select" />
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
        {result ? (
          <dl className="space-y-1.5 rounded-lg border border-border/60 p-3 text-sm">
            {(
              [
                ["Gross ALV", result.calculation.grossAlv],
                ["Assessable ALV", result.calculation.assessableAlv],
                ["Property Tax", result.calculation.propertyTax],
                ["Water Tax", result.calculation.waterTax],
                ["Drainage Tax", result.calculation.drainageTax],
                ["Penalty", result.calculation.penalty],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-mono tabular-nums">{formatCurrency(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function DemandNoticePreview({ result }: { result?: TaxPreviewResult | null }) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Demand notice preview</CardTitle>
        <CardDescription>Live grand total for selected example</CardDescription>
      </CardHeader>
      <CardContent>
        {result ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Property + Water + Drainage + Penalty</span>
              <span className="font-mono tabular-nums">{formatCurrency(result.calculation.demand)}</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{formatCurrency(result.calculation.demand)}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Configure ward, year, and matrix to preview demand.</p>
        )}
      </CardContent>
    </Card>
  )
}
