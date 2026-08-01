"use client"

import { ROLE_LABELS, tenantRoleCode, type TenantRole } from "@/lib/api/types"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

const ROLE_BADGE_CLASS: Record<string, string> = {
  PENDING_APPROVAL:
    "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100",
  SURVEYOR: "border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-100",
  FIELD_SUPERVISOR:
    "border-indigo-200/80 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-100",
  QC_SUPERVISOR:
    "border-cyan-200/80 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-100",
  ADMIN: "border-slate-300/80 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
}

export function RoleBadge({ role, className }: { role: TenantRole | string; className?: string }) {
  const code = typeof role === "string" ? role : tenantRoleCode(role)
  const label = ROLE_LABELS[code] ?? code
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg px-2 py-0.5 text-[11px] font-medium tracking-wide transition-colors",
        ROLE_BADGE_CLASS[code],
        className
      )}
    >
      {label}
    </Badge>
  )
}

export function StatusBadge({ isActive, className }: { isActive: boolean; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg px-2 py-0.5 text-[11px] font-medium tracking-wide",
        isActive
          ? "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100"
          : "border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100",
        className
      )}
    >
      <span
        className={cn("mr-1.5 inline-block size-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-rose-500")}
        aria-hidden
      />
      {isActive ? "Active" : "Disabled"}
    </Badge>
  )
}

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/15",
        className
      )}
      aria-hidden
    >
      {initials || "?"}
    </div>
  )
}

export function primaryAssignment(roles?: TenantRole[]): TenantRole | undefined {
  return roles?.find((r) => r.isActive)
}

/** All active geo-scoped assignments (multi-allotment field roles). */
export function activeAssignments(roles?: TenantRole[]): TenantRole[] {
  return roles?.filter((r) => r.isActive) ?? []
}

export function assignmentGeoLabels(role?: TenantRole) {
  if (!role) {
    return { state: "—", district: "—", ulb: "—", ward: "—" }
  }
  return {
    state: role.state?.name ?? "—",
    district: role.district?.name ?? "—",
    ulb: role.ulb?.name ?? "—",
    ward: role.ward
      ? `${role.ward.wardNumber}${role.ward.wardName ? ` · ${role.ward.wardName}` : ""}`
      : role.ulbId
        ? "Unrestricted Access"
        : "—",
  }
}

/** Distinct ULB names from active allotments. */
export function assignmentLocationChips(roles?: TenantRole[]): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const r of activeAssignments(roles)) {
    if (!r.ulbId) continue
    const name = r.ulb?.name ?? r.ulbId
    if (seen.has(r.ulbId)) continue
    seen.add(r.ulbId)
    names.push(name)
  }
  return names
}

/** Ward / unrestricted labels from active allotments. */
export function assignmentWardChips(roles?: TenantRole[]): string[] {
  const byUlb = new Map<string, { allWards: boolean; wards: string[] }>()
  for (const r of activeAssignments(roles)) {
    if (!r.ulbId) continue
    const entry = byUlb.get(r.ulbId) ?? { allWards: false, wards: [] }
    if (!r.wardId) {
      entry.allWards = true
      entry.wards = []
    } else if (!entry.allWards && r.ward) {
      const label = r.ward.wardName ? `${r.ward.wardNumber} · ${r.ward.wardName}` : r.ward.wardNumber
      if (!entry.wards.includes(label)) entry.wards.push(label)
    }
    byUlb.set(r.ulbId, entry)
  }
  const chips: string[] = []
  for (const entry of byUlb.values()) {
    if (entry.allWards) chips.push("Unrestricted Access")
    else chips.push(...entry.wards)
  }
  return chips
}

/** Compact ward labels for directory: first 3 + +N. */
export function assignmentWardSummary(roles?: TenantRole[], maxVisible = 3): string {
  const labels = assignmentWardChips(roles)
  if (!labels.length) return "—"
  if (labels.length <= maxVisible) return labels.join(", ")
  return `${labels.slice(0, maxVisible).join(", ")} +${labels.length - maxVisible}`
}

export function GeoChip({
  label,
  onClick,
  tone = "default",
}: {
  label: string
  onClick?: () => void
  tone?: "default" | "unrestricted"
}) {
  const className = cn(
    "inline-flex max-w-[10rem] truncate rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-200",
    tone === "unrestricted"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      : "border-border bg-muted/50 text-foreground",
    onClick && "cursor-pointer hover:border-primary/40 hover:bg-primary/5"
  )
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} title={label}>
        {label}
      </button>
    )
  }
  return (
    <span className={className} title={label}>
      {label}
    </span>
  )
}
