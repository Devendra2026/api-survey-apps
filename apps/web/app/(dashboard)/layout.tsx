import { ProtectedDashboardLayout } from "@/components/layout/protected-layout"
import { auth } from "@clerk/nextjs/server"

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  await auth.protect()
  return <ProtectedDashboardLayout>{children}</ProtectedDashboardLayout>
}
