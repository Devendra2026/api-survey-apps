"use client"

import { DistrictDrawer, StateDrawer, ULBDrawer, WardDrawer } from "@/features/configuration/components/GeoDrawers"
import { GeographyAccordion } from "@/features/configuration/components/GeographyAccordion"
import { useGeographyTree, useGeographyUlbWards } from "@/features/configuration/hooks/use-configuration"
import type { GeographyTreeNode } from "@/features/configuration/lib/types"
import { useAlignWardsWithConvex, useEtlStatus, useStartEtlIncremental } from "@/features/etl/hooks/use-etl-status"
import { isEtlJobActive } from "@/features/etl/lib/types"
import { UlbPortalApiKeyCard } from "@/features/master-data/components/ulb-portal-api-key-card"
import { computeGeoStats } from "@/features/master-data/lib/geo-stats"
import { useStates } from "@/hooks/use-api"
import { apiDelete, apiPatch, apiPost, getApiErrorMessage } from "@/lib/api/client"
import { hasAdminRole } from "@/lib/format-ward-label"
import { useAuthStore } from "@/stores/app-store"
import { useQueryClient } from "@tanstack/react-query"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { GitMerge, MapPin, Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

type DrawerKind = "state" | "district" | "ulb" | "ward" | null

const WARD_NAME_CONFLICT = "A ward with this name already exists. Please use a different name."

function statesToTreeNodes(items: Array<{ id: string; name: string; code: string }>): GeographyTreeNode[] {
  return items.map((s) => ({
    id: s.id,
    type: "state" as const,
    name: s.name,
    code: s.code,
    status: "ACTIVE" as const,
    counts: { districts: 0, surveys: 0 },
    children: [],
  }))
}

function findNodeById(tree: GeographyTreeNode[], id?: string): GeographyTreeNode | null {
  if (!id) return null
  for (const node of tree) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findNodeById(node.children, id)
      if (found) return found
    }
  }
  return null
}

export function TenantsWardsPanel() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const tenantRoles = useAuthStore((s) => s.profile?.tenantRoles)
  // Match API: geo create/update requires settings:manage (not role:assign alone)
  const canManage = hasPermission("settings:manage")
  const canDeleteWard = hasAdminRole(tenantRoles)
  // State delete API requires a global admin assignment
  const canDeleteState = canManage && hasAdminRole(tenantRoles)
  const canEtl = hasPermission("etl:manage")
  const { data: treeData, isLoading: treeLoading, isError: treeError, error: treeErr, refetch } = useGeographyTree()
  const { data: statesPage, isLoading: statesLoading, isError: statesError } = useStates({ limit: 100 })
  const { data: etlStatus } = useEtlStatus(canEtl)
  const startIncremental = useStartEtlIncremental()
  const alignWards = useAlignWardsWithConvex()
  const [selected, setSelected] = useState<GeographyTreeNode | null>(null)
  const [parent, setParent] = useState<GeographyTreeNode | null>(null)
  const [drawer, setDrawer] = useState<DrawerKind>(null)
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<"ward" | "state" | null>(null)
  const [fixDupesOpen, setFixDupesOpen] = useState(false)
  const [wardNameError, setWardNameError] = useState<string | null>(null)
  const qc = useQueryClient()

  /** Prefer full tree; if it fails or is empty, fall back to /states so existing UP still appears. */
  const tree = useMemo(() => {
    if (treeData && treeData.length > 0) return treeData
    const stateItems = statesPage?.items ?? []
    if (stateItems.length > 0) return statesToTreeNodes(stateItems)
    return treeData ?? []
  }, [treeData, statesPage?.items])

  const isLoading = treeLoading || (statesLoading && !treeData?.length)
  const loadError = treeError && statesError

  const stats = useMemo(() => computeGeoStats(tree), [tree])
  const fixDistrictId = useMemo(() => {
    if (!selected) return null
    if (selected.type === "district") return selected.id
    if (selected.type === "ulb") return selected.parentId ?? null
    if (selected.type === "ward") {
      const ulb = selected.parentId ? findNodeById(tree, selected.parentId) : null
      return ulb?.parentId ?? null
    }
    return null
  }, [selected, tree])
  const etlBusy = isEtlJobActive(etlStatus?.activeJob?.status) || startIncremental.isPending || alignWards.isPending

  const runFixDuplicateWards = async () => {
    if (!fixDistrictId) {
      toast.error("Select a district, ULB, or ward first")
      return
    }
    try {
      const result = await alignWards.mutateAsync({ apply: true, districtId: fixDistrictId })
      setFixDupesOpen(false)
      await invalidate()
      if (result.ok) {
        toast.success("Duplicate wards removed — Nest matches Convex")
      } else {
        const n = result.steps.dedupe.wardsSoftDeleted
        toast.message(
          n > 0
            ? `Merged ${n} duplicate ward(s). Check ETL console if some ULBs still mismatch.`
            : "Align finished — open ETL console if duplicates remain."
        )
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  const wardUlbId =
    drawer === "ward"
      ? drawerMode === "create" && parent?.type === "ulb"
        ? parent.id
        : drawerMode === "edit" && selected?.type === "ward"
          ? selected.parentId
          : undefined
      : undefined
  const { data: siblingWards = [] } = useGeographyUlbWards(wardUlbId)

  const siblingWardNames = useMemo(() => {
    if (drawer !== "ward") return []
    const names = siblingWards.map((w) => w.name)
    if (drawerMode === "edit" && selected?.type === "ward") {
      return names.filter((n) => n !== selected.name)
    }
    return names
  }, [drawer, drawerMode, selected, siblingWards])

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["configuration", "geography-tree"] })
    await qc.invalidateQueries({ queryKey: ["configuration", "geography-ulb-wards"] })
    await qc.invalidateQueries({ queryKey: ["states"] })
    await qc.invalidateQueries({ queryKey: ["wards"] })
    await refetch()
  }

  const endpointFor = (node: GeographyTreeNode) => {
    switch (node.type) {
      case "state":
        return `/states/${node.id}`
      case "district":
        return `/districts/${node.id}`
      case "ulb":
        return `/ulbs/${node.id}`
      case "ward":
        return `/wards/${node.id}`
    }
  }

  const openEdit = (node: GeographyTreeNode) => {
    if (!canManage) return
    setParent(null)
    setSelected(node)
    setDrawerMode("edit")
    setWardNameError(null)
    setDrawer(node.type)
  }

  const openCreate = (kind: Exclude<DrawerKind, null>, parentNode: GeographyTreeNode | null) => {
    if (!canManage) return
    setSelected(null)
    setParent(parentNode)
    setDrawerMode("create")
    setWardNameError(null)
    setDrawer(kind)
  }

  const confirmDelete = async () => {
    if (!selected || deleting || !deleteTarget) return
    if (deleteTarget === "ward" && selected.type !== "ward") return
    if (deleteTarget === "state" && selected.type !== "state") return

    setDeleting(true)
    try {
      if (deleteTarget === "ward") {
        await apiDelete(`/wards/${selected.id}`)
        toast.success("Ward deleted")
      } else {
        await apiDelete(`/states/${selected.id}`)
        toast.success("State deleted")
      }
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
      setDrawer(null)
      setSelected(null)
      await invalidate()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const deleteWardLabel = selected?.type === "ward" ? selected.name?.trim() || selected.wardNumber || "Ward" : "Ward"
  const deleteStateLabel =
    selected?.type === "state" ? `${selected.name}${selected.code ? ` (${selected.code})` : ""}` : "State"
  const stateDistrictCount =
    selected?.type === "state" ? (selected.counts?.districts ?? selected.children?.length ?? 0) : 0
  const stateDeleteBlocked =
    selected?.type === "state" && stateDistrictCount > 0
      ? `This state has ${stateDistrictCount} district(s). Keep Uttar Pradesh (09); only delete empty duplicates.`
      : null

  const firstState = tree.find((n) => n.type === "state") ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="size-4" aria-hidden />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">Geographic Hierarchy</h3>
            <p className="max-w-xl text-sm text-muted-foreground">
              New states appear here immediately. Assign the state to other users before it shows in their survey, QC,
              or filter dropdowns.
            </p>
            {loadError ? (
              <p className="text-sm text-destructive">
                Could not load geography ({getApiErrorMessage(treeErr)}). Try Refresh or check API logs.
              </p>
            ) : null}
            {treeError && !statesError && tree.length > 0 ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Full hierarchy failed to load — showing states only. Expand after districts/ULBs are added, or retry.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-normal">
                {stats.districts} districts
              </Badge>
              <Badge variant="secondary" className="font-normal">
                {stats.ulbs} ULBs
              </Badge>
              <Badge variant="secondary" className="font-normal">
                Wards on demand
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEtl ? (
            <>
              <Button
                type="button"
                className="cursor-pointer"
                disabled={etlBusy || !fixDistrictId}
                onClick={() => setFixDupesOpen(true)}
              >
                <GitMerge className="size-4" aria-hidden />
                Remove duplicate wards
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="cursor-pointer"
                disabled={etlBusy}
                onClick={async () => {
                  try {
                    const result = await startIncremental.mutateAsync(undefined)
                    toast.success(`Survey sync queued (${result.jobId.slice(0, 8)}…)`)
                  } catch (error) {
                    toast.error(getApiErrorMessage(error))
                  }
                }}
              >
                <RefreshCw className={`size-4 ${etlBusy ? "animate-spin" : ""}`} aria-hidden />
                Sync surveys
              </Button>
              <Button type="button" variant="ghost" size="sm" className="cursor-pointer" asChild>
                <Link href="/admin/etl">ETL console</Link>
              </Button>
              {etlStatus?.activeJob ? (
                <Badge variant="outline" className="font-normal">
                  {etlStatus.activeJob.type} · {etlStatus.activeJob.status}
                </Badge>
              ) : etlStatus ? (
                <Badge variant="secondary" className="font-normal">
                  Surveys synced {etlStatus.migrationState.completed} · failed {etlStatus.migrationState.failed}
                </Badge>
              ) : null}
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={!canManage}
            onClick={() => openCreate("state", null)}
          >
            <Plus className="size-4" aria-hidden />
            Add state
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            disabled={isLoading}
            onClick={() => void invalidate()}
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!canManage || !firstState}
            onClick={() => openCreate("district", firstState)}
          >
            <Plus className="size-4" aria-hidden />
            Add district
          </Button>
        </div>
      </div>

      <GeographyAccordion
        nodes={tree}
        loading={isLoading}
        canManage={canManage}
        onEdit={openEdit}
        onAddDistrict={(state) => openCreate("district", state)}
        onAddUlb={(district) => openCreate("ulb", district)}
        onAddWard={(ulb) => openCreate("ward", ulb)}
        onWardClick={openEdit}
      />

      {canManage && selected?.type === "ulb" ? (
        <UlbPortalApiKeyCard ulbId={selected.id} ulbName={selected.name} />
      ) : null}

      <StateDrawer
        open={drawer === "state"}
        onOpenChange={(o) => !o && setDrawer(null)}
        mode={drawerMode}
        initial={
          drawerMode === "edit" && selected?.type === "state"
            ? { name: selected.name, code: selected.code ?? "" }
            : undefined
        }
        saving={saving}
        canDelete={canDeleteState && drawerMode === "edit"}
        deleting={deleting}
        deleteBlockedReason={stateDeleteBlocked}
        onDelete={() => {
          setDeleteTarget("state")
          setDeleteConfirmOpen(true)
        }}
        onSubmit={async (values) => {
          setSaving(true)
          try {
            if (drawerMode === "create") await apiPost("/states", values)
            else if (selected) await apiPatch(endpointFor(selected), values)
            toast.success("State saved")
            setDrawer(null)
            await invalidate()
          } catch (err) {
            toast.error(getApiErrorMessage(err))
          } finally {
            setSaving(false)
          }
        }}
      />
      <DistrictDrawer
        open={drawer === "district"}
        onOpenChange={(o) => !o && setDrawer(null)}
        mode={drawerMode}
        initial={
          drawerMode === "edit" && selected?.type === "district"
            ? { name: selected.name, code: selected.code ?? "" }
            : undefined
        }
        saving={saving}
        onSubmit={async (values) => {
          setSaving(true)
          try {
            if (drawerMode === "create" && parent?.type === "state") {
              await apiPost("/districts", { ...values, stateId: parent.id })
            } else if (selected) await apiPatch(endpointFor(selected), values)
            toast.success("District saved")
            setDrawer(null)
            await invalidate()
          } catch (err) {
            toast.error(getApiErrorMessage(err))
          } finally {
            setSaving(false)
          }
        }}
      />
      <ULBDrawer
        open={drawer === "ulb"}
        onOpenChange={(o) => !o && setDrawer(null)}
        mode={drawerMode}
        initial={
          drawerMode === "edit" && selected?.type === "ulb"
            ? { name: selected.name, code: selected.code ?? "", type: selected.ulbType ?? "MUNICIPAL_COUNCIL" }
            : undefined
        }
        saving={saving}
        onSubmit={async (values) => {
          setSaving(true)
          try {
            if (drawerMode === "create" && parent?.type === "district") {
              await apiPost("/ulbs", { ...values, districtId: parent.id })
            } else if (selected) await apiPatch(endpointFor(selected), values)
            toast.success("ULB saved")
            setDrawer(null)
            await invalidate()
          } catch (err) {
            toast.error(getApiErrorMessage(err))
          } finally {
            setSaving(false)
          }
        }}
      />
      <WardDrawer
        open={drawer === "ward"}
        onOpenChange={(o) => {
          if (!o) {
            setDrawer(null)
            setWardNameError(null)
          }
        }}
        mode={drawerMode}
        initial={
          drawerMode === "edit" && selected?.type === "ward"
            ? { wardNumber: selected.wardNumber ?? "", wardName: selected.name }
            : undefined
        }
        saving={saving}
        canDelete={canDeleteWard && drawerMode === "edit"}
        deleting={deleting}
        onDelete={() => {
          setDeleteTarget("ward")
          setDeleteConfirmOpen(true)
        }}
        existingWardNames={siblingWardNames}
        excludeWardName={drawerMode === "edit" && selected?.type === "ward" ? selected.name : undefined}
        nameError={wardNameError}
        onNameErrorChange={setWardNameError}
        onSubmit={async (values) => {
          setSaving(true)
          setWardNameError(null)
          try {
            if (drawerMode === "create" && parent?.type === "ulb") {
              await apiPost("/wards", { ...values, ulbId: parent.id })
            } else if (selected) await apiPatch(endpointFor(selected), values)
            toast.success("Ward saved")
            setDrawer(null)
            await invalidate()
          } catch (err) {
            const message = getApiErrorMessage(err)
            if (message.toLowerCase().includes("already exists") && message.toLowerCase().includes("name")) {
              setWardNameError(WARD_NAME_CONFLICT)
            }
            toast.error(message)
          } finally {
            setSaving(false)
          }
        }}
      />

      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open)
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent
          onKeyDown={(event) => {
            if (event.key !== "Enter" || deleting) return
            const target = event.target as HTMLElement | null
            if (target?.closest("button")) return
            event.preventDefault()
            void confirmDelete()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {deleteTarget === "state" ? `Delete State: ${deleteStateLabel}` : `Delete Ward: ${deleteWardLabel}`}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget === "state" ? (
                <>
                  Permanently delete this empty state? Keep <strong>Uttar Pradesh (09)</strong> — only remove duplicate
                  empty states (01, UP, UP-01). This cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete this ward? This action is permanent and cannot be undone. The ward
                  will be removed from active lists. Associated data (tenants, records, etc.) will remain linked but
                  this ward will no longer be available for new work.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={deleting}
              onClick={() => {
                setDeleteConfirmOpen(false)
                setDeleteTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              disabled={
                deleting ||
                !selected ||
                (deleteTarget === "ward" && selected.type !== "ward") ||
                (deleteTarget === "state" && selected.type !== "state")
              }
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fixDupesOpen} onOpenChange={setFixDupesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove duplicate wards?</DialogTitle>
            <DialogDescription>
              Merges wards that are the same number (for example <strong>2</strong> and <strong>W02</strong>), moves
              surveys onto the keeper ward, then syncs names/codes from Convex. Empty UP shells (01 / UP) may be cleaned
              up. This does <strong>not</strong> import surveys — use Sync surveys for that.
              <br />
              <br />
              Ask the QC team to finish the open review (or pause Start QC) before running, then hard-refresh Command
              Center / QC after it completes so ward filters pick up remapped surveys.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={alignWards.isPending}
              onClick={() => setFixDupesOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              disabled={alignWards.isPending}
              onClick={() => void runFixDuplicateWards()}
            >
              {alignWards.isPending ? "Fixing…" : "Remove duplicates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
