"use client"

import { useEffect } from "react"

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("demand-notice-print-mode")
    return () => {
      document.documentElement.classList.remove("demand-notice-print-mode")
    }
  }, [])

  return <div className="min-h-screen bg-white text-slate-900">{children}</div>
}
