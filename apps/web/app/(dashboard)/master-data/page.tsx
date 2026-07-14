"use client"

import { EmptyState, PageHeader } from "@/components/shared/page-elements"
import { useDistricts, useStates, useUlbs, useWards } from "@/hooks/use-api"
import { useAuthStore } from "@/stores/app-store"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useMemo, useState } from "react"

const REFERENCE_SETS = [
  {
    id: "ownership",
    title: "Ownership types",
    description: "Prisma OwnershipType enum used by survey classification",
    values: [
      "INDIVIDUAL",
      "JOINT",
      "LIMITED_COMPANY_FIRM",
      "TRUST_SOCIETY",
      "RELIGIOUS_BODY",
      "STATE_GOVERNMENT_BODY",
      "CENTRAL_GOVERNMENT_BODY",
      "MUNICIPAL_COUNCIL_TOWN_PANCHAYAT",
      "LEASE_PROPERTY",
    ],
  },
  {
    id: "property-types",
    title: "Property types",
    description: "Prisma PropertyType enum for assessment categories",
    values: [
      "RESIDENTIAL_SELF",
      "RESIDENTIAL_RENTED",
      "SHOP_BAKERY",
      "BANK_OFFICE",
      "SCHOOL_COLLEGE",
      "MALL_SHOWROOM",
      "PETROL_PUMP",
      "HOTEL_MARRIAGE_RESTAURANT",
      "HOSPITAL_NURSING_PATHOLOGY",
      "GODOWN",
      "CENTRAL_GOVERNMENT",
      "STATE_GOVERNMENT",
      "INDUSTRY",
      "COLD_STORE",
      "OPEN",
      "AGRICULTURE",
      "OPEN_LAND_GODOWN",
      "MANDIR",
      "MASJID",
      "TRUST_DHARAMSHALA",
      "SHAMSHAN_KABRISTAN",
      "GURUDWARA_CHURCH",
      "RESIDENTIAL_AND_COMMERCIAL",
    ],
  },
  {
    id: "tax-zones",
    title: "Tax rate zones / road widths",
    description: "Road-width based tax matrix from TaxRateZone",
    values: ["BELOW_9M", "METER_9_TO_12", "METER_12_TO_24", "ABOVE_24M"],
  },
  {
    id: "construction",
    title: "Construction types",
    description: "Floor construction classification for tax demand",
    values: ["PAKKA_BUILDING_WITH_RCC_ROOF", "TIN_SHED", "OPEN_LAND", "UNDER_CONSTRUCTION", "KACCHA_BUILDING"],
  },
  {
    id: "assessment",
    title: "Assessment years",
    description: "Financial year labels used by import and registry",
    values: ["AY_2025_2026", "AY_2026_2027"],
  },
] as const

export default function MasterDataPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission("role:assign")

  const [stateId, setStateId] = useState("")
  const [districtId, setDistrictId] = useState("")
  const [ulbId, setUlbId] = useState("")

  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(stateId || undefined)
  const { data: ulbs } = useUlbs(districtId || undefined)
  const { data: wards } = useWards(ulbId || undefined)

  const selectedState = useMemo(() => states?.items.find((item) => item.id === stateId), [states, stateId])

  if (!canManage) {
    return (
      <EmptyState
        title="Master Data unavailable"
        description="You need administration permissions to manage reference data and hierarchy masters."
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Master Data"
        description="Enterprise reference catalogs and geography hierarchy for municipal property surveys"
      />

      <Tabs defaultValue="hierarchy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hierarchy">Geography hierarchy</TabsTrigger>
          <TabsTrigger value="reference">Reference catalogs</TabsTrigger>
          <TabsTrigger value="audit">Audit notes</TabsTrigger>
        </TabsList>

        <TabsContent value="hierarchy" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              value={stateId || undefined}
              onValueChange={(value) => {
                setStateId(value)
                setDistrictId("")
                setUlbId("")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {states?.items.map((state) => (
                  <SelectItem key={state.id} value={state.id}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={districtId || undefined}
              onValueChange={(value) => {
                setDistrictId(value)
                setUlbId("")
              }}
              disabled={!stateId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {districts?.items.map((district) => (
                  <SelectItem key={district.id} value={district.id}>
                    {district.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={ulbId || undefined} onValueChange={setUlbId} disabled={!districtId}>
              <SelectTrigger>
                <SelectValue placeholder="Select municipality / ULB" />
              </SelectTrigger>
              <SelectContent>
                {ulbs?.items.map((ulb) => (
                  <SelectItem key={ulb.id} value={ulb.id}>
                    {ulb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Districts</CardTitle>
                <CardDescription>
                  {selectedState ? `Under ${selectedState.name}` : "Select a state to load districts"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72">
                  <div className="space-y-1 pr-3">
                    {(districts?.items ?? []).map((district) => (
                      <button
                        key={district.id}
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/40"
                        onClick={() => {
                          setDistrictId(district.id)
                          setUlbId("")
                        }}
                      >
                        <span className="font-medium">{district.name}</span>
                        {districtId === district.id ? <Badge variant="secondary">Selected</Badge> : null}
                      </button>
                    ))}
                    {!districts?.items.length ? (
                      <p className="text-sm text-muted-foreground">No districts loaded</p>
                    ) : null}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Municipalities / ULBs</CardTitle>
                <CardDescription>Municipality and town panchayat masters</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72">
                  <div className="space-y-1 pr-3">
                    {(ulbs?.items ?? []).map((ulb) => (
                      <button
                        key={ulb.id}
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/40"
                        onClick={() => setUlbId(ulb.id)}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{ulb.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {ulb.code} · {ulb.type}
                          </p>
                        </div>
                        {ulbId === ulb.id ? <Badge variant="secondary">Selected</Badge> : null}
                      </button>
                    ))}
                    {!ulbs?.items.length ? (
                      <p className="text-sm text-muted-foreground">Select a district to load ULBs</p>
                    ) : null}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Wards</CardTitle>
                <CardDescription>Ward hierarchy for the selected ULB</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72">
                  <div className="space-y-1 pr-3">
                    {(wards?.items ?? []).map((ward) => (
                      <div
                        key={ward.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{ward.wardName}</span>
                        <span className="font-mono text-xs text-muted-foreground">{ward.wardNumber}</span>
                      </div>
                    ))}
                    {!wards?.items.length ? (
                      <p className="text-sm text-muted-foreground">Select a ULB to load wards</p>
                    ) : null}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reference" className="grid gap-4 lg:grid-cols-2">
          {REFERENCE_SETS.map((set) => (
            <Card key={set.id} className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{set.title}</CardTitle>
                <CardDescription>{set.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {set.values.map((value) => (
                    <Badge key={value} variant="outline" className="font-mono text-[10px]">
                      {value}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Master data audit posture</CardTitle>
              <CardDescription>
                Geography mutations and role assignments are recorded via SecurityAudit and SurveyAudit on the API.
                Editable tax-matrix grids will write the same audit trail when mutation endpoints are enabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Hierarchy source of truth: State → District → Ulb → Ward in Prisma.</p>
              <p>
                • Classification source of truth: Prisma enums for ownership, property type, tax zone, construction.
              </p>
              <p>• Import maps Excel labels into these enums through `@workspace/validation`.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
