"use client"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { CommandPalette } from "@/components/layout/command-palette"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { useUiStore } from "@/stores/app-store"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar collapsed={sidebarCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6">{children}</main>
          <MobileBottomNav />
        </div>
        <CommandPalette />
      </div>
    </TooltipProvider>
  )
}
