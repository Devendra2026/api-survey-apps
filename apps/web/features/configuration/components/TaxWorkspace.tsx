"use client"

import { Button } from "@workspace/ui/components/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable"
import { useAuthStore } from "@/stores/app-store"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useReferenceEntries, useTaxConfig, useTaxConfigMutations, useTaxVersions } from "../hooks/use-configuration"
import { num } from "../lib/formulas"
import type { TaxPreviewResult } from "../lib/types"
import { StickyActionBar } from "./ConfigurationToolbar"
import { PublishDialog, RollbackDialog, VersionHistoryDrawer } from "./PublishDialogs"
import { TaxMatrix } from "./TaxMatrix"
import { CalculationPreview, DemandNoticePreview, FormulaBuilder, FormulaPreview } from "./TaxPreviewPanels"
import { WardNavigator } from "./WardNavigator"

export function TaxWorkspace() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission("settings:manage")
  const canPublish = hasPermission("settings:publish") || hasPermission("settings:manage")

  const [stateId, setStateId] = useState("")
  const [districtId, setDistrictId] = useState("")
  const [ulbId, setUlbId] = useState("")
  const [wardId, setWardId] = useState("")
  const [assessmentYearId, setAssessmentYearId] = useState("")
  const [areaSqFt, setAreaSqFt] = useState(1000)
  const [roadWidthEntryId, setRoadWidthEntryId] = useState("")
  const [constructionEntryId, setConstructionEntryId] = useState("")
  const [preview, setPreview] = useState<TaxPreviewResult | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCells = useRef<
    Map<string, { roadWidthEntryId: string; constructionEntryId: string; annualRatePerSqFt: number }>
  >(new Map())

  const { data: config, isLoading } = useTaxConfig(wardId || undefined, assessmentYearId || undefined)
  const { data: versions = [] } = useTaxVersions(config?.id)
  const { data: roads } = useReferenceEntries("TAX_RATE_ZONE", { limit: 50 })
  const { data: constructions } = useReferenceEntries("CONSTRUCTION_TYPE", { limit: 50 })
  const mutations = useTaxConfigMutations()

  useEffect(() => {
    if (!roadWidthEntryId && roads?.items[0]) setRoadWidthEntryId(roads.items[0].id)
    if (!constructionEntryId && constructions?.items[0]) setConstructionEntryId(constructions.items[0].id)
  }, [roads, constructions, roadWidthEntryId, constructionEntryId])

  const runPreview = useCallback(async () => {
    if (!wardId || !assessmentYearId || !roadWidthEntryId || !constructionEntryId) return
    try {
      const result = await mutations.preview.mutateAsync({
        wardId,
        assessmentYearId,
        areaSqFt,
        roadWidthEntryId,
        constructionEntryId,
      })
      setPreview(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview failed")
    }
  }, [wardId, assessmentYearId, areaSqFt, roadWidthEntryId, constructionEntryId, mutations.preview])

  useEffect(() => {
    void runPreview()
  }, [runPreview])

  const flushCells = useCallback(async () => {
    if (!config || pendingCells.current.size === 0) return
    const cells = Array.from(pendingCells.current.values())
    pendingCells.current.clear()
    try {
      await mutations.upsertCells.mutateAsync({ id: config.id, cells })
      toast.success("Draft autosaved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Autosave failed")
    }
  }, [config, mutations.upsertCells])

  const onCellChange = (cell: { roadWidthEntryId: string; constructionEntryId: string; annualRatePerSqFt: number }) => {
    if (!canManage) return
    pendingCells.current.set(`${cell.roadWidthEntryId}:${cell.constructionEntryId}`, cell)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void flushCells()
    }, 400)
  }

  const params = useMemo(
    () => ({
      propertyTaxPct: num(config?.propertyTaxPct),
      waterTaxPct: num(config?.waterTaxPct),
      drainageTaxPct: num(config?.drainageTaxPct),
      penaltyPct: num(config?.penaltyPct),
      assessablePct: num(config?.assessablePct),
    }),
    [config]
  )

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[560px] flex-col gap-3">
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 rounded-lg border border-border/70">
        <ResizablePanel defaultSize={22} minSize={18}>
          <div className="h-full overflow-auto p-2">
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
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={48} minSize={30}>
          <div className="flex h-full flex-col gap-3 overflow-auto p-3">
            {isLoading && wardId && assessmentYearId ? (
              <p className="text-sm text-muted-foreground">Loading tax matrix…</p>
            ) : !config ? (
              <p className="text-sm text-muted-foreground">
                Select State → District → ULB → Ward and Assessment Year to configure rates.
              </p>
            ) : (
              <>
                <TaxMatrix config={config} onCellChange={onCellChange} disabled={!canManage} />
                <FormulaBuilder
                  {...params}
                  disabled={!canManage}
                  onChange={(patch) => {
                    if (!config) return
                    void mutations.updateParams
                      .mutateAsync({ id: config.id, ...patch })
                      .then(() => toast.success("Parameters saved"))
                      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Save failed"))
                  }}
                />
                <FormulaPreview />
              </>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={30} minSize={22}>
          <div className="flex h-full flex-col gap-3 overflow-auto p-3">
            <CalculationPreview
              areaSqFt={areaSqFt}
              onAreaChange={setAreaSqFt}
              roads={roads?.items ?? []}
              constructions={constructions?.items ?? []}
              roadWidthEntryId={roadWidthEntryId}
              constructionEntryId={constructionEntryId}
              onRoadChange={setRoadWidthEntryId}
              onConstructionChange={setConstructionEntryId}
              result={preview}
            />
            <DemandNoticePreview result={preview} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <StickyActionBar>
        <div className="text-sm text-muted-foreground">
          {config ? `Ward tax config · ${config.status} · v${config.version}` : "No configuration selected"}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={!config}
            onClick={() => setHistoryOpen(true)}
          >
            Version history
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={!canPublish || !versions.length}
            onClick={() => setRollbackOpen(true)}
          >
            Rollback
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!canPublish || !config}
            onClick={() => setPublishOpen(true)}
          >
            Publish
          </Button>
        </div>
      </StickyActionBar>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        saving={mutations.publish.isPending}
        onConfirm={async (values) => {
          if (!config) return
          try {
            await mutations.publish.mutateAsync({ id: config.id, ...values })
            toast.success("Tax configuration published")
            setPublishOpen(false)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Publish failed")
          }
        }}
      />
      <RollbackDialog
        open={rollbackOpen}
        onOpenChange={setRollbackOpen}
        versions={versions}
        saving={mutations.rollback.isPending}
        onConfirm={async (values) => {
          if (!config) return
          try {
            await mutations.rollback.mutateAsync({ id: config.id, ...values })
            toast.success("Rolled back to draft")
            setRollbackOpen(false)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Rollback failed")
          }
        }}
      />
      <VersionHistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} versions={versions} />
    </div>
  )
}
