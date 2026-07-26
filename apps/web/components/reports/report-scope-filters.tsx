"use client"

import { useDistricts, useStates, useUlbs, useWards } from "@/hooks/use-api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { CalendarDays, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useRef } from "react"

const ALL = "__all__"

export type ReportScopeState = {
  stateId?: string
  districtId?: string
  ulbId?: string
  wardId?: string
  month?: string
  dateFrom?: string
  dateTo?: string
}

function monthBounds(offsetMonths: number): { dateFrom: string; dateTo: string; month: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
  const y = start.getUTCFullYear()
  const m = String(start.getUTCMonth() + 1).padStart(2, "0")
  return {
    month: `${y}-${m}`,
    dateFrom: `${y}-${m}-01`,
    dateTo: `${y}-${m}-${String(end.getUTCDate()).padStart(2, "0")}`,
  }
}

function pickFilterValue(v: string) {
  return v === ALL ? undefined : v
}

export function countActiveReportFilters(filters: ReportScopeState): number {
  return [
    filters.districtId,
    filters.ulbId,
    filters.wardId,
    filters.month || filters.dateFrom || filters.dateTo,
  ].filter(Boolean).length
}

export function ReportScopeFiltersPanel({
  value,
  onChange,
}: {
  value: ReportScopeState
  onChange: (next: ReportScopeState) => void
}) {
  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(value.stateId)
  const { data: ulbs } = useUlbs(value.districtId)
  const { data: wards } = useWards(value.ulbId)

  const stateItems = useMemo(() => states?.items ?? [], [states?.items])
  const districtItems = useMemo(() => districts?.items ?? [], [districts?.items])
  const ulbItems = useMemo(() => ulbs?.items ?? [], [ulbs?.items])
  const wardItems = useMemo(() => wards?.items ?? [], [wards?.items])

  const stateBootstrapped = useRef(false)
  const valueRef = useRef(value)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    if (stateBootstrapped.current || value.stateId || !stateItems.length) return
    const first = stateItems[0]
    if (!first) return
    stateBootstrapped.current = true
    onChange({ ...valueRef.current, stateId: first.id })
  }, [stateItems, value.stateId, onChange])

  const patch = (partial: Partial<ReportScopeState>) => onChange({ ...value, ...partial })

  const quickRanges = useMemo(
    () => [
      { label: "This month", ...monthBounds(0) },
      { label: "Last month", ...monthBounds(-1) },
      { label: "2 months back", ...monthBounds(-2) },
    ],
    []
  )

  const activeCount = countActiveReportFilters(value)
  const hasActive = activeCount > 0

  const reset = () => {
    onChange({
      stateId: value.stateId,
      districtId: undefined,
      ulbId: undefined,
      wardId: undefined,
      month: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })
  }

  const setMonth = (month: string | undefined) => {
    if (!month) {
      patch({ month: undefined, dateFrom: undefined, dateTo: undefined })
      return
    }
    const [yRaw, mRaw] = month.split("-")
    const y = Number(yRaw)
    const m = Number(mRaw)
    if (!y || Number.isNaN(m) || m < 1 || m > 12) {
      patch({ month: undefined, dateFrom: undefined, dateTo: undefined })
      return
    }
    const mm = String(m).padStart(2, "0")
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    patch({
      month: `${y}-${mm}`,
      dateFrom: `${y}-${mm}-01`,
      dateTo: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/15 bg-gradient-to-r from-primary/10 via-card to-card px-3 py-2 dark:from-primary/20 dark:via-primary/5">
        <div className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
          <span className="font-medium text-foreground">Filter Control Panel</span>
          <Badge variant="secondary">{activeCount} active</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickRanges.map((range) => (
            <Button
              key={range.label}
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() =>
                patch({
                  month: range.month,
                  dateFrom: range.dateFrom,
                  dateTo: range.dateTo,
                })
              }
            >
              {range.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="cursor-pointer"
            onClick={reset}
            disabled={!hasActive}
            aria-label="Reset filters"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 bg-background/40 p-3 md:grid-cols-2 xl:grid-cols-4 dark:bg-background/20">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">District</Label>
          <Select
            value={value.districtId ?? ALL}
            onValueChange={(v) =>
              patch({
                districtId: pickFilterValue(v),
                ulbId: undefined,
                wardId: undefined,
              })
            }
            disabled={!value.stateId}
          >
            <SelectTrigger className="h-10 w-full cursor-pointer rounded-lg border-primary/20">
              <SelectValue placeholder="All districts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All districts</SelectItem>
              {districtItems.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">ULB</Label>
          <Select
            value={value.ulbId ?? ALL}
            onValueChange={(v) =>
              patch({
                ulbId: pickFilterValue(v),
                wardId: undefined,
              })
            }
            disabled={!value.districtId}
          >
            <SelectTrigger className="h-10 w-full cursor-pointer rounded-lg border-primary/20">
              <SelectValue placeholder={value.districtId ? "All ULBs" : "Select district first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All ULBs</SelectItem>
              {ulbItems.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ward</Label>
          <Select
            value={value.wardId ?? ALL}
            onValueChange={(v) => patch({ wardId: pickFilterValue(v) })}
            disabled={!value.ulbId}
          >
            <SelectTrigger className="h-10 w-full cursor-pointer rounded-lg border-primary/20">
              <SelectValue placeholder={value.ulbId ? "All wards" : "Select ULB first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All wards</SelectItem>
              {wardItems.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.wardName || `Ward ${w.wardNumber}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <Input
            type="month"
            className="h-10 w-full rounded-lg border-primary/20"
            value={value.month ?? ""}
            onChange={(e) => setMonth(e.target.value || undefined)}
            title="Month range"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">From date</Label>
          <Input
            type="date"
            className="h-10 w-full rounded-lg border-primary/20"
            value={value.dateFrom ?? ""}
            onChange={(e) => patch({ month: undefined, dateFrom: e.target.value || undefined })}
            aria-label="From date"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">To date</Label>
          <Input
            type="date"
            className="h-10 w-full rounded-lg border-primary/20"
            value={value.dateTo ?? ""}
            onChange={(e) => patch({ month: undefined, dateTo: e.target.value || undefined })}
            aria-label="To date"
          />
        </div>
      </div>
    </div>
  )
}
