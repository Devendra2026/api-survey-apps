"use client"

import { useAuthStore } from "@/stores/app-store"
import { cn } from "@workspace/ui/lib/utils"
import { BarChart3, ClipboardList, LayoutDashboard, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const items = [
  { title: "Home", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { title: "Surveys", href: "/surveys", icon: ClipboardList, permission: "survey:view" },
  { title: "Reports", href: "/reports", icon: BarChart3, permission: "report:view" },
  { title: "More", href: "/admin/settings", icon: MoreHorizontal },
] as const

export function MobileBottomNav() {
  const pathname = usePathname()
  const hasPermission = useAuthStore((s) => s.hasPermission)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
      aria-label="Mobile navigation"
    >
      <ul className="grid grid-cols-4 gap-1 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          if ("permission" in item && item.permission && !hasPermission(item.permission)) {
            return <li key={item.href} />
          }
          const Icon = item.icon
          const active =
            pathname === item.href ||
            (item.href !== "/admin/settings" && pathname.startsWith(`${item.href}/`)) ||
            (item.href === "/admin/settings" && pathname.startsWith("/admin"))

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.title}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
