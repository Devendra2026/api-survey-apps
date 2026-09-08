"use client"

import { appNav, navDisplayTitle, type NavItem } from "@/lib/navigation"
import { useAuthStore } from "@/stores/app-store"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"

function isRouteActive(pathname: string, href: string): boolean {
  if (!href || href.startsWith("#")) return false
  if (href === "/surveys/new") return pathname === "/surveys/new"
  if (href === "/surveys/command-center") {
    return pathname === "/surveys/command-center" || pathname.startsWith("/surveys/command-center/")
  }
  if (href === "/surveys") {
    return (
      pathname === "/surveys" ||
      (pathname.startsWith("/surveys/") &&
        !pathname.startsWith("/surveys/new") &&
        !pathname.startsWith("/surveys/command-center"))
    )
  }
  if (href === "/qc/command-center") {
    return pathname === "/qc/command-center" || pathname.startsWith("/qc/command-center/")
  }
  if (href === "/qc/registry") {
    return pathname === "/qc/registry" || pathname.startsWith("/qc/registry/") || pathname.startsWith("/qc/review/")
  }
  if (href === "/qc" || href === "/admin") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isGroupActive(pathname: string, item: NavItem): boolean {
  if (item.children?.length) {
    return item.children.some((child) => isRouteActive(pathname, child.href))
  }
  return isRouteActive(pathname, item.href)
}

function NavLink({
  item,
  collapsed,
  nested = false,
  groupTitle,
}: {
  item: NavItem
  collapsed: boolean
  nested?: boolean
  groupTitle?: string
}) {
  const pathname = usePathname()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const active = isRouteActive(pathname, item.href)

  if (item.permission && !hasPermission(item.permission)) return null

  const Icon = item.icon
  const tooltipLabel = groupTitle ? `${groupTitle} · ${item.title}` : navDisplayTitle(item)

  const link = (
    <Link
      href={item.href}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-xl text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        nested ? "px-2.5 py-2" : "px-3 py-2.5",
        collapsed && "justify-center px-2",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      {active ? <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary-foreground/70" /> : null}
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span className="min-w-0 truncate">{item.title}</span> : null}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{tooltipLabel}</TooltipContent>
    </Tooltip>
  )
}

function NavGroup({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const visibleChildren = useMemo(
    () => (item.children ?? []).filter((child) => !child.permission || hasPermission(child.permission)),
    [item.children, hasPermission]
  )
  const groupActive = isGroupActive(pathname, item)
  const [userOpen, setUserOpen] = useState(true)
  const open = groupActive || userOpen

  if (visibleChildren.length === 0) return null

  const panelId = `nav-group-${item.title.toLowerCase().replace(/\s+/g, "-")}`
  const Icon = item.icon

  if (collapsed) {
    return (
      <div
        className="space-y-1 border-t border-slate-100 pt-1 dark:border-slate-800"
        role="group"
        aria-label={item.title}
      >
        {visibleChildren.map((child) => (
          <NavLink key={child.href} item={child} collapsed groupTitle={item.title} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0.5 pt-2">
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          groupActive
            ? "text-slate-600 dark:text-slate-300"
            : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        )}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[0.12em] uppercase">
          {item.title}
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={item.title}
          className="ml-3 space-y-0.5 border-l border-slate-200 py-0.5 pl-1.5 dark:border-slate-800"
        >
          {visibleChildren.map((child) => (
            <NavLink key={child.href} item={child} collapsed={false} nested groupTitle={item.title} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function NavItemRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const hasPermission = useAuthStore((s) => s.hasPermission)

  if (item.children?.length) {
    return <NavGroup item={item} collapsed={collapsed} />
  }

  if (item.permission && !hasPermission(item.permission)) return null

  return <NavLink item={item} collapsed={collapsed} />
}

export function AppSidebar({ collapsed, variant = "desktop" }: { collapsed: boolean; variant?: "desktop" | "drawer" }) {
  const isDrawer = variant === "drawer"

  return (
    <aside
      className={cn(
        "flex h-screen flex-col overflow-y-auto border-r border-slate-100 bg-white text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:shadow-xl",
        isDrawer ? "relative w-full" : cn("fixed top-0 left-0 z-40 hidden md:flex", collapsed ? "w-18" : "w-64")
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center justify-center border-b border-slate-100 dark:border-slate-800",
          collapsed ? "px-2" : "px-3"
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            "relative flex items-center justify-center outline-none",
            collapsed ? "size-10" : "h-12 w-full"
          )}
          aria-label="SDV EDUTECH — Survey Operations"
        >
          <Image
            src="/logo.png"
            alt="SDV EDUTECH"
            width={collapsed ? 40 : 220}
            height={collapsed ? 40 : 64}
            priority
            className={cn("object-contain object-center", collapsed ? "size-10" : "h-12 w-auto max-w-full")}
          />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2.5">
        {appNav.map((item) => (
          <NavItemRow key={item.title} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  )
}
