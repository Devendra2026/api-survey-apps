"use client"

import { tenantRoleDisplayName } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { Badge } from "@workspace/ui/components/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { MapPin } from "lucide-react"

export function TenantScopeBadge() {
  const profile = useAuthStore((s) => s.profile)
  const roles = profile?.tenantRoles?.filter((r) => r.isActive) ?? []

  if (!roles.length) {
    return (
      <Badge variant="outline" className="hidden gap-1 rounded-md font-normal lg:inline-flex">
        <MapPin className="size-3" />
        No scope
      </Badge>
    )
  }

  const primary = roles[0]!
  const label = tenantRoleDisplayName(primary)
  const detail = [
    primary.stateId ? "State" : null,
    primary.districtId ? "District" : null,
    primary.ulbId ? "ULB" : null,
    primary.wardId ? "Ward" : null,
  ]
    .filter(Boolean)
    .join(" → ")

  const scopeText = detail || "Full access"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="hidden max-w-50 gap-1 truncate rounded-md font-normal lg:inline-flex">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">
            {label}
            {detail ? ` · ${scopeText}` : ""}
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-primary-foreground/80">
          Tenant scope: {scopeText}
          {roles.length > 1 ? ` (+${roles.length - 1} more)` : ""}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
