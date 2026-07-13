"use client"

import { useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { PageHeader } from "@/components/shared/page-elements"
import { getApiErrorMessage } from "@/lib/api/client"

export default function ImportPage() {
  const { getToken } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; failed: number; errors?: string[] } | null>(null)

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
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Import surveys"
        description="Bulk import property surveys from Excel (.xlsx) or CSV files"
      />

      <Card>
        <CardHeader>
          <CardTitle>Upload file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button onClick={handleImport} disabled={!file || loading}>
            <Upload className="size-4" />
            {loading ? "Importing..." : "Import surveys"}
          </Button>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Import result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Imported: {result.imported}</p>
            <p>Failed: {result.failed}</p>
            {result.errors?.length ? (
              <ul className="text-destructive list-disc pl-5">
                {result.errors.slice(0, 10).map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
