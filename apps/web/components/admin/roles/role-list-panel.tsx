"use client"

import { ROLE_PERMISSION_HINTS } from "@/components/admin/roles/matrix-config"
import { DEPARTMENT_ROLE_CODES, SYSTEM_ROLE_CODES } from "@/components/admin/roles/permission-utils"
import { roleDisplayName, type CatalogRole } from "@/lib/api/types"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { motion, useReducedMotion } from "framer-motion"
import { Plus, Search, Shield } from "lucide-react"
import { useMemo, useState } from "react"

function RoleRow({
  role,
  selected,
  index,
  reduceMotion,
  userCounts,
  onSelect,
}: {
  role: CatalogRole
  selected: boolean
  index: number
  reduceMotion: boolean | null
  userCounts: Record<string, number>
  onSelect: (id: string) => void
}) {
  const isSystem = SYSTEM_ROLE_CODES.has(role.name)
  const isDept = DEPARTMENT_ROLE_CODES.has(role.name)
  const permCount = role.permissionCount ?? role.permissions?.length ?? 0
  const users = role.assignedUsersCount ?? userCounts[role.name] ?? userCounts[role.id] ?? 0
  const badge = isDept ? "DEPT" : isSystem ? "SYS" : "CUSTOM"

  return (
    <motion.button
      key={role.id}
      type="button"
      role="option"
      aria-selected={selected}
      initial={reduceMotion ? false : { opacity: 0, x: -4 }}
      animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      onClick={() => onSelect(role.id)}
      className={cn(
        "group relative w-full cursor-pointer rounded-lg border px-2 py-2 text-left transition-all duration-200",
        selected
          ? "border-primary/50 bg-linear-to-br from-primary/12 via-primary/5 to-transparent shadow-[0_4px_14px_-6px_oklch(0.48_0.2_275/0.45)]"
          : "border-transparent hover:border-border/80 hover:bg-muted/50"
      )}
    >
      {selected ? <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden /> : null}
      <div className="flex items-start gap-2 pl-1">
        <div
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200",
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <Shield className="size-3.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold tracking-tight">{roleDisplayName(role.name)}</span>
            <Badge
              variant="outline"
              className={cn(
                "h-4 shrink-0 rounded px-1 text-[9px] font-medium uppercase",
                isDept
                  ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100"
                  : isSystem
                    ? "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    : "border-primary/30 bg-primary/5 text-primary"
              )}
            >
              {badge}
            </Badge>
          </div>
          <p className="line-clamp-1 text-[11px] leading-snug text-muted-foreground">
            {role.description ?? ROLE_PERMISSION_HINTS[role.name] ?? "Custom role"}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {permCount} perms · {users} users · <span className="text-emerald-700 dark:text-emerald-300">Active</span>
          </p>
        </div>
      </div>
    </motion.button>
  )
}

export function RoleListPanel({
  roles,
  selectedId,
  userCounts,
  isLoading,
  onSelect,
  onCreateRole,
  canCreate,
}: {
  roles: CatalogRole[]
  selectedId: string | null
  userCounts: Record<string, number>
  isLoading?: boolean
  onSelect: (id: string) => void
  onCreateRole?: () => void
  canCreate?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return roles
    return roles.filter(
      (r) =>
        roleDisplayName(r.name).toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
    )
  }, [roles, query])

  const { systemRoles, customRoles } = useMemo(() => {
    const system: CatalogRole[] = []
    const custom: CatalogRole[] = []
    for (const role of filtered) {
      if (SYSTEM_ROLE_CODES.has(role.name) || DEPARTMENT_ROLE_CODES.has(role.name)) system.push(role)
      else custom.push(role)
    }
    return { systemRoles: system, customRoles: custom }
  }, [filtered])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-card shadow-xs">
      <div className="shrink-0 space-y-2 border-b px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Roles · {roles.length}
          </p>
          {canCreate && onCreateRole ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 cursor-pointer gap-1 rounded-md px-2 text-xs"
              onClick={onCreateRole}
            >
              <Plus className="size-3.5" aria-hidden />
              Add Role
            </Button>
          ) : null}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles…"
            className="h-8 rounded-lg pl-8 text-sm"
            aria-label="Search roles"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-1.5" role="listbox" aria-label="Role list">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
          ) : filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              {roles.length === 0 ? "No roles yet." : "No roles match your search."}
            </p>
          ) : (
            <>
              {systemRoles.length > 0 ? (
                <div className="space-y-1">
                  <p className="px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    System Roles
                  </p>
                  {systemRoles.map((role, index) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      selected={selectedId === role.id}
                      index={index}
                      reduceMotion={reduceMotion}
                      userCounts={userCounts}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              ) : null}
              {customRoles.length > 0 ? (
                <div className="space-y-1">
                  <p className="px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Custom Roles
                  </p>
                  {customRoles.map((role, index) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      selected={selectedId === role.id}
                      index={index}
                      reduceMotion={reduceMotion}
                      userCounts={userCounts}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
