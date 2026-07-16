import {
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileUp,
  LayoutDashboard,
  MapPin,
  Settings,
  Shield,
  Users,
} from "lucide-react"

import type { LucideIcon } from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  permission?: string
  description?: string
  children?: NavItem[]
}

/** Flatten nested nav trees for command palette / breadcrumbs. */
export function flattenNav(items: NavItem[]): NavItem[] {
  const result: NavItem[] = []
  for (const item of items) {
    if (item.children?.length) {
      result.push(...flattenNav(item.children))
    } else {
      result.push(item)
    }
  }
  return result
}

export function findNavTitle(items: NavItem[], href: string): string | undefined {
  for (const item of items) {
    if (item.href === href) return item.title
    if (item.children?.length) {
      const nested = findNavTitle(item.children, href)
      if (nested) return nested
    }
  }
  return undefined
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
    href: "/surveys",
    icon: ClipboardList,
    children: [
      {
        title: "Command Center",
        href: "/surveys/command-center",
        icon: ClipboardList,
        permission: "survey:view",
        description: "Ward-wise field progress and filters",
      },
      {
        title: "Survey Registry",
        href: "/surveys",
        icon: ClipboardList,
        permission: "survey:view",
        description: "Search, filter, and manage surveys",
      },
    ],
  },
  {
    title: "QC Portal",
    href: "/qc/command-center",
    icon: ClipboardCheck,
    children: [
      {
        title: "QC Command Center",
        href: "/qc/command-center",
        icon: ClipboardCheck,
        permission: "survey:approve",
        description: "Ward-wise QC pipeline and smart filters",
      },
      {
        title: "QC Review Registry",
        href: "/qc/registry",
        icon: ClipboardCheck,
        permission: "survey:approve",
        description: "Search and open surveys for QC verification",
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
      { title: "Geography", href: "/admin/geography", icon: MapPin, permission: "role:assign" },
      {
        title: "Import",
        href: "/import",
        icon: FileUp,
        permission: "survey:create",
      },
      {
        title: "Master Data",
        href: "/master-data",
        icon: Database,
        permission: "role:assign",
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
  PROCESSING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
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
  PROCESSING: "Processing",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  RETURNED: "Returned",
}

export { Building2 }
