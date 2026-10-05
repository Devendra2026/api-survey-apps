"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { ConfigurationSideNav } from "./ConfigurationSideNav"
import { saveConfigLastPath } from "../lib/last-path"
import { Button } from "@workspace/ui/components/button"
import { PanelLeftClose, PanelLeft } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export function ConfigurationWorkspace({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  const [forceExpanded, setForceExpanded] = useState(false)
  const [isLg, setIsLg] = useState(true)

  useEffect(() => {
    saveConfigLastPath(pathname)
  }, [pathname])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const apply = () => setIsLg(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  const collapsed = !isLg && !forceExpanded

  return (
    <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-lg border border-border/60 bg-background">
      <aside className={cn("sticky top-0 self-stretch", forceExpanded && !isLg && "absolute z-30 h-full shadow-lg")}>
        <div className="flex h-full flex-col">
          {!isLg ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="m-1 size-8 cursor-pointer"
              aria-label={forceExpanded ? "Collapse navigation" : "Expand navigation"}
              onClick={() => setForceExpanded((value) => !value)}
            >
              {forceExpanded ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
            </Button>
          ) : null}
          <ConfigurationSideNav collapsed={collapsed} />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 space-y-1 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Configuration Registry
          </p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {description ? <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </div>
    </div>
  )
}
