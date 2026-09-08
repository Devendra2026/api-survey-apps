import {
  Activity,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileUp,
  Gauge,
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  Settings,
  Shield,
  Table2,
  Users,
} from "lucide-react"

import type { LucideIcon } from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  permission?: string
  description?: string
  /** Extra search terms. Not shown in the sidebar. */
  keywords?: string
  children?: NavItem[]
}

export interface FlatNavItem extends NavItem {
  groupTitle?: string
}

/** Flatten nested nav trees for command palette. Groups are not destinations. */
export function flattenNav(items: NavItem[], groupTitle?: string): FlatNavItem[] {
  const result: FlatNavItem[] = []
  for (const item of items) {
    if (item.children?.length) {
      result.push(...flattenNav(item.children, item.title))
    } else {
      result.push(groupTitle ? { ...item, groupTitle } : item)
    }
  }
  return result
}

/** Prefer a matching child so a group href cannot override a leaf label. */
export function findNavTitle(items: NavItem[], href: string): string | undefined {
  for (const item of items) {
    if (item.children?.length) {
      const nested = findNavTitle(item.children, href)
      if (nested) return nested
    }
    if (item.href === href) return item.title
  }
  return undefined
}

/** Disambiguate identical child labels (both groups have Command Center). */
export function navDisplayTitle(item: Pick<NavItem, "title"> & { groupTitle?: string }): string {
  if (item.groupTitle && item.title === "Command Center") {
    return `${item.groupTitle} · ${item.title}`
  }
  return item.title
}

export const appNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    title: "Field Surveys",
    href: "#field-surveys",
    icon: ClipboardList,
    children: [
      {
        title: "Command Center",
        href: "/surveys/command-center",
        icon: Gauge,
        permission: "survey:view",
        description: "Ward-wise field progress and filters",
      },
      {
        title: "Survey Registry",
        href: "/surveys",
        icon: Table2,
        permission: "survey:view",
        description: "Search, filter, and manage surveys",
      },
    ],
  },
  {
    title: "QC Portal",
    href: "#qc-portal",
    icon: ClipboardCheck,
    children: [
      {
        title: "Command Center",
        href: "/qc/command-center",
        icon: Activity,
        permission: "survey:approve",
        description: "Ward-wise QC queues and quick actions",
      },
      {
        title: "QC Registry",
        href: "/qc/registry",
        icon: ListChecks,
        permission: "survey:approve",
        description: "Review, correct, and approve submitted surveys",
        keywords: "QC Review",
      },
    ],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    permission: "report:view",
  },
  {
    title: "Administration",
    href: "/admin",
    icon: Shield,
    children: [
      { title: "Users", href: "/admin/users", icon: Users, permission: "user:view" },
      { title: "Roles", href: "/admin/roles", icon: Shield, permission: "role:assign" },
      {
        title: "Master Data",
        href: "/master-data",
        icon: Database,
        permission: "settings:view",
      },
      {
        title: "Import",
        href: "/import",
        icon: FileUp,
        permission: "survey:create",
      },
      {
        title: "ETL Sync",
        href: "/admin/etl",
        icon: RefreshCw,
        permission: "etl:manage",
        description: "Convex → Postgres / MinIO survey sync",
      },
    ],
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

/** @deprecated Prefer `appNav` — kept for any residual imports */
export const mainNav = appNav.filter((item) => item.title !== "Settings" && item.title !== "Administration")

/** @deprecated Prefer `appNav` */
export const adminNav: NavItem[] = appNav.find((item) => item.title === "Administration")?.children ?? []

export const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  SUBMITTED: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  APPROVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  REJECTED: "bg-destructive/15 text-destructive",
  REOPENED: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  QUEUED: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  RUNNING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  PROCESSING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  COMPLETED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  SUCCEEDED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  FAILED: "bg-destructive/15 text-destructive",
  RETURNED: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
}

export const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REOPENED: "Reopened",
  PENDING: "Pending",
  QUEUED: "Queued",
  RUNNING: "Running",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  RETURNED: "Returned",
}
