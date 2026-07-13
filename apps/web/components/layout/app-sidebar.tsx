"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { useAuthStore } from "@/stores/app-store"
import { adminNav, mainNav, type NavItem } from "@/lib/navigation"

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

  if (item.permission && !hasPermission(item.permission)) return null

  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{item.title}</span>
    </Link>
  )
}

export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground border-sidebar-border hidden h-full shrink-0 flex-col border-r transition-all duration-200 md:flex",
        collapsed ? "w-18" : "w-64"
      )}
    >
      <div className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center px-2")}>
        {!collapsed ? (
          <div>
            <p className="text-sm font-semibold">Survey Portal</p>
            <p className="text-muted-foreground text-xs">Municipal Property Tax</p>
          </div>
        ) : (
          <span className="text-sm font-bold">SP</span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-3">
        <div className="space-y-1">
          {!collapsed ? (
            <p className="text-muted-foreground px-3 text-xs font-semibold uppercase tracking-wide">
              Main
            </p>
          ) : null}
          {mainNav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        <div className="space-y-1">
          {!collapsed ? (
            <p className="text-muted-foreground px-3 text-xs font-semibold uppercase tracking-wide">
              Administration
            </p>
          ) : null}
          {adminNav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </nav>

      <div className="border-sidebar-border border-t p-3">
        <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
          <Link href="/">Help</Link>
        </Button>
      </div>
    </aside>
  )
}
