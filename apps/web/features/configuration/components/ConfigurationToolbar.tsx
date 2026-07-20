"use client"

import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Search, X } from "lucide-react"
import type { ReactNode } from "react"

export function SearchToolbar({
  value,
  onChange,
  placeholder = "Search…",
  actions,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-8"
          aria-label={placeholder}
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 size-7 -translate-y-1/2 cursor-pointer"
            onClick={() => onChange("")}
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
      {actions}
    </div>
  )
}

export function ConfigurationToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-[7.5rem] z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background/95 py-2 backdrop-blur">
      {children}
    </div>
  )
}

export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-1 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-background/95 px-1 py-3 backdrop-blur">
      {children}
    </div>
  )
}
