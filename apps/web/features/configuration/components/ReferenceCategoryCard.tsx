"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { formatDistanceToNow } from "date-fns"
import { ArrowRight, History, Plus } from "lucide-react"
import Link from "next/link"
import type { ReferenceCategory } from "../lib/types"
import { categoryIcon } from "./ConfigurationStats"

export function ReferenceCategoryCard({
  category,
  onCreate,
  onAudit,
}: {
  category: ReferenceCategory
  onCreate?: () => void
  onAudit?: () => void
}) {
  const Icon = categoryIcon(category.iconKey)
  const lastUpdated = category.entries[0]?.updatedAt ?? category.updatedAt

  return (
    <Card className="group border-border/70 shadow-none transition-colors duration-200 hover:border-primary/40">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
            <Icon className="size-5" aria-hidden />
          </div>
          <Badge variant="secondary" className="tabular-nums">
            {category._count.entries} entries
          </Badge>
        </div>
        <div>
          <CardTitle className="text-base">{category.name}</CardTitle>
          <CardDescription className="mt-1 line-clamp-2">{category.description ?? "Reference catalog"}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        Updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
        {category.isSystem ? (
          <Badge variant="outline" className="ml-2">
            System
          </Badge>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Button asChild size="sm" className="cursor-pointer">
          <Link href={`/master-data?tab=reference&category=${encodeURIComponent(category.code)}`}>
            Open
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={onCreate}>
          <Plus className="size-3.5" />
          Create
        </Button>
        <Button type="button" size="sm" variant="ghost" className="cursor-pointer" onClick={onAudit}>
          <History className="size-3.5" />
          Audit
        </Button>
      </CardFooter>
    </Card>
  )
}
