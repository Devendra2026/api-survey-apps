"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { History, Pencil, Plus, Trash2 } from "lucide-react"
import type { GeographyTreeNode } from "../lib/types"

export function HierarchyDetailsPanel({
  node,
  onCreateChild,
  onEdit,
  onDelete,
  onAudit,
}: {
  node: GeographyTreeNode | null
  onCreateChild?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onAudit?: () => void
}) {
  if (!node) {
    return (
      <Card className="h-full border-border/70 shadow-none">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Select a node in the hierarchy explorer.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const childLabel =
    node.type === "state"
      ? "Create District"
      : node.type === "district"
        ? "Create ULB"
        : node.type === "ulb"
          ? "Create Ward"
          : null

  return (
    <Card className="h-full border-border/70 shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Badge variant="outline" className="mb-2 uppercase">
              {node.type}
            </Badge>
            <CardTitle>{node.type === "ward" ? `Ward ${node.wardNumber}` : node.name}</CardTitle>
            <CardDescription>{node.type === "ward" ? node.name : (node.code ?? "—")}</CardDescription>
          </div>
          <Badge variant={node.status === "ACTIVE" ? "default" : "secondary"}>{node.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(node.counts).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground capitalize">{key}</p>
              <p className="text-xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {childLabel ? (
            <Button type="button" size="sm" className="cursor-pointer" onClick={onCreateChild}>
              <Plus className="size-3.5" />
              {childLabel}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onAudit}>
            <History className="size-3.5" />
            Audit
          </Button>
          <Button type="button" size="sm" variant="destructive" className="cursor-pointer" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
