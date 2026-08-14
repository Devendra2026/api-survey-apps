import { createParamDecorator, ExecutionContext } from "@nestjs/common"

export const UlbId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ ulbId?: string }>()
  return request.ulbId ?? ""
})
