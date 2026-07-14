"use client"

import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"

export function FormField({
  label,
  htmlFor,
  description,
  error,
  required,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  description?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {description && !error ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
