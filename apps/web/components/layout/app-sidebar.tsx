"use client"

import { appNav, type NavItem } from "@/lib/navigation"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { Building2, ChevronDown } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"

function isRouteActive(pathname: string, href: string): boolean {
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
  if (href === "/qc/registry") {
    return pathname === "/qc/registry" || pathname.startsWith("/qc/registry/") || pathname.startsWith("/qc/review/")
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isGroupActive(pathname: string, item: NavItem): boolean {
  if (item.children?.length) {
    return item.children.some((child) => isRouteActive(pathname, child.href))
  }
  return isRouteActive(pathname, item.href)
}

function NavLink({ item, collapsed, nested = false }: { item: NavItem; collapsed: boolean; nested?: boolean }) {
  const pathname = usePathname()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const active = isRouteActive(pathname, item.href)

  if (item.permission && !hasPermission(item.permission)) return null

  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200",
        nested ? "px-3 py-1.5 pl-9" : "px-3 py-2.5",
        collapsed && "justify-center px-2",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      {active ? <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-primary-foreground/70" /> : null}
      <Icon className="size-4 shrink-0" />
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate">{item.title}</span>
          {!nested && item.description ? (
            <span
              className={cn(
                "mt-0.5 block truncate text-[10px] font-normal",
                active ? "text-primary-foreground/75" : "text-muted-foreground"
              )}
            >
              {item.description}
            </span>
          ) : null}
        </span>
      ) : null}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.title}</TooltipContent>
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
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const [prevGroupActive, setPrevGroupActive] = useState(groupActive)

  if (prevGroupActive !== groupActive) {
    setPrevGroupActive(groupActive)
    if (groupActive) setUserOpen(null)
  }

  const open = userOpen ?? groupActive

  if (visibleChildren.length === 0) return null

  const Icon = item.icon

  if (collapsed) {
    return (
      <div className="space-y-1">
        {visibleChildren.map((child) => (
          <NavLink key={child.href} item={child} collapsed />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setUserOpen(!(userOpen ?? groupActive))}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300",
          groupActive
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
        )}
        aria-expanded={open}
      >
        <Icon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-slate-500 transition-transform dark:text-slate-400",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="space-y-0.5">
          {visibleChildren.map((child) => (
            <NavLink key={child.href} item={child} collapsed={false} nested />
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
          "flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-100 px-4 dark:border-slate-800",
          collapsed && "justify-center px-2"
        )}
      >
        {!collapsed ? (
          <>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm dark:bg-indigo-500">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                SDV EDUTECH
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">Survey Operations</p>
            </div>
          </>
        ) : (
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white dark:bg-indigo-500">
            <Building2 className="size-4" />
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2.5">
        {appNav.map((item) => (
          <NavItemRow key={item.title} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-100 p-2.5 dark:border-slate-800">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50",
            collapsed ? "justify-center px-0" : "justify-start"
          )}
          asChild
        >
          <Link href="/admin/settings">{collapsed ? "?" : "Help & settings"}</Link>
        </Button>
      </div>
    </aside>
  )
}
