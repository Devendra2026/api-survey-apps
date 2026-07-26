"use client"

import type { ReferenceEntry } from "@/features/configuration/lib/types"
import type { FlatDistrict } from "@/features/master-data/lib/geo-stats"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"

export function TaxScopeSelectors({
  districts,
  resolvedDistrictId,
  ulbId,
  resolvedYearId,
  years,
  onDistrictChange,
  onUlbChange,
  onYearChange,
}: {
  districts: FlatDistrict[]
  resolvedDistrictId: string
  ulbId: string
  resolvedYearId: string
  years: ReferenceEntry[]
  onDistrictChange: (id: string) => void
  onUlbChange: (id: string) => void
  onYearChange: (id: string) => void
}) {
  const selectedDistrict = districts.find((d) => d.id === resolvedDistrictId)

  return (
    <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/50 p-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label className="text-xs tracking-wide text-muted-foreground uppercase">District</Label>
        <Select value={resolvedDistrictId} onValueChange={onDistrictChange}>
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="Select district" />
          </SelectTrigger>
          <SelectContent>
            {districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name} ({d.ulbs.length} ULB)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs tracking-wide text-muted-foreground uppercase">Municipality</Label>
        <Select value={ulbId} onValueChange={onUlbChange} disabled={!resolvedDistrictId}>
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="Select municipality" />
          </SelectTrigger>
          <SelectContent>
            {(selectedDistrict?.ulbs ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name} ({u.wardCount} wards)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs tracking-wide text-muted-foreground uppercase">Assessment year</Label>
        <Select value={resolvedYearId} onValueChange={onYearChange}>
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
