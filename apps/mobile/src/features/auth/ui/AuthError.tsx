import { Text } from "@/components/ui"
import { colors, radius, spacing } from "@/theme"
import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"

type Props = {
  message: string
  children?: ReactNode
}

export function AuthError({ message, children }: Props) {
  if (!message && !children) {
    return null
  }

  return (
    <View
      style={styles.box}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {message ? (
        <Text variant="caption" tone="danger">
          {message}
        </Text>
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.dangerMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
})
