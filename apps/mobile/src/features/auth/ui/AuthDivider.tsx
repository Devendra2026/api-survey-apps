import { Text } from "@/components/ui"
import { colors, spacing } from "@/theme"
import { StyleSheet, View } from "react-native"

type Props = {
  label?: string
}

export function AuthDivider({ label = "Or continue with" }: Props) {
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={label}>
      <View style={styles.line} />
      <Text variant="caption" tone="secondary" style={styles.label}>
        {label}
      </Text>
      <View style={styles.line} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  label: {
    flexShrink: 0,
  },
})
