"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { motion, useReducedMotion } from "framer-motion"

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={cn("shadow-none", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</CardTitle>
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        </CardHeader>
        <CardContent>
          <div className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </CardContent>
      </Card>
    </motion.div>
  )
}
