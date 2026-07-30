"use client"

import { useDistricts, useStates, useUlbs, useWards } from "@/hooks/use-api"
import type { CommandCenterFilters } from "@/lib/api/types"
import { formatWardOptionLabel } from "@/lib/format-ward-label"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { CalendarDays, Loader2, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useRef } from "react"

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

function formatDisplayDate(value?: string) {
  if (!value) return "Select"
  const [y, m, d] = value.split("-")
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function GeoSelectHint({
  isLoading,
  isError,
  empty,
  emptyMessage,
}: {
  isLoading?: boolean
  isError?: boolean
  empty?: boolean
  emptyMessage?: string
}) {
  if (isLoading) {
    return (
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Loading…
      </p>
    )
  }
  if (isError) {
    return <p className="text-[11px] text-destructive">Failed to load. Check access and retry.</p>
  }
  if (empty) {
    return <p className="text-[11px] text-muted-foreground">{emptyMessage}</p>
  }
  return null
}

export function CommandCenterFiltersPanel({
  filters,
  onChange,
  stateId,
  onStateChange,
}: {
  filters: CommandCenterFilters
  onChange: (next: CommandCenterFilters) => void
  stateId: string
  onStateChange: (stateId: string) => void
}) {
  const { data: states, isLoading: statesLoading, isError: statesError } = useStates({ limit: 100 })
  const { data: districts, isLoading: districtsLoading, isError: districtsError } = useDistricts(stateId || undefined)
  const { data: ulbs, isLoading: ulbsLoading, isError: ulbsError } = useUlbs(filters.districtId)
  const { data: wards, isLoading: wardsLoading, isError: wardsError } = useWards(filters.ulbId)

  const districtItems = useMemo(() => districts?.items ?? [], [districts?.items])
  const ulbItems = useMemo(() => ulbs?.items ?? [], [ulbs?.items])
  const wardItems = useMemo(() => wards?.items ?? [], [wards?.items])
  const stateItems = useMemo(() => states?.items ?? [], [states?.items])

  const defaultsApplied = useRef({ state: false })

  useEffect(() => {
    if (defaultsApplied.current.state || stateId || !stateItems.length) return
    const first = stateItems[0]
    if (first) {
      defaultsApplied.current.state = true
      onStateChange(first.id)
    }
  }, [stateId, stateItems, onStateChange])

  const patch = (partial: Partial<CommandCenterFilters>) => onChange({ ...filters, ...partial })

  const quickRanges = useMemo(
    () => [
      { label: "This month", ...monthBounds(0) },
      { label: "Last month", ...monthBounds(-1) },
      { label: "2 months back", ...monthBounds(-2) },
    ],
    []
  )

  const reset = () => {
    defaultsApplied.current = { state: true }
    onChange({
      surveyStatus: "any",
      districtId: undefined,
      ulbId: undefined,
      wardId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      month: undefined,
    })
  }

  return (
    <Card className="border-slate-100 shadow-sm transition-all duration-300 dark:border-slate-800">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-50">
              Smart Filters
            </CardTitle>
            <CardDescription className="mt-1">
              District, ULB, ward, survey status, and date range for focused field analysis.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quickRanges.map((range) => (
              <Button
                key={range.label}
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer border-slate-200 dark:border-slate-800"
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
              variant="ghost"
              size="icon"
              className="cursor-pointer"
              aria-label="Reset filters"
              onClick={reset}
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">State</Label>
            <Select value={stateId || ""} onValueChange={onStateChange}>
              <SelectTrigger className="h-9 cursor-pointer border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {stateItems.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <GeoSelectHint
              isLoading={statesLoading}
              isError={statesError}
              empty={!statesLoading && !statesError && stateItems.length === 0}
              emptyMessage="No states available."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">District</Label>
            <Select
              value={filters.districtId || ""}
              onValueChange={(districtId) => {
                onChange({
                  ...filters,
                  districtId,
                  ulbId: undefined,
                  wardId: undefined,
                })
              }}
              disabled={!stateId}
            >
              <SelectTrigger className="h-9 cursor-pointer border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {districtItems.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stateId ? (
              <GeoSelectHint
                isLoading={districtsLoading}
                isError={districtsError}
                empty={!districtsLoading && !districtsError && districtItems.length === 0}
                emptyMessage="No districts for this state."
              />
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ULB</Label>
            <Select
              value={filters.ulbId || ""}
              onValueChange={(ulbId) => {
                onChange({ ...filters, ulbId, wardId: undefined })
              }}
              disabled={!filters.districtId}
            >
              <SelectTrigger className="h-9 cursor-pointer border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Select municipality" />
              </SelectTrigger>
              <SelectContent>
                {ulbItems.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.districtId ? (
              <GeoSelectHint
                isLoading={ulbsLoading}
                isError={ulbsError}
                empty={!ulbsLoading && !ulbsError && ulbItems.length === 0}
                emptyMessage="No ULBs for this district."
              />
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ward</Label>
            <Select
              value={filters.wardId || "all"}
              onValueChange={(value) => patch({ wardId: value === "all" ? undefined : value })}
              disabled={!filters.ulbId}
            >
              <SelectTrigger className="h-9 cursor-pointer border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="All wards" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All wards</SelectItem>
                {wardItems.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {formatWardOptionLabel(w)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.ulbId ? (
              <GeoSelectHint
                isLoading={wardsLoading}
                isError={wardsError}
                empty={!wardsLoading && !wardsError && wardItems.length === 0}
                emptyMessage="No wards for this ULB."
              />
            ) : (
              <p className="text-[11px] text-muted-foreground">Select a ULB to list wards.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Survey Status</Label>
            <Select value={filters.surveyStatus || "any"} onValueChange={(surveyStatus) => patch({ surveyStatus })}>
              <SelectTrigger className="h-9 cursor-pointer border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Month</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full cursor-pointer justify-start border-slate-200 font-normal dark:border-slate-800"
                >
                  <CalendarDays className="mr-2 size-4 text-muted-foreground" />
                  {filters.month || "Pick month"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-3">
                <Input
                  type="month"
                  className="h-9 border-slate-200 dark:border-slate-800"
                  value={filters.month ?? ""}
                  onChange={(e) => {
                    const month = e.target.value
                    if (!month) {
                      patch({ month: undefined })
                      return
                    }
                    const [y, m] = month.split("-").map(Number)
                    const end = new Date(Date.UTC(y!, m!, 0))
                    patch({
                      month,
                      dateFrom: `${month}-01`,
                      dateTo: `${month}-${String(end.getUTCDate()).padStart(2, "0")}`,
                    })
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">From Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full cursor-pointer justify-start border-slate-200 font-normal dark:border-slate-800"
                >
                  <CalendarDays className="mr-2 size-4 text-muted-foreground" />
                  {formatDisplayDate(filters.dateFrom)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-3">
                <Input
                  type="date"
                  className="h-9 border-slate-200 dark:border-slate-800"
                  value={filters.dateFrom ?? ""}
                  onChange={(e) => patch({ dateFrom: e.target.value || undefined, month: undefined })}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">To Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full cursor-pointer justify-start border-slate-200 font-normal dark:border-slate-800"
                >
                  <CalendarDays className="mr-2 size-4 text-muted-foreground" />
                  {formatDisplayDate(filters.dateTo)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-3">
                <Input
                  type="date"
                  className="h-9 border-slate-200 dark:border-slate-800"
                  value={filters.dateTo ?? ""}
                  onChange={(e) => patch({ dateTo: e.target.value || undefined, month: undefined })}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
