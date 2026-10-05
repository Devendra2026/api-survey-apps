import { Button, Text } from "@/components/ui"
import { colors, radius, spacing } from "@/theme"
import * as Location from "expo-location"
import { useCallback, useEffect, useRef, useState } from "react"
import { Linking, StyleSheet, View } from "react-native"
import { gpsFreshnessWarning } from "../lib/gps-freshness"
import type { SurveyEditableFields, SurveyPatch } from "../types"
import { SurveyLocationMap } from "./SurveyLocationMap"

const GPS_TIMEOUT_MS = 20_000

type GpsError = { message: string; openSettings: boolean }
type GpsPhase = "idle" | "searching" | "acquired"

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
  const [phase, setPhase] = useState<GpsPhase>(fields.latitude != null ? "acquired" : "idle")
  const [error, setError] = useState<GpsError | null>(null)
  const lat = toNumber(fields.latitude)
  const lng = toNumber(fields.longitude)
  const accuracy = toNumber(fields.gpsAccuracyMeters)
  const freshness = gpsFreshnessWarning(fields.capturedAt)
  const autoStarted = useRef(false)

  const capture = useCallback(async () => {
    setBusy(true)
    setError(null)
    setPhase("searching")
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        setError({
          message: "Unable to get accurate location. Location services are off — turn on GPS and try again.",
          openSettings: false,
        })
        setPhase(lat !== null ? "acquired" : "idle")
        return
      }
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setError({
          message: "Unable to get accurate location. Location permission is required to record the property position.",
          openSettings: !permission.canAskAgain,
        })
        setPhase(lat !== null ? "acquired" : "idle")
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
      setPhase("acquired")
    } catch (e) {
      const timedOut = e instanceof Error && e.message === "timeout"
      setError({
        message: timedOut
          ? "Unable to get accurate location. Move to an open area and tap Retry."
          : "Unable to get accurate location. Try again.",
        openSettings: false,
      })
      setPhase(lat !== null ? "acquired" : "idle")
    } finally {
      setBusy(false)
    }
  }, [lat, onCapture])

  useEffect(() => {
    if (!editable || lat !== null || autoStarted.current) return
    autoStarted.current = true
    void capture()
  }, [capture, editable, lat])

  return (
    <View style={styles.wrap}>
      <View style={styles.statusRow}>
        <Text variant="label">GPS status</Text>
        <Text
          variant="caption"
          tone={phase === "searching" ? "primary" : phase === "acquired" ? "default" : "secondary"}
        >
          {phase === "searching" ? "Searching…" : phase === "acquired" && lat !== null ? "Acquired" : "Not captured"}
        </Text>
      </View>
      {lat !== null && lng !== null ? (
        <View style={styles.readout}>
          <SurveyLocationMap latitude={lat} longitude={lng} />
          <Row label="Latitude" value={lat.toFixed(6)} />
          <Row label="Longitude" value={lng.toFixed(6)} />
          <Row label="Accuracy" value={accuracy === null ? "—" : `${accuracy.toFixed(2)} m`} />
          <Row label="Captured" value={fields.capturedAt ? new Date(fields.capturedAt).toLocaleString() : "—"} />
          {freshness ? (
            <Text variant="caption" tone="danger">
              {freshness}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text variant="body" tone="secondary">
          Stand at the property entrance and capture the location. GPS is required to submit. Only a successful
          capture is stored — failed attempts never overwrite a valid fix.
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
          title={busy ? "Getting current location…" : lat !== null ? "Capture current location" : error ? "Retry" : "Capture current location"}
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
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  readout: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  error: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.dangerMuted },
})
