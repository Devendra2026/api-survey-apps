import { apiClient, apiGet } from "@/lib/api/client"
import axios from "axios"

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

function triggerBlobDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

/**
 * Download a completed export via the API proxy (authenticated, same-origin).
 * Avoids browser "Failed to fetch" against private MinIO / missing S3 CORS.
 */
export async function downloadExportJobFile(jobId: string, filename: string) {
  try {
    const response = await apiClient.get<Blob>(`/reports/jobs/${jobId}/file`, {
      responseType: "blob",
      timeout: 15 * 60_000,
    })
    triggerBlobDownload(response.data, filename)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      const text = await error.response.data.text()
      try {
        const parsed = JSON.parse(text) as { message?: string }
        throw new Error(parsed.message || `Download failed (${error.response.status})`)
      } catch (inner) {
        if (inner instanceof Error && inner.message.startsWith("Download failed")) throw inner
        if (inner instanceof Error && !inner.message.includes("JSON")) throw inner
        throw new Error(text.slice(0, 240) || `Download failed (${error.response.status})`)
      }
    }
    if (axios.isAxiosError(error) && !error.response) {
      throw new Error("Network error while downloading export. Confirm the API is reachable and try again.")
    }
    throw error
  }
}

/** @deprecated Prefer downloadExportJobFile for production — signed URL fetch often hits CORS/private hosts. */
export async function downloadFromUrl(url: string, filename: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`)
    }
    const blob = await response.blob()
    triggerBlobDownload(blob, filename)
  } catch (error) {
    // Fallback: navigate without fetch (still fails if URL host is unreachable).
    if (error instanceof TypeError || (error instanceof Error && /failed to fetch/i.test(error.message))) {
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.rel = "noopener"
      a.target = "_blank"
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    }
    throw error
  }
}

export function isSyncExportCapError(message: string): boolean {
  return /capped|sync=true|synchronous exports/i.test(message)
}
