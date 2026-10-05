"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Switch } from "@workspace/ui/components/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Home,
  Landmark,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useGeographyUlbWards } from "../hooks/use-configuration"
import type { GeographyTreeNode } from "../lib/types"
import { SearchToolbar } from "./ConfigurationToolbar"

type StatusFilter = "all" | "active" | "inactive"

type GeoTreeTableProps = {
  tree: GeographyTreeNode[]
  canManage: boolean
  isLoading?: boolean
  onAddLocation: () => void
  onAddChild: (node: GeographyTreeNode) => void
  onEdit: (node: GeographyTreeNode) => void
  onDelete: (node: GeographyTreeNode) => void
  onToggleStatus: (node: GeographyTreeNode, next: "ACTIVE" | "DISABLED") => void
}

function NodeTypeIcon({ type }: { type: GeographyTreeNode["type"] }) {
  const className = "size-3.5 shrink-0 text-muted-foreground"
  if (type === "state") return <Landmark className={className} />
  if (type === "district") return <MapPin className={className} />
  if (type === "ulb") return <Building2 className={className} />
  return <Home className={className} />
}

function displayName(node: GeographyTreeNode) {
  if (node.type === "ward") {
    return node.wardNumber ? `${node.wardNumber} — ${node.name}` : node.name
  }
  return node.name
}

function codeOrNumber(node: GeographyTreeNode) {
  if (node.type === "ward") return node.wardNumber ?? "—"
  return node.code ?? "—"
}

function formatCounts(counts: Record<string, number>) {
  const parts = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${value} ${key}`)
  return parts.length ? parts.join(" · ") : "—"
}

function childLabel(type: GeographyTreeNode["type"]) {
  switch (type) {
    case "state":
      return "Add district"
    case "district":
      return "Add ULB"
    case "ulb":
      return "Add ward"
    case "ward":
      return null
  }
}

function matchesQuery(node: GeographyTreeNode, lower: string) {
  return (
    node.name.toLowerCase().includes(lower) ||
    node.code?.toLowerCase().includes(lower) ||
    Boolean(node.wardNumber?.toLowerCase().includes(lower))
  )
}

function matchesStatus(node: GeographyTreeNode, status: StatusFilter) {
  if (status === "all") return true
  if (status === "active") return node.status === "ACTIVE"
  return node.status === "DISABLED" || node.status === "ARCHIVED"
}

function filterTree(nodes: GeographyTreeNode[], query: string, status: StatusFilter): GeographyTreeNode[] {
  const lower = query.trim().toLowerCase()
  const walk = (list: GeographyTreeNode[]): GeographyTreeNode[] =>
    list
      .map((n) => {
        const children = n.children ? walk(n.children) : []
        const queryOk = !lower || matchesQuery(n, lower)
        const statusOk = matchesStatus(n, status)
        if ((queryOk && statusOk) || children.length) {
          return { ...n, children }
        }
        return null
      })
      .filter(Boolean) as GeographyTreeNode[]
  return walk(nodes)
}

function collectExpandableIds(list: GeographyTreeNode[], acc: string[] = []) {
  for (const n of list) {
    if (n.children?.length) {
      acc.push(n.id)
      collectExpandableIds(n.children, acc)
    }
  }
  return acc
}

function countByType(list: GeographyTreeNode[]) {
  const counts = { state: 0, district: 0, ulb: 0, ward: 0 }
  const walk = (nodes: GeographyTreeNode[]) => {
    for (const n of nodes) {
      counts[n.type] += 1
      if (n.children?.length) walk(n.children)
    }
  }
  walk(list)
  return counts
}

function treeHasUpdatedAt(nodes: GeographyTreeNode[]): boolean {
  for (const n of nodes) {
    if ("updatedAt" in n && typeof (n as { updatedAt?: unknown }).updatedAt === "string") {
      return true
    }
    if (n.children?.length && treeHasUpdatedAt(n.children)) return true
  }
  return false
}

function statusBadgeVariant(status: GeographyTreeNode["status"]) {
  if (status === "ACTIVE") return "default" as const
  if (status === "DISABLED") return "secondary" as const
  return "outline" as const
}

function TreeRow({
  node,
  depth,
  expanded,
  canManage,
  showUpdated,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  node: GeographyTreeNode
  depth: number
  expanded: Set<string>
  canManage: boolean
  showUpdated: boolean
  onToggle: (id: string) => void
  onAddChild: (node: GeographyTreeNode) => void
  onEdit: (node: GeographyTreeNode) => void
  onDelete: (node: GeographyTreeNode) => void
  onToggleStatus: (node: GeographyTreeNode, next: "ACTIVE" | "DISABLED") => void
}) {
  const isOpen = expanded.has(node.id)
  const wardsQuery = useGeographyUlbWards(node.type === "ulb" && isOpen ? node.id : undefined)
  const childNodes = node.type === "ulb" ? (wardsQuery.data ?? []) : (node.children ?? [])
  const hasChildren = node.type === "ulb" || childNodes.length > 0
  const addChildText = childLabel(node.type)
  const updatedAt = showUpdated && "updatedAt" in node ? ((node as { updatedAt?: string }).updatedAt ?? "—") : null
  const canToggle = canManage && node.status !== "ARCHIVED"

  return (
    <>
      <TableRow className="text-sm">
        <TableCell className="py-1">
          <div
            className="flex min-w-0 items-center gap-1"
            style={{ paddingLeft: depth * 14 }}
            role="treeitem"
            aria-expanded={hasChildren ? isOpen : undefined}
            aria-level={depth + 1}
          >
            <button
              type="button"
              className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground"
              aria-label={isOpen ? "Collapse" : "Expand"}
              disabled={!hasChildren}
              onClick={() => {
                if (hasChildren) onToggle(node.id)
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" && hasChildren && !isOpen) {
                  e.preventDefault()
                  onToggle(node.id)
                }
                if (e.key === "ArrowLeft" && hasChildren && isOpen) {
                  e.preventDefault()
                  onToggle(node.id)
                }
                if (e.key === "Enter" && hasChildren) {
                  e.preventDefault()
                  onToggle(node.id)
                }
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
            <NodeTypeIcon type={node.type} />
            <span className="min-w-0 truncate font-medium">{displayName(node)}</span>
            <Badge variant="outline" className="ml-1 shrink-0 px-1.5 py-0 text-[10px] font-normal uppercase">
              {node.type}
            </Badge>
          </div>
        </TableCell>
        <TableCell className="py-1 font-mono text-xs text-muted-foreground">{codeOrNumber(node)}</TableCell>
        <TableCell className="py-1 text-xs text-muted-foreground">{formatCounts(node.counts)}</TableCell>
        <TableCell className="py-1">
          <div className="flex items-center gap-2">
            <Badge variant={statusBadgeVariant(node.status)} className="font-normal">
              {node.status === "DISABLED" ? "Inactive" : node.status}
            </Badge>
            {canManage ? (
              <Switch
                checked={node.status === "ACTIVE"}
                disabled={!canToggle}
                aria-label={`Toggle status for ${displayName(node)}`}
                onCheckedChange={(checked) => {
                  if (!canToggle) return
                  onToggleStatus(node, checked ? "ACTIVE" : "DISABLED")
                }}
              />
            ) : null}
          </div>
        </TableCell>
        {showUpdated ? (
          <TableCell className="py-1 text-xs whitespace-nowrap text-muted-foreground">{updatedAt}</TableCell>
        ) : null}
        <TableCell className="py-1 text-right">
          <div className="flex items-center justify-end gap-1">
            {node.type === "ulb" ? (
              <Button asChild variant="ghost" size="sm" className="h-7 cursor-pointer px-2 text-xs">
                <Link href={`/configuration/geography/ulbs/${node.id}/pin-codes`}>PIN codes</Link>
              </Button>
            ) : null}
            {canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7 cursor-pointer" aria-label="Actions">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="cursor-pointer" onClick={() => onEdit(node)}>
                    <Pencil className="size-4" /> Edit
                  </DropdownMenuItem>
                  {addChildText ? (
                    <DropdownMenuItem className="cursor-pointer" onClick={() => onAddChild(node)}>
                      <Plus className="size-4" /> {addChildText}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => onDelete(node)}
                  >
                    <Trash2 className="size-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
      {isOpen && node.type === "ulb" && wardsQuery.isLoading ? (
        <TableRow>
          <TableCell colSpan={showUpdated ? 6 : 5} className="py-2 text-xs text-muted-foreground">
            Loading wards…
          </TableCell>
        </TableRow>
      ) : null}
      {hasChildren && isOpen
        ? childNodes.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              canManage={canManage}
              showUpdated={showUpdated}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleStatus={onToggleStatus}
            />
          ))
        : null}
    </>
  )
}

function LoadingSkeleton({ showUpdated }: { showUpdated: boolean }) {
  const cols = showUpdated ? 6 : 5
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j} className="py-1">
              <Skeleton className={cn("h-4", j === 0 ? "w-48" : "w-20")} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function GeoTreeTable({
  tree,
  canManage,
  isLoading,
  onAddLocation,
  onAddChild,
  onEdit,
  onDelete,
  onToggleStatus,
}: GeoTreeTableProps) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const showUpdated = useMemo(() => treeHasUpdatedAt(tree), [tree])
  const filtered = useMemo(() => filterTree(tree, query, statusFilter), [tree, query, statusFilter])
  const typeCounts = useMemo(() => countByType(filtered), [filtered])
  const colSpan = showUpdated ? 6 : 5
  const hasFilters = Boolean(query.trim()) || statusFilter !== "all"

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-50 flex-1">
          <SearchToolbar value={query} onChange={setQuery} placeholder="Search locations…" />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          onClick={() => setExpanded(new Set(collectExpandableIds(filtered)))}
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
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-8 w-32.5 cursor-pointer" aria-label="Status filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-normal tabular-nums">
            {typeCounts.state} states
          </Badge>
          <Badge variant="secondary" className="font-normal tabular-nums">
            {typeCounts.district} districts
          </Badge>
          <Badge variant="secondary" className="font-normal tabular-nums">
            {typeCounts.ulb} ULBs
          </Badge>
          <Badge variant="secondary" className="font-normal tabular-nums">
            {typeCounts.ward} wards
          </Badge>
        </div>
        {canManage ? (
          <Button type="button" size="sm" className="ml-auto cursor-pointer" onClick={onAddLocation}>
            <Plus className="size-3.5" /> Add Location
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code / Number</TableHead>
              <TableHead>Counts</TableHead>
              <TableHead>Status</TableHead>
              {showUpdated ? <TableHead>Updated</TableHead> : null}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <LoadingSkeleton showUpdated={showUpdated} />
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-28 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {hasFilters
                        ? "No locations match"
                        : tree.length === 0
                          ? "No locations yet"
                          : "No locations match"}
                    </p>
                    {hasFilters ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => {
                          setQuery("")
                          setStatusFilter("all")
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : canManage && tree.length === 0 ? (
                      <Button type="button" size="sm" className="cursor-pointer" onClick={onAddLocation}>
                        <Plus className="size-3.5" /> Add Location
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  canManage={canManage}
                  showUpdated={showUpdated}
                  onToggle={toggleExpanded}
                  onAddChild={onAddChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleStatus={onToggleStatus}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
