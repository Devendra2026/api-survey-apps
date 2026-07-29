import { ProtectedDashboardLayout } from "@/components/layout/protected-layout"
import { hasDashboardAccess } from "@/lib/auth/dashboard-access"
import { unwrapApiProfile } from "@/lib/auth/unwrap-api-profile"
import { auth } from "@clerk/nextjs/server"
import { forbidden, redirect } from "next/navigation"

type CurrentUserProfile = {
  permissions?: string[]
}

async function fetchCurrentUser(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured")
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (response.status === 401) {
    return { status: 401 as const, profile: null }
  }
  if (response.status === 403) {
    return { status: 403 as const, profile: null }
  }
  if (!response.ok) {
    throw new Error(`Failed to load profile (${response.status})`)
  }

  const body: unknown = await response.json()
  const profile = unwrapApiProfile<CurrentUserProfile>(body)

  return {
    status: 200 as const,
    profile,
  }
}

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const { getToken } = await auth.protect()
  const token = await getToken()
  if (!token) {
    redirect("/sign-in")
  }

  const currentUser = await fetchCurrentUser(token)
  if (currentUser.status === 401) {
    redirect("/sign-in")
  }
  // API 403 (e.g. disabled account messaging path) or empty permissions → Forbidden.
  if (currentUser.status === 403 || !hasDashboardAccess(currentUser.profile?.permissions)) {
    forbidden()
  }

  return <ProtectedDashboardLayout>{children}</ProtectedDashboardLayout>
}
