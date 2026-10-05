"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { AddLocationDrawer, type GeoLevel } from "@/features/configuration/components/AddLocationDrawer"
import { ConfigurationWorkspace } from "@/features/configuration/components/ConfigurationWorkspace"
import { GeoTreeTable } from "@/features/configuration/components/GeoTreeTable"
import { useGeographyTree } from "@/features/configuration/hooks/use-configuration"
import type { GeographyTreeNode } from "@/features/configuration/lib/types"
import { apiDelete, apiPatch, apiPost } from "@/lib/api/client"
import { useAuthStore } from "@/stores/app-store"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useMemo, useState } from "react"
import { toast } from "sonner"

type DrawerMode = "create" | "edit"

type LocationPayload = {
  level: GeoLevel
  name: string
  code?: string
  wardNumber?: string
  ulbType?: string
  stateId?: string
  districtId?: string
  ulbId?: string
}

type AncestorMatch = {
  stateId?: string
  districtId?: string
  ulbId?: string
  node?: GeographyTreeNode
}

function endpointFor(node: GeographyTreeNode): string {
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

function findAncestors(tree: GeographyTreeNode[], nodeId: string, hint?: GeographyTreeNode): AncestorMatch {
  for (const state of tree) {
    if (state.id === nodeId) return { node: state }
    for (const district of state.children ?? []) {
      if (district.id === nodeId) return { stateId: state.id, node: district }
      for (const ulb of district.children ?? []) {
        if (ulb.id === nodeId) return { stateId: state.id, districtId: district.id, node: ulb }
        for (const ward of ulb.children ?? []) {
          if (ward.id === nodeId) {
            return { stateId: state.id, districtId: district.id, ulbId: ulb.id, node: ward }
          }
        }
      }
    }
  }
  if (hint?.type === "ward" && hint.parentId) {
    const parent = findAncestors(tree, hint.parentId)
    return { stateId: parent.stateId, districtId: parent.districtId, ulbId: hint.parentId, node: hint }
  }
  return {}
}

function createDefaultsForChild(
  tree: GeographyTreeNode[],
  node: GeographyTreeNode
): { level: GeoLevel; stateId?: string; districtId?: string; ulbId?: string } | undefined {
  const ancestors = findAncestors(tree, node.id, node)
  if (node.type === "state") {
    return { level: "district", stateId: node.id }
  }
  if (node.type === "district") {
    return { level: "ulb", stateId: ancestors.stateId, districtId: node.id }
  }
  if (node.type === "ulb") {
    return { level: "ward", stateId: ancestors.stateId, districtId: ancestors.districtId, ulbId: node.id }
  }
  return undefined
}

export default function GeographyPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")
  const canManage = hasPermission("settings:manage") || hasPermission("role:assign")
  const { data: tree = [], isLoading, refetch } = useGeographyTree()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create")
  const [editingNode, setEditingNode] = useState<GeographyTreeNode | null>(null)
  const [createDefaults, setCreateDefaults] = useState<
    { level: GeoLevel; stateId?: string; districtId?: string; ulbId?: string } | undefined
  >()
  const [deleteTarget, setDeleteTarget] = useState<GeographyTreeNode | null>(null)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  async function invalidate(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ["configuration", "geography-tree"] })
    await queryClient.invalidateQueries({ queryKey: ["configuration", "geography-ulb-wards"] })
    await refetch()
  }

  const editingAncestors = useMemo(
    () => (editingNode ? findAncestors(tree, editingNode.id, editingNode) : undefined),
    [tree, editingNode]
  )

  const editInitial = useMemo(() => {
    if (drawerMode !== "edit" || !editingNode) return undefined
    return {
      level: editingNode.type,
      id: editingNode.id,
      name: editingNode.name,
      code: editingNode.code,
      wardNumber: editingNode.wardNumber,
      ulbType: editingNode.ulbType,
      parentIds: {
        stateId: editingAncestors?.stateId,
        districtId: editingAncestors?.districtId,
        ulbId: editingAncestors?.ulbId,
      },
    }
  }, [drawerMode, editingNode, editingAncestors])

  const drawerCreateDefaults = useMemo(() => {
    if (drawerMode !== "create" || !createDefaults) return undefined
    return createDefaults
  }, [drawerMode, createDefaults])

  function openCreate(defaults?: { level: GeoLevel; stateId?: string; districtId?: string; ulbId?: string }): void {
    if (!canManage) return
    setDrawerMode("create")
    setEditingNode(null)
    setCreateDefaults(defaults ?? { level: "state" })
    setDrawerOpen(true)
  }

  function openEdit(node: GeographyTreeNode): void {
    if (!canManage) return
    setDrawerMode("edit")
    setEditingNode(node)
    setCreateDefaults(undefined)
    setDrawerOpen(true)
  }

  async function handleSubmit(payload: LocationPayload): Promise<void> {
    setSaving(true)
    try {
      if (drawerMode === "edit" && editingNode) {
        const id = editingNode.id
        if (payload.level === "state") {
          await apiPatch(`/states/${id}`, { name: payload.name, code: payload.code })
        } else if (payload.level === "district") {
          await apiPatch(`/districts/${id}`, {
            name: payload.name,
            ...(payload.code ? { code: payload.code } : {}),
            ...(payload.stateId ? { stateId: payload.stateId } : {}),
          })
        } else if (payload.level === "ulb") {
          await apiPatch(`/ulbs/${id}`, {
            name: payload.name,
            code: payload.code,
            ...(payload.ulbType ? { type: payload.ulbType } : {}),
          })
        } else {
          await apiPatch(`/wards/${id}`, {
            wardName: payload.name,
            wardNumber: payload.wardNumber,
            ...(payload.ulbId ? { ulbId: payload.ulbId } : {}),
          })
        }
        toast.success("Location updated")
      } else if (payload.level === "state") {
        await apiPost("/states", { name: payload.name, code: payload.code })
        toast.success("State created")
      } else if (payload.level === "district") {
        await apiPost("/districts", { name: payload.name, code: payload.code, stateId: payload.stateId })
        toast.success("District created")
      } else if (payload.level === "ulb") {
        await apiPost("/ulbs", {
          name: payload.name,
          code: payload.code,
          districtId: payload.districtId,
          type: payload.ulbType,
        })
        toast.success("ULB created")
      } else {
        await apiPost("/wards", {
          wardName: payload.name,
          wardNumber: payload.wardNumber,
          ulbId: payload.ulbId,
        })
        toast.success("Ward created")
      }
      setDrawerOpen(false)
      await invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(node: GeographyTreeNode, next: "ACTIVE" | "DISABLED"): Promise<void> {
    const label = next === "ACTIVE" ? "Activated" : "Deactivated"
    try {
      await apiPatch(endpointFor(node), { status: next })
      toast.success(label)
      await invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status update failed")
      await invalidate()
    }
  }

  function handleDeleteRequest(node: GeographyTreeNode): void {
    const nestedCount = node.type === "ulb" ? (node.counts.geographicWards ?? 0) : (node.children?.length ?? 0)
    if (nestedCount > 0) {
      toast.error("Cannot delete a location that has children")
      return
    }
    setDeleteTarget(node)
  }

  if (!canView) {
    return <EmptyState title="Geography unavailable" description="Requires settings:view." />
  }

  return (
    <ConfigurationWorkspace title="Tenants & Wards" description="State → District → ULB → Ward">
      <div className="min-h-140">
        <GeoTreeTable
          tree={tree}
          canManage={canManage}
          isLoading={isLoading}
          onAddLocation={() => openCreate({ level: "state" })}
          onAddChild={(node) => {
            const defaults = createDefaultsForChild(tree, node)
            if (defaults) openCreate(defaults)
          }}
          onEdit={openEdit}
          onDelete={handleDeleteRequest}
          onToggleStatus={(node, next) => {
            void handleToggleStatus(node, next)
          }}
        />
      </div>
      <AddLocationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        initial={editInitial}
        createDefaults={drawerCreateDefaults}
        tree={tree}
        saving={saving}
        onSubmit={(payload) => {
          void handleSubmit(payload)
        }}
      />
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.type}?</DialogTitle>
            <DialogDescription>This permanently removes {deleteTarget?.name}. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                if (!deleteTarget) return
                const target = deleteTarget
                void (async () => {
                  try {
                    await apiDelete(endpointFor(target))
                    toast.success("Deleted")
                    setDeleteTarget(null)
                    await invalidate()
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Delete failed")
                  }
                })()
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfigurationWorkspace>
  )
}
