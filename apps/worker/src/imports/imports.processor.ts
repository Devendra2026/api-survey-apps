import { Processor, WorkerHost } from "@nestjs/bullmq"
import { JOB_QUEUE_NAMES, type ImportJobPayload } from "@workspace/jobs"
import type { Job } from "bullmq"
import { ImportWorkerService } from "./import-worker.service.js"

@Processor(JOB_QUEUE_NAMES.imports, { concurrency: 2 })
export class ImportsProcessor extends WorkerHost {
  constructor(private readonly importWorkerService: ImportWorkerService) {
    super()
  }

  async process(job: Job<ImportJobPayload>): Promise<void> {
    await this.importWorkerService.process(job.data, async (progress) => {
      await job.updateProgress(progress)
    })
  }
}
