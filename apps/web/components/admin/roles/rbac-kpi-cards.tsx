"use client"

import type { CatalogPermission, CatalogRole, UserDirectoryStats } from "@/lib/api/types"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Activity, KeyRound, Shield, ShieldCheck, UserCheck } from "lucide-react"
import { SYSTEM_ROLE_CODES } from "./permission-utils"

/** Ultra-compact metrics strip — Data-Dense Dashboard (ui-ux-pro-max) */
export function RbacKpiCards({
  roles,
  permissions,
  userStats,
  isLoading,
}: {
  roles: CatalogRole[]
  permissions: CatalogPermission[]
  userStats?: UserDirectoryStats
  isLoading?: boolean
}) {
  const systemCount = roles.filter((r) => SYSTEM_ROLE_CODES.has(r.name)).length
  const customCount = Math.max(roles.length - systemCount, 0)
  const assignedUsers = (userStats?.total ?? 0) - (userStats?.pending ?? 0)

  const items = [
    { label: "Roles", value: roles.length, icon: Shield, tone: "text-primary" },
    { label: "System", value: systemCount, icon: ShieldCheck, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Custom", value: customCount, icon: Shield, tone: "text-slate-600 dark:text-slate-300" },
    {
      label: "Assigned",
      value: userStats ? Math.max(assignedUsers, 0) : "—",
      icon: UserCheck,
      tone: "text-cyan-600 dark:text-cyan-400",
    },
    { label: "Permissions", value: permissions.length, icon: KeyRound, tone: "text-violet-600 dark:text-violet-400" },
    {
      label: "Sessions",
      value: userStats?.active ?? "—",
      icon: Activity,
      tone: "text-sky-600 dark:text-sky-400",
    },
  ]

  if (isLoading) {
    return <Skeleton className="h-10 w-full rounded-lg" />
  }

  return (
    <div
      className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border/80 bg-border/60 sm:grid-cols-6"
      role="group"
      aria-label="RBAC metrics"
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="flex items-center gap-2 bg-card px-2.5 py-2 transition-colors duration-200 hover:bg-muted/40"
          >
            <Icon className={cn("size-3.5 shrink-0", item.tone)} aria-hidden />
            <div className="min-w-0 leading-none">
              <p className="truncate text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
                {item.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{item.value}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
