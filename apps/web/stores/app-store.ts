import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UiState {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  globalSearch: string
  setGlobalSearch: (value: string) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      globalSearch: "",
      setGlobalSearch: (globalSearch) => set({ globalSearch }),
    }),
    { name: "survey-ui" }
  )
)

interface AuthState {
  profile: {
    id: string
    fullName: string
    email: string
    permissions: string[]
  } | null
  setProfile: (profile: AuthState["profile"]) => void
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
