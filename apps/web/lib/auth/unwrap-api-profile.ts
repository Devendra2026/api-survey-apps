/**
 * Nest ResponseTransformInterceptor wraps payloads as `{ success, data, ... }`.
 * Server-side `fetch` must unwrap `data` the same way axios `apiGet` does.
 */
export function unwrapApiProfile<T extends object>(body: unknown): T | null {
  if (!body || typeof body !== "object") {
    return null
  }

  const record = body as Record<string, unknown>
  if ("success" in record && "data" in record) {
    const inner = record.data
    if (!inner || typeof inner !== "object") {
      return null
    }
    return inner as T
  }

  return body as T
}
