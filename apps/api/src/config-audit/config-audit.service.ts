import { Injectable } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import { PrismaService } from "../prisma/prisma.service.js"

export type ConfigAuditInput = {
  entityType: string
  entityId: string
  action: string
  oldValue?: unknown
  newValue?: unknown
  reason?: string | null
  actorId?: string | null
}

@Injectable()
export class ConfigAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: ConfigAuditInput) {
    return this.prisma.db.configAuditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue:
          input.oldValue === undefined || input.oldValue === null
            ? undefined
            : (input.oldValue as Prisma.InputJsonValue),
        newValue:
          input.newValue === undefined || input.newValue === null
            ? undefined
            : (input.newValue as Prisma.InputJsonValue),
        reason: input.reason ?? undefined,
        actorId: input.actorId ?? undefined,
      },
    })
  }

  async list(params: { entityType?: string; entityId?: string; limit?: number }) {
    const take = Math.min(params.limit ?? 50, 200)
    return this.prisma.db.configAuditLog.findMany({
      where: {
        ...(params.entityType ? { entityType: params.entityType } : {}),
        ...(params.entityId ? { entityId: params.entityId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    })
  }
}
