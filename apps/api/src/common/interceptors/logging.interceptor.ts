import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common"
import { Observable, tap } from "rxjs"

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP")

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; url: string; user?: { id?: string } }>()
    const { method, url } = req
    const userId = req.user?.id ?? "anonymous"
    const started = Date.now()

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`${method} ${url} ${userId} ${Date.now() - started}ms`)
        },
        error: (err: Error) => {
          this.logger.warn(`${method} ${url} ${userId} ${Date.now() - started}ms ERROR ${err.message}`)
        },
      })
    )
  }
}
