"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { NotificationsPopover } from "@/components/layout/notifications-popover"
import { TenantScopeBadge } from "@/components/layout/tenant-scope-badge"
import { tenantRoleDisplayName } from "@/lib/api/types"
import { useAuthStore, useUiStore } from "@/stores/app-store"
import { UserButton } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { Sheet, SheetContent, SheetTrigger } from "@workspace/ui/components/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { Menu, Moon, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const isDark = (resolvedTheme ?? theme) === "dark"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 cursor-pointer rounded-lg text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          <Sun className="size-4 scale-100 rotate-0 transition-all duration-200 dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all duration-200 dark:scale-100 dark:rotate-0" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{isDark ? "Light mode" : "Dark mode"}</TooltipContent>
    </Tooltip>
  )
}

function UserProfileChip() {
  const profile = useAuthStore((s) => s.profile)
  const activeRoles = profile?.tenantRoles?.filter((r) => r.isActive) ?? []
  const primaryRole = activeRoles[0]
  const roleLabel = primaryRole ? tenantRoleDisplayName(primaryRole) : null
  const displayName = profile?.fullName?.trim() || "Account"
  const email = profile?.email

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 py-1 pr-1.5 pl-2.5 transition-colors duration-200 dark:border-slate-800 dark:bg-slate-800/60">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="max-w-36 truncate text-sm leading-tight font-medium text-slate-900 dark:text-slate-50">
          {displayName}
        </p>
        <div className="mt-0.5 flex items-center justify-end gap-1.5">
          {roleLabel ? (
            <Badge
              variant="secondary"
              className="h-4 max-w-28 truncate rounded px-1.5 text-[10px] font-medium tracking-wide text-slate-600 dark:text-slate-300"
            >
              {roleLabel}
              {activeRoles.length > 1 ? ` +${activeRoles.length - 1}` : ""}
            </Badge>
          ) : (
            <p className="max-w-36 truncate text-[11px] text-slate-500 dark:text-slate-400">{email ?? "Signed in"}</p>
          )}
        </div>
      </div>
      <UserButton
        appearance={{
          elements: {
            rootBox: "flex items-center",
            userButtonTrigger:
              "focus:shadow-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 rounded-full",
            userButtonAvatarBox: "size-8",
            userButtonPopoverCard: "shadow-lg border border-slate-100 dark:border-slate-800",
          },
        }}
      />
    </div>
  )
}

export function AppHeader() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setCommandOpen = useUiStore((s) => s.setCommandOpen)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)

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
          className="hidden size-9 cursor-pointer rounded-lg md:inline-flex"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="size-4" />
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 cursor-pointer rounded-lg md:hidden"
              aria-label="Open menu"
            >
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
          className="relative hidden h-9 max-w-md flex-1 cursor-pointer justify-start gap-2 rounded-lg border-slate-100 px-3 font-normal text-slate-500 transition-colors duration-200 md:inline-flex dark:border-slate-800 dark:text-slate-400"
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
          className="size-9 cursor-pointer rounded-lg md:hidden"
          onClick={() => setCommandOpen(true)}
          aria-label="Open search"
        >
          <Search className="size-4" />
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <TenantScopeBadge />

          <div className="flex items-center gap-0.5 rounded-xl border border-slate-100 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <NotificationsPopover />
            <ThemeToggle />
          </div>

          <Separator orientation="vertical" className="hidden h-8 sm:block" />

          <UserProfileChip />
        </div>
      </div>
    </header>
  )
}
