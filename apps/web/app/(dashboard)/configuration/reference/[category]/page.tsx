"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { AuditTimeline } from "@/features/configuration/components/AuditTimeline"
import {
  ConfigurationToolbar,
  SearchToolbar,
  StickyActionBar,
} from "@/features/configuration/components/ConfigurationToolbar"
import { ConfigurationWorkspace } from "@/features/configuration/components/ConfigurationWorkspace"
import { ReferenceDrawer } from "@/features/configuration/components/ReferenceDrawer"
import { ReferenceTable } from "@/features/configuration/components/ReferenceTable"
import {
  useConfigAudit,
  useReferenceEntries,
  useReferenceMutations,
} from "@/features/configuration/hooks/use-configuration"
import type { ReferenceEntry } from "@/features/configuration/lib/types"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

export default function ReferenceCategoryPage() {
  const params = useParams<{ category: string }>()
  const categoryCode = params.category
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")
  const canManage = hasPermission("settings:manage") || hasPermission("role:assign")

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("ALL")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
  const [activeEntry, setActiveEntry] = useState<ReferenceEntry | null>(null)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditEntryId, setAuditEntryId] = useState<string | undefined>()

  const { data, isLoading, isError, error } = useReferenceEntries(categoryCode, {
    search: search || undefined,
    status: status === "ALL" ? undefined : status,
    limit: 100,
  })
  const mutations = useReferenceMutations()
  const audit = useConfigAudit({
    entityType: "ReferenceEntry",
    entityId: auditEntryId,
  })

  const items = data?.items ?? []
  const title = data?.category.name ?? categoryCode

  const selectedCount = selectedIds.size
  const exportCsv = () => {
    const header = ["code", "name", "description", "value", "status", "version", "updatedAt"]
    const rows = items.map((e) =>
      [e.code, e.name, e.description ?? "", e.value ?? "", e.status, e.version, e.updatedAt]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",")
    )
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${categoryCode}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectedList = useMemo(() => Array.from(selectedIds), [selectedIds])

  if (!canView) {
    return <EmptyState title="Reference catalog unavailable" description="Requires settings:view." />
  }

  return (
    <ConfigurationWorkspace
      title={title}
      description={data?.category.description ?? "Reference catalog entries"}
      actions={
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!canManage}
          onClick={() => {
            setDrawerMode("create")
            setActiveEntry(null)
            setDrawerOpen(true)
          }}
        >
          Create entry
        </Button>
      }
    >
      <ConfigurationToolbar>
        <SearchToolbar value={search} onChange={setSearch} placeholder="Search name, code…" />
        <div className="flex flex-wrap gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px] cursor-pointer">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="DISABLED">Disabled</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={exportCsv}>
            Export
          </Button>
        </div>
      </ConfigurationToolbar>

      <div className="mt-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading entries…</p>
        ) : isError ? (
          <EmptyState
            title="Failed to load entries"
            description={error instanceof Error ? error.message : "Unknown error"}
          />
        ) : (
          <ReferenceTable
            items={items}
            selectedIds={selectedIds}
            onToggle={(id) =>
              setSelectedIds((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
            onToggleAll={(checked) => setSelectedIds(checked ? new Set(items.map((i) => i.id)) : new Set())}
            onEdit={(entry) => {
              setActiveEntry(entry)
              setDrawerMode("edit")
              setDrawerOpen(true)
            }}
            onClone={async (entry) => {
              try {
                await mutations.clone.mutateAsync({ id: entry.id })
                toast.success("Entry cloned")
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Clone failed")
              }
            }}
            onArchive={async (entry) => {
              try {
                await mutations.update.mutateAsync({ id: entry.id, status: "ARCHIVED" })
                toast.success("Entry archived")
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Archive failed")
              }
            }}
            onRestore={async (entry) => {
              try {
                await mutations.update.mutateAsync({ id: entry.id, status: "ACTIVE" })
                toast.success("Entry restored")
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Restore failed")
              }
            }}
            onHistory={(entry) => {
              setAuditEntryId(entry.id)
              setAuditOpen(true)
            }}
          />
        )}
      </div>

      <StickyActionBar>
        <p className="text-sm text-muted-foreground">
          {selectedCount ? `${selectedCount} selected` : `${items.length} entries`}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={!canManage || !selectedCount}
            onClick={async () => {
              try {
                await mutations.bulkStatus.mutateAsync({ ids: selectedList, status: "ACTIVE" })
                toast.success("Entries enabled")
                setSelectedIds(new Set())
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Bulk enable failed")
              }
            }}
          >
            Bulk enable
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={!canManage || !selectedCount}
            onClick={async () => {
              try {
                await mutations.bulkStatus.mutateAsync({ ids: selectedList, status: "DISABLED" })
                toast.success("Entries disabled")
                setSelectedIds(new Set())
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Bulk disable failed")
              }
            }}
          >
            Bulk disable
          </Button>
        </div>
      </StickyActionBar>

      <ReferenceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        categoryCode={categoryCode}
        entry={activeEntry}
        saving={mutations.create.isPending || mutations.update.isPending}
        onSubmit={async (values) => {
          try {
            if (drawerMode === "create") {
              await mutations.create.mutateAsync(values)
              toast.success("Entry created")
            } else if (activeEntry) {
              await mutations.update.mutateAsync({
                id: activeEntry.id,
                name: values.name,
                description: values.description,
                value: values.value,
              })
              toast.success("Entry updated")
            }
            setDrawerOpen(false)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed")
          }
        }}
      />
      <AuditTimeline open={auditOpen} onOpenChange={setAuditOpen} logs={audit.data} loading={audit.isLoading} />
    </ConfigurationWorkspace>
  )
}
