"use client"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { CommandPalette } from "@/components/layout/command-palette"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { useUiStore } from "@/stores/app-store"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <AppSidebar collapsed={sidebarCollapsed} />
        <AppHeader />
        <main
          className={cn(
            "min-h-screen overflow-y-auto bg-background p-4 pt-20 pb-24 md:p-8 md:pt-24 md:pb-8 dark:bg-slate-950",
            sidebarCollapsed ? "md:ml-18" : "md:ml-64"
          )}
        >
          {children}
        </main>
        <MobileBottomNav />
        <CommandPalette />
      </div>
    </TooltipProvider>
  )
}
