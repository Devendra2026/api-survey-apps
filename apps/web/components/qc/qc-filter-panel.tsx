"use client"

import { useDistricts, useStates, useUlbs, useWards } from "@/hooks/use-api"
import type { QcCommandCenterFilters } from "@/lib/api/types"
import { formatWardOptionLabel } from "@/lib/format-ward-label"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { format, parse } from "date-fns"
import { CalendarDays, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

const DEFAULT_DISTRICT_NAME = "Etah"
const DEFAULT_ULB_HINT = "etah"

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
  const parsed = parse(value, "yyyy-MM-dd", new Date())
  if (Number.isNaN(parsed.getTime())) return value
  return format(parsed, "dd/MM/yyyy")
}

function parseIsoDate(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = parse(value, "yyyy-MM-dd", new Date())
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function countActiveFilters(filters: QcCommandCenterFilters) {
  return [filters.districtId, filters.ulbId, filters.wardId, filters.month, filters.dateFrom, filters.dateTo].filter(
    Boolean
  ).length
}

export function QcFilterPanel({
  filters,
  onChange,
  stateId,
  onStateChange,
}: {
  filters: QcCommandCenterFilters
  onChange: (next: QcCommandCenterFilters) => void
  stateId: string
  onStateChange: (stateId: string) => void
}) {
  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(stateId || undefined)
  const { data: ulbs } = useUlbs(filters.districtId)
  const { data: wards } = useWards(filters.ulbId)

  const districtItems = useMemo(() => districts?.items ?? [], [districts?.items])
  const ulbItems = useMemo(() => ulbs?.items ?? [], [ulbs?.items])
  const wardItems = useMemo(() => wards?.items ?? [], [wards?.items])
  const stateItems = useMemo(() => states?.items ?? [], [states?.items])

  const defaultsApplied = useRef({ state: false, district: false, ulb: false })
  const [monthOpen, setMonthOpen] = useState(false)
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)

  useEffect(() => {
    if (defaultsApplied.current.state || stateId || !stateItems.length) return
    const first = stateItems[0]
    if (first) {
      defaultsApplied.current.state = true
      onStateChange(first.id)
    }
  }, [stateId, stateItems, onStateChange])

  useEffect(() => {
    if (defaultsApplied.current.district || filters.districtId || !districtItems.length) return
    const match = districtItems.find((d) => d.name.toLowerCase().includes(DEFAULT_DISTRICT_NAME.toLowerCase()))
    if (match) {
      defaultsApplied.current.district = true
      onChange({ ...filters, districtId: match.id, ulbId: undefined, wardId: undefined })
    }
  }, [districtItems, filters, onChange])

  useEffect(() => {
    if (defaultsApplied.current.ulb || !filters.districtId || filters.ulbId || !ulbItems.length) return
    const match =
      ulbItems.find((u) => u.name.toLowerCase().includes(DEFAULT_ULB_HINT)) ??
      ulbItems.find((u) => u.name.toLowerCase().includes("municipal"))
    if (match) {
      defaultsApplied.current.ulb = true
      onChange({ ...filters, ulbId: match.id, wardId: undefined })
    }
  }, [ulbItems, filters, onChange])

  const patch = (partial: Partial<QcCommandCenterFilters>) => onChange({ ...filters, ...partial })

  const quickRanges = useMemo(
    () => [
      { label: "This month", ...monthBounds(0) },
      { label: "Last month", ...monthBounds(-1) },
      { label: "2 months back", ...monthBounds(-2) },
    ],
    []
  )

  const activeCount = countActiveFilters(filters)

  const reset = () => {
    defaultsApplied.current = { state: true, district: false, ulb: false }
    onChange({
      districtId: undefined,
      ulbId: undefined,
      wardId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      month: undefined,
    })
  }

  const monthDate = filters.month ? parse(`${filters.month}-01`, "yyyy-MM-dd", new Date()) : undefined

  return (
    <Card className="border-slate-100 bg-card/80 shadow-sm backdrop-blur transition-all duration-300 dark:border-slate-800">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold tracking-wide text-slate-900 uppercase dark:text-slate-50">
                  Filter Control Panel
                </CardTitle>
                {activeCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-full bg-teal-500/10 font-medium text-teal-700 dark:text-teal-300"
                  >
                    {activeCount} active
                  </Badge>
                ) : null}
              </div>
              <CardDescription className="mt-1">
                Set district, ULB, ward, and date range once — then review ward-by-ward.
              </CardDescription>
            </div>
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
            <Button type="button" variant="ghost" size="sm" className="cursor-pointer gap-1.5" onClick={reset}>
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">District</Label>
            <Select
              value={filters.districtId || ""}
              onValueChange={(districtId) => {
                defaultsApplied.current.ulb = false
                onChange({
                  ...filters,
                  districtId,
                  ulbId: undefined,
                  wardId: undefined,
                })
              }}
              disabled={!stateId}
            >
              <SelectTrigger className="h-9 border-slate-200 dark:border-slate-800">
                <SelectValue placeholder={DEFAULT_DISTRICT_NAME} />
              </SelectTrigger>
              <SelectContent>
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
              value={filters.ulbId || ""}
              onValueChange={(ulbId) => onChange({ ...filters, ulbId, wardId: undefined })}
              disabled={!filters.districtId}
            >
              <SelectTrigger className="h-9 border-slate-200 dark:border-slate-800">
                <SelectValue placeholder="Municipal Council Etah" />
              </SelectTrigger>
              <SelectContent>
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
              value={filters.wardId || "all"}
              onValueChange={(value) => patch({ wardId: value === "all" ? undefined : value })}
              disabled={!filters.ulbId}
            >
              <SelectTrigger className="h-9 border-slate-200 dark:border-slate-800">
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Month</Label>
            <Popover open={monthOpen} onOpenChange={setMonthOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-9 w-full cursor-pointer justify-start border-slate-200 font-normal dark:border-slate-800",
                    !filters.month && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 size-4 text-muted-foreground" />
                  {filters.month || "Pick month"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  selected={monthDate && !Number.isNaN(monthDate.getTime()) ? monthDate : undefined}
                  onSelect={(date) => {
                    if (!date) {
                      patch({ month: undefined })
                      return
                    }
                    const month = format(date, "yyyy-MM")
                    const end = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0))
                    patch({
                      month,
                      dateFrom: `${month}-01`,
                      dateTo: `${month}-${String(end.getUTCDate()).padStart(2, "0")}`,
                    })
                    setMonthOpen(false)
                  }}
                  defaultMonth={monthDate && !Number.isNaN(monthDate.getTime()) ? monthDate : undefined}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">From date</Label>
            <Popover open={fromOpen} onOpenChange={setFromOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-9 w-full cursor-pointer justify-start border-slate-200 font-normal dark:border-slate-800",
                    !filters.dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 size-4 text-muted-foreground" />
                  {formatDisplayDate(filters.dateFrom)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={parseIsoDate(filters.dateFrom)}
                  onSelect={(date) => {
                    patch({
                      dateFrom: date ? format(date, "yyyy-MM-dd") : undefined,
                      month: undefined,
                    })
                    setFromOpen(false)
                  }}
                  defaultMonth={parseIsoDate(filters.dateFrom)}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">To date</Label>
            <Popover open={toOpen} onOpenChange={setToOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-9 w-full cursor-pointer justify-start border-slate-200 font-normal dark:border-slate-800",
                    !filters.dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 size-4 text-muted-foreground" />
                  {formatDisplayDate(filters.dateTo)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={parseIsoDate(filters.dateTo)}
                  onSelect={(date) => {
                    patch({
                      dateTo: date ? format(date, "yyyy-MM-dd") : undefined,
                      month: undefined,
                    })
                    setToOpen(false)
                  }}
                  defaultMonth={parseIsoDate(filters.dateTo)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
