import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common"
import type { Request, Response } from "express"
import type { ApiResponse } from "../interfaces/api-response.interface.js"

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
      this.logger.warn(`HttpException ${status} ${request.method} ${request.url} → ${JSON.stringify(body)}`)
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
    } else if (this.isPrismaUniqueConflict(exception)) {
      status = HttpStatus.CONFLICT
      message =
        "A duplicate code or name already exists. Use the existing record, or run Dedupe Wards before Sync Wards."
      this.logger.warn(`Prisma unique conflict ${request.method} ${request.url}`)
    } else if (exception instanceof Error) {
      // Do not map every Prisma invocation dump to "duplicate" — only real unique failures above.
      const raw = exception.message
      if (/prisma\./i.test(raw)) {
        status = HttpStatus.INTERNAL_SERVER_ERROR
        message = "A database operation failed. Check API logs for details."
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
