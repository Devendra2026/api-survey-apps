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
import { useEffect, useMemo, useState } from "react"
import type { GeographyTreeNode } from "../lib/types"

export type GeoLevel = "state" | "district" | "ulb" | "ward"

const LEVEL_LABELS: Record<GeoLevel, string> = {
  state: "State",
  district: "District",
  ulb: "ULB",
  ward: "Ward",
}

const ULB_TYPES = [
  { value: "MUNICIPAL_COUNCIL", label: "Municipal Council" },
  { value: "TOWN_PANCHAYAT", label: "Town Panchayat" },
] as const

function collectByType(nodes: GeographyTreeNode[], type: GeoLevel): GeographyTreeNode[] {
  const out: GeographyTreeNode[] = []
  const walk = (list: GeographyTreeNode[]) => {
    for (const n of list) {
      if (n.type === type) out.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

function findNode(nodes: GeographyTreeNode[], id: string): GeographyTreeNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const found = findNode(n.children, id)
      if (found) return found
    }
  }
  return undefined
}

function childrenOfType(nodes: GeographyTreeNode[], parentId: string | undefined, type: GeoLevel): GeographyTreeNode[] {
  if (!parentId) return []
  const parent = findNode(nodes, parentId)
  return (parent?.children ?? []).filter((c) => c.type === type)
}

type AddLocationDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  /** When edit, lock level and prefills */
  initial?: {
    level: GeoLevel
    id: string
    name: string
    code?: string
    wardNumber?: string
    ulbType?: string
    parentIds?: { stateId?: string; districtId?: string; ulbId?: string }
  }
  /** Prefill parents when Add child from a row */
  createDefaults?: {
    level: GeoLevel
    stateId?: string
    districtId?: string
    ulbId?: string
  }
  tree: GeographyTreeNode[]
  saving?: boolean
  onSubmit: (payload: {
    level: GeoLevel
    name: string
    code?: string
    wardNumber?: string
    ulbType?: string
    stateId?: string
    districtId?: string
    ulbId?: string
  }) => void
}

export function AddLocationDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  createDefaults,
  tree,
  saving,
  onSubmit,
}: AddLocationDrawerProps) {
  const [level, setLevel] = useState<GeoLevel>("state")
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [wardNumber, setWardNumber] = useState("")
  const [ulbType, setUlbType] = useState<string>("MUNICIPAL_COUNCIL")
  const [stateId, setStateId] = useState<string>("")
  const [districtId, setDistrictId] = useState<string>("")
  const [ulbId, setUlbId] = useState<string>("")

  useEffect(() => {
    if (!open) return

    if (mode === "edit" && initial) {
      setLevel(initial.level)
      setName(initial.name)
      setCode(initial.code ?? "")
      setWardNumber(initial.wardNumber ?? "")
      setUlbType(initial.ulbType ?? "MUNICIPAL_COUNCIL")
      setStateId(initial.parentIds?.stateId ?? "")
      setDistrictId(initial.parentIds?.districtId ?? "")
      setUlbId(initial.parentIds?.ulbId ?? "")
      return
    }

    const defaults = createDefaults
    setLevel(defaults?.level ?? "state")
    setName("")
    setCode("")
    setWardNumber("")
    setUlbType("MUNICIPAL_COUNCIL")
    setStateId(defaults?.stateId ?? "")
    setDistrictId(defaults?.districtId ?? "")
    setUlbId(defaults?.ulbId ?? "")
  }, [open, mode, initial, createDefaults])

  const stateOptions = useMemo(() => collectByType(tree, "state"), [tree])
  const districtOptions = useMemo(() => childrenOfType(tree, stateId || undefined, "district"), [tree, stateId])
  const ulbOptions = useMemo(() => childrenOfType(tree, districtId || undefined, "ulb"), [tree, districtId])

  const needsState = level === "district" || level === "ulb" || level === "ward"
  const needsDistrict = level === "ulb" || level === "ward"
  const needsUlb = level === "ward"
  const needsCode = level === "state" || level === "district" || level === "ulb"
  const needsWardNumber = level === "ward"
  const needsUlbType = level === "ulb"

  const title =
    mode === "edit" ? `Edit ${LEVEL_LABELS[level]}` : level === "state" ? "Add Location" : `Add ${LEVEL_LABELS[level]}`

  const description =
    mode === "edit"
      ? `Update ${LEVEL_LABELS[level].toLowerCase()} details`
      : "Create a location in the geography hierarchy"

  function handleLevelChange(next: GeoLevel) {
    setLevel(next)
    // Keep parents that still apply; clear deeper ones that no longer do
    if (next === "state") {
      setStateId("")
      setDistrictId("")
      setUlbId("")
    } else if (next === "district") {
      setDistrictId("")
      setUlbId("")
    } else if (next === "ulb") {
      setUlbId("")
    }
    setCode("")
    setWardNumber("")
    setUlbType("MUNICIPAL_COUNCIL")
  }

  function handleStateChange(next: string) {
    setStateId(next)
    setDistrictId("")
    setUlbId("")
  }

  function handleDistrictChange(next: string) {
    setDistrictId(next)
    setUlbId("")
  }

  function handleSubmit() {
    const payload: Parameters<AddLocationDrawerProps["onSubmit"]>[0] = {
      level,
      name: name.trim(),
    }
    if (needsCode) payload.code = code.trim()
    if (needsWardNumber) payload.wardNumber = wardNumber.trim()
    if (needsUlbType) payload.ulbType = ulbType
    if (needsState && stateId) payload.stateId = stateId
    if (needsDistrict && districtId) payload.districtId = districtId
    if (needsUlb && ulbId) payload.ulbId = ulbId
    onSubmit(payload)
  }

  const districtCodeOk = level !== "district" || /^[A-Za-z]{3}$/.test(code.trim())
  const canSubmit =
    name.trim().length > 0 &&
    (!needsCode || code.trim().length > 0) &&
    districtCodeOk &&
    (!needsWardNumber || wardNumber.trim().length > 0) &&
    (!needsState || Boolean(stateId)) &&
    (!needsDistrict || Boolean(districtId)) &&
    (!needsUlb || Boolean(ulbId))

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
            if (canSubmit) handleSubmit()
          }}
        >
          <div className="space-y-2">
            <Label>Level</Label>
            <Select value={level} onValueChange={(v) => handleLevelChange(v as GeoLevel)} disabled={mode === "edit"}>
              <SelectTrigger className="cursor-pointer" disabled={mode === "edit"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LEVEL_LABELS) as GeoLevel[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {LEVEL_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsState ? (
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={stateId || undefined} onValueChange={handleStateChange}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {stateOptions.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {needsDistrict ? (
            <div className="space-y-2">
              <Label>District</Label>
              <Select value={districtId || undefined} onValueChange={handleDistrictChange} disabled={!stateId}>
                <SelectTrigger className="cursor-pointer" disabled={!stateId}>
                  <SelectValue placeholder={stateId ? "Select district" : "Select state first"} />
                </SelectTrigger>
                <SelectContent>
                  {districtOptions.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {needsUlb ? (
            <div className="space-y-2">
              <Label>ULB</Label>
              <Select value={ulbId || undefined} onValueChange={setUlbId} disabled={!districtId}>
                <SelectTrigger className="cursor-pointer" disabled={!districtId}>
                  <SelectValue placeholder={districtId ? "Select ULB" : "Select district first"} />
                </SelectTrigger>
                <SelectContent>
                  {ulbOptions.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {needsWardNumber ? (
            <div className="space-y-2">
              <Label htmlFor="add-loc-ward-number">Ward number</Label>
              <Input
                id="add-loc-ward-number"
                value={wardNumber}
                onChange={(e) => setWardNumber(e.target.value)}
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="add-loc-name">{level === "ward" ? "Ward name" : "Name"}</Label>
            <Input id="add-loc-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {needsCode ? (
            <div className="space-y-2">
              <Label htmlFor="add-loc-code">{level === "district" ? "District code" : "Code"}</Label>
              <Input
                id="add-loc-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={level === "district" ? 3 : undefined}
                className="font-mono"
                aria-describedby={level === "district" ? "add-loc-code-hint" : undefined}
              />
              {level === "district" ? (
                <p id="add-loc-code-hint" className="text-xs text-muted-foreground">
                  Exactly 3 letters (A–Z)
                </p>
              ) : null}
            </div>
          ) : null}

          {needsUlbType ? (
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={ulbType} onValueChange={setUlbType}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ULB_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <SheetFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="cursor-pointer" disabled={saving || !canSubmit}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
