"use client"

import { type MasterDataTab, parseMasterDataTab } from "@/features/master-data/lib/tab-params"
import { ReferenceDataPanel } from "@/features/master-data/panels/reference-data-panel"
import { TaxRatesPanel } from "@/features/master-data/panels/tax-rates-panel"
import { TenantsWardsPanel } from "@/features/master-data/panels/tenants-wards-panel"
import { Badge } from "@workspace/ui/components/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"
import { Database, IndianRupee, MapPin } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

const pillBase =
  "cursor-pointer gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground"

export function MasterDataRegistry({
  activeTab,
  onTabChange,
  districtCount,
  categoryFromUrl,
}: {
  activeTab: MasterDataTab
  onTabChange: (tab: MasterDataTab) => void
  districtCount?: number
  categoryFromUrl?: string
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-5 py-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Configuration Registry</p>
        <p className="mt-0.5 text-sm text-muted-foreground">Reference dropdowns and geographic tenant hierarchy</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => onTabChange(parseMasterDataTab(v))} className="gap-0">
        <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5">
          <TabsList variant="default" className="h-auto flex-wrap gap-1 bg-transparent p-0">
            <TabsTrigger
              value="reference"
              className={cn(pillBase, "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground")}
            >
              <Database className="size-3.5" aria-hidden />
              Reference Data
            </TabsTrigger>
            <TabsTrigger
              value="tenants"
              className={cn(pillBase, "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground")}
            >
              <MapPin className="size-3.5" aria-hidden />
              Tenants &amp; Wards
              {districtCount != null && districtCount > 0 ? (
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-semibold data-[state=active]:bg-white/20"
                >
                  {districtCount}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="tax-rates"
              className={cn(
                pillBase,
                "data-[state=active]:bg-emerald-700 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-600"
              )}
            >
              <IndianRupee className="size-3.5" aria-hidden />
              Tax Rates
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="reference" className="mt-0 p-4 lg:p-5">
          <ReferenceDataPanel initialCategory={categoryFromUrl} />
        </TabsContent>
        <TabsContent value="tenants" className="mt-0 p-4 lg:p-5">
          <TenantsWardsPanel />
        </TabsContent>
        <TabsContent value="tax-rates" className="mt-0 p-4 lg:p-5">
          <TaxRatesPanel />
        </TabsContent>
      </Tabs>
    </section>
  )
}

/** Syncs tab state with `?tab=` / `?category=` search params. */
export function useMasterDataTabState() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = parseMasterDataTab(searchParams.get("tab"))
  const categoryFromUrl = searchParams.get("category") ?? undefined

  const onTabChange = useCallback(
    (tab: MasterDataTab) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", tab)
      if (tab !== "reference") params.delete("category")
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return { activeTab, onTabChange, categoryFromUrl }
}
