"use client"

import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { useUiStore } from "@/stores/app-store"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)

  return (
    <div className="bg-background flex min-h-screen">
      <AppSidebar collapsed={sidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
