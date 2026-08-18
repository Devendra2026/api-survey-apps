"use client"

import { glassInsetClass } from "@/components/surveys/survey-view-field"
import { usePhotoMutations } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import type { SurveyPhotoItem } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { ImageIcon, Link2, Trash2, Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

const PHOTO_TYPE_OPTIONS = ["FRONT", "SIDE", "INSIDE", "DOCUMENT"] as const

function isHttpUrl(url: string | undefined): boolean {
  return Boolean(url?.trim() && /^https?:\/\//i.test(url.trim()))
}

function usePhotoDisplayUrl(photo: SurveyPhotoItem, fetchFreshUrl: (photoId: string) => Promise<string | null>) {
  const initialUrl = isHttpUrl(photo.url) ? photo.url.trim() : ""
  const [displayUrl, setDisplayUrl] = useState(initialUrl)
  const [failed, setFailed] = useState(false)
  const refreshAttempted = useRef(false)

  useEffect(() => {
    const next = isHttpUrl(photo.url) ? photo.url.trim() : ""
    setDisplayUrl(next)
    setFailed(false)
    refreshAttempted.current = false
  }, [photo.id, photo.url])

  const onImageError = async () => {
    if (refreshAttempted.current || photo.importStatus === "PENDING") {
      setFailed(true)
      return
    }
    refreshAttempted.current = true
    try {
      const fresh = await fetchFreshUrl(photo.id)
      if (fresh && isHttpUrl(fresh)) {
        setDisplayUrl(fresh.trim())
        setFailed(false)
        return
      }
    } catch {
      // Fall through to unavailable state.
    }
    setFailed(true)
  }

  return { displayUrl, failed, onImageError }
}

function PhotoImage({
  photo,
  alt,
  className,
  fetchFreshUrl,
}: {
  photo: SurveyPhotoItem
  alt: string
  className?: string
  fetchFreshUrl: (photoId: string) => Promise<string | null>
}) {
  const usableInitial = isHttpUrl(photo.url) ? photo.url.trim() : ""
  const migrating = !usableInitial && photo.importStatus === "PENDING"
  const { displayUrl, failed, onImageError } = usePhotoDisplayUrl(photo, fetchFreshUrl)

  if (migrating) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/40 bg-white/20 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
        <ImageIcon className="size-6 opacity-60" />
        <span className="text-xs">Photo migrating…</span>
      </div>
    )
  }

  if (failed || !displayUrl) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/40 bg-white/20 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
        <ImageIcon className="size-6 opacity-60" />
        <span className="text-xs">Image unavailable</span>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={displayUrl} alt={alt} onError={() => void onImageError()} className={className} />
  )
}

function PhotoEditTile({
  photo,
  surveyId,
  surveyorFallback,
}: {
  photo: SurveyPhotoItem
  surveyId: string
  surveyorFallback: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const photos = usePhotoMutations(surveyId)
  const busy = photos.replace.isPending || photos.remove.isPending || photos.getDownloadUrl.isPending

  const fetchFreshUrl = async (photoId: string) => {
    const result = await photos.getDownloadUrl.mutateAsync(photoId)
    return result.url
  }

  const onReplace = async (file: File | undefined) => {
    if (!file) return
    try {
      await photos.replace.mutateAsync({ id: photo.id, file, photoType: photo.photoType })
      toast.success(`${photo.label} replaced`)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const onCopyLink = async () => {
    try {
      const result = await photos.getDownloadUrl.mutateAsync(photo.id)
      await navigator.clipboard.writeText(result.url)
      toast.success("Share link copied")
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const onDelete = async () => {
    try {
      await photos.remove.mutateAsync(photo.id)
      toast.success(`${photo.label} deleted`)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  return (
    <div className={cn(glassInsetClass, "overflow-hidden p-2")}>
      <PhotoImage
        photo={photo}
        alt={photo.label}
        fetchFreshUrl={fetchFreshUrl}
        className="aspect-video w-full rounded-lg object-cover"
      />
      <p className="mt-2 text-sm font-medium">{photo.label}</p>
      <p className="text-xs text-muted-foreground">{photo.surveyorName || surveyorFallback}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onReplace(e.target.files?.[0])}
        />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="size-3.5" />
          Replace
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onCopyLink()}>
          <Link2 className="size-3.5" />
          Copy link
        </Button>
        <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void onDelete()}>
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>
    </div>
  )
}

export function QcPhotoEditor({
  surveyId,
  photos,
  surveyorFallback,
  editMode,
}: {
  surveyId: string
  photos: SurveyPhotoItem[]
  surveyorFallback: string
  editMode: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const mutations = usePhotoMutations(surveyId)
  const [uploadType, setUploadType] = useState<string>("FRONT")

  const onUpload = async (file: File | undefined) => {
    if (!file) return
    try {
      await mutations.upload.mutateAsync({ file, photoType: uploadType })
      toast.success(`${uploadType} photo uploaded`)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
          Photos Uploaded {photos.length}/{Math.max(photos.length, 2)}
        </p>
      </div>

      {editMode ? (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-40 space-y-1">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">New photo type</p>
            <Select value={uploadType} onValueChange={setUploadType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHOTO_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onUpload(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            disabled={mutations.upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" />
            Upload to storage
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {photos.length ? (
          photos.map((photo) =>
            editMode ? (
              <PhotoEditTile key={photo.id} photo={photo} surveyId={surveyId} surveyorFallback={surveyorFallback} />
            ) : (
              <ReadOnlyPhotoTile key={photo.id} photo={photo} surveyId={surveyId} surveyorFallback={surveyorFallback} />
            )
          )
        ) : (
          <div
            className={cn(
              glassInsetClass,
              "col-span-full flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
            )}
          >
            <ImageIcon className="size-4" />
            No photos uploaded
          </div>
        )}
      </div>
    </div>
  )
}

function ReadOnlyPhotoTile({
  photo,
  surveyId,
  surveyorFallback,
}: {
  photo: SurveyPhotoItem
  surveyId: string
  surveyorFallback: string
}) {
  const photos = usePhotoMutations(surveyId)

  const fetchFreshUrl = async (photoId: string) => {
    const result = await photos.getDownloadUrl.mutateAsync(photoId)
    return result.url
  }

  return (
    <div className={cn(glassInsetClass, "group overflow-hidden p-2 transition-transform hover:scale-[1.01]")}>
      <PhotoImage
        photo={photo}
        alt={photo.label}
        fetchFreshUrl={fetchFreshUrl}
        className="aspect-video w-full rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <p className="mt-2 text-sm font-medium">{photo.label}</p>
      <p className="text-xs text-muted-foreground">{photo.surveyorName || surveyorFallback}</p>
    </div>
  )
}
