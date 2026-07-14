"use client"

import { adminNav, mainNav, type NavItem } from "@/lib/navigation"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

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
      {!collapsed ? <span className="truncate">{item.title}</span> : null}
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
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
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
        <NavSection label="Main" items={mainNav} collapsed={collapsed} />
        <NavSection label="Administration" items={adminNav} collapsed={collapsed} />
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full", collapsed ? "justify-center px-0" : "justify-start")}
          asChild
        >
          <Link href="/">{collapsed ? "?" : "Help & support"}</Link>
        </Button>
      </div>
    </motion.aside>
  )
}
