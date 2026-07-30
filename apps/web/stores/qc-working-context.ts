"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface QcWorkingContextState {
  activeWardId: string | null
  activeUlbId: string | null
  setActiveWard: (input: { wardId: string; ulbId: string }) => void
  clearActiveWard: () => void
}

export const useQcWorkingContext = create<QcWorkingContextState>()(
  persist(
    (set) => ({
      activeWardId: null,
      activeUlbId: null,
      setActiveWard: ({ wardId, ulbId }) => set({ activeWardId: wardId, activeUlbId: ulbId }),
      clearActiveWard: () => set({ activeWardId: null, activeUlbId: null }),
    }),
    {
      name: "qc-working-context",
      partialize: (state) => ({
        activeWardId: state.activeWardId,
        activeUlbId: state.activeUlbId,
      }),
    }
  )
)
