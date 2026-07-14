"use client"

import { adminNav, mainNav } from "@/lib/navigation"
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
import { FilePlus2, FileSearch, LayoutDashboard, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"

export function CommandPalette() {
  const router = useRouter()
  const open = useUiStore((s) => s.commandOpen)
  const setOpen = useUiStore((s) => s.setCommandOpen)
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
    () => [...mainNav, ...adminNav].filter((item) => !item.permission || hasPermission(item.permission)),
    [hasPermission]
  )

  const run = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, property IDs..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.href} value={item.title} onSelect={() => run(item.href)}>
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
          <CommandItem
            value="surveys search"
            onSelect={() => {
              setOpen(false)
              router.push("/surveys")
            }}
          >
            <FileSearch />
            <span>Browse surveys</span>
          </CommandItem>
          {hasPermission("survey:create") ? (
            <CommandItem value="create survey dashboard" onSelect={() => run("/surveys/new")}>
              <FilePlus2 />
              <span>Create survey</span>
            </CommandItem>
          ) : null}
          {hasPermission("survey:create") ? (
            <CommandItem value="import surveys dashboard" onSelect={() => run("/import")}>
              <Upload />
              <span>Import surveys</span>
            </CommandItem>
          ) : null}
          {hasPermission("survey:view") ? (
            <CommandItem value="review pending qc dashboard" onSelect={() => run("/surveys?surveyStatus=SUBMITTED")}>
              <FileSearch />
              <span>Review pending QC</span>
            </CommandItem>
          ) : null}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
