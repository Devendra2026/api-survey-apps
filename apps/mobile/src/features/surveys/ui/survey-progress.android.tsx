import { colors } from "@/theme";
import { Host, LinearProgressIndicator } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet } from "react-native";

/** Android completion bar. Jetpack Compose `LinearProgressIndicator` inside `Host`. */
export function SurveyProgressBar({ percent, onPrimary = false }: { percent: number; onPrimary?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme="light"
      seedColor={colors.primary}
      style={styles.host}
    >
      <LinearProgressIndicator
        progress={clamped / 100}
        color={onPrimary ? colors.textInverse : colors.primary}
        trackColor={onPrimary ? "rgba(255,255,255,0.28)" : colors.surfaceMuted}
        strokeCap="round"
        gapSize={0}
        drawStopIndicator={{ stopSize: 0, color: onPrimary ? colors.textInverse : colors.primary }}
        modifiers={[fillMaxWidth()]}
      />
    </Host>
  )
}

const styles = StyleSheet.create({
  host: { width: "100%", height: 4 },
})
