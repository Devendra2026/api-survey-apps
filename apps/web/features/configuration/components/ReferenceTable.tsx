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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { format } from "date-fns"
import { Copy, History, MoreHorizontal, Pencil, Archive, RotateCcw } from "lucide-react"
import type { ReferenceEntry } from "../lib/types"

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
}) {
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id))

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => onToggleAll(Boolean(v))}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Updated By</TableHead>
            <TableHead>Updated At</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No entries found
              </TableCell>
            </TableRow>
          ) : (
            items.map((entry) => (
              <TableRow key={entry.id} data-state={selectedIds.has(entry.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(entry.id)}
                    onCheckedChange={() => onToggle(entry.id)}
                    aria-label={`Select ${entry.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{entry.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{entry.code}</div>
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-muted-foreground">
                  {entry.description ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">{entry.value ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={entry.status === "ACTIVE" ? "default" : "secondary"} className="font-normal">
                    {entry.status}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">v{entry.version}</TableCell>
                <TableCell className="text-muted-foreground">{entry.updatedBy ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {format(new Date(entry.updatedAt), "dd MMM yyyy HH:mm")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 cursor-pointer" aria-label="Actions">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="cursor-pointer" onClick={() => onEdit(entry)}>
                        <Pencil className="size-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => onClone(entry)}>
                        <Copy className="size-4" /> Clone
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => onHistory(entry)}>
                        <History className="size-4" /> History
                      </DropdownMenuItem>
                      {entry.status === "ARCHIVED" ? (
                        <DropdownMenuItem className="cursor-pointer" onClick={() => onRestore(entry)}>
                          <RotateCcw className="size-4" /> Restore
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem className="cursor-pointer" onClick={() => onArchive(entry)}>
                          <Archive className="size-4" /> Archive
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
