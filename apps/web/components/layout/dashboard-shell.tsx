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
      <div className="min-h-screen bg-background text-foreground">
        <AppSidebar collapsed={sidebarCollapsed} />
        <AppHeader />
        <main
          className={cn(
            "min-h-screen overflow-y-auto bg-[radial-gradient(ellipse_at_top,_oklch(0.97_0.02_275)_0%,_transparent_55%)] p-4 pt-20 pb-24 md:p-8 md:pt-24 md:pb-8 dark:bg-[radial-gradient(ellipse_at_top,_oklch(0.22_0.04_275)_0%,_transparent_50%)]",
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
