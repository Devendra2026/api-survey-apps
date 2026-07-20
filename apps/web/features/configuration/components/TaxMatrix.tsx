"use client"

import { Input } from "@workspace/ui/components/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { useMemo } from "react"
import type { TaxConfig, TaxRateCell } from "../lib/types"
import { num } from "../lib/formulas"

export function TaxRateCellInput({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <Input
      type="number"
      min={0}
      step="0.01"
      value={Number.isFinite(value) ? value : 0}
      disabled={disabled}
      className="h-8 min-w-[5.5rem] font-mono tabular-nums"
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Annual rate per sq ft"
    />
  )
}

export function TaxMatrix({
  config,
  onCellChange,
  disabled,
}: {
  config: TaxConfig
  onCellChange: (cell: { roadWidthEntryId: string; constructionEntryId: string; annualRatePerSqFt: number }) => void
  disabled?: boolean
}) {
  const { roads, constructions, cellMap } = useMemo(() => {
    const roadMap = new Map<string, { id: string; name: string }>()
    const constructionMap = new Map<string, { id: string; name: string }>()
    const map = new Map<string, TaxRateCell>()

    for (const cell of config.cells) {
      map.set(`${cell.roadWidthEntryId}:${cell.constructionEntryId}`, cell)
      if (cell.roadWidthEntry) {
        roadMap.set(cell.roadWidthEntryId, {
          id: cell.roadWidthEntryId,
          name: cell.roadWidthEntry.name,
        })
      }
      if (cell.constructionEntry) {
        constructionMap.set(cell.constructionEntryId, {
          id: cell.constructionEntryId,
          name: cell.constructionEntry.name,
        })
      }
    }

    return {
      roads: Array.from(roadMap.values()),
      constructions: Array.from(constructionMap.values()),
      cellMap: map,
    }
  }, [config.cells])

  if (!roads.length || !constructions.length) {
    return <p className="text-sm text-muted-foreground">Matrix cells will appear after draft creation.</p>
  }

  return (
    <div className="overflow-auto rounded-lg border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background">Road Width</TableHead>
            {constructions.map((c) => (
              <TableHead key={c.id} className="min-w-[120px] whitespace-nowrap">
                {c.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {roads.map((road) => (
            <TableRow key={road.id}>
              <TableCell className="sticky left-0 z-10 bg-background font-medium">{road.name}</TableCell>
              {constructions.map((construction) => {
                const cell = cellMap.get(`${road.id}:${construction.id}`)
                return (
                  <TableCell key={construction.id}>
                    <TaxRateCellInput
                      value={num(cell?.annualRatePerSqFt)}
                      disabled={disabled}
                      onChange={(annualRatePerSqFt) =>
                        onCellChange({
                          roadWidthEntryId: road.id,
                          constructionEntryId: construction.id,
                          annualRatePerSqFt,
                        })
                      }
                    />
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
