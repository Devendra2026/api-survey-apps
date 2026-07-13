"use client"

import { UserButton } from "@clerk/nextjs"
import { Menu, Moon, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Sheet, SheetContent, SheetTrigger } from "@workspace/ui/components/sheet"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { useUiStore } from "@/stores/app-store"
import { useAuthStore } from "@/stores/app-store"

export function AppHeader() {
  const { theme, setTheme } = useTheme()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const globalSearch = useUiStore((s) => s.globalSearch)
  const setGlobalSearch = useUiStore((s) => s.setGlobalSearch)
  const profile = useAuthStore((s) => s.profile)

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar}>
        <Menu className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={toggleSidebar}>
        <Menu className="size-4" />
      </Button>

      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Search surveys, property IDs..."
          className="pl-9"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>

        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium">{profile?.fullName ?? "User"}</p>
          <p className="text-muted-foreground text-xs">{profile?.email}</p>
        </div>
        <UserButton />
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <AppSidebar collapsed={false} />
        </SheetContent>
      </Sheet>
    </header>
  )
}
