import type { Logger } from "@nestjs/common"
import { isPermanentFailure, remediationFor } from "@workspace/etl-core"
import { UnrecoverableError } from "bullmq"

/**
 * Converts a permanent failure into an error BullMQ will not retry.
 *
 * Without this, a misconfigured shared secret burns every attempt and its backoff
 * on each trigger, multiplying one configuration problem into a stream of
 * identical failures across every ETL queue.
 */
export function toQueueError(err: unknown, logger: Logger): Error {
  if (!isPermanentFailure(err)) {
    return err instanceof Error ? err : new Error(String(err))
  }
  const message = err instanceof Error ? err.message : String(err)
  const remediation = remediationFor(err)
  logger.error(remediation ? `ETL stopped retrying: ${message} — ${remediation}` : `ETL stopped retrying: ${message}`)
  return new UnrecoverableError(message)
}
