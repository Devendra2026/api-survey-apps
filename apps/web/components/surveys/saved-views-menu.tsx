"use client"

import { useSavedViewMutations, useSavedViews } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import type { SavedView } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Bookmark, Star, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export function SavedViewsMenu({
  currentFilters,
  currentColumns,
  onApply,
}: {
  currentFilters: Record<string, unknown>
  currentColumns: Record<string, boolean>
  onApply: (view: SavedView) => void
}) {
  const { data: views = [] } = useSavedViews("surveys")
  const mutations = useSavedViewMutations()
  const [name, setName] = useState("")
  const appliedDefault = useRef(false)

  useEffect(() => {
    if (appliedDefault.current || views.length === 0) return
    const defaultView = views.find((view) => view.isDefault)
    if (defaultView) {
      appliedDefault.current = true
      onApply(defaultView)
    }
  }, [views, onApply])

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Enter a view name")
      return
    }
    try {
      await mutations.create.mutateAsync({
        name: trimmed,
        entity: "surveys",
        filters: currentFilters,
        columns: currentColumns,
      })
      setName("")
      toast.success("View saved")
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Bookmark className="size-3.5" />
          Views
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Saved views</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">No saved views yet</div>
        ) : (
          views.map((view) => (
            <DropdownMenuItem
              key={view.id}
              className="flex items-center justify-between gap-2"
              onSelect={(event) => {
                event.preventDefault()
                onApply(view)
              }}
            >
              <span className="truncate">{view.name}</span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded p-1 hover:bg-muted"
                  title={view.isDefault ? "Default view" : "Set default"}
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      await mutations.update.mutateAsync({ id: view.id, body: { isDefault: true } })
                      toast.success("Default view updated")
                    } catch (error) {
                      toast.error(getApiErrorMessage(error))
                    }
                  }}
                >
                  <Star
                    className={`size-3.5 ${view.isDefault ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
                  />
                </button>
                <button
                  type="button"
                  className="rounded p-1 hover:bg-muted"
                  title="Delete view"
                  onClick={async (e) => {
                    e.stopPropagation()
                    try {
                      await mutations.remove.mutateAsync(view.id)
                      toast.success("View deleted")
                    } catch (error) {
                      toast.error(getApiErrorMessage(error))
                    }
                  }}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </button>
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <div className="flex items-center gap-2 p-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New view name"
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") void save()
            }}
          />
          <Button size="sm" className="h-8 shrink-0" onClick={() => void save()} disabled={mutations.create.isPending}>
            Save
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
