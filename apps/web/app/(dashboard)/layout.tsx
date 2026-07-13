import { ProtectedDashboardLayout } from "@/components/layout/protected-layout"

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedDashboardLayout>{children}</ProtectedDashboardLayout>
}
