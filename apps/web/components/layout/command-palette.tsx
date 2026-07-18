"use client"

import { appNav, flattenNav } from "@/lib/navigation"
import { useAuthStore, useUiStore } from "@/stores/app-store"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@workspace/ui/components/command"
import { ClipboardCheck, FilePlus2, FileSearch, FileSpreadsheet, LayoutDashboard, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"

export function CommandPalette() {
  const router = useRouter()
  const open = useUiStore((s) => s.commandOpen)
  const setOpen = useUiStore((s) => s.setCommandOpen)
  const setGlobalSearch = useUiStore((s) => s.setGlobalSearch)
  const hasPermission = useAuthStore((s) => s.hasPermission)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, setOpen])

  const navItems = useMemo(
    () => flattenNav(appNav).filter((item) => !item.permission || hasPermission(item.permission)),
    [hasPermission]
  )

  const run = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const searchSurveys = (value: string) => {
    const query = value.trim()
    if (!query) return
    setGlobalSearch(query)
    setOpen(false)
    router.push(`/surveys?q=${encodeURIComponent(query)}`)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search pages, property IDs, actions…"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const value = (e.target as HTMLInputElement).value
            if (value.trim().length >= 3) searchSurveys(value)
          }
        }}
      />
      <CommandList>
        <CommandEmpty>No results found. Press Enter to search surveys.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.href}
                value={`${item.title} ${item.description ?? ""}`}
                onSelect={() => run(item.href)}
              >
                <Icon />
                <span>{item.title}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          <CommandItem value="dashboard" onSelect={() => run("/dashboard")}>
            <LayoutDashboard />
            <span>Go to dashboard</span>
          </CommandItem>
          <CommandItem value="surveys search" onSelect={() => run("/surveys")}>
            <FileSearch />
            <span>Browse survey registry</span>
          </CommandItem>
          {hasPermission("survey:approve") ? (
            <CommandItem value="qc review" onSelect={() => run("/qc/registry")}>
              <ClipboardCheck />
              <span>Open QC Review</span>
            </CommandItem>
          ) : null}
          {hasPermission("survey:create") ? (
            <CommandItem value="create survey" onSelect={() => run("/surveys/new")}>
              <FilePlus2 />
              <span>Create survey</span>
            </CommandItem>
          ) : null}
          {hasPermission("survey:create") ? (
            <CommandItem value="import surveys" onSelect={() => run("/import")}>
              <Upload />
              <span>Import surveys</span>
            </CommandItem>
          ) : null}
          {hasPermission("report:view") ? (
            <CommandItem value="government reports" onSelect={() => run("/reports")}>
              <FileSpreadsheet />
              <span>Open report builder</span>
            </CommandItem>
          ) : null}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
