import type { TenantRole } from "@/lib/api/types"
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UiState {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  globalSearch: string
  setGlobalSearch: (value: string) => void
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      globalSearch: "",
      setGlobalSearch: (globalSearch) => set({ globalSearch }),
      commandOpen: false,
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    {
      name: "survey-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        globalSearch: state.globalSearch,
      }),
    }
  )
)

interface AuthProfile {
  id: string
  fullName: string
  email: string
  permissions: string[]
  tenantRoles: TenantRole[]
}

interface AuthState {
  profile: AuthProfile | null
  setProfile: (profile: AuthProfile | null) => void
  clearProfile: () => void
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  clearProfile: () => set({ profile: null }),
  hasPermission: (permission) => {
    const { profile } = get()
    return profile?.permissions.includes(permission) ?? false
  },
}))
