import { Processor, WorkerHost } from "@nestjs/bullmq"
import { JOB_QUEUE_NAMES, type ExportJobPayload } from "@workspace/jobs"
import type { Job } from "bullmq"
import { ExportWorkerService } from "./export-worker.service.js"

@Processor(JOB_QUEUE_NAMES.exports, { concurrency: 2 })
export class ExportsProcessor extends WorkerHost {
  constructor(private readonly exportWorkerService: ExportWorkerService) {
    super()
  }

  async process(job: Job<ExportJobPayload>): Promise<void> {
    await this.exportWorkerService.process(job.data, async (progress) => {
      await job.updateProgress(progress)
    })
  }
}
