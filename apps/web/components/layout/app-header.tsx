"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { NotificationsPopover } from "@/components/layout/notifications-popover"
import { TenantScopeBadge } from "@/components/layout/tenant-scope-badge"
import { useUiStore } from "@/stores/app-store"
import { UserButton } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetTrigger } from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"
import { Menu, Moon, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function AppHeader() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setCommandOpen = useUiStore((s) => s.setCommandOpen)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const isDark = (resolvedTheme ?? theme) === "dark"

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-50 h-16 border-b border-slate-100 bg-white/90 text-slate-900 shadow-sm backdrop-blur supports-backdrop-filter:bg-white/70",
        "dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-50 dark:shadow-xl dark:supports-backdrop-filter:bg-slate-900/70",
        "left-0 md:left-64",
        sidebarCollapsed && "md:left-18"
      )}
    >
      <div className="flex h-16 items-center gap-2 px-3 md:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="hidden cursor-pointer md:inline-flex"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="size-4" />
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="cursor-pointer md:hidden" aria-label="Open menu">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-64 border-slate-100 bg-white p-0 dark:border-slate-800 dark:bg-slate-900"
          >
            <AppSidebar collapsed={false} variant="drawer" />
          </SheetContent>
        </Sheet>

        <Button
          variant="outline"
          className="relative hidden h-9 max-w-md flex-1 cursor-pointer justify-start gap-2 border-slate-100 px-3 font-normal text-slate-500 md:inline-flex dark:border-slate-800 dark:text-slate-400"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-3.5" />
          <span className="truncate">Search surveys, parcels, wards...</span>
          <kbd className="pointer-events-none absolute top-1.5 right-1.5 hidden h-5 items-center gap-0.5 rounded border border-slate-100 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500 select-none sm:flex dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            ⌘K
          </kbd>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="cursor-pointer md:hidden"
          onClick={() => setCommandOpen(true)}
          aria-label="Open search"
        >
          <Search className="size-4" />
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          <TenantScopeBadge />
          <NotificationsPopover />

          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          </Button>

          <div className="hidden text-right sm:block">
            <p className="max-w-40 truncate text-sm leading-tight font-medium text-slate-900 dark:text-slate-50">
              Tarun Sikarwar
            </p>
            <p className="max-w-40 truncate text-[11px] text-slate-500 dark:text-slate-400">Operations lead</p>
          </div>
          <UserButton />
        </div>
      </div>
    </header>
  )
}
