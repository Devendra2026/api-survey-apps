"use client"

import type { UserDirectoryStats } from "@/lib/api/types"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Clock, MapPin, Shield, ShieldCheck, UserRound, Users } from "lucide-react"

export type UserDirectoryKpiId = "total" | "surveyors" | "supervisors" | "qc" | "admins" | "pending" | "locations"

export function UserDirectoryKpis({
  stats,
  isLoading,
  activeId,
  onSelect,
}: {
  stats?: UserDirectoryStats
  isLoading?: boolean
  activeId?: UserDirectoryKpiId | null
  onSelect: (id: UserDirectoryKpiId) => void
}) {
  const items: Array<{
    id: UserDirectoryKpiId
    label: string
    value: string | number
    icon: typeof Users
    tone: string
  }> = [
    {
      id: "total",
      label: "Total Users",
      value: stats?.total ?? "—",
      icon: Users,
      tone: "text-primary",
    },
    {
      id: "surveyors",
      label: "Active Surveyors",
      value: stats?.surveyors ?? "—",
      icon: UserRound,
      tone: "text-sky-600 dark:text-sky-400",
    },
    {
      id: "supervisors",
      label: "Active Supervisors",
      value: stats?.supervisors ?? "—",
      icon: Shield,
      tone: "text-indigo-600 dark:text-indigo-400",
    },
    {
      id: "qc",
      label: "Active QC Supervisors",
      value: stats?.qcSupervisors ?? "—",
      icon: ShieldCheck,
      tone: "text-cyan-600 dark:text-cyan-400",
    },
    {
      id: "admins",
      label: "Admins",
      value: stats?.admins ?? "—",
      icon: Shield,
      tone: "text-slate-600 dark:text-slate-300",
    },
    {
      id: "pending",
      label: "Pending Users",
      value: stats?.pending ?? "—",
      icon: Clock,
      tone: "text-amber-600 dark:text-amber-400",
    },
    {
      id: "locations",
      label: "Locations Assigned",
      value: stats?.locationsAssigned ?? "—",
      icon: MapPin,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
  ]

  if (isLoading) {
    return <Skeleton className="h-14 w-full rounded-lg" aria-hidden />
  }

  if (!stats) {
    return null
  }

  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/80 bg-border/60 sm:grid-cols-3 lg:grid-cols-7"
      role="group"
      aria-label="User directory metrics"
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = activeId === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 bg-card px-3 py-2.5 text-left transition-colors duration-200 hover:bg-muted/40 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-primary/8 ring-1 ring-primary/30 ring-inset"
            )}
            aria-pressed={active}
          >
            <Icon className={cn("size-4 shrink-0", item.tone)} aria-hidden />
            <div className="min-w-0 leading-none">
              <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {item.label}
              </p>
              <p className="mt-1 text-base font-semibold text-foreground tabular-nums">{item.value}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
