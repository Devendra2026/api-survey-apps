"use client"

import { useDistricts, useRoles, useStates, useUlbs, useWards } from "@/hooks/use-api"
import { roleDisplayName } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { Filter, RotateCcw, Search } from "lucide-react"
import { useMemo } from "react"

export type UserDirectoryFilters = {
  search: string
  roleName: string
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  isActive: string
}

export const EMPTY_USER_FILTERS: UserDirectoryFilters = {
  search: "",
  roleName: "",
  stateId: "",
  districtId: "",
  ulbId: "",
  wardId: "",
  isActive: "",
}

export function UserDirectoryFiltersBar({
  filters,
  onChange,
  onReset,
  className,
}: {
  filters: UserDirectoryFilters
  onChange: (next: UserDirectoryFilters) => void
  onReset: () => void
  className?: string
}) {
  const { data: roles } = useRoles()
  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(filters.stateId || undefined)
  const { data: ulbs } = useUlbs(filters.districtId || undefined)
  const { data: wards } = useWards(filters.ulbId || undefined)

  const roleOptions = useMemo(() => {
    const items = roles?.items ?? []
    return [...items].sort((a, b) => roleDisplayName(a.name).localeCompare(roleDisplayName(b.name)))
  }, [roles?.items])

  const patch = (partial: Partial<UserDirectoryFilters>) => onChange({ ...filters, ...partial })
  const activeCount = [
    filters.roleName,
    filters.stateId,
    filters.districtId,
    filters.ulbId,
    filters.wardId,
    filters.isActive,
    filters.search,
  ].filter(Boolean).length

  return (
    <section
      className={cn("surface-elevated animate-in-fade space-y-4 p-4 md:p-5", className)}
      aria-label="User filters"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Filter className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Filters</p>
            <p className="text-xs text-muted-foreground">
              {activeCount > 0
                ? `${activeCount} active filter${activeCount === 1 ? "" : "s"}`
                : "Search and refine the directory"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="cursor-pointer gap-1.5 text-muted-foreground transition-colors duration-200"
          onClick={onReset}
          disabled={activeCount === 0}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset
        </Button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="user-search"
          aria-label="Search users by name, email, or mobile"
          placeholder="Search by name, email, or mobile…"
          value={filters.search}
          onChange={(e) => patch({ search: e.target.value })}
          className="h-11 rounded-xl border-border/80 bg-background pl-10 shadow-none"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Role</Label>
          <Select
            value={filters.roleName || "__all__"}
            onValueChange={(value) => patch({ roleName: value === "__all__" ? "" : value })}
          >
            <SelectTrigger className="h-10 cursor-pointer rounded-xl">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All roles</SelectItem>
              {roleOptions.map((role) => (
                <SelectItem key={role.id} value={role.name}>
                  {roleDisplayName(role.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Status</Label>
          <Select
            value={filters.isActive || "__all__"}
            onValueChange={(value) => patch({ isActive: value === "__all__" ? "" : value })}
          >
            <SelectTrigger className="h-10 cursor-pointer rounded-xl">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">State</Label>
          <Select
            value={filters.stateId || "__all__"}
            onValueChange={(value) =>
              patch({
                stateId: value === "__all__" ? "" : value,
                districtId: "",
                ulbId: "",
                wardId: "",
              })
            }
          >
            <SelectTrigger className="h-10 cursor-pointer rounded-xl">
              <SelectValue placeholder="All states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All states</SelectItem>
              {(states?.items ?? []).map((state) => (
                <SelectItem key={state.id} value={state.id}>
                  {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">District</Label>
          <Select
            value={filters.districtId || "__all__"}
            onValueChange={(value) =>
              patch({
                districtId: value === "__all__" ? "" : value,
                ulbId: "",
                wardId: "",
              })
            }
            disabled={!filters.stateId}
          >
            <SelectTrigger className="h-10 cursor-pointer rounded-xl">
              <SelectValue placeholder="All districts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All districts</SelectItem>
              {(districts?.items ?? []).map((district) => (
                <SelectItem key={district.id} value={district.id}>
                  {district.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">ULB</Label>
          <Select
            value={filters.ulbId || "__all__"}
            onValueChange={(value) =>
              patch({
                ulbId: value === "__all__" ? "" : value,
                wardId: "",
              })
            }
            disabled={!filters.districtId}
          >
            <SelectTrigger className="h-10 cursor-pointer rounded-xl">
              <SelectValue placeholder="All ULBs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All ULBs</SelectItem>
              {(ulbs?.items ?? []).map((ulb) => (
                <SelectItem key={ulb.id} value={ulb.id}>
                  {ulb.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Ward</Label>
          <Select
            value={filters.wardId || "__all__"}
            onValueChange={(value) => patch({ wardId: value === "__all__" ? "" : value })}
            disabled={!filters.ulbId}
          >
            <SelectTrigger className="h-10 cursor-pointer rounded-xl">
              <SelectValue placeholder="All wards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All wards</SelectItem>
              {(wards?.items ?? []).map((ward) => (
                <SelectItem key={ward.id} value={ward.id}>
                  {ward.wardNumber}
                  {ward.wardName ? ` · ${ward.wardName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  )
}
