"use client"

import { useReferenceCategories } from "../hooks/use-configuration"
import { CONFIG_BASE, CONFIG_NAV_GROUPS, type ConfigNavItem } from "../lib/types"
import { saveConfigLastPath } from "../lib/last-path"
import { cn } from "@workspace/ui/lib/utils"
import { Calculator, FileText, Layers, LayoutDashboard, Map, Settings, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"

const ICONS: Record<NonNullable<ConfigNavItem["icon"]>, LucideIcon> = {
  map: Map,
  layers: Layers,
  calculator: Calculator,
  fileText: FileText,
  layout: LayoutDashboard,
  settings: Settings,
}

export function ConfigurationSideNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()
  const { data: categories } = useReferenceCategories()

  const groups = CONFIG_NAV_GROUPS.map((g) => {
    if (g.id !== "reference") return g
    const items: ConfigNavItem[] =
      categories?.map((c) => ({
        href: `${CONFIG_BASE}/reference/${c.code}`,
        label: c.name,
        icon: "layers" as const,
        match: (p: string) => p === `${CONFIG_BASE}/reference/${c.code}`,
      })) ?? []
    return { ...g, items }
  })

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label="Configuration modules"
        className={cn(
          "flex h-full flex-col gap-4 overflow-y-auto border-r border-border/60 bg-zinc-50/80 py-3 dark:bg-zinc-950/40",
          collapsed ? "w-14 px-1.5" : "w-60 px-2"
        )}
      >
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            {!collapsed ? (
              <p className="px-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.label}
              </p>
            ) : null}
            {group.items.length === 0 && !collapsed ? (
              <p className="px-2 text-xs text-muted-foreground">Loading…</p>
            ) : null}
            {group.items.map((item) => {
              const active = item.match(pathname)
              const Icon = item.icon ? ICONS[item.icon] : Layers
              const link = (
                <Link
                  href={item.href}
                  aria-label={collapsed ? item.label : undefined}
                  onClick={() => saveConfigLastPath(item.href)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors duration-150",
                    collapsed && "justify-center px-0",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              )
              if (!collapsed) return <div key={item.href}>{link}</div>
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        ))}
      </nav>
    </TooltipProvider>
  )
}
