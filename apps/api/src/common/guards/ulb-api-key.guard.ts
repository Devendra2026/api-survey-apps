import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { GeoEntityStatus } from "@workspace/database"
import { PrismaService } from "../../prisma/prisma.service.js"
import { hashUlbApiKey } from "../utils/ulb-api-key.util.js"

const INVALID_API_KEY = "Invalid API key"

@Injectable()
export class UlbApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>
      ulbId?: string
    }>()

    const rawHeader = request.headers["x-api-key"]
    const rawKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
    if (!rawKey?.trim()) {
      throw new UnauthorizedException(INVALID_API_KEY)
    }

    const keyHash = hashUlbApiKey(rawKey.trim())
    const record = await this.prisma.db.ulbApiKey.findUnique({
      where: { keyHash },
      select: {
        ulbId: true,
        isActive: true,
        ulb: { select: { status: true } },
      },
    })

    if (!record?.isActive || record.ulb.status !== GeoEntityStatus.ACTIVE) {
      throw new UnauthorizedException(INVALID_API_KEY)
    }

    request.ulbId = record.ulbId
    return true
  }
}
