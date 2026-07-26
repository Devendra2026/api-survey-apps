/** Google Maps Static API URL for demand-notice GIS panel (print-safe). */
export function buildStaticMapUrl(
  latitude: number,
  longitude: number,
  options?: { width?: number; height?: number; zoom?: number }
): string | null {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) return null

  const width = options?.width ?? 640
  const height = options?.height ?? 360
  const zoom = options?.zoom ?? 17
  const center = `${latitude},${longitude}`

  return (
    `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(center)}` +
    `&zoom=${zoom}&size=${width}x${height}&scale=2&maptype=roadmap` +
    `&markers=color:red%7C${encodeURIComponent(center)}` +
    `&key=${encodeURIComponent(apiKey)}`
  )
}

export function formatLatLong(latitude: number | null, longitude: number | null): string {
  if (latitude == null || longitude == null) return "—"
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}
