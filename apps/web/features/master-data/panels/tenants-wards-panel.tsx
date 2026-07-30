"use client"

import { DistrictDrawer, StateDrawer, ULBDrawer, WardDrawer } from "@/features/configuration/components/GeoDrawers"
import { GeographyAccordion } from "@/features/configuration/components/GeographyAccordion"
import { useGeographyTree } from "@/features/configuration/hooks/use-configuration"
import type { GeographyTreeNode } from "@/features/configuration/lib/types"
import { useEtlStatus, useStartEtlIncremental } from "@/features/etl/hooks/use-etl-status"
import { isEtlJobActive } from "@/features/etl/lib/types"
import { computeGeoStats } from "@/features/master-data/lib/geo-stats"
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
import { MapPin, Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

type DrawerKind = "state" | "district" | "ulb" | "ward" | null

const WARD_NAME_CONFLICT = "A ward with this name already exists. Please use a different name."

function collectSiblingWardNames(tree: GeographyTreeNode[], ulbId: string, excludeWardId?: string): string[] {
  for (const state of tree) {
    for (const district of state.children ?? []) {
      for (const ulb of district.children ?? []) {
        if (ulb.id !== ulbId) continue
        return (ulb.children ?? []).filter((w) => w.type === "ward" && w.id !== excludeWardId).map((w) => w.name)
      }
    }
  }
  return []
}

export function TenantsWardsPanel() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const tenantRoles = useAuthStore((s) => s.profile?.tenantRoles)
  const canManage = hasPermission("settings:manage") || hasPermission("role:assign")
  const canDeleteWard = hasAdminRole(tenantRoles)
  const canEtl = hasPermission("etl:manage")
  const { data: tree = [], isLoading, refetch } = useGeographyTree()
  const { data: etlStatus } = useEtlStatus(canEtl)
  const startIncremental = useStartEtlIncremental()
  const [selected, setSelected] = useState<GeographyTreeNode | null>(null)
  const [parent, setParent] = useState<GeographyTreeNode | null>(null)
  const [drawer, setDrawer] = useState<DrawerKind>(null)
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [wardNameError, setWardNameError] = useState<string | null>(null)
  const qc = useQueryClient()

  const stats = useMemo(() => computeGeoStats(tree), [tree])
  const etlBusy = isEtlJobActive(etlStatus?.activeJob?.status) || startIncremental.isPending

  const siblingWardNames = useMemo(() => {
    if (drawer !== "ward") return []
    if (drawerMode === "create" && parent?.type === "ulb") {
      return collectSiblingWardNames(tree, parent.id)
    }
    if (drawerMode === "edit" && selected?.type === "ward" && selected.parentId) {
      return collectSiblingWardNames(tree, selected.parentId, selected.id)
    }
    return []
  }, [drawer, drawerMode, parent, selected, tree])

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["configuration", "geography-tree"] })
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

  const confirmDeleteWard = async () => {
    if (!selected || selected.type !== "ward" || deleting) return
    setDeleting(true)
    try {
      await apiDelete(`/wards/${selected.id}`)
      toast.success("Ward deleted")
      setDeleteConfirmOpen(false)
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
                variant="secondary"
                className="cursor-pointer"
                disabled={etlBusy}
                onClick={async () => {
                  try {
                    const result = await startIncremental.mutateAsync(undefined)
                    toast.success(`Convex sync queued (${result.jobId.slice(0, 8)}…)`)
                  } catch (error) {
                    toast.error(getApiErrorMessage(error))
                  }
                }}
              >
                <RefreshCw className={`size-4 ${etlBusy ? "animate-spin" : ""}`} aria-hidden />
                Sync from Convex
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
                  Synced {etlStatus.migrationState.completed} · failed {etlStatus.migrationState.failed}
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
        onSubmit={async (values) => {
          setSaving(true)
          try {
            if (drawerMode === "create") await apiPost("/states", values)
            else if (selected) await apiPatch(endpointFor(selected), values)
            toast.success("State saved")
            setDrawer(null)
            await invalidate()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed")
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
            toast.error(err instanceof Error ? err.message : "Save failed")
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
            toast.error(err instanceof Error ? err.message : "Save failed")
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
        onDelete={() => setDeleteConfirmOpen(true)}
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

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent
          onKeyDown={(event) => {
            if (event.key !== "Enter" || deleting) return
            const target = event.target as HTMLElement | null
            if (target?.closest("button")) return
            event.preventDefault()
            void confirmDeleteWard()
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete Ward: {deleteWardLabel}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this ward? This action is permanent and cannot be undone. The ward will be
              removed from active lists. Associated data (tenants, records, etc.) will remain linked but this ward will
              no longer be available for new work.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={deleting}
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              disabled={deleting || !selected || selected.type !== "ward"}
              onClick={() => void confirmDeleteWard()}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
