"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { ConfigurationWorkspace } from "@/features/configuration/components/ConfigurationWorkspace"
import { DistrictDrawer, StateDrawer, ULBDrawer, WardDrawer } from "@/features/configuration/components/GeoDrawers"
import { GeographyAccordion } from "@/features/configuration/components/GeographyAccordion"
import { useGeographyTree } from "@/features/configuration/hooks/use-configuration"
import type { GeographyTreeNode } from "@/features/configuration/lib/types"
import { apiPatch, apiPost } from "@/lib/api/client"
import { useAuthStore } from "@/stores/app-store"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { useState } from "react"
import { toast } from "sonner"

type DrawerKind = "state" | "district" | "ulb" | "ward" | null

export default function GeographyPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")
  const canManage = hasPermission("settings:manage") || hasPermission("role:assign")
  const { data: tree = [], isLoading, refetch } = useGeographyTree()
  const [selected, setSelected] = useState<GeographyTreeNode | null>(null)
  const [parent, setParent] = useState<GeographyTreeNode | null>(null)
  const [drawer, setDrawer] = useState<DrawerKind>(null)
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["configuration", "geography-tree"] })
    await refetch()
  }

  if (!canView) {
    return <EmptyState title="Master Data unavailable" description="Requires settings:view." />
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
    setDrawer(node.type)
  }

  const openCreate = (kind: Exclude<DrawerKind, null>, parentNode: GeographyTreeNode | null) => {
    if (!canManage) return
    setSelected(null)
    setParent(parentNode)
    setDrawerMode("create")
    setDrawer(kind)
  }

  return (
    <ConfigurationWorkspace
      title="Geographic Hierarchy"
      description="State → District → ULB → Ward master data with codes and inline edit."
      actions={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!canManage}
          onClick={() => openCreate("state", null)}
        >
          Create State
        </Button>
      }
    >
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
            if (drawerMode === "create" && parent?.type === "ulb") {
              await apiPost("/wards", { ...values, ulbId: parent.id })
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
    </ConfigurationWorkspace>
  )
}
