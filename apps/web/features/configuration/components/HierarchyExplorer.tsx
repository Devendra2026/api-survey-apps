"use client"

import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { Building2, ChevronDown, ChevronRight, MapPin, Landmark, Home } from "lucide-react"
import { useMemo, useState } from "react"
import type { GeographyTreeNode } from "../lib/types"
import { SearchToolbar } from "./ConfigurationToolbar"

function nodeIcon(type: GeographyTreeNode["type"]) {
  switch (type) {
    case "state":
      return Landmark
    case "district":
      return MapPin
    case "ulb":
      return Building2
    case "ward":
      return Home
  }
}

function filterTree(nodes: GeographyTreeNode[], q: string): GeographyTreeNode[] {
  if (!q.trim()) return nodes
  const lower = q.toLowerCase()
  const walk = (list: GeographyTreeNode[]): GeographyTreeNode[] =>
    list
      .map((n) => {
        const children = n.children ? walk(n.children) : []
        const match =
          n.name.toLowerCase().includes(lower) || n.code?.toLowerCase().includes(lower) || n.wardNumber?.includes(lower)
        if (match || children.length) return { ...n, children }
        return null
      })
      .filter(Boolean) as GeographyTreeNode[]
  return walk(nodes)
}

function TreeNodeRow({
  node,
  depth,
  expanded,
  selectedId,
  onToggle,
  onSelect,
}: {
  node: GeographyTreeNode
  depth: number
  expanded: Set<string>
  selectedId?: string
  onToggle: (id: string) => void
  onSelect: (node: GeographyTreeNode) => void
}) {
  const Icon = nodeIcon(node.type)
  const hasChildren = Boolean(node.children?.length)
  const isOpen = expanded.has(node.id)
  const count = node.counts.districts ?? node.counts.ulbs ?? node.counts.wards ?? node.counts.surveys ?? 0

  return (
    <div>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isOpen : undefined}
        tabIndex={0}
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-muted",
          selectedId === node.id && "bg-primary/10 text-foreground"
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect(node)
          }
          if (e.key === "ArrowRight" && hasChildren && !isOpen) onToggle(node.id)
          if (e.key === "ArrowLeft" && hasChildren && isOpen) onToggle(node.id)
        }}
      >
        <button
          type="button"
          className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground"
          aria-label={isOpen ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) onToggle(node.id)
          }}
        >
          {hasChildren ? (
            isOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
          ) : (
            <span className="size-3.5" />
          )}
        </button>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {node.type === "ward" ? `${node.wardNumber} — ${node.name}` : node.name}
        </span>
        <Badge variant="secondary" className="tabular-nums opacity-80">
          {count}
        </Badge>
      </div>
      {hasChildren && isOpen
        ? node.children!.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  )
}

export function HierarchyTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: GeographyTreeNode[]
  selectedId?: string
  onSelect: (node: GeographyTreeNode) => void
}) {
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const filtered = useMemo(() => filterTree(nodes, query), [nodes, query])

  const collectIds = (list: GeographyTreeNode[], acc: string[] = []) => {
    for (const n of list) {
      acc.push(n.id)
      if (n.children) collectIds(n.children, acc)
    }
    return acc
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <SearchToolbar value={query} onChange={setQuery} placeholder="Search hierarchy…" />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          onClick={() => setExpanded(new Set(collectIds(filtered)))}
        >
          Expand all
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          onClick={() => setExpanded(new Set())}
        >
          Collapse all
        </Button>
      </div>
      <div role="tree" className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 p-1">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No geography nodes match.</p>
        ) : (
          filtered.map((node) => (
            <TreeNodeRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={(id) =>
                setExpanded((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function HierarchyExplorer({
  nodes,
  selectedId,
  onSelect,
  loading,
}: {
  nodes: GeographyTreeNode[]
  selectedId?: string
  onSelect: (node: GeographyTreeNode) => void
  loading?: boolean
}) {
  if (loading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading hierarchy…</p>
  }
  return <HierarchyTree nodes={nodes} selectedId={selectedId} onSelect={onSelect} />
}
