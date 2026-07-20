import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from "@nestjs/common"
import { Observable, tap } from "rxjs"

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP")

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string
      url: string
      query?: unknown
      user?: { id?: string }
    }>()
    const { method, url } = req
    const userId = req.user?.id ?? "anonymous"
    const started = Date.now()

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`${method} ${url} ${userId} ${Date.now() - started}ms`)
        },
        error: (err: unknown) => {
          const elapsed = Date.now() - started
          if (err instanceof HttpException) {
            this.logger.warn(
              `${method} ${url} ${userId} ${elapsed}ms ERROR ${err.message} query=${JSON.stringify(req.query ?? {})} response=${JSON.stringify(err.getResponse())}`
            )
            return
          }
          const message = err instanceof Error ? err.message : String(err)
          const stack = err instanceof Error ? err.stack : undefined
          this.logger.warn(`${method} ${url} ${userId} ${elapsed}ms ERROR ${message}`)
          if (stack) this.logger.warn(stack)
        },
      })
    )
  }
}
