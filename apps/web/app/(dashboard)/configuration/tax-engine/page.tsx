"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { ConfigurationWorkspace } from "@/features/configuration/components/ConfigurationWorkspace"
import { TaxWorkspace } from "@/features/configuration/components/TaxWorkspace"
import { useAuthStore } from "@/stores/app-store"

export default function TaxEnginePage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")

  if (!canView) {
    return <EmptyState title="Tax Engine unavailable" description="Requires settings:view." />
  }

  return (
    <ConfigurationWorkspace
      title="Tax Rate Engine"
      description="Ward × Assessment Year rate matrix, parameterized formulas, draft autosave, and publish."
    >
      <TaxWorkspace />
    </ConfigurationWorkspace>
  )
}
