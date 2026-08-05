"use client"

import { useWards } from "@/hooks/use-api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ulbTypeBadge } from "../lib/geo-display"
import type { GeographyTreeNode } from "../lib/types"
import { SearchToolbar } from "./ConfigurationToolbar"
import { WardPillGrid } from "./WardPillGrid"

function nodeMatches(node: GeographyTreeNode, q: string): boolean {
  const lower = q.toLowerCase()
  return (
    node.name.toLowerCase().includes(lower) ||
    (node.code?.toLowerCase().includes(lower) ?? false) ||
    (node.wardNumber?.toLowerCase().includes(lower) ?? false)
  )
}

/** Filter tree; keep ancestors of matches. Returns filtered tree + ids that should expand. */
function filterGeographyTree(
  nodes: GeographyTreeNode[],
  q: string
): { nodes: GeographyTreeNode[]; expandIds: Set<string> } {
  if (!q.trim()) return { nodes, expandIds: new Set() }
  const expandIds = new Set<string>()

  const walk = (list: GeographyTreeNode[]): GeographyTreeNode[] =>
    list
      .map((n) => {
        const children = n.children ? walk(n.children) : []
        const selfMatch = nodeMatches(n, q)
        if (selfMatch || children.length) {
          if (children.length) expandIds.add(n.id)
          for (const c of children) {
            if (c.children?.length) expandIds.add(c.id)
          }
          return { ...n, children }
        }
        return null
      })
      .filter(Boolean) as GeographyTreeNode[]

  return { nodes: walk(nodes), expandIds }
}

export function GeographyAccordion({
  nodes,
  loading,
  canManage,
  onEdit,
  onAddDistrict,
  onAddUlb,
  onAddWard,
  onWardClick,
}: {
  nodes: GeographyTreeNode[]
  loading?: boolean
  canManage: boolean
  onEdit: (node: GeographyTreeNode) => void
  onAddDistrict: (state: GeographyTreeNode) => void
  onAddUlb: (district: GeographyTreeNode) => void
  onAddWard: (ulb: GeographyTreeNode) => void
  onWardClick: (ward: GeographyTreeNode) => void
}) {
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const { nodes: filtered, expandIds } = useMemo(() => filterGeographyTree(nodes, query), [nodes, query])

  useEffect(() => {
    if (!query.trim()) return
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const id of expandIds) next.add(id)
      return next
    })
  }, [query, expandIds])

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading hierarchy…</p>
  }

  if (nodes.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No geography yet. Create a state to begin.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchToolbar value={query} onChange={setQuery} placeholder="Search districts, ULBs, or wards…" />
      <div className="space-y-3">
        {filtered.map((state) => (
          <StateCard
            key={state.id}
            state={state}
            expanded={expanded}
            onToggle={toggle}
            canManage={canManage}
            onEdit={onEdit}
            onAddDistrict={onAddDistrict}
            onAddUlb={onAddUlb}
            onAddWard={onAddWard}
            onWardClick={onWardClick}
          />
        ))}
        {filtered.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No geography nodes match.</p> : null}
      </div>
    </div>
  )
}

function StateCard({
  state,
  expanded,
  onToggle,
  canManage,
  onEdit,
  onAddDistrict,
  onAddUlb,
  onAddWard,
  onWardClick,
}: {
  state: GeographyTreeNode
  expanded: Set<string>
  onToggle: (id: string) => void
  canManage: boolean
  onEdit: (node: GeographyTreeNode) => void
  onAddDistrict: (state: GeographyTreeNode) => void
  onAddUlb: (district: GeographyTreeNode) => void
  onAddWard: (ulb: GeographyTreeNode) => void
  onWardClick: (ward: GeographyTreeNode) => void
}) {
  const open = expanded.has(state.id)
  const districts = state.children ?? []

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-3 py-2.5">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 text-left"
          onClick={() => onToggle(state.id)}
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="font-semibold">{state.name}</span>
          {state.code ? <span className="font-mono text-xs text-muted-foreground">{state.code}</span> : null}
        </button>
        <Badge variant="secondary" className="tabular-nums">
          {districts.length} {districts.length === 1 ? "district" : "districts"}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => onAddDistrict(state)}
            >
              <Plus className="size-3.5" />
              Add district
            </Button>
          ) : null}
          {canManage ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 cursor-pointer"
              aria-label="Edit state"
              onClick={() => onEdit(state)}
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="space-y-3 p-3">
          {districts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No districts in this state.</p>
          ) : (
            districts.map((district) => (
              <DistrictCard
                key={district.id}
                district={district}
                stateName={state.name}
                expanded={expanded}
                onToggle={onToggle}
                canManage={canManage}
                onEdit={onEdit}
                onAddUlb={onAddUlb}
                onAddWard={onAddWard}
                onWardClick={onWardClick}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function DistrictCard({
  district,
  stateName,
  expanded,
  onToggle,
  canManage,
  onEdit,
  onAddUlb,
  onAddWard,
  onWardClick,
}: {
  district: GeographyTreeNode
  stateName: string
  expanded: Set<string>
  onToggle: (id: string) => void
  canManage: boolean
  onEdit: (node: GeographyTreeNode) => void
  onAddUlb: (district: GeographyTreeNode) => void
  onAddWard: (ulb: GeographyTreeNode) => void
  onWardClick: (ward: GeographyTreeNode) => void
}) {
  const open = expanded.has(district.id)
  const ulbs = district.children ?? []
  const ulbCount = district.counts.ulbs ?? ulbs.length

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          onClick={() => onToggle(district.id)}
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate font-medium">{district.name}</span>
          {district.code ? (
            <span className="shrink-0 font-mono text-xs font-semibold tracking-wide text-muted-foreground">
              {district.code}
            </span>
          ) : null}
          <span className="truncate text-xs text-muted-foreground">{stateName}</span>
        </button>
        <Badge variant="secondary" className="tabular-nums">
          {ulbCount} {ulbCount === 1 ? "ULB" : "ULBs"}
        </Badge>
        {canManage ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 cursor-pointer"
            aria-label="Edit district"
            onClick={() => onEdit(district)}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-2 border-t border-border/50 bg-muted/20 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">ULBs / Municipalities</p>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => onAddUlb(district)}
              >
                <Plus className="size-3.5" />
                Add ULB
              </Button>
            ) : null}
          </div>
          {ulbs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ULBs in this district.</p>
          ) : (
            <div className="space-y-2">
              {ulbs.map((ulb) => (
                <UlbCard
                  key={ulb.id}
                  ulb={ulb}
                  expanded={expanded}
                  onToggle={onToggle}
                  canManage={canManage}
                  onEdit={onEdit}
                  onAddWard={onAddWard}
                  onWardClick={onWardClick}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function UlbCard({
  ulb,
  expanded,
  onToggle,
  canManage,
  onEdit,
  onAddWard,
  onWardClick,
}: {
  ulb: GeographyTreeNode
  expanded: Set<string>
  onToggle: (id: string) => void
  canManage: boolean
  onEdit: (node: GeographyTreeNode) => void
  onAddWard: (ulb: GeographyTreeNode) => void
  onWardClick: (ward: GeographyTreeNode) => void
}) {
  const open = expanded.has(ulb.id)
  const { data: wardsPage, isLoading: wardsLoading, isError: wardsError } = useWards(open ? ulb.id : undefined)
  const wardsFromApi = useMemo((): GeographyTreeNode[] => {
    const items = wardsPage?.items ?? []
    return items.map((w) => ({
      id: w.id,
      type: "ward" as const,
      name: w.wardName,
      wardNumber: w.wardNumber,
      status: "ACTIVE" as const,
      parentId: ulb.id,
      counts: {},
    }))
  }, [wardsPage?.items, ulb.id])
  const wards = wardsFromApi.length > 0 ? wardsFromApi : (ulb.children ?? [])
  const wardCount = ulb.counts.wards ?? wards.length

  return (
    <div className={cn("rounded-md border border-border/50 bg-card")}>
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          onClick={() => onToggle(ulb.id)}
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-medium">{ulb.name}</span>
          {ulb.code ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{ulb.code}</span> : null}
          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
            {ulbTypeBadge(ulb.ulbType)}
          </Badge>
        </button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {wardCount} {wardCount === 1 ? "ward" : "wards"}
        </span>
        {canManage ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 cursor-pointer"
            aria-label="Edit ULB"
            onClick={() => onEdit(ulb)}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-2 border-t border-border/40 px-2.5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Wards</p>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 cursor-pointer text-xs"
                onClick={() => onAddWard(ulb)}
              >
                <Plus className="size-3.5" />
                Add ward
              </Button>
            ) : null}
          </div>
          {wardsLoading ? <p className="text-sm text-muted-foreground">Loading wards…</p> : null}
          {wardsError ? <p className="text-sm text-destructive">Could not load wards for this ULB.</p> : null}
          {!wardsLoading && !wardsError ? (
            <WardPillGrid wards={wards} onWardClick={canManage ? onWardClick : undefined} disabled={!canManage} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
