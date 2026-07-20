"use client"

import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { useDistricts, useStates, useUlbs, useWards } from "@/hooks/use-api"
import { useReferenceEntries } from "../hooks/use-configuration"
import { Badge } from "@workspace/ui/components/badge"

export function WardNavigator({
  stateId,
  districtId,
  ulbId,
  wardId,
  assessmentYearId,
  onStateChange,
  onDistrictChange,
  onUlbChange,
  onWardChange,
  onAssessmentYearChange,
  publishStatus,
}: {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  assessmentYearId: string
  onStateChange: (id: string) => void
  onDistrictChange: (id: string) => void
  onUlbChange: (id: string) => void
  onWardChange: (id: string) => void
  onAssessmentYearChange: (id: string) => void
  publishStatus?: string
}) {
  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(stateId || undefined)
  const { data: ulbs } = useUlbs(districtId || undefined)
  const { data: wards } = useWards(ulbId || undefined)
  const { data: years } = useReferenceEntries("ASSESSMENT_YEAR", { limit: 50 })

  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border/70 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Ward Navigator</h2>
        {publishStatus ? (
          <Badge variant={publishStatus === "PUBLISHED" ? "default" : "secondary"}>{publishStatus}</Badge>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label>State</Label>
        <Select
          value={stateId}
          onValueChange={(v) => {
            onStateChange(v)
            onDistrictChange("")
            onUlbChange("")
            onWardChange("")
          }}
        >
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent>
            {states?.items.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>District</Label>
        <Select
          value={districtId}
          onValueChange={(v) => {
            onDistrictChange(v)
            onUlbChange("")
            onWardChange("")
          }}
          disabled={!stateId}
        >
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="Select district" />
          </SelectTrigger>
          <SelectContent>
            {districts?.items.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>ULB</Label>
        <Select
          value={ulbId}
          onValueChange={(v) => {
            onUlbChange(v)
            onWardChange("")
          }}
          disabled={!districtId}
        >
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="Select ULB" />
          </SelectTrigger>
          <SelectContent>
            {ulbs?.items.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Ward</Label>
        <Select value={wardId} onValueChange={onWardChange} disabled={!ulbId}>
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="Select ward" />
          </SelectTrigger>
          <SelectContent>
            {wards?.items.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.wardNumber} — {w.wardName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Assessment Year</Label>
        <Select value={assessmentYearId} onValueChange={onAssessmentYearChange}>
          <SelectTrigger className="cursor-pointer">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {years?.items.map((y) => (
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
