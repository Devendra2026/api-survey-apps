import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common"
import type { Request, Response } from "express"
import type { ApiResponse } from "../interfaces/api-response.interface.js"
import { safeLogText } from "../logging/safe-log-text.js"

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  private isPrismaUniqueConflict(exception: unknown): boolean {
    if (
      typeof exception === "object" &&
      exception !== null &&
      "code" in exception &&
      (exception as { code: string }).code === "P2002"
    ) {
      return true
    }
    if (exception instanceof Error && /Unique constraint failed/i.test(exception.message)) {
      return true
    }
    return false
  }

  private uniqueConflictMessage(exception: unknown): string {
    if (this.prismaUniqueTargetIncludesEmail(exception)) {
      return "An account with this email already exists."
    }
    return "A duplicate code or name already exists. Use the existing record, or run Dedupe Wards before Sync Wards."
  }

  private prismaUniqueTargetIncludesEmail(exception: unknown): boolean {
    if (typeof exception !== "object" || exception === null || !("meta" in exception)) {
      return false
    }
    const meta = (exception as { meta?: unknown }).meta
    if (typeof meta !== "object" || meta === null || !("target" in meta)) {
      return false
    }
    const target = (meta as { target?: unknown }).target
    const fields = Array.isArray(target) ? target : typeof target === "string" ? [target] : []
    return fields.some((field) => typeof field === "string" && /(^|_)email($|_)/i.test(field))
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = "Internal server error"
    let errors: unknown[] | null = null

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const body = exception.getResponse()
      // Log full validation / HTTP response body (e.g. class-validator messages)
      this.logger.warn(
        `requestId=${requestIdOf(request)} method=${request.method} route=${routeOf(request)} status=${status} errorCode=${status} message=${safeLogText(JSON.stringify(body))}`
      )
      if (typeof body === "string") {
        message = body
      } else if (typeof body === "object" && body !== null) {
        const obj = body as Record<string, unknown>
        message = (obj.message as string) ?? exception.message
        if (Array.isArray(obj.message)) {
          message = "Validation failed"
          errors = obj.message
        } else if (obj.errors) {
          errors = Array.isArray(obj.errors) ? obj.errors : [obj.errors]
        }
      }
    } else if (isFileTooLarge(exception)) {
      status = HttpStatus.PAYLOAD_TOO_LARGE
      message = "The uploaded file is too large."
      this.logger.warn(
        `requestId=${requestIdOf(request)} method=${request.method} route=${routeOf(request)} status=413 errorCode=413`
      )
    } else if (isUpstreamTimeout(exception)) {
      status = HttpStatus.GATEWAY_TIMEOUT
      message = "The request timed out while contacting storage. Please try again."
      this.logger.error(
        `requestId=${requestIdOf(request)} method=${request.method} route=${routeOf(request)} status=504 errorCode=504`
      )
    } else if (this.isPrismaUniqueConflict(exception)) {
      status = HttpStatus.CONFLICT
      message = this.uniqueConflictMessage(exception)
      this.logger.warn(`Prisma unique conflict ${request.method} ${request.url}`)
    } else if (exception instanceof Error) {
      // Do not map every Prisma invocation dump to "duplicate" — only real unique failures above.
      const raw = exception.message
      if (/REFRESH_PENDING/i.test(raw) && (/enum/i.test(raw) || /invalid input value/i.test(raw))) {
        status = HttpStatus.SERVICE_UNAVAILABLE
        message =
          "Database is missing MigrationJobType.REFRESH_PENDING. Redeploy migrate (`prisma migrate deploy`), then retry."
        this.logger.error(`Missing REFRESH_PENDING enum ${request.method} ${request.url}: ${raw.slice(0, 400)}`)
      } else if (/prisma\./i.test(raw) || /\bP20\d{2}\b/.test(raw)) {
        status = HttpStatus.INTERNAL_SERVER_ERROR
        if (/column .* does not exist|P2022/i.test(raw)) {
          message =
            "Database schema is behind the API. Run `pnpm db:deploy` (or `prisma migrate deploy`) so migrations such as User.requestedRole are applied, then retry."
        } else {
          message = "A database operation failed. Check API logs for details."
        }
        this.logger.error(`Prisma error ${request.method} ${request.url}: ${raw.slice(0, 400)}`, exception.stack)
      } else {
        message = raw
        this.logger.error(exception.message, exception.stack)
      }
    } else {
      this.logger.error("Unknown exception", String(exception))
    }

    const payload: ApiResponse = {
      success: false,
      message,
      data: null,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      statusCode: status,
    }

    response.status(status).json(payload)
  }
}

function routeOf(request: Request): string {
  return request.url.split("?")[0] ?? request.url
}

function requestIdOf(request: Request): string {
  const header = request.header("x-request-id")
  return header && header.length > 0 ? header : "none"
}

function isFileTooLarge(exception: unknown): boolean {
  return (
    typeof exception === "object" && exception !== null && "code" in exception && exception.code === "LIMIT_FILE_SIZE"
  )
}

function isUpstreamTimeout(exception: unknown): boolean {
  return exception instanceof Error && (exception.name === "TimeoutError" || exception.name === "AbortError")
}
