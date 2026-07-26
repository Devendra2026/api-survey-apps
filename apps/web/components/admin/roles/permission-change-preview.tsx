"use client"

import { cn } from "@workspace/ui/lib/utils"

const MAX_VISIBLE = 8

function formatList(items: string[]): string {
  if (items.length <= MAX_VISIBLE) return items.join(", ")
  const visible = items.slice(0, MAX_VISIBLE).join(", ")
  return `${visible}, +${items.length - MAX_VISIBLE} more`
}

export function PermissionChangePreview({
  grantedNames,
  revokedNames,
  assignedUsers,
  className,
}: {
  grantedNames: string[]
  revokedNames: string[]
  assignedUsers: number
  className?: string
}) {
  if (grantedNames.length === 0 && revokedNames.length === 0) return null

  const userLabel = assignedUsers === 1 ? "1 assigned user" : `${assignedUsers} assigned users`

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 text-xs leading-relaxed", className)}
    >
      <p className="font-medium text-foreground">Pending permission changes</p>
      <p className="mt-1 text-muted-foreground">
        Users with this role will gain or lose these capabilities. Affects {userLabel}.
      </p>
      <div className="mt-2 space-y-1">
        {grantedNames.length > 0 ? (
          <p>
            <span className="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
              +{grantedNames.length} granted
            </span>
            <span className="text-emerald-700/90 dark:text-emerald-400/90"> — {formatList(grantedNames)}</span>
          </p>
        ) : null}
        {revokedNames.length > 0 ? (
          <p>
            <span className="font-medium text-rose-700 tabular-nums dark:text-rose-400">
              −{revokedNames.length} revoked
            </span>
            <span className="text-rose-700/90 dark:text-rose-400/90"> — {formatList(revokedNames)}</span>
          </p>
        ) : null}
      </div>
    </div>
  )
}
