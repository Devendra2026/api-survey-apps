"use client"

import { FormField } from "@/components/forms/form-field"
import { useDistricts, useStates, useUlbs, useWards } from "@/hooks/use-api"
import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Plus, Trash2 } from "lucide-react"
import { useId } from "react"

export type AllotmentDraft = {
  key: string
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
}

export function emptyAllotment(): AllotmentDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    stateId: "",
    districtId: "",
    ulbId: "",
    wardId: "",
  }
}

export function allotmentsComplete(rows: AllotmentDraft[]): boolean {
  return rows.length > 0 && rows.every((r) => r.stateId && r.districtId && r.ulbId && r.wardId)
}

export function toAllotmentPayload(rows: AllotmentDraft[]) {
  return rows.map((r) => ({
    stateId: r.stateId,
    districtId: r.districtId,
    ulbId: r.ulbId,
    wardId: r.wardId,
  }))
}

function AllotmentRow({
  row,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  row: AllotmentDraft
  index: number
  canRemove: boolean
  onChange: (next: AllotmentDraft) => void
  onRemove: () => void
}) {
  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(row.stateId || undefined)
  const { data: ulbs } = useUlbs(row.districtId || undefined)
  const { data: wards } = useWards(row.ulbId || undefined)
  const labelId = useId()

  return (
    <div className="space-y-3 rounded-2xl border bg-muted/15 p-4">
      <div className="flex items-center justify-between gap-2">
        <p id={labelId} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Allotment {index + 1}
        </p>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remove allotment ${index + 1}`}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-labelledby={labelId}>
        <FormField label="State" required>
          <Select
            value={row.stateId || undefined}
            onValueChange={(value) => onChange({ ...row, stateId: value, districtId: "", ulbId: "", wardId: "" })}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {(states?.items ?? []).map((state) => (
                <SelectItem key={state.id} value={state.id}>
                  {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="District" required>
          <Select
            value={row.districtId || undefined}
            onValueChange={(value) => onChange({ ...row, districtId: value, ulbId: "", wardId: "" })}
            disabled={!row.stateId}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Select district" />
            </SelectTrigger>
            <SelectContent>
              {(districts?.items ?? []).map((district) => (
                <SelectItem key={district.id} value={district.id}>
                  {district.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="ULB" required>
          <Select
            value={row.ulbId || undefined}
            onValueChange={(value) => onChange({ ...row, ulbId: value, wardId: "" })}
            disabled={!row.districtId}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Select ULB" />
            </SelectTrigger>
            <SelectContent>
              {(ulbs?.items ?? []).map((ulb) => (
                <SelectItem key={ulb.id} value={ulb.id}>
                  {ulb.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Ward" required>
          <Select
            value={row.wardId || undefined}
            onValueChange={(value) => onChange({ ...row, wardId: value })}
            disabled={!row.ulbId}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Select ward" />
            </SelectTrigger>
            <SelectContent>
              {(wards?.items ?? []).map((ward) => (
                <SelectItem key={ward.id} value={ward.id}>
                  {ward.wardNumber}
                  {ward.wardName ? ` · ${ward.wardName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
    </div>
  )
}

export function UserAllotmentsEditor({
  value,
  onChange,
}: {
  value: AllotmentDraft[]
  onChange: (next: AllotmentDraft[]) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Assign one or more ULB + ward pairs. Each allotment needs State, District, ULB, and Ward.
      </p>
      {value.map((row, index) => (
        <AllotmentRow
          key={row.key}
          row={row}
          index={index}
          canRemove={value.length > 1}
          onChange={(next) => onChange(value.map((r) => (r.key === row.key ? next : r)))}
          onRemove={() => onChange(value.filter((r) => r.key !== row.key))}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full rounded-xl border-dashed"
        onClick={() => onChange([...value, emptyAllotment()])}
      >
        <Plus className="mr-2 size-4" />
        Add allotment
      </Button>
    </div>
  )
}
