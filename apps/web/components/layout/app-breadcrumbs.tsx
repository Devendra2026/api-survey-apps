"use client"

import { adminNav, mainNav } from "@/lib/navigation"
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
  surveys: "Surveys",
  new: "New survey",
  reports: "Reports",
  import: "Import",
  admin: "Admin",
  users: "Users",
  roles: "Roles",
  geography: "Geography",
  settings: "Settings",
}

export function AppBreadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  const allNav = [...mainNav, ...adminNav]
  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`
    const navMatch = allNav.find((n) => n.href === href)
    const isLast = index === segments.length - 1
    const label = navMatch?.title ?? labelMap[segment] ?? (segment.length > 12 ? `${segment.slice(0, 8)}…` : segment)

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
