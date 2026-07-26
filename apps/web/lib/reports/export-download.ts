import { apiGet } from "@/lib/api/client"

export type ExportJobStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED"

export type ExportJob = {
  id: string
  status: ExportJobStatus
  reportType: string
  format: string
  filename?: string | null
  rowCount?: number | null
  errorMessage?: string | null
}

export type ExportJobDownload = {
  jobId: string
  filename: string
  rowCount?: number | null
  url: string
}

export type EnqueuedExport = {
  jobId: string
  status: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function enqueueReportExport(
  format: "xlsx" | "csv" | "pdf",
  params: Record<string, string>
): Promise<EnqueuedExport> {
  const searchParams = new URLSearchParams({ ...params, format })
  // Omit sync so the API queues a background job (no 500-row / 2MB sync cap).
  searchParams.delete("sync")
  return apiGet<EnqueuedExport>(`/reports/export?${searchParams}`)
}

export async function getExportJob(jobId: string): Promise<ExportJob> {
  return apiGet<ExportJob>(`/reports/jobs/${jobId}`)
}

export async function getExportJobDownload(jobId: string): Promise<ExportJobDownload> {
  return apiGet<ExportJobDownload>(`/reports/jobs/${jobId}/download`)
}

export async function waitForExportJob(
  jobId: string,
  options: { timeoutMs?: number; intervalMs?: number; onTick?: (job: ExportJob) => void } = {}
): Promise<ExportJob> {
  const timeoutMs = options.timeoutMs ?? 120_000
  const intervalMs = options.intervalMs ?? 2000
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const job = await getExportJob(jobId)
    options.onTick?.(job)
    if (job.status === "SUCCEEDED") return job
    if (job.status === "FAILED" || job.status === "CANCELLED") {
      throw new Error(job.errorMessage || `Export ${job.status.toLowerCase()}`)
    }
    await sleep(intervalMs)
  }

  throw new Error("Export is taking longer than expected. Check back shortly or retry with a narrower filter scope.")
}

export async function downloadFromUrl(url: string, filename: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export function isSyncExportCapError(message: string): boolean {
  return /capped|sync=true|synchronous exports/i.test(message)
}
