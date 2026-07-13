import { Button } from "@workspace/ui/components/button"

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

async function getApiHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`${apiUrl}/health`, {
      cache: "no-store",
    })

    if (!response.ok) {
      return { ok: false, message: `API responded with ${response.status}` }
    }

    const data = (await response.json()) as { status?: string }
    return {
      ok: data.status === "ok",
      message: data.status === "ok" ? `API healthy at ${apiUrl}` : "Unexpected health payload",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { ok: false, message: `API unreachable (${message})` }
  }
}

export default async function Page() {
  const health = await getApiHealth()

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Survey apps monorepo</h1>
          <p>Next.js web and NestJS API are wired in this Turborepo workspace.</p>
          <p className={health.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
            {health.message}
          </p>
          <Button className="mt-2" asChild>
            <a href={`${apiUrl}/health`} target="_blank" rel="noreferrer">
              Open API health
            </a>
          </Button>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  )
}
