"use client"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { useEffect, useState } from "react"

type GeoDrawerMode = "create" | "edit"

function GeoDrawerShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description: string
  children: React.ReactNode
  saving?: boolean
  onSubmit: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          {children}
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

export function StateDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  mode: GeoDrawerMode
  initial?: { name: string; code: string }
  saving?: boolean
  onSubmit: (values: { name: string; code: string }) => void
}) {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setCode(initial?.code ?? "")
    }
  }, [open, initial])

  return (
    <GeoDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Create State" : "Edit State"}
      description="Top-level administrative unit"
      saving={saving}
      onSubmit={() => onSubmit({ name, code })}
    >
      <div className="space-y-2">
        <Label htmlFor="state-name">Name</Label>
        <Input id="state-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="state-code">Code</Label>
        <Input id="state-code" value={code} onChange={(e) => setCode(e.target.value)} required className="font-mono" />
      </div>
    </GeoDrawerShell>
  )
}

export function DistrictDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  mode: GeoDrawerMode
  initial?: { name: string; code: string }
  saving?: boolean
  onSubmit: (values: { name: string; code: string }) => void
}) {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setCode(initial?.code ?? "")
    }
  }, [open, initial])

  return (
    <GeoDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Create District" : "Edit District"}
      description="District within the selected state"
      saving={saving}
      onSubmit={() => {
        const normalized = code.trim().toUpperCase()
        if (!/^[A-Z]{3}$/.test(normalized)) {
          return
        }
        onSubmit({ name, code: normalized })
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="district-name">Name</Label>
        <Input id="district-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="district-code">Code</Label>
        <Input
          id="district-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onBlur={() => setCode((c) => c.trim().toUpperCase())}
          required
          maxLength={3}
          pattern="[A-Za-z]{3}"
          title="Exactly 3 letters (A–Z)"
          placeholder="BAG"
          className="font-mono uppercase"
        />
        <p className="text-xs text-muted-foreground">3 letters, e.g. BAG</p>
      </div>
    </GeoDrawerShell>
  )
}

export function ULBDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  mode: GeoDrawerMode
  initial?: { name: string; code: string; type: string }
  saving?: boolean
  onSubmit: (values: { name: string; code: string; type: string }) => void
}) {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [type, setType] = useState("MUNICIPAL_COUNCIL")
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setCode(initial?.code ?? "")
      setType(initial?.type ?? "MUNICIPAL_COUNCIL")
    }
  }, [open, initial])

  return (
    <GeoDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Create ULB" : "Edit ULB"}
      description="Urban Local Body under the selected district"
      saving={saving}
      onSubmit={() => onSubmit({ name, code, type })}
    >
      <div className="space-y-2">
        <Label htmlFor="ulb-name">Name</Label>
        <Input id="ulb-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ulb-code">Code</Label>
        <Input id="ulb-code" value={code} onChange={(e) => setCode(e.target.value)} required className="font-mono" />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MUNICIPAL_COUNCIL">Municipal Council</SelectItem>
            <SelectItem value="TOWN_PANCHAYAT">Town Panchayat</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </GeoDrawerShell>
  )
}

export function WardDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  saving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  mode: GeoDrawerMode
  initial?: { wardNumber: string; wardName: string }
  saving?: boolean
  onSubmit: (values: { wardNumber: string; wardName: string }) => void
}) {
  const [wardNumber, setWardNumber] = useState("")
  const [wardName, setWardName] = useState("")
  useEffect(() => {
    if (open) {
      setWardNumber(initial?.wardNumber ?? "")
      setWardName(initial?.wardName ?? "")
    }
  }, [open, initial])

  return (
    <GeoDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Create Ward" : "Edit Ward"}
      description="Ward within the selected ULB"
      saving={saving}
      onSubmit={() => onSubmit({ wardNumber, wardName })}
    >
      <div className="space-y-2">
        <Label htmlFor="ward-number">Ward number</Label>
        <Input id="ward-number" value={wardNumber} onChange={(e) => setWardNumber(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ward-name">Ward name</Label>
        <Input id="ward-name" value={wardName} onChange={(e) => setWardName(e.target.value)} required />
      </div>
    </GeoDrawerShell>
  )
}
