import { InjectQueue } from "@nestjs/bullmq"
import { Injectable } from "@nestjs/common"
import {
  JOB_NAMES,
  JOB_QUEUE_NAMES,
  type ExportJobPayload,
  type ImportJobPayload,
  type StorageCleanupPayload,
} from "@workspace/jobs"
import type { Queue } from "bullmq"

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(JOB_QUEUE_NAMES.imports) private readonly importsQueue: Queue<ImportJobPayload>,
    @InjectQueue(JOB_QUEUE_NAMES.exports) private readonly exportsQueue: Queue<ExportJobPayload>,
    @InjectQueue(JOB_QUEUE_NAMES.storageCleanup) private readonly storageCleanupQueue: Queue<StorageCleanupPayload>
  ) {}

  async enqueueImport(payload: ImportJobPayload): Promise<string> {
    const job = await this.importsQueue.add(JOB_NAMES.processImport, payload, {
      jobId: payload.jobId,
    })
    return job.id ?? payload.jobId
  }

  async enqueueExport(payload: ExportJobPayload): Promise<string> {
    const job = await this.exportsQueue.add(JOB_NAMES.processExport, payload, {
      jobId: payload.jobId,
    })
    return job.id ?? payload.jobId
  }

  async enqueueStorageCleanup(payload: StorageCleanupPayload): Promise<string> {
    const job = await this.storageCleanupQueue.add(JOB_NAMES.deleteObjects, payload)
    return job.id ?? ""
  }
}
