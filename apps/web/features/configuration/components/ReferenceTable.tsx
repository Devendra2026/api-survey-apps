"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Switch } from "@workspace/ui/components/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Copy, History, MoreHorizontal, Pencil, Archive, RotateCcw } from "lucide-react"
import type { ReferenceEntry } from "../lib/types"

function statusBadgeVariant(status: ReferenceEntry["status"]) {
  if (status === "ACTIVE") return "default" as const
  if (status === "DISABLED") return "secondary" as const
  return "outline" as const
}

export function ReferenceTable({
  items,
  selectedIds,
  onToggle,
  onToggleAll,
  onEdit,
  onClone,
  onArchive,
  onRestore,
  onHistory,
  canManage = false,
  onToggleStatus,
}: {
  items: ReferenceEntry[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onEdit: (entry: ReferenceEntry) => void
  onClone: (entry: ReferenceEntry) => void
  onArchive: (entry: ReferenceEntry) => void
  onRestore: (entry: ReferenceEntry) => void
  onHistory: (entry: ReferenceEntry) => void
  canManage?: boolean
  onToggleStatus?: (entry: ReferenceEntry, status: "ACTIVE" | "DISABLED") => void
}) {
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id))

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <Table>
        <TableHeader>
          <TableRow className="text-sm">
            <TableHead className="w-10 py-1.5">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => onToggleAll(Boolean(v))}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="w-20 py-1.5">Position</TableHead>
            <TableHead className="py-1.5">Label</TableHead>
            <TableHead className="py-1.5">Value</TableHead>
            <TableHead className="w-35 py-1.5">Status</TableHead>
            <TableHead className="w-12 py-1.5" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                No entries found
              </TableCell>
            </TableRow>
          ) : (
            items.map((entry) => {
              const canToggle = canManage && entry.status !== "ARCHIVED" && Boolean(onToggleStatus)
              return (
                <TableRow
                  key={entry.id}
                  className="text-sm"
                  data-state={selectedIds.has(entry.id) ? "selected" : undefined}
                >
                  <TableCell className="py-1.5">
                    <Checkbox
                      checked={selectedIds.has(entry.id)}
                      onCheckedChange={() => onToggle(entry.id)}
                      aria-label={`Select ${entry.name}`}
                    />
                  </TableCell>
                  <TableCell className="py-1.5 text-muted-foreground tabular-nums">{entry.sortOrder}</TableCell>
                  <TableCell className="py-1.5">
                    <div className="font-medium">{entry.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{entry.code}</div>
                  </TableCell>
                  <TableCell className="py-1.5 font-mono text-xs">{entry.value ?? entry.code}</TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariant(entry.status)} className="font-normal">
                        {entry.status === "DISABLED" ? "Inactive" : entry.status}
                      </Badge>
                      {canManage && onToggleStatus ? (
                        <Switch
                          checked={entry.status === "ACTIVE"}
                          disabled={!canToggle}
                          aria-label={`Toggle status for ${entry.name}`}
                          onCheckedChange={(checked) => {
                            if (!canToggle) return
                            onToggleStatus(entry, checked ? "ACTIVE" : "DISABLED")
                          }}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7 cursor-pointer" aria-label="Actions">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canManage ? (
                          <>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => onEdit(entry)}>
                              <Pencil className="size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => onClone(entry)}>
                              <Copy className="size-4" /> Clone
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        <DropdownMenuItem className="cursor-pointer" onClick={() => onHistory(entry)}>
                          <History className="size-4" /> History
                        </DropdownMenuItem>
                        {canManage ? (
                          entry.status === "ARCHIVED" ? (
                            <DropdownMenuItem className="cursor-pointer" onClick={() => onRestore(entry)}>
                              <RotateCcw className="size-4" /> Restore
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="cursor-pointer" onClick={() => onArchive(entry)}>
                              <Archive className="size-4" /> Archive
                            </DropdownMenuItem>
                          )
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
