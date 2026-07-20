"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { apiDelete, apiPatch, apiPost } from "@/lib/api/client"
import { AuditTimeline } from "@/features/configuration/components/AuditTimeline"
import { ConfigurationWorkspace } from "@/features/configuration/components/ConfigurationWorkspace"
import { DistrictDrawer, StateDrawer, ULBDrawer, WardDrawer } from "@/features/configuration/components/GeoDrawers"
import { HierarchyDetailsPanel } from "@/features/configuration/components/HierarchyDetailsPanel"
import { HierarchyExplorer } from "@/features/configuration/components/HierarchyExplorer"
import { useConfigAudit, useGeographyTree } from "@/features/configuration/hooks/use-configuration"
import type { GeographyTreeNode } from "@/features/configuration/lib/types"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@workspace/ui/components/resizable"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

type DrawerKind = "state" | "district" | "ulb" | "ward" | null

export default function GeographyPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")
  const canManage = hasPermission("settings:manage") || hasPermission("role:assign")
  const { data: tree = [], isLoading, refetch } = useGeographyTree()
  const [selected, setSelected] = useState<GeographyTreeNode | null>(null)
  const [drawer, setDrawer] = useState<DrawerKind>(null)
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()
  const audit = useConfigAudit(selected ? { entityType: selected.type, entityId: selected.id } : undefined)

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["configuration", "geography-tree"] })
    await refetch()
  }

  if (!canView) {
    return <EmptyState title="Geography unavailable" description="Requires settings:view." />
  }

  const openCreateChild = () => {
    if (!selected || !canManage) return
    setDrawerMode("create")
    if (selected.type === "state") setDrawer("district")
    else if (selected.type === "district") setDrawer("ulb")
    else if (selected.type === "ulb") setDrawer("ward")
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

  return (
    <ConfigurationWorkspace
      title="Geographic Hierarchy"
      description="State → District → ULB → Ward explorer with CRUD and audit."
      actions={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!canManage}
          onClick={() => {
            setDrawerMode("create")
            setDrawer("state")
          }}
        >
          Create State
        </Button>
      }
    >
      <ResizablePanelGroup orientation="horizontal" className="min-h-[560px] rounded-lg border border-border/70">
        <ResizablePanel defaultSize={42} minSize={28}>
          <div className="h-full p-3">
            <HierarchyExplorer nodes={tree} selectedId={selected?.id} onSelect={setSelected} loading={isLoading} />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={58} minSize={35}>
          <div className="h-full p-3">
            <HierarchyDetailsPanel
              node={selected}
              onCreateChild={openCreateChild}
              onEdit={() => {
                if (!selected || !canManage) return
                setDrawerMode("edit")
                setDrawer(selected.type)
              }}
              onDelete={() => setDeleteOpen(true)}
              onAudit={() => setAuditOpen(true)}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

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
        initial={drawerMode === "edit" && selected?.type === "district" ? { name: selected.name } : undefined}
        saving={saving}
        onSubmit={async (values) => {
          setSaving(true)
          try {
            if (drawerMode === "create" && selected?.type === "state") {
              await apiPost("/districts", { ...values, stateId: selected.id })
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
            if (drawerMode === "create" && selected?.type === "district") {
              await apiPost("/ulbs", { ...values, districtId: selected.id })
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
        onOpenChange={(o) => !o && setDrawer(null)}
        mode={drawerMode}
        initial={
          drawerMode === "edit" && selected?.type === "ward"
            ? { wardNumber: selected.wardNumber ?? "", wardName: selected.name }
            : undefined
        }
        saving={saving}
        onSubmit={async (values) => {
          setSaving(true)
          try {
            if (drawerMode === "create" && selected?.type === "ulb") {
              await apiPost("/wards", { ...values, ulbId: selected.id })
            } else if (selected) await apiPatch(endpointFor(selected), values)
            toast.success("Ward saved")
            setDrawer(null)
            await invalidate()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed")
          } finally {
            setSaving(false)
          }
        }}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected?.type}?</DialogTitle>
            <DialogDescription>
              This permanently removes {selected?.name}. Related child records may block deletion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={async () => {
                if (!selected) return
                try {
                  await apiDelete(endpointFor(selected))
                  toast.success("Deleted")
                  setSelected(null)
                  setDeleteOpen(false)
                  await invalidate()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Delete failed")
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuditTimeline open={auditOpen} onOpenChange={setAuditOpen} logs={audit.data} loading={audit.isLoading} />
    </ConfigurationWorkspace>
  )
}
