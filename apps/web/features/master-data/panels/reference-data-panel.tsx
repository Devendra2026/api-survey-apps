"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { ReferenceDrawer } from "@/features/configuration/components/ReferenceDrawer"
import { ReferenceTable } from "@/features/configuration/components/ReferenceTable"
import {
  useReferenceCategories,
  useReferenceEntries,
  useReferenceMutations,
} from "@/features/configuration/hooks/use-configuration"
import type { ReferenceEntry } from "@/features/configuration/lib/types"
import { useAuthStore } from "@/stores/app-store"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Info, Plus, Search } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

export function ReferenceDataPanel({ initialCategory }: { initialCategory?: string }) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission("settings:manage") || hasPermission("role:assign")
  const { data: categories, isLoading: catsLoading } = useReferenceCategories()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const categoryFromUrl = initialCategory || searchParams.get("category") || ""
  const categoryCode = categoryFromUrl || categories?.[0]?.code || ""

  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create")
  const [activeEntry, setActiveEntry] = useState<ReferenceEntry | null>(null)

  const selectCategory = (code: string) => {
    setSelectedIds(new Set())
    setSearch("")
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", "reference")
    params.set("category", code)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const { data, isLoading, isError, error } = useReferenceEntries(categoryCode, {
    search: search || undefined,
    limit: 100,
  })
  const mutations = useReferenceMutations()

  const activeCount = useMemo(() => (data?.items ?? []).filter((i) => i.status === "ACTIVE").length, [data?.items])
  const items = data?.items ?? []
  const category = data?.category ?? categories?.find((c) => c.code === categoryCode)

  return (
    <div className="space-y-4">
      {catsLoading ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-36 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Reference categories">
          {categories?.map((cat) => {
            const selected = cat.code === categoryCode
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectCategory(cat.code)}
                className={cn(
                  "shrink-0 cursor-pointer rounded-xl border px-3 py-2 text-left text-sm transition-colors duration-200",
                  selected
                    ? "border-primary/40 bg-primary/5 font-medium text-foreground shadow-sm"
                    : "border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <span className="block max-w-[10rem] truncate">{cat.name}</span>
                <span className="text-[10px] text-muted-foreground">{cat._count.entries} options</span>
              </button>
            )
          })}
        </div>
      )}

      {!categoryCode ? (
        <EmptyState title="No categories" description="Reference catalogs have not been seeded yet." />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/50 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">{category?.name ?? categoryCode}</h3>
              <p className="max-w-xl text-sm text-muted-foreground">
                {category?.description ?? "Options shown on survey forms and configuration screens."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="font-normal">
                  {items.length} options
                </Badge>
                <Badge className="border-transparent bg-emerald-500/15 font-normal text-emerald-800 dark:text-emerald-300">
                  {activeCount} active
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1 sm:w-52 sm:flex-none">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search options…"
                  className="h-9 pl-8"
                  aria-label="Search options"
                />
              </div>
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
                <Plus className="size-4" aria-hidden />
                Add option
              </Button>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading options…</p>
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
              onHistory={() => {
                toast.message("Open Audit Log under Administration for full history.")
              }}
            />
          )}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Changes sync live to all open survey forms. Edits here appear in configuration audit where enabled.
          </p>
        </>
      )}

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
              toast.success("Option created")
            } else if (activeEntry) {
              await mutations.update.mutateAsync({
                id: activeEntry.id,
                name: values.name,
                description: values.description,
                value: values.value,
              })
              toast.success("Option updated")
            }
            setDrawerOpen(false)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed")
          }
        }}
      />
    </div>
  )
}
