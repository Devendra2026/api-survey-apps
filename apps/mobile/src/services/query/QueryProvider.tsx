import { isApiClientError } from "@/services/api/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

function shouldRetry(failureCount: number, error: unknown): boolean {
  // 4xx are server decisions (validation, permission, tenant scope) — retrying cannot change them.
  if (isApiClientError(error) && error.statusCode >= 400 && error.statusCode < 500) return false
  return failureCount < 2
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}

/**
 * Must wrap AppSessionProvider: the session owns clearing this cache on sign-out and Clerk user switch,
 * and every user-owned query key is scoped by Clerk userId.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
