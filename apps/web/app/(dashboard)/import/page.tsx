"use client"

import { KpiCard } from "@/components/shared/kpi-card"
import { PageHeader } from "@/components/shared/page-elements"
import { getApiErrorMessage } from "@/lib/api/client"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { FileSpreadsheet, Upload } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

export default function ImportPage() {
  const { getToken } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    imported: number
    failed: number
    errors?: string[]
  } | null>(null)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }, [])

  async function handleImport() {
    if (!file) {
      toast.error("Select a file first")
      return
    }

    setLoading(true)
    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append("file", file)
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
      const response = await fetch(`${base}/imports/surveys`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const json = await response.json()
      if (!json.success) throw new Error(json.message)
      setResult(json.data)
      toast.success(`Imported ${json.data.imported} surveys`)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Import surveys" description="Bulk import property surveys from Excel (.xlsx) or CSV files" />

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Upload file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors",
              dragging ? "border-primary bg-accent/40" : "hover:bg-muted/40"
            )}
          >
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
              <FileSpreadsheet className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{file ? file.name : "Drop a file here or click to browse"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Accepts .xlsx, .xls, or .csv</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button onClick={() => void handleImport()} disabled={!file || loading} size="sm">
            <Upload className="size-3.5" />
            {loading ? "Importing…" : "Import surveys"}
          </Button>
        </CardContent>
      </Card>

      {result ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard title="Imported" value={result.imported} />
            <KpiCard title="Failed" value={result.failed} />
          </div>
          {result.errors?.length ? (
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                  {result.errors.slice(0, 10).map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
