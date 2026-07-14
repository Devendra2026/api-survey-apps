"use client"

import { useDashboardSummary, useDistricts, useStates, useUlbs, useUsers, useWards } from "@/hooks/use-api"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { FilterX } from "lucide-react"

export interface SurveyRegistryFiltersState {
  surveyStatus: string
  qcStatus: string
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  surveyorId: string
  dateFrom: string
  dateTo: string
  mobile: string
}

export const emptyRegistryFilters = (): SurveyRegistryFiltersState => ({
  surveyStatus: "all",
  qcStatus: "all",
  stateId: "",
  districtId: "",
  ulbId: "",
  wardId: "",
  surveyorId: "",
  dateFrom: "",
  dateTo: "",
  mobile: "",
})

export function SurveyRegistryFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: SurveyRegistryFiltersState
  onChange: (next: SurveyRegistryFiltersState) => void
  onReset: () => void
}) {
  const canViewUsers = useAuthStore((s) => s.hasPermission("user:view"))
  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(filters.stateId || undefined)
  const { data: ulbs } = useUlbs(filters.districtId || undefined)
  const { data: wards } = useWards(filters.ulbId || undefined)
  const { data: users } = useUsers(canViewUsers ? { limit: 100 } : {})
  const { data: dashboard } = useDashboardSummary()

  const surveyorOptions = canViewUsers
    ? (users?.items ?? []).map((user) => ({ id: user.id, fullName: user.fullName }))
    : (dashboard?.topSurveyors ?? []).map((user) => ({ id: user.id, fullName: user.fullName }))

  const patch = (partial: Partial<SurveyRegistryFiltersState>) => onChange({ ...filters, ...partial })

  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Advanced filters</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onReset}>
          <FilterX className="size-3.5" />
          Reset
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Select value={filters.surveyStatus} onValueChange={(surveyStatus) => patch({ surveyStatus })}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="REOPENED">Reopened</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.qcStatus} onValueChange={(qcStatus) => patch({ qcStatus })}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="QC status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All QC</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.stateId || "all"}
          onValueChange={(value) =>
            patch({
              stateId: value === "all" ? "" : value,
              districtId: "",
              ulbId: "",
              wardId: "",
            })
          }
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {(states?.items ?? []).map((state) => (
              <SelectItem key={state.id} value={state.id}>
                {state.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.districtId || "all"}
          onValueChange={(value) =>
            patch({
              districtId: value === "all" ? "" : value,
              ulbId: "",
              wardId: "",
            })
          }
          disabled={!filters.stateId}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="District" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All districts</SelectItem>
            {(districts?.items ?? []).map((district) => (
              <SelectItem key={district.id} value={district.id}>
                {district.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.ulbId || "all"}
          onValueChange={(value) =>
            patch({
              ulbId: value === "all" ? "" : value,
              wardId: "",
            })
          }
          disabled={!filters.districtId}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="ULB" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ULBs</SelectItem>
            {(ulbs?.items ?? []).map((ulb) => (
              <SelectItem key={ulb.id} value={ulb.id}>
                {ulb.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.wardId || "all"}
          onValueChange={(value) => patch({ wardId: value === "all" ? "" : value })}
          disabled={!filters.ulbId}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Ward" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All wards</SelectItem>
            {(wards?.items ?? []).map((ward) => (
              <SelectItem key={ward.id} value={ward.id}>
                {ward.wardName || `Ward ${ward.wardNumber}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.surveyorId || "all"}
          onValueChange={(value) => patch({ surveyorId: value === "all" ? "" : value })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Surveyor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All surveyors</SelectItem>
            {surveyorOptions.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="h-8"
          value={filters.dateFrom}
          onChange={(e) => patch({ dateFrom: e.target.value })}
          aria-label="From date"
        />
        <Input
          type="date"
          className="h-8"
          value={filters.dateTo}
          onChange={(e) => patch({ dateTo: e.target.value })}
          aria-label="To date"
        />
        <Input
          className="h-8"
          placeholder="Mobile number"
          value={filters.mobile}
          onChange={(e) => patch({ mobile: e.target.value })}
        />
      </div>
    </div>
  )
}
