"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { ConfigurationWorkspace } from "@/features/configuration/components/ConfigurationWorkspace"
import { FormulaBuilder, FormulaPreview } from "@/features/configuration/components/TaxPreviewPanels"
import { WardNavigator } from "@/features/configuration/components/WardNavigator"
import { useTaxConfig, useTaxConfigMutations } from "@/features/configuration/hooks/use-configuration"
import { num } from "@/features/configuration/lib/formulas"
import { useAuthStore } from "@/stores/app-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { useState } from "react"
import { toast } from "sonner"

export default function DemandRulesPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")
  const canManage = hasPermission("settings:manage") || hasPermission("role:assign")

  const [stateId, setStateId] = useState("")
  const [districtId, setDistrictId] = useState("")
  const [ulbId, setUlbId] = useState("")
  const [wardId, setWardId] = useState("")
  const [assessmentYearId, setAssessmentYearId] = useState("")
  const { data: config } = useTaxConfig(wardId || undefined, assessmentYearId || undefined)
  const mutations = useTaxConfigMutations()

  if (!canView) {
    return <EmptyState title="Demand Rules unavailable" description="Requires settings:view." />
  }

  return (
    <ConfigurationWorkspace
      title="Demand Rules"
      description="Penalty, water, drainage, and assessable percentages for demand notice generation (Ward × AY)."
    >
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <WardNavigator
          stateId={stateId}
          districtId={districtId}
          ulbId={ulbId}
          wardId={wardId}
          assessmentYearId={assessmentYearId}
          onStateChange={setStateId}
          onDistrictChange={setDistrictId}
          onUlbChange={setUlbId}
          onWardChange={setWardId}
          onAssessmentYearChange={setAssessmentYearId}
          publishStatus={config?.status}
        />
        <div className="space-y-4">
          {!config ? (
            <Card className="border-border/70 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Select a ward and assessment year</CardTitle>
                <CardDescription>
                  Demand rule parameters are stored on the ward tax configuration document.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <FormulaBuilder
                propertyTaxPct={num(config.propertyTaxPct)}
                waterTaxPct={num(config.waterTaxPct)}
                drainageTaxPct={num(config.drainageTaxPct)}
                penaltyPct={num(config.penaltyPct)}
                assessablePct={num(config.assessablePct)}
                disabled={!canManage}
                onChange={(patch) => {
                  void mutations.updateParams
                    .mutateAsync({ id: config.id, ...patch })
                    .then(() => toast.success("Demand rules saved"))
                    .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Save failed"))
                }}
              />
              <FormulaPreview />
              <Card className="border-border/70 shadow-none">
                <CardHeader>
                  <CardTitle className="text-sm">Notice flags</CardTitle>
                  <CardDescription>
                    Demand notices use published tax parameters for the selected Ward × Assessment Year. Publish from
                    Tax Engine when ready.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Status: <span className="font-medium text-foreground">{config.status}</span> · Version{" "}
                  {config.version}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </ConfigurationWorkspace>
  )
}
