"use client"

import { adminNav, mainNav, type NavItem } from "@/lib/navigation"
import { SIDEBAR_WIDTH, useAuthStore, useUiStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { motion } from "framer-motion"
import { GripVertical } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useRef } from "react"

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const active =
    pathname === item.href ||
    (item.href !== "/surveys/new" && pathname.startsWith(`${item.href}/`)) ||
    (item.href === "/surveys/new" && pathname === "/surveys/new")

  if (item.permission && !hasPermission(item.permission)) return null

  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-2",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      {active ? <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" /> : null}
      <Icon className="size-4 shrink-0" />
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate">{item.title}</span>
          {item.description ? (
            <span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">
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

function NavSection({ label, items, collapsed }: { label: string; items: NavItem[]; collapsed: boolean }) {
  return (
    <div className="space-y-1">
      {!collapsed ? (
        <p className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </p>
      ) : null}
      {items.map((item) => (
        <NavLink key={item.href} item={item} collapsed={collapsed} />
      ))}
    </div>
  )
}

export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  const sidebarWidth = useUiStore((s) => s.sidebarWidth)
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const dragging = useRef(false)

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      dragging.current = true
      const startX = event.clientX
      const startWidth = collapsed ? SIDEBAR_WIDTH.collapsed : sidebarWidth

      const onMove = (moveEvent: PointerEvent) => {
        if (!dragging.current) return
        const next = startWidth + (moveEvent.clientX - startX)
        if (next <= SIDEBAR_WIDTH.min + 24) {
          setSidebarCollapsed(true)
          setSidebarWidth(SIDEBAR_WIDTH.collapsed)
          return
        }
        setSidebarCollapsed(false)
        setSidebarWidth(next)
      }

      const onUp = () => {
        dragging.current = false
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [collapsed, setSidebarCollapsed, setSidebarWidth, sidebarWidth]
  )

  const width = collapsed ? SIDEBAR_WIDTH.collapsed : sidebarWidth

  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={{ duration: dragging.current ? 0 : 0.18, ease: "easeOut" }}
      className={cn(
        "relative hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
      )}
    >
      <div className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center px-2")}>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">Survey Portal</p>
            <p className="truncate text-[11px] text-muted-foreground">Municipal Property Tax</p>
          </div>
        ) : (
          <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            SP
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-2.5">
        <NavSection label="Operations" items={mainNav} collapsed={collapsed} />
        <NavSection label="Administration" items={adminNav} collapsed={collapsed} />
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start")}
          asChild
        >
          <Link href="/admin/settings">{collapsed ? "?" : "Help & settings"}</Link>
        </Button>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={onPointerDown}
        className="absolute inset-y-0 right-0 z-20 flex w-1.5 cursor-col-resize items-center justify-center hover:bg-primary/20"
      >
        <GripVertical className="size-3 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100" />
      </div>
    </motion.aside>
  )
}
