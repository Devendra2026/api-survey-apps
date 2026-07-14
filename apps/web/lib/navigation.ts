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
}

export const mainNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
    description: "Executive overview and system health",
  },
  {
    title: "Field Survey",
    href: "/surveys/new",
    icon: ClipboardList,
    permission: "survey:create",
    description: "Create and capture property surveys",
  },
  {
    title: "Survey Registry",
    href: "/surveys",
    icon: ClipboardList,
    permission: "survey:view",
    description: "Search, filter, and manage surveys",
  },
  {
    title: "QC Portal",
    href: "/qc",
    icon: ClipboardCheck,
    permission: "survey:approve",
    description: "Review, approve, and return surveys",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    permission: "report:view",
    description: "Government and operational exports",
  },
  {
    title: "Import",
    href: "/import",
    icon: FileUp,
    permission: "survey:create",
    description: "Bulk Excel and CSV import jobs",
  },
  {
    title: "Master Data",
    href: "/master-data",
    icon: Database,
    permission: "role:assign",
    description: "Reference data and geography",
  },
]

export const adminNav: NavItem[] = [
  { title: "Users", href: "/admin/users", icon: Users, permission: "user:view" },
  { title: "Roles", href: "/admin/roles", icon: Shield, permission: "role:assign" },
  { title: "Geography", href: "/admin/geography", icon: MapPin, permission: "role:assign" },
  { title: "Settings", href: "/admin/settings", icon: Settings },
]

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
