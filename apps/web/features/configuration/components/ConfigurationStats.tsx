"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Building2,
  Calendar,
  Database,
  DoorOpen,
  Hammer,
  Home,
  KeyRound,
  Layers,
  MapPin,
  Route,
  Ruler,
  Users,
  type LucideIcon,
} from "lucide-react"

const ICONS: Record<string, LucideIcon> = {
  Calendar,
  Users,
  Building2,
  Home,
  Route,
  Ruler,
  Hammer,
  MapPin,
  Layers,
  KeyRound,
  DoorOpen,
  Database,
}

export function ConfigurationStats({
  stats,
  loading,
}: {
  stats: Array<{ label: string; value: string | number; hint?: string }>
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/70 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{stat.value}</CardTitle>
          </CardHeader>
          {stat.hint ? <CardContent className="pt-0 text-xs text-muted-foreground">{stat.hint}</CardContent> : null}
        </Card>
      ))}
    </div>
  )
}

export function categoryIcon(iconKey?: string | null): LucideIcon {
  if (!iconKey) return Database
  return ICONS[iconKey] ?? Database
}
