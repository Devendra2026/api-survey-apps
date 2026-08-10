import type { PrismaClient } from "@workspace/database"
import type { CursorState } from "./schemas.js"

export class CursorConflictError extends Error {
  constructor(message = "Audit ETL cursor version conflict") {
    super(message)
    this.name = "CursorConflictError"
  }
}

export class CursorManager {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly pipelineKey: string
  ) {}

  async getOrCreate(): Promise<CursorState> {
    const row = await this.prisma.auditEtlCursor.upsert({
      where: { pipelineKey: this.pipelineKey },
      create: {
        pipelineKey: this.pipelineKey,
        lastProcessedTimestamp: 0n,
        lastProcessedId: "",
        version: 0,
      },
      update: {},
    })
    return {
      lastProcessedTimestamp: Number(row.lastProcessedTimestamp),
      lastProcessedId: row.lastProcessedId,
      version: row.version,
    }
  }

  /**
   * Optimistic lock advance: only succeeds when `expectedVersion` still matches.
   */
  async advance(input: {
    expectedVersion: number
    lastProcessedTimestamp: number
    lastProcessedId: string
  }): Promise<CursorState> {
    const result = await this.prisma.auditEtlCursor.updateMany({
      where: {
        pipelineKey: this.pipelineKey,
        version: input.expectedVersion,
      },
      data: {
        lastProcessedTimestamp: BigInt(input.lastProcessedTimestamp),
        lastProcessedId: input.lastProcessedId,
        version: { increment: 1 },
      },
    })

    if (result.count !== 1) {
      throw new CursorConflictError(
        `Failed to advance cursor for ${this.pipelineKey} (version ${input.expectedVersion})`
      )
    }

    const row = await this.prisma.auditEtlCursor.findUniqueOrThrow({
      where: { pipelineKey: this.pipelineKey },
    })
    return {
      lastProcessedTimestamp: Number(row.lastProcessedTimestamp),
      lastProcessedId: row.lastProcessedId,
      version: row.version,
    }
  }
}
