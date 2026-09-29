import { getApiBaseUrl } from "@/lib/env"
import { fetch as expoFetch } from "expo/fetch"
import { friendlyHttpMessage } from "./error-messages"

export type ApiEnvelope<T> = {
  success: boolean
  message: string
  data: T
  errors: string[] | null
}

type TokenGetter = () => Promise<string | null>

let tokenGetter: TokenGetter | null = null

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Register a Clerk (or other) session token provider for authenticated requests.
 * Call once from the auth layer when it is wired up.
 */
export function setApiTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter
}

export class ApiClientError extends Error {
  readonly statusCode: number
  readonly errors: string[] | null
  readonly kind: "http" | "network" | "timeout" | "parse"

  constructor(
    message: string,
    statusCode: number,
    errors: string[] | null = null,
    kind: ApiClientError["kind"] = "http"
  ) {
    super(message)
    this.name = "ApiClientError"
    this.statusCode = statusCode
    this.errors = errors
    this.kind = kind
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError
}

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (isApiClientError(error)) {
    if (error.errors?.length) {
      return error.errors.join("; ")
    }
    return error.message || fallback
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

async function buildHeaders(init?: HeadersInit, body?: RequestInit["body"]): Promise<Headers> {
  const headers = new Headers(init)
  // Multipart bodies need the runtime-generated boundary header.
  if (!headers.has("Content-Type") && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  // Prefer an explicit Authorization header (one-token profile loads) over a second getToken().
  if (!headers.has("Authorization") && tokenGetter) {
    const token = await tokenGetter()
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }
  return headers
}

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path
  }
  const base = getApiBaseUrl()
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalized}`
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ApiClientError(`Invalid response from server (${response.status})`, response.status, null, "parse")
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("success" in body) ||
    typeof (body as ApiEnvelope<unknown>).success !== "boolean"
  ) {
    if (!response.ok) {
      throw new ApiClientError(friendlyHttpMessage(response.status, ""), response.status)
    }
    return body as T
  }

  const envelope = body as ApiEnvelope<T>
  if (!envelope.success || !response.ok) {
    throw new ApiClientError(
      friendlyHttpMessage(response.status, envelope.message || ""),
      response.status,
      envelope.errors
    )
  }
  return envelope.data
}

type FetchImpl = (
  url: string,
  init: { method?: string; headers: Headers; body?: BodyInit | null; signal: AbortSignal }
) => Promise<Response>

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: FetchImpl = fetch
): Promise<T> {
  const headers = await buildHeaders(init.headers, init.body)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(resolveUrl(path), {
      ...init,
      headers,
      signal: controller.signal,
    })
    return await parseEnvelope<T>(response)
  } catch (error) {
    if (isApiClientError(error)) {
      throw error
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiClientError("The request timed out. Check your connection and try again.", 0, null, "timeout")
    }
    throw new ApiClientError("Unable to reach the server. Check your network and API URL.", 0, null, "network")
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" })
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" })
}

const UPLOAD_TIMEOUT_MS = 90_000

/** Multipart upload via `expo/fetch`, which encodes `expo-file-system` `File` parts (name + MIME type). */
export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: form }, UPLOAD_TIMEOUT_MS, expoFetch)
}

/** Absolute URL for authenticated binary GETs (e.g. `expo-image` sources with an Authorization header). */
export function apiUrl(path: string): string {
  return resolveUrl(path)
}

export async function getApiAuthHeader(): Promise<Record<string, string>> {
  const token = tokenGetter ? await tokenGetter() : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Network or timeout failure — the request never reached a server decision, so it is safe to retry later. */
export function isRetryableNetworkError(error: unknown): boolean {
  return isApiClientError(error) && (error.kind === "network" || error.kind === "timeout")
}
