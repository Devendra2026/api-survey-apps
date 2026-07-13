import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { Button } from "@workspace/ui/components/button"
import { Building2 } from "lucide-react"

export default async function HomePage() {
  const { userId } = await auth()
  if (userId) redirect("/dashboard")

  return (
    <div className="from-background to-muted/40 flex min-h-screen flex-col bg-linear-to-b">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Building2 className="text-primary size-6" />
          <span className="font-semibold">Municipal Survey Portal</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-primary text-sm font-medium">Enterprise municipal property tax surveys</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Capture, review, and approve property surveys at scale
          </h1>
          <p className="text-muted-foreground mt-4 text-lg">
            Multi-tenant RBAC, GPS and photo validation, workflow approvals, and exportable reports —
            built for ULB field teams and quality control supervisors.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/sign-in">Sign in to continue</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
