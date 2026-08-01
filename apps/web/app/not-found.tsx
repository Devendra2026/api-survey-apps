import Link from "next/link"

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you requested does not exist or the link is incorrect.
      </p>
      <Link href="/dashboard" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to dashboard
      </Link>
    </main>
  )
}
