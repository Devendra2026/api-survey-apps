"use client"

import type { GeoWard } from "@/lib/api/types"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { Search } from "lucide-react"

export function WardRatesSidebar({
  wards,
  activeWardId,
  search,
  onSearchChange,
  onSelectWard,
  activeChip,
}: {
  wards: GeoWard[]
  activeWardId: string
  search: string
  onSearchChange: (v: string) => void
  onSelectWard: (id: string) => void
  activeChip: string
}) {
  return (
    <aside className="w-full shrink-0 space-y-2 lg:w-[17.5rem]">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Wards</p>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search wards…"
          className="h-9 pl-8"
          aria-label="Search wards"
        />
      </div>
      {wards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
          No wards for this ULB
        </p>
      ) : (
        <ul className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
          {wards.map((w) => {
            const active = w.id === activeWardId
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onSelectWard(w.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-200",
                    active
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                      : "border-transparent bg-transparent text-foreground hover:bg-muted/60"
                  )}
                >
                  <span className={cn("min-w-0 truncate", active ? "font-semibold" : "font-medium")}>
                    Ward {w.wardNumber} — {w.wardName}
                  </span>
                  {active ? (
                    <span className="shrink-0 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                      {activeChip}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
