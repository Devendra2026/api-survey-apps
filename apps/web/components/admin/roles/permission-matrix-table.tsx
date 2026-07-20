"use client"

/**
 * Enterprise permission matrix (module × action checkboxes).
 * Parent row checkboxes support checked / unchecked / indeterminate.
 * View is mandatory for other actions in the same module row.
 */
import {
  MATRIX_ACTIONS,
  MATRIX_MODULES,
  type MatrixActionId,
  type MatrixModuleDef,
  type MatrixModuleIcon,
} from "@/components/admin/roles/matrix-config"
import {
  VIEW_REQUIRED_TOOLTIP,
  allMatrixPermissionIds,
  checkState,
  modulePermissionIds,
  setModuleRow,
  setPermissionIds,
  sharedModuleCount,
  toggleCellWithDependencies,
} from "@/components/admin/roles/permission-utils"
import type { CatalogPermission } from "@/lib/api/types"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import {
  BadgeCheck,
  Bell,
  Building2,
  Camera,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardList,
  Database,
  FileBarChart,
  Key,
  Landmark,
  LayoutDashboard,
  Link2,
  Map as MapIcon,
  MapPin,
  ScrollText,
  Search,
  Settings,
  Shield,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

const MODULE_ICONS: Record<MatrixModuleIcon, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  shield: Shield,
  map: MapIcon,
  "map-pin": MapPin,
  "building-2": Building2,
  landmark: Landmark,
  "clipboard-list": ClipboardList,
  "badge-check": BadgeCheck,
  "file-bar-chart": FileBarChart,
  upload: Upload,
  camera: Camera,
  database: Database,
  settings: Settings,
  "scroll-text": ScrollText,
  key: Key,
  bell: Bell,
}

export function PermissionMatrixTable({
  permissions,
  selectedIds,
  onChange,
  readOnly,
  loading,
  protectedIds,
  className,
}: {
  permissions: CatalogPermission[]
  selectedIds: Set<string>
  onChange?: (next: Set<string>) => void
  readOnly?: boolean
  loading?: boolean
  /** Permission IDs that cannot be unchecked (system baseline) */
  protectedIds?: Set<string>
  className?: string
}) {
  const [moduleSearch, setModuleSearch] = useState("")
  const [permissionSearch, setPermissionSearch] = useState("")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const locked = protectedIds ?? new Set<string>()
  const editable = !readOnly && !loading && typeof onChange === "function"

  // #region agent log
  useEffect(() => {
    fetch("http://127.0.0.1:7363/ingest/7e05a85b-205b-4ccb-b81d-e5a353e86608", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "792eec" },
      body: JSON.stringify({
        sessionId: "792eec",
        runId: "pre-fix",
        hypothesisId: "C_E",
        location: "permission-matrix-table.tsx:editable",
        message: "matrix editable flags",
        data: {
          editable,
          readOnly: Boolean(readOnly),
          loading: Boolean(loading),
          hasOnChange: typeof onChange === "function",
          selectedCount: selectedIds.size,
          permCatalog: permissions.length,
          protectedCount: locked.size,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [editable, readOnly, loading, onChange, selectedIds.size, permissions.length, locked.size])
  // #endregion

  const byName = useMemo(() => {
    const map = new Map<string, CatalogPermission>()
    for (const p of permissions) map.set(p.name, p)
    return map
  }, [permissions])

  const resolve = useCallback(
    (permissionName: string) => {
      const perm = byName.get(permissionName)
      return perm ? { id: perm.id, name: perm.name } : undefined
    },
    [byName]
  )

  const allMatrixIds = useMemo(() => allMatrixPermissionIds(resolve), [resolve])

  const filteredModules = useMemo(() => {
    const mq = moduleSearch.trim().toLowerCase()
    const pq = permissionSearch.trim().toLowerCase()
    return MATRIX_MODULES.filter((mod) => {
      const moduleMatch =
        !mq ||
        mod.label.toLowerCase().includes(mq) ||
        mod.description.toLowerCase().includes(mq) ||
        mod.id.toLowerCase().includes(mq)
      const permissionMatch =
        !pq ||
        Object.values(mod.cells).some((name) => name?.toLowerCase().includes(pq)) ||
        MATRIX_ACTIONS.some((a) => a.label.toLowerCase().includes(pq) && mod.cells[a.id])
      return moduleMatch && permissionMatch
    })
  }, [moduleSearch, permissionSearch])

  const emit = (next: Set<string>) => {
    if (!editable || !onChange) return
    const merged = new Set(next)
    for (const id of locked) merged.add(id)
    onChange(merged)
  }

  const onCellToggle = (mod: MatrixModuleDef, actionId: MatrixActionId, permissionId: string, checked: boolean) => {
    // #region agent log
    fetch("http://127.0.0.1:7363/ingest/7e05a85b-205b-4ccb-b81d-e5a353e86608", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "792eec" },
      body: JSON.stringify({
        sessionId: "792eec",
        runId: "pre-fix",
        hypothesisId: "E",
        location: "permission-matrix-table.tsx:onCellToggle",
        message: "cell toggle attempted",
        data: {
          moduleId: mod.id,
          actionId,
          permissionId,
          checked,
          editable,
          isProtected: locked.has(permissionId),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    if (locked.has(permissionId) && !checked) return
    emit(toggleCellWithDependencies(selectedIds, mod, actionId, permissionId, checked, resolve))
  }

  const onRowToggle = (mod: MatrixModuleDef, checked: boolean) => {
    const next = setModuleRow(selectedIds, mod, checked, resolve)
    if (!checked) {
      for (const id of locked) next.add(id)
    }
    emit(next)
  }

  const onBulkIds = (ids: string[], checked: boolean) => {
    const next = setPermissionIds(selectedIds, ids, checked, resolve)
    if (!checked) {
      for (const id of locked) next.add(id)
    }
    emit(next)
  }

  const columnIds = (actionId: MatrixActionId) => {
    const ids: string[] = []
    const seen = new Set<string>()
    for (const mod of filteredModules) {
      const name = mod.cells[actionId]
      if (!name) continue
      const perm = resolve(name)
      if (perm && !seen.has(perm.id)) {
        seen.add(perm.id)
        ids.push(perm.id)
      }
    }
    return ids
  }

  const selectedCount = allMatrixIds.filter((id) => selectedIds.has(id)).length
  const globalState = checkState(selectedIds, allMatrixIds)

  if (loading) {
    return (
      <div className={cn("flex h-full min-h-0 flex-col gap-2", className)}>
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="min-h-64 flex-1 rounded-lg" />
      </div>
    )
  }

  if (permissions.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        <p className="font-medium text-foreground">Permission catalog unavailable</p>
        <p>Load GET /permissions successfully before editing the matrix.</p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className={cn("flex h-full min-h-0 flex-col gap-2", className)}>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="relative min-w-36 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              placeholder="Search module…"
              className="h-8 rounded-lg pl-8 text-sm"
              aria-label="Search module"
            />
          </div>
          <div className="relative min-w-36 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={permissionSearch}
              onChange={(e) => setPermissionSearch(e.target.value)}
              placeholder="Search permission…"
              className="h-8 rounded-lg pl-8 text-sm"
              aria-label="Search permission"
            />
          </div>
          <Badge variant="secondary" className="h-7 rounded-md font-normal tabular-nums">
            {selectedCount}/{allMatrixIds.length}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 cursor-pointer rounded-md px-2 text-xs"
            onClick={() => setCollapsed({})}
          >
            <ChevronsUpDown className="mr-1 size-3" aria-hidden />
            Expand
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 cursor-pointer rounded-md px-2 text-xs"
            onClick={() => {
              const next: Record<string, boolean> = {}
              for (const mod of MATRIX_MODULES) next[mod.id] = true
              setCollapsed(next)
            }}
          >
            <ChevronsDownUp className="mr-1 size-3" aria-hidden />
            Collapse
          </Button>
          {editable ? (
            <>
              <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors hover:bg-muted/50">
                <Checkbox
                  checked={globalState}
                  onCheckedChange={(v) => {
                    if (v === "indeterminate") return
                    onBulkIds(allMatrixIds, v === true)
                  }}
                  aria-label="Select all permissions"
                />
                Select all
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer rounded-md px-2 text-xs"
                onClick={() => onBulkIds(allMatrixIds, false)}
              >
                Clear all
              </Button>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {readOnly ? "System role — clone to customize, or baseline is protected" : "View only"}
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/80">
          <table className="w-full min-w-420 caption-bottom border-separate border-spacing-0 text-sm">
            <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-30 h-9 w-55 min-w-55 border-r border-b bg-muted/95 px-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Module
                </TableHead>
                {MATRIX_ACTIONS.map((action) => {
                  const ids = columnIds(action.id)
                  const state = checkState(selectedIds, ids)
                  return (
                    <TableHead key={action.id} className="h-9 border-b px-1 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {editable && ids.length > 0 ? (
                          <Checkbox
                            checked={state}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              onBulkIds(ids, v === true)
                            }}
                            aria-label={`Select all ${action.label}`}
                          />
                        ) : (
                          <span className="size-4" aria-hidden />
                        )}
                        <span className="text-[9px] font-semibold tracking-wide text-muted-foreground uppercase">
                          {action.label}
                        </span>
                      </div>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModules.map((mod, rowIndex) => {
                const ids = modulePermissionIds(mod, resolve)
                const rowState = checkState(selectedIds, ids)
                const isCollapsed = collapsed[mod.id] === true
                const granted = ids.filter((id) => selectedIds.has(id)).length
                const Icon = MODULE_ICONS[mod.icon]
                const zebra = rowIndex % 2 === 1

                if (isCollapsed) {
                  return (
                    <TableRow key={mod.id} className={cn(zebra && "bg-muted/20")}>
                      <TableCell
                        colSpan={MATRIX_ACTIONS.length + 1}
                        className="sticky left-0 z-10 cursor-pointer bg-card p-0 hover:bg-muted/40"
                        onClick={() => setCollapsed((prev) => ({ ...prev, [mod.id]: false }))}
                      >
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden />
                          <Icon className="size-3.5 text-primary" aria-hidden />
                          <span className="flex-1 text-sm font-medium">{mod.label}</span>
                          <Badge variant="outline" className="h-5 rounded-md text-[10px] tabular-nums">
                            {granted}/{ids.length}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }

                return (
                  <TableRow
                    key={mod.id}
                    className={cn("transition-colors duration-150 hover:bg-primary/4", zebra && "bg-muted/15")}
                  >
                    <TableCell
                      className={cn("sticky left-0 z-10 w-55 min-w-55 border-r bg-card p-1.5", zebra && "bg-muted/20")}
                    >
                      <div className="flex items-center gap-1.5">
                        {editable && ids.length > 0 ? (
                          <Checkbox
                            checked={rowState}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              onRowToggle(mod, v === true)
                            }}
                            aria-label={`Select all ${mod.label}`}
                          />
                        ) : null}
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
                          onClick={() => setCollapsed((prev) => ({ ...prev, [mod.id]: true }))}
                          aria-expanded
                        >
                          <ChevronsDownUp className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Icon className="size-3" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-xs leading-tight font-semibold">{mod.label}</span>
                            <span className="block truncate text-[10px] text-muted-foreground tabular-nums">
                              {granted}/{ids.length}
                            </span>
                          </span>
                        </button>
                      </div>
                    </TableCell>
                    {MATRIX_ACTIONS.map((action) => {
                      const permName = mod.cells[action.id]
                      if (!permName) {
                        return (
                          <TableCell key={`${mod.id}-${action.id}`} className="p-1 text-center">
                            <span className="text-muted-foreground/25">·</span>
                          </TableCell>
                        )
                      }
                      const cell = resolve(permName)
                      if (!cell) {
                        return (
                          <TableCell
                            key={`${mod.id}-${action.id}`}
                            className="p-1 text-center"
                            title="Permission not seeded"
                          >
                            <span className="inline-block size-3.5 rounded border border-dashed border-muted-foreground/35" />
                          </TableCell>
                        )
                      }
                      const checked = selectedIds.has(cell.id)
                      const isProtected = locked.has(cell.id)
                      const cellEditable = editable && !isProtected
                      const linked = sharedModuleCount(cell.id, resolve) > 1
                      const viewName = mod.cells.view
                      const viewPerm = viewName ? resolve(viewName) : undefined
                      const needsViewHint = action.id !== "view" && Boolean(viewPerm) && !selectedIds.has(viewPerm!.id)

                      return (
                        <TableCell
                          key={`${mod.id}-${action.id}-${cell.id}`}
                          className={cn(
                            "p-1 text-center transition-colors",
                            checked && "bg-primary/8",
                            cellEditable && "cursor-pointer"
                          )}
                          onClick={(e) => {
                            if (!cellEditable) return
                            if ((e.target as HTMLElement).closest('[data-slot="checkbox"]')) return
                            onCellToggle(mod, action.id, cell.id, !checked)
                          }}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center gap-0.5">
                                <Checkbox
                                  checked={checked}
                                  disabled={!cellEditable}
                                  onCheckedChange={(v) => {
                                    if (v === "indeterminate") return
                                    onCellToggle(mod, action.id, cell.id, v === true)
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`${mod.label} ${action.label}: ${cell.name}`}
                                  className={cn(cellEditable && "cursor-pointer")}
                                />
                                {linked ? <Link2 className="size-2.5 text-muted-foreground" aria-hidden /> : null}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-56 text-xs">
                              <p className="font-medium">{cell.name}</p>
                              {isProtected ? <p className="text-amber-200">System permission — cannot remove</p> : null}
                              {needsViewHint ? <p className="text-amber-200">{VIEW_REQUIRED_TOOLTIP}</p> : null}
                              {linked ? <p className="text-muted-foreground">Shared across modules</p> : null}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  )
}
