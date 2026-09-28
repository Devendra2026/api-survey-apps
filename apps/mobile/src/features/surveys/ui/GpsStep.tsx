import { Button, Text } from "@/components/ui"
import { colors, radius, spacing } from "@/theme"
import * as Location from "expo-location"
import { useState } from "react"
import { Linking, StyleSheet, View } from "react-native"
import type { SurveyEditableFields, SurveyPatch } from "../types"

const GPS_TIMEOUT_MS = 20_000
const WEAK_ACCURACY_METERS = 30

type GpsError = { message: string; openSettings: boolean }

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error("Location failed"))
      },
    )
  })
}

function toNumber(value: SurveyEditableFields["latitude"]): number | null {
  if (value === null) return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function GpsStep({
  fields,
  editable,
  onCapture,
}: {
  fields: SurveyEditableFields
  editable: boolean
  onCapture: (patch: SurveyPatch) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<GpsError | null>(null)
  const lat = toNumber(fields.latitude)
  const lng = toNumber(fields.longitude)
  const accuracy = toNumber(fields.gpsAccuracyMeters)

  const capture = async () => {
    setBusy(true)
    setError(null)
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        setError({ message: "Location services are off. Turn on GPS and try again.", openSettings: false })
        return
      }
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setError({
          message: "Location permission is required to record the property position.",
          openSettings: !permission.canAskAgain,
        })
        return
      }
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        GPS_TIMEOUT_MS,
      )
      onCapture({
        latitude: Number(position.coords.latitude.toFixed(7)),
        longitude: Number(position.coords.longitude.toFixed(7)),
        gpsAccuracyMeters:
          position.coords.accuracy !== null ? Number(position.coords.accuracy.toFixed(2)) : null,
        capturedAt: new Date(position.timestamp).toISOString(),
        gpsSource: "DEVICE",
      })
    } catch (e) {
      const timedOut = e instanceof Error && e.message === "timeout"
      setError({
        message: timedOut
          ? "Could not get a GPS fix in time. Move to an open area and try again."
          : "Could not read your location. Try again.",
        openSettings: false,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.wrap}>
      {lat !== null && lng !== null ? (
        <View style={styles.readout}>
          <Row label="Latitude" value={lat.toFixed(6)} />
          <Row label="Longitude" value={lng.toFixed(6)} />
          <Row label="Accuracy" value={accuracy !== null ? `± ${accuracy.toFixed(1)} m` : "Unknown"} />
          <Row label="Captured" value={fields.capturedAt ? new Date(fields.capturedAt).toLocaleString() : "—"} />
          {accuracy !== null && accuracy > WEAK_ACCURACY_METERS ? (
            <Text variant="caption" style={{ color: colors.warning }}>
              Accuracy is weak. Recapture outdoors if possible.
            </Text>
          ) : null}
        </View>
      ) : (
        <Text variant="body" tone="secondary">
          Stand at the property entrance and capture the location. GPS is required to submit.
        </Text>
      )}
      {error ? (
        <View style={styles.error}>
          <Text variant="caption" tone="danger">
            {error.message}
          </Text>
          {error.openSettings ? (
            <Button title="Open settings" variant="secondary" onPress={() => void Linking.openSettings()} />
          ) : null}
        </View>
      ) : null}
      {editable ? (
        <Button
          title={lat !== null ? "Recapture GPS" : "Capture GPS"}
          loading={busy}
          variant={lat !== null ? "secondary" : "primary"}
          onPress={() => void capture()}
        />
      ) : null}
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  readout: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  error: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.dangerMuted },
})
