import { colors, radius } from "@/theme";
import { StyleSheet, View } from "react-native";

/** Thin completion bar. Android replaces this with `LinearProgressIndicator`. */
export function SurveyProgressBar({ percent, onPrimary = false }: { percent: number; onPrimary?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={[styles.track, onPrimary && styles.trackOnPrimary]}
    >
      <View style={[styles.fill, onPrimary && styles.fillOnPrimary, { width: `${clamped}%` }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  trackOnPrimary: { backgroundColor: "rgba(255,255,255,0.28)" },
  fill: { height: "100%", backgroundColor: colors.primary, borderRadius: radius.full },
  fillOnPrimary: { backgroundColor: colors.textInverse },
})
