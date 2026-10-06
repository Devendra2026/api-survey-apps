import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from "@nestjs/common"
import { Observable, tap } from "rxjs"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"
import { safeLogText } from "../logging/safe-log-text.js"

type LoggedRequest = {
  method?: string
  url?: string
  id?: unknown
  headers?: Record<string, unknown>
  user?: AuthenticatedUser
}

/**
 * Structured request log. Never includes tokens, passwords, or signed storage URLs.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP")

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<LoggedRequest>()
    const res = context.switchToHttp().getResponse<{ statusCode?: number }>()
    const started = Date.now()
    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(formatAccessLog(req, res.statusCode ?? 200, Date.now() - started))
        },
        error: (err: unknown) => {
          const status = err instanceof HttpException ? err.getStatus() : 500
          const message = err instanceof Error ? safeLogText(err.message) : "unknown"
          this.logger.warn(
            `${formatAccessLog(req, status, Date.now() - started)} errorCode=${status} message=${message}`
          )
        },
      })
    )
  }
}

function formatAccessLog(req: LoggedRequest, status: number, durationMs: number): string {
  const route = (req.url ?? "").split("?")[0] ?? ""
  return `requestId=${requestIdOf(req)} userId=${req.user?.id ?? "anonymous"} tenantId=${tenantIdOf(req.user)} method=${req.method ?? ""} route=${route} status=${status} durationMs=${durationMs}`
}

function requestIdOf(req: LoggedRequest): string {
  if (typeof req.id === "string" && req.id.length > 0) {
    return req.id
  }
  const header = req.headers?.["x-request-id"]
  if (typeof header === "string" && header.length > 0) {
    return header
  }
  if (Array.isArray(header) && typeof header[0] === "string" && header[0].length > 0) {
    return header[0]
  }
  return "none"
}

function tenantIdOf(user: AuthenticatedUser | undefined): string {
  const ulbId = user?.tenantRoles?.find((role) => role.ulbId)?.ulbId
  return ulbId ?? "none"
}
