"use client"

import { AppBreadcrumbs } from "@/components/layout/app-breadcrumbs"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { NotificationsPopover } from "@/components/layout/notifications-popover"
import { TenantScopeBadge } from "@/components/layout/tenant-scope-badge"
import { useAuthStore, useUiStore } from "@/stores/app-store"
import { UserButton } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@workspace/ui/components/sheet"
import { Menu, Monitor, Moon, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function AppHeader() {
  const { setTheme } = useTheme()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const setCommandOpen = useUiStore((s) => s.setCommandOpen)
  const profile = useAuthStore((s) => s.profile)

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex h-14 items-center gap-2 px-3 md:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="size-4" />
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <AppSidebar collapsed={false} />
          </SheetContent>
        </Sheet>

        <Button
          variant="outline"
          className="relative hidden h-8 max-w-sm flex-1 justify-start gap-2 px-3 font-normal text-muted-foreground md:inline-flex"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-3.5" />
          <span className="truncate">Search surveys, pages…</span>
          <kbd className="pointer-events-none absolute top-1.5 right-1.5 hidden h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium select-none sm:flex">
            ⌘K
          </kbd>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setCommandOpen(true)}
          aria-label="Open search"
        >
          <Search className="size-4" />
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          <TenantScopeBadge />
          <NotificationsPopover />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Theme">
                <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="size-4" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="size-4" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="size-4" /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden text-right sm:block">
            <p className="max-w-35 truncate text-sm leading-tight font-medium">{profile?.fullName ?? "User"}</p>
            <p className="max-w-35 truncate text-[11px] text-muted-foreground">{profile?.email}</p>
          </div>
          <UserButton />
        </div>
      </div>

      <div className="hidden border-t border-border/60 px-4 py-1.5 sm:block">
        <AppBreadcrumbs />
      </div>
    </header>
  )
}
