"use client"

import type { UserDirectoryStats } from "@/lib/api/types"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Shield, UserCheck, UserRound, Users, UserX } from "lucide-react"

type KpiId = "total" | "active" | "disabled" | "pending" | "admins"

export function UserDirectoryKpis({
  stats,
  isLoading,
  activeId,
  onSelect,
}: {
  stats?: UserDirectoryStats
  isLoading?: boolean
  activeId?: KpiId | null
  onSelect: (id: KpiId) => void
}) {
  const items: Array<{
    id: KpiId
    label: string
    value: string | number
    icon: typeof Users
    tone: string
  }> = [
    {
      id: "total",
      label: "Total",
      value: stats?.total ?? "—",
      icon: Users,
      tone: "text-primary",
    },
    {
      id: "active",
      label: "Active",
      value: stats?.active ?? "—",
      icon: UserCheck,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "disabled",
      label: "Disabled",
      value: stats?.disabled ?? "—",
      icon: UserX,
      tone: "text-rose-600 dark:text-rose-400",
    },
    {
      id: "pending",
      label: "Pending",
      value: stats?.pending ?? "—",
      icon: UserRound,
      tone: "text-amber-600 dark:text-amber-400",
    },
    {
      id: "admins",
      label: "Admins",
      value: stats?.admins ?? "—",
      icon: Shield,
      tone: "text-cyan-600 dark:text-cyan-400",
    },
  ]

  if (isLoading) {
    return <Skeleton className="h-10 w-full rounded-lg" aria-hidden />
  }

  if (!stats) {
    return null
  }

  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/80 bg-border/60 sm:grid-cols-5"
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
              "flex cursor-pointer items-center gap-2 bg-card px-2.5 py-2 text-left transition-colors duration-200 hover:bg-muted/40 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-primary/8 ring-1 ring-primary/30 ring-inset"
            )}
            aria-pressed={active}
          >
            <Icon className={cn("size-3.5 shrink-0", item.tone)} aria-hidden />
            <div className="min-w-0 leading-none">
              <p className="truncate text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
                {item.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{item.value}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
