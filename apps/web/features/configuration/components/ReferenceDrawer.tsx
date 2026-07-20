"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import { useEffect, useState } from "react"
import type { ReferenceEntry } from "../lib/types"

export function ReferenceDrawer({
  open,
  onOpenChange,
  mode,
  categoryCode,
  entry,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  categoryCode: string
  entry?: ReferenceEntry | null
  saving?: boolean
  onSubmit: (values: {
    categoryCode: string
    code: string
    name: string
    description?: string
    value?: string
  }) => Promise<void> | void
}) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [value, setValue] = useState("")

  useEffect(() => {
    if (entry && mode === "edit") {
      setCode(entry.code)
      setName(entry.name)
      setDescription(entry.description ?? "")
      setValue(entry.value ?? "")
    } else if (open && mode === "create") {
      setCode("")
      setName("")
      setDescription("")
      setValue("")
    }
  }, [entry, mode, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "Create entry" : "Edit entry"}</SheetTitle>
          <SheetDescription>
            {mode === "create" ? `Add a new value to ${categoryCode}` : `Update ${entry?.name ?? "entry"}`}
          </SheetDescription>
        </SheetHeader>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void onSubmit({
              categoryCode,
              code,
              name,
              description: description || undefined,
              value: value || undefined,
            })
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="ref-code">Code</Label>
            <Input
              id="ref-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={mode === "edit"}
              required
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-name">Name</Label>
            <Input id="ref-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-value">Value</Label>
            <Input id="ref-value" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref-desc">Description</Label>
            <Textarea id="ref-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
