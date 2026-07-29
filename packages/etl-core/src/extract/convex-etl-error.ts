/** Reasons reported by the Convex ETL endpoints in their JSON error body. */
export type ConvexEtlAuthReason = "secret_missing" | "secret_mismatch" | "secret_not_configured"

const AUTH_REASONS: readonly string[] = ["secret_missing", "secret_mismatch", "secret_not_configured"]

/** Statuses that will never succeed on retry, so the queue must not burn attempts. */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 405, 413, 422])

export interface ConvexEtlHttpErrorInit {
  path: string
  status: number
  body: string
  wwwAuthenticate?: string
}

/**
 * Failure of a Convex ETL HTTP call, carrying enough structure for the worker to
 * decide whether retrying is worthwhile and for operators to tell a Convex-issued
 * rejection apart from one produced by the reverse proxy in front of it.
 */
export class ConvexEtlHttpError extends Error {
  readonly path: string
  readonly status: number
  readonly body: string
  readonly reason?: ConvexEtlAuthReason
  /** Fingerprint of the secret as Convex received it; absent unless Convex answered. */
  readonly providedFingerprint?: string
  readonly wwwAuthenticate?: string
  private readonly jsonErrorBody: boolean

  constructor(init: ConvexEtlHttpErrorInit) {
    const parsed = parseConvexErrorBody(init.body)
    super(buildMessage(init, parsed))
    this.name = "ConvexEtlHttpError"
    this.path = init.path
    this.status = init.status
    this.body = init.body
    this.reason = parsed.reason
    this.providedFingerprint = parsed.providedFingerprint
    this.jsonErrorBody = parsed.jsonErrorBody
    this.wwwAuthenticate = init.wwwAuthenticate
  }

  /**
   * True when Convex itself produced the response rather than something in front
   * of it. A JSON `error` body counts even without a `reason`, so this stays
   * correct against a deployment that predates the structured reasons.
   */
  get answeredByConvex(): boolean {
    return this.reason !== undefined || this.jsonErrorBody
  }

  get isAuthFailure(): boolean {
    return this.status === 401 || this.status === 403
  }

  /**
   * A 401 without a Convex reason body means the request never reached the ETL
   * handler — almost always a proxy or ingress rejecting or stripping the header.
   */
  get looksLikeProxyRejection(): boolean {
    return this.isAuthFailure && !this.answeredByConvex
  }

  get isRetryable(): boolean {
    // A missing ETL_SECRET on Convex is a 500 that no amount of retrying fixes.
    if (this.reason === "secret_not_configured") return false
    if (NON_RETRYABLE_STATUSES.has(this.status)) return false
    return true
  }

  /** Operator-facing next step, safe to log. */
  get remediation(): string {
    switch (this.reason) {
      case "secret_not_configured":
        return "Convex has no ETL_SECRET. Run: npx convex env set ETL_SECRET <value>"
      case "secret_missing":
        return "Convex received no X-ETL-Secret header. Check that the proxy in front of Convex forwards it."
      case "secret_mismatch":
        return "ETL_CONVEX_SECRET does not match Convex ETL_SECRET. Re-set both from the same value."
      default:
        break
    }
    if (this.looksLikeProxyRejection) {
      return "The 401 did not come from Convex. Check the reverse proxy or ingress at CONVEX_SITE_URL."
    }
    if (this.status === 404) {
      return "Route not found. Confirm the ETL endpoints are deployed: npx convex deploy."
    }
    return "Check worker logs and Convex function logs for this request."
  }
}

function parseConvexErrorBody(body: string): {
  reason?: ConvexEtlAuthReason
  providedFingerprint?: string
  jsonErrorBody: boolean
} {
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed !== "object" || parsed === null) return { jsonErrorBody: false }
    const record = parsed as Record<string, unknown>
    const reason = typeof record.reason === "string" && AUTH_REASONS.includes(record.reason) ? record.reason : undefined
    return {
      reason: reason as ConvexEtlAuthReason | undefined,
      providedFingerprint: typeof record.providedFingerprint === "string" ? record.providedFingerprint : undefined,
      jsonErrorBody: typeof record.error === "string",
    }
  } catch {
    return { jsonErrorBody: false }
  }
}

function buildMessage(
  init: ConvexEtlHttpErrorInit,
  parsed: { reason?: ConvexEtlAuthReason; providedFingerprint?: string; jsonErrorBody: boolean }
): string {
  const parts = [`Convex ETL ${init.path} failed (${init.status}`]
  parts.push(parsed.reason ? ` ${parsed.reason})` : ")")
  if (parsed.providedFingerprint) {
    parts.push(` sentSecretFingerprint=${parsed.providedFingerprint}`)
  }
  if (!parsed.reason && init.wwwAuthenticate) {
    parts.push(` www-authenticate=${init.wwwAuthenticate.slice(0, 80)}`)
  }
  const snippet = init.body.trim().slice(0, 300)
  if (snippet) parts.push(`: ${snippet}`)
  return parts.join("")
}
