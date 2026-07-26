import { Suspense } from "react"

export default function PrintDemandNoticeLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>{children}</Suspense>
}
