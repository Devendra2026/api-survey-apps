"use client"

import { moduleSummary } from "@/components/admin/roles/permission-utils"
import type { RoleCategory } from "@/components/admin/roles/system-role-policy"
import type { CatalogPermission } from "@/lib/api/types"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { useMemo } from "react"

function formatDate(value?: string | null): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return "—"
  }
}

export function RolePermissionSummary({
  selectedIds,
  permissions,
  assignedUsers,
  roleType,
  createdAt,
  updatedAt,
  className,
}: {
  selectedIds: Set<string>
  permissions: CatalogPermission[]
  assignedUsers: number
  roleType: RoleCategory | "System" | "Custom"
  createdAt?: string | null
  updatedAt?: string | null
  className?: string
}) {
  const resolve = useMemo(() => {
    const map = new Map(permissions.map((p) => [p.name, { id: p.id, name: p.name }]))
    return (name: string) => map.get(name)
  }, [permissions])

  const rows = useMemo(() => moduleSummary(selectedIds, resolve), [selectedIds, resolve])
  const modulesSelected = rows.filter((r) => r.granted > 0).length
  const uniqueSelected = selectedIds.size
  const typeLabel = roleType === "SYSTEM" || roleType === "System" ? "SYSTEM" : "CUSTOM"

  return (
    <aside
      className={cn("flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm", className)}
      aria-label="Role permission summary"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Summary</span>
        <Badge
          variant="outline"
          className={cn(
            "h-5 rounded-md text-[10px]",
            typeLabel === "SYSTEM"
              ? "border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
              : "border-primary/30 bg-primary/5 text-primary"
          )}
        >
          {typeLabel}
        </Badge>
        <Badge
          variant="outline"
          className="h-5 rounded-md border-emerald-300/60 bg-emerald-500/10 text-[10px] text-emerald-800 dark:text-emerald-200"
        >
          Active
        </Badge>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border bg-card px-2 py-1.5">
          <dt className="text-[10px] text-muted-foreground">Modules</dt>
          <dd className="text-sm font-semibold tabular-nums">{modulesSelected}</dd>
        </div>
        <div className="rounded-md border bg-card px-2 py-1.5">
          <dt className="text-[10px] text-muted-foreground">Permissions</dt>
          <dd className="text-sm font-semibold tabular-nums">{uniqueSelected}</dd>
        </div>
        <div className="rounded-md border bg-card px-2 py-1.5">
          <dt className="text-[10px] text-muted-foreground">Users</dt>
          <dd className="text-sm font-semibold tabular-nums">{assignedUsers}</dd>
        </div>
      </dl>

      <dl className="space-y-1 border-t pt-2 text-[11px] text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Created</dt>
          <dd className="text-foreground tabular-nums">{formatDate(createdAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Updated</dt>
          <dd className="text-foreground tabular-nums">{formatDate(updatedAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Created by</dt>
          <dd className="text-foreground">—</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Updated by</dt>
          <dd className="text-foreground">—</dd>
        </div>
      </dl>

      <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
        {rows.map((row) => (
          <li key={row.moduleId} className="flex items-center justify-between gap-2">
            <span className={cn("truncate", row.granted === 0 && "text-muted-foreground")}>{row.label}</span>
            <span
              className={cn(
                "tabular-nums",
                row.granted === row.total && row.total > 0
                  ? "font-medium text-emerald-700 dark:text-emerald-300"
                  : "text-muted-foreground"
              )}
            >
              {row.granted} / {row.total}
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t pt-2 text-xs font-medium tabular-nums">
        Total <span className="text-foreground">{uniqueSelected}</span> Permissions
      </p>
    </aside>
  )
}
