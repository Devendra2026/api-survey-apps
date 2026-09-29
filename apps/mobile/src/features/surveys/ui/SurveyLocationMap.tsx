import { Text } from "@/components/ui"
import { getGoogleMapsApiKey } from "@/lib/env"
import { colors, radius, spacing } from "@/theme"
import { StyleSheet, View } from "react-native"
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps"

export function SurveyLocationMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const apiKey = getGoogleMapsApiKey()
  return (
    <View style={styles.wrap}>
      <Text variant="label">Current location</Text>
      {!apiKey ? (
        <Text variant="caption" tone="danger">
          Google Maps key is not configured. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for local and production builds.
        </Text>
      ) : null}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={{
          latitude,
          longitude,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        }}
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker coordinate={{ latitude, longitude }} title="Property location" />
      </MapView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  map: {
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
})
