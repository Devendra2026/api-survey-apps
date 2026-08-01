"use client"

/**
 * Grouped permission checkbox cards by resource area (survey, user, settings, …).
 */
import type { CatalogPermission } from "@/lib/api/types"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"

const GROUP_LABELS: Record<string, string> = {
  survey: "Field Surveys & QC",
  user: "Admin · Users",
  role: "Roles",
  dashboard: "Dashboard",
  report: "Reports",
  photo: "Photos",
  settings: "Masters · Configuration",
  etl: "ETL Sync",
}

function groupKey(permissionName: string): string {
  const idx = permissionName.indexOf(":")
  return idx === -1 ? "other" : permissionName.slice(0, idx)
}

function groupLabel(key: string): string {
  return GROUP_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

function actionLabel(permissionName: string): string {
  const idx = permissionName.indexOf(":")
  const action = idx === -1 ? permissionName : permissionName.slice(idx + 1)
  return action.replaceAll("_", " ")
}

export function PermissionGroupsPanel({
  permissions,
  selectedIds,
  onChange,
  readOnly,
  loading,
  className,
}: {
  permissions: CatalogPermission[]
  selectedIds: Set<string>
  onChange?: (next: Set<string>) => void
  readOnly?: boolean
  loading?: boolean
  className?: string
}) {
  const [query, setQuery] = useState("")

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const map = new Map<string, CatalogPermission[]>()
    for (const perm of permissions) {
      if (
        q &&
        !perm.name.toLowerCase().includes(q) &&
        !(perm.description ?? "").toLowerCase().includes(q) &&
        !actionLabel(perm.name).toLowerCase().includes(q)
      ) {
        continue
      }
      const key = groupKey(perm.name)
      const list = map.get(key) ?? []
      list.push(perm)
      map.set(key, list)
    }
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        label: groupLabel(key),
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [permissions, query])

  const totalSelected = useMemo(() => {
    let n = 0
    for (const p of permissions) if (selectedIds.has(p.id)) n += 1
    return n
  }, [permissions, selectedIds])

  const toggle = (id: string, checked: boolean) => {
    if (!onChange || readOnly) return
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    onChange(next)
  }

  const clearGroup = (items: CatalogPermission[]) => {
    if (!onChange || readOnly) return
    const next = new Set(selectedIds)
    for (const item of items) next.delete(item.id)
    onChange(next)
  }

  const selectGroup = (items: CatalogPermission[]) => {
    if (!onChange || readOnly) return
    const next = new Set(selectedIds)
    for (const item of items) next.add(item.id)
    onChange(next)
  }

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2", className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search permissions…"
            className="h-8 rounded-lg pl-8 text-sm"
            aria-label="Search permissions"
          />
        </div>
        <Badge variant="secondary" className="rounded-md tabular-nums">
          {totalSelected} selected
        </Badge>
        {!readOnly && onChange ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 cursor-pointer rounded-md text-xs"
            onClick={() => onChange(new Set())}
          >
            Clear all
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No permissions match your search.</p>
        ) : (
          groups.map((group) => {
            const selectedInGroup = group.items.filter((p) => selectedIds.has(p.id)).length
            return (
              <section
                key={group.key}
                className="rounded-lg border border-border/80 bg-card/50 shadow-xs"
                aria-label={group.label}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold tracking-tight">{group.label}</h3>
                    <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px] tabular-nums">
                      {selectedInGroup} selected
                    </Badge>
                  </div>
                  {!readOnly && onChange ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer rounded-md px-2 text-xs"
                        onClick={() => selectGroup(group.items)}
                      >
                        Select all
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 cursor-pointer rounded-md px-2 text-xs"
                        onClick={() => clearGroup(group.items)}
                      >
                        Clear all
                      </Button>
                    </div>
                  ) : null}
                </div>
                <ul className="grid gap-1 p-2 sm:grid-cols-2">
                  {group.items.map((perm) => {
                    const checked = selectedIds.has(perm.id)
                    return (
                      <li key={perm.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors",
                            readOnly ? "cursor-default" : "hover:border-border/80 hover:bg-muted/40",
                            checked && "border-primary/20 bg-primary/5"
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={readOnly || !onChange}
                            onCheckedChange={(value) => toggle(perm.id, value === true)}
                            className="mt-0.5"
                            aria-label={perm.name}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium capitalize">{actionLabel(perm.name)}</span>
                            <span className="block truncate font-mono text-[10px] text-muted-foreground">
                              {perm.name}
                            </span>
                            {perm.description ? (
                              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                                {perm.description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })
        )}
      </div>

      <p className="shrink-0 text-[11px] leading-snug text-muted-foreground">
        Permission changes apply when the signed-in user&apos;s session data refreshes (re-login or token refresh).
      </p>
    </div>
  )
}
