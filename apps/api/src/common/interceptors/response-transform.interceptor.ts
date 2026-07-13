import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from "@nestjs/common"
import { Observable, map } from "rxjs"
import type { Request } from "express"
import type { ApiResponse } from "../interfaces/api-response.interface.js"

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse | StreamableFile> {
    const request = context.switchToHttp().getRequest<Request>()

    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile) {
          return data
        }
        if (data && typeof data === "object" && "success" in data && "timestamp" in data) {
          return data as ApiResponse
        }

        return {
          success: true,
          message: "OK",
          data: data ?? null,
          errors: null,
          timestamp: new Date().toISOString(),
          path: request.url,
          statusCode: 200,
        }
      })
    )
  }
}
