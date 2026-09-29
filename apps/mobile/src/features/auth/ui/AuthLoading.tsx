import { Text } from "@/components/ui"
import { colors, spacing } from "@/theme"
import { ActivityIndicator, StyleSheet, View } from "react-native"

type Props = {
  message?: string
}

export function AuthLoading({ message = "Loading…" }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator color={colors.primary} size="small" />
      <Text variant="caption" tone="secondary">
        {message}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
})
