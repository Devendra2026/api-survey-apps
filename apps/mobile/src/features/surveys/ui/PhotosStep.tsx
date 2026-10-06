import { Button, Text } from "@/components/ui"
import { apiUrl, getApiAuthHeader, getApiErrorMessage, isApiClientError } from "@/services/api/client"
import { deleteSurveyPhoto, replaceSurveyPhoto, uploadSurveyPhoto } from "@/services/api/surveys"
import { colors, radius, spacing } from "@/theme"
import { Image } from "expo-image"
import { ImageManipulator, SaveFormat } from "expo-image-manipulator"
import * as ImagePicker from "expo-image-picker"
import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Linking, StyleSheet, View } from "react-native"
import { useRecordCache } from "../hooks/queries"
import { optionLabel } from "../lib/labels"
import { createPhotoSlotGuard, photoPreviewPath, photoWriteTarget } from "../lib/photo-upload"
import { type PhotoType, type SurveyPhoto } from "../types"

const PHOTO_SLOTS: { type: PhotoType; hint: string; required: boolean }[] = [
  { type: "FRONT", hint: "Full front of the building from the street", required: true },
  { type: "SIDE", hint: "Side elevation along the property boundary", required: true },
]

const MAX_WIDTH = 1600
const JPEG_QUALITY = 0.7

type LocalUpload = {
  uri: string
  width: number
  height: number
  status: "uploading" | "failed"
  error?: string
  replaceId?: string
  canRetry: boolean
}

async function compress(asset: ImagePicker.ImagePickerAsset): Promise<{ uri: string; width: number; height: number }> {
  const context = ImageManipulator.manipulate(asset.uri)
  if (asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH })
  const rendered = await context.renderAsync()
  const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG })
  return { uri: saved.uri, width: saved.width, height: saved.height }
}

export function PhotosStep({
  surveyId,
  photos,
  editable,
}: {
  surveyId: string
  photos: SurveyPhoto[]
  editable: boolean
}) {
  const recordCache = useRecordCache()
  const slots = useRef(createPhotoSlotGuard())
  const [local, setLocal] = useState<Partial<Record<PhotoType, LocalUpload>>>({})
  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    let cancelled = false
    void getApiAuthHeader().then((h) => {
      if (!cancelled) setAuthHeaders(h)
    })
    return () => {
      cancelled = true
    }
  }, [photos.length])

  const setLocalFor = (type: PhotoType, next: LocalUpload | undefined) =>
    setLocal((prev) => {
      const copy = { ...prev }
      if (next) copy[type] = next
      else delete copy[type]
      return copy
    })

  const send = async (type: PhotoType, file: { uri: string; width: number; height: number }, replaceId?: string) => {
    const write = photoWriteTarget(replaceId)
    setLocalFor(type, { ...file, status: "uploading", replaceId, canRetry: false })
    try {
      const input = {
        surveyId,
        photoType: type,
        uri: file.uri,
        width: file.width,
        height: file.height,
        capturedAt: new Date().toISOString(),
      }
      const row = write.mode === "replace" ? await replaceSurveyPhoto(write.photoId, input) : await uploadSurveyPhoto(input)
      if (!row.objectKey) throw new Error("Upload was not confirmed by storage. Try again.")
      recordCache.update(surveyId, (record) => ({
        ...record,
        photos:
          write.mode === "replace"
            ? record.photos.map((photo) => (photo.id === write.photoId ? row : photo))
            : [...record.photos, row],
      }))
      setLocalFor(type, undefined)
    } catch (e) {
      const tooLarge = isApiClientError(e) && e.statusCode === 413
      setLocalFor(type, {
        ...file,
        status: "failed",
        error: getApiErrorMessage(e, "Upload failed"),
        replaceId,
        canRetry: !tooLarge,
      })
    }
  }

  const upload = async (type: PhotoType, file: { uri: string; width: number; height: number }, replaceId?: string) => {
    if (!slots.current.tryAcquire(type)) return
    try {
      await send(type, file, replaceId)
    } finally {
      slots.current.release(type)
    }
  }

  const pick = async (type: PhotoType, source: "camera" | "library", replaceId?: string) => {
    if (!slots.current.tryAcquire(type)) return
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          source === "camera" ? "Camera access is required to photograph the property." : "Photo library access is required.",
          permission.canAskAgain ? undefined : [{ text: "Cancel" }, { text: "Open settings", onPress: () => void Linking.openSettings() }],
        )
        return
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: "images", quality: 1, exif: false }
      const result =
        source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
      const asset = result.canceled ? undefined : result.assets[0]
      if (!asset) return
      const file = await compress(asset)
      await send(type, file, replaceId)
    } catch (e) {
      Alert.alert("Could not process photo", getApiErrorMessage(e))
    } finally {
      slots.current.release(type)
    }
  }

  const choose = (type: PhotoType, replaceId?: string) =>
    Alert.alert(optionLabel(type), undefined, [
      { text: "Take photo", onPress: () => void pick(type, "camera", replaceId) },
      { text: "Choose from gallery", onPress: () => void pick(type, "library", replaceId) },
      { text: "Cancel", style: "cancel" },
    ])

  const remove = (photo: SurveyPhoto) =>
    Alert.alert(`Delete ${optionLabel(photo.photoType)}?`, "The photo is removed from storage.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteSurveyPhoto(photo.id)
            .then(() =>
              recordCache.update(surveyId, (r) => ({ ...r, photos: r.photos.filter((p) => p.id !== photo.id) })),
            )
            .catch((e: unknown) => Alert.alert("Delete failed", getApiErrorMessage(e)))
        },
      },
    ])

  return (
    <View style={styles.grid}>
      {PHOTO_SLOTS.map(({ type, hint, required }) => {
        const confirmed = photos.filter((p) => p.photoType === type && p.objectKey)
        const latest = confirmed[confirmed.length - 1]
        const pending = local[type]
        return (
          <View key={type} style={styles.slot}>
            <View style={styles.slotHeader}>
              <Text variant="bodyStrong">
                {optionLabel(type)}
                {required ? <Text tone="danger"> *</Text> : null}
              </Text>
              {latest && !pending ? (
                <Text variant="caption" style={{ color: colors.success, fontWeight: "600" }}>
                  Uploaded
                </Text>
              ) : null}
            </View>
            <Text variant="caption" tone="secondary">
              {hint}
            </Text>
            <View style={styles.preview}>
              {pending ? (
                <Image source={{ uri: pending.uri }} style={styles.image} contentFit="cover" />
              ) : latest && authHeaders ? (
                <Image
                  source={{ uri: apiUrl(photoPreviewPath(latest.id, latest.objectKey)), headers: authHeaders }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  accessibilityLabel={`${optionLabel(type)} photo`}
                />
              ) : (
                <Text variant="caption" tone="secondary">
                  No photo
                </Text>
              )}
              {pending?.status === "uploading" ? (
                <View style={styles.overlay}>
                  <ActivityIndicator color={colors.textInverse} />
                  <Text variant="caption" tone="inverse">
                    Uploading…
                  </Text>
                </View>
              ) : null}
            </View>
            {pending?.status === "failed" ? (
              <View style={styles.failed}>
                <Text variant="caption" tone="danger">
                  {pending.error}
                </Text>
                <View style={styles.actions}>
                  {pending.canRetry ? (
                    <Button title="Retry" onPress={() => void upload(type, pending, pending.replaceId)} style={styles.flex} />
                  ) : null}
                  <Button title="Discard" variant="secondary" onPress={() => setLocalFor(type, undefined)} style={styles.flex} />
                </View>
              </View>
            ) : null}
            {editable && !pending ? (
              latest ? (
                <View style={styles.actions}>
                  <Button title="Retake" variant="secondary" onPress={() => choose(type, latest.id)} style={styles.flex} />
                  <Button title="Remove" variant="ghost" onPress={() => remove(latest)} style={styles.flex} />
                </View>
              ) : (
                <Button title="Open camera" variant={type === "FRONT" ? "primary" : "secondary"} onPress={() => choose(type)} />
              )
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { gap: spacing.lg },
  slot: { gap: spacing.sm },
  slotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  preview: {
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  failed: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.dangerMuted },
  actions: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
})
