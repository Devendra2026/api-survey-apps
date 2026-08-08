"use client"

import { PublishDialog, RollbackDialog, VersionHistoryDrawer } from "@/features/configuration/components/PublishDialogs"
import {
  useGeographyTree,
  useReferenceEntries,
  useTaxConfig,
  useTaxConfigMutations,
  useTaxVersions,
} from "@/features/configuration/hooks/use-configuration"
import { useTaxConfigPreview } from "@/features/configuration/hooks/use-tax-config-preview"
import { num } from "@/features/configuration/lib/formulas"
import type { TaxConfig } from "@/features/configuration/lib/types"
import { flattenDistricts } from "@/features/master-data/lib/geo-stats"
import { TaxRatesBanner } from "@/features/master-data/tax/tax-rates-banner"
import { TaxScopeSelectors } from "@/features/master-data/tax/tax-scope-selectors"
import { UlbRatesToolbar } from "@/features/master-data/tax/ulb-rates-toolbar"
import { WardRateEditor } from "@/features/master-data/tax/ward-rate-editor"
import { WardRatesSidebar } from "@/features/master-data/tax/ward-rates-sidebar"
import { useWards } from "@/hooks/use-api"
import { apiGet } from "@/lib/api/client"
import { useAuthStore } from "@/stores/app-store"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

type CellPayload = {
  roadWidthEntryId: string
  constructionEntryId: string
  annualRatePerSqFt: number
}

function cellsFromConfig(config: TaxConfig): CellPayload[] {
  return config.cells.map((c) => ({
    roadWidthEntryId: c.roadWidthEntryId,
    constructionEntryId: c.constructionEntryId,
    annualRatePerSqFt: num(c.annualRatePerSqFt),
  }))
}

function zeroCells(config: TaxConfig): CellPayload[] {
  return config.cells.map((c) => ({
    roadWidthEntryId: c.roadWidthEntryId,
    constructionEntryId: c.constructionEntryId,
    annualRatePerSqFt: 0,
  }))
}

export function TaxRatesPanel() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission("settings:manage")
  const canPublish = hasPermission("settings:publish") || hasPermission("settings:manage")

  const { data: tree = [] } = useGeographyTree()
  const districts = useMemo(() => flattenDistricts(tree), [tree])

  const [districtId, setDistrictId] = useState("")
  const [ulbId, setUlbId] = useState("")
  const [wardId, setWardId] = useState("")
  const [assessmentYearId, setAssessmentYearId] = useState("")
  const [wardSearch, setWardSearch] = useState("")
  const [areaSqFt, setAreaSqFt] = useState(394)
  const [roadWidthEntryId, setRoadWidthEntryId] = useState("")
  const [constructionEntryId, setConstructionEntryId] = useState("")
  const [publishOpen, setPublishOpen] = useState(false)
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCells = useRef<Map<string, CellPayload>>(new Map())

  const resolvedDistrictId = districtId || districts[0]?.id || ""
  const selectedDistrict = districts.find((d) => d.id === resolvedDistrictId)
  const selectedUlb = selectedDistrict?.ulbs.find((u) => u.id === ulbId)
  const { data: wardsPage } = useWards(ulbId || undefined)
  const wards = useMemo(() => wardsPage?.items ?? [], [wardsPage])
  const resolvedWardId = wardId || wards[0]?.id || ""

  const { data: years } = useReferenceEntries("ASSESSMENT_YEAR", { limit: 50 })
  const { data: roads } = useReferenceEntries("TAX_RATE_ZONE", { limit: 50 })
  const { data: constructions } = useReferenceEntries("CONSTRUCTION_TYPE", { limit: 50 })

  const resolvedYearId = assessmentYearId || years?.items[0]?.id || ""
  const resolvedRoadId = roadWidthEntryId || roads?.items[0]?.id || ""
  const resolvedConstructionId = constructionEntryId || constructions?.items[0]?.id || ""

  const { data: config, isLoading } = useTaxConfig(resolvedWardId || undefined, resolvedYearId || undefined)
  const { data: versions = [] } = useTaxVersions(config?.id)
  const mutations = useTaxConfigMutations()
  const { preview } = useTaxConfigPreview({
    wardId: resolvedWardId || undefined,
    assessmentYearId: resolvedYearId || undefined,
    areaSqFt,
    roadWidthEntryId: resolvedRoadId || undefined,
    constructionEntryId: resolvedConstructionId || undefined,
  })

  const filteredWards = useMemo(() => {
    const q = wardSearch.trim().toLowerCase()
    if (!q) return wards
    return wards.filter((w) => w.wardName.toLowerCase().includes(q) || String(w.wardNumber).toLowerCase().includes(q))
  }, [wards, wardSearch])

  const selectedWard = wards.find((w) => w.id === resolvedWardId)

  // Clear pending edits when switching wards
  useEffect(() => {
    pendingCells.current.clear()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dirty flag on ward change
    setIsDirty(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [resolvedWardId])

  const flushCells = useCallback(
    async (opts?: { allowEmptyToast?: boolean }) => {
      if (!config || pendingCells.current.size === 0) {
        if (opts?.allowEmptyToast) toast.message("No unsaved cell edits for this ward")
        return
      }
      const cells = Array.from(pendingCells.current.values())
      pendingCells.current.clear()
      setIsDirty(false)
      try {
        await mutations.upsertCells.mutateAsync({ id: config.id, cells })
        setSavedFlash(true)
        window.setTimeout(() => setSavedFlash(false), 2000)
        toast.success("Ward draft saved")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Save failed")
      }
    },
    [config, mutations.upsertCells]
  )

  const onCellChange = (cell: CellPayload) => {
    if (!canManage) return
    pendingCells.current.set(`${cell.roadWidthEntryId}:${cell.constructionEntryId}`, cell)
    setIsDirty(true)
    setSavedFlash(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void flushCells()
    }, 400)
  }

  const onCopyToAll = async () => {
    if (!config || !canManage || !resolvedYearId || !ulbId) return
    if (!window.confirm("Copy this ward’s rates to all other wards in this ULB?")) return
    setBusy(true)
    try {
      const result = await mutations.bulkApply.mutateAsync({
        ulbId,
        assessmentYearId: resolvedYearId,
        mode: "copy",
        sourceWardId: resolvedWardId,
        cells: cellsFromConfig(config),
      })
      toast.success(`Copied rates to ${result.updated} ward(s)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy failed")
    } finally {
      setBusy(false)
    }
  }

  const onUlbDefault = async () => {
    if (!config || !canManage || !resolvedYearId || !ulbId) return
    setBusy(true)
    try {
      const qs = new URLSearchParams({
        ulbId,
        assessmentYearId: resolvedYearId,
        excludeWardId: resolvedWardId,
      })
      const source = await apiGet<TaxConfig | null>(`/tax-configs/first-with-rates?${qs}`)
      if (!source) {
        toast.message("No other ward in this ULB has rates to copy")
        return
      }
      await mutations.upsertCells.mutateAsync({ id: config.id, cells: cellsFromConfig(source) })
      toast.success("Applied ULB default from another ward")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ULB default failed")
    } finally {
      setBusy(false)
    }
  }

  const onSystemDefault = async () => {
    if (!config || !canManage) return
    if (!window.confirm("Reset this ward’s rate matrix to zero (system default)?")) return
    setBusy(true)
    try {
      await mutations.upsertCells.mutateAsync({ id: config.id, cells: zeroCells(config) })
      toast.success("Ward reset to system default (zeros)")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed")
    } finally {
      setBusy(false)
    }
  }

  const onResetUlb = async () => {
    if (!canManage || !resolvedYearId || !ulbId || wards.length === 0) return
    if (!window.confirm("Reset ALL wards in this ULB to system default (zero rates)?")) return
    setBusy(true)
    try {
      const result = await mutations.bulkApply.mutateAsync({
        ulbId,
        assessmentYearId: resolvedYearId,
        mode: "zero",
      })
      toast.success(`Reset ${result.updated} ward(s) to system default`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ULB reset failed")
    } finally {
      setBusy(false)
    }
  }

  const onSaveAll = async () => {
    await flushCells({ allowEmptyToast: true })
    toast.message("Save All flushes the current ward. Edit and save other wards individually.")
  }

  const activeChip =
    !config || !resolvedWardId
      ? "—"
      : isDirty
        ? "Unsaved"
        : config.status === "PUBLISHED"
          ? "Published"
          : savedFlash
            ? "Saved"
            : "Draft"

  return (
    <div className="space-y-4">
      <TaxRatesBanner />

      <TaxScopeSelectors
        districts={districts}
        resolvedDistrictId={resolvedDistrictId}
        ulbId={ulbId}
        resolvedYearId={resolvedYearId}
        years={years?.items ?? []}
        onDistrictChange={(v) => {
          setDistrictId(v)
          setUlbId("")
          setWardId("")
        }}
        onUlbChange={(v) => {
          setUlbId(v)
          setWardId("")
        }}
        onYearChange={setAssessmentYearId}
      />

      {!ulbId ? (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          Select a municipality to manage ward rates.
        </p>
      ) : (
        <>
          <UlbRatesToolbar
            ulbName={selectedUlb?.name ?? "Municipality"}
            districtName={selectedDistrict?.name ?? "—"}
            wardCount={wards.length}
            status={config?.status}
            canManage={canManage}
            canPublish={canPublish}
            hasConfig={Boolean(config)}
            hasVersions={versions.length > 0}
            busy={busy}
            onResetUlb={() => void onResetUlb()}
            onSaveAll={() => void onSaveAll()}
            onHistory={() => setHistoryOpen(true)}
            onRollback={() => setRollbackOpen(true)}
            onPublish={() => setPublishOpen(true)}
          />

          <div className="flex flex-col gap-4 lg:flex-row">
            <WardRatesSidebar
              wards={filteredWards}
              activeWardId={resolvedWardId}
              search={wardSearch}
              onSearchChange={setWardSearch}
              onSelectWard={setWardId}
              activeChip={activeChip}
            />

            <WardRateEditor
              key={resolvedWardId}
              ward={selectedWard}
              config={config}
              isLoading={isLoading}
              canManage={canManage}
              busy={busy}
              roads={roads?.items ?? []}
              constructions={constructions?.items ?? []}
              resolvedRoadId={resolvedRoadId}
              resolvedConstructionId={resolvedConstructionId}
              areaSqFt={areaSqFt}
              preview={preview}
              onRoadChange={setRoadWidthEntryId}
              onConstructionChange={setConstructionEntryId}
              onAreaChange={setAreaSqFt}
              onCellChange={onCellChange}
              onSaveWard={() => void flushCells({ allowEmptyToast: true })}
              onUlbDefault={() => void onUlbDefault()}
              onSystemDefault={() => void onSystemDefault()}
              onCopyToAll={() => void onCopyToAll()}
            />
          </div>
        </>
      )}

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
