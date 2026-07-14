"use client"

import { appNav, findNavTitle } from "@/lib/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment } from "react"

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  surveys: "Survey Registry",
  "command-center": "Command Center",
  new: "New Survey",
  qc: "QC Portal",
  reports: "Reports",
  import: "Import",
  "master-data": "Master Data",
  admin: "Administration",
  users: "Users",
  roles: "Roles",
  geography: "Geography",
  settings: "Settings",
}

export function AppBreadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`
    const navTitle = findNavTitle(appNav, href)
    const isLast = index === segments.length - 1
    const label = navTitle ?? labelMap[segment] ?? (segment.length > 12 ? `${segment.slice(0, 8)}…` : segment)

    return { href, label, isLast }
  })

  return (
    <Breadcrumb className="hidden sm:block">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <Fragment key={crumb.href}>
            {i > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
