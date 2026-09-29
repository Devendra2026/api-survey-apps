import { Text } from "@/components/ui"
import { MIN_PASSWORD_LENGTH } from "@/features/auth/lib/clerk-errors"
import { colors, radius, spacing } from "@/theme"
import { StyleSheet, View } from "react-native"

type Props = {
  password: string
}

function strengthLabel(password: string): { label: string; tone: "danger" | "warning" | "success" | "secondary" } {
  if (!password) {
    return { label: `At least ${MIN_PASSWORD_LENGTH} characters`, tone: "secondary" }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { label: `Too short (${password.length}/${MIN_PASSWORD_LENGTH})`, tone: "danger" }
  }
  const hasLetter = /[A-Za-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const score = Number(hasLetter) + Number(hasNumber) + Number(hasSymbol) + (password.length >= 12 ? 1 : 0)
  if (score >= 3) {
    return { label: "Strong password", tone: "success" }
  }
  if (score >= 2) {
    return { label: "Good password", tone: "warning" }
  }
  return { label: "Add letters, numbers, or symbols for a stronger password", tone: "warning" }
}

export function PasswordStrength({ password }: Props) {
  const { label, tone } = strengthLabel(password)
  const filled =
    password.length === 0
      ? 0
      : password.length < MIN_PASSWORD_LENGTH
        ? 1
        : strengthLabel(password).tone === "success"
          ? 3
          : 2

  return (
    <View style={styles.wrap} accessibilityLabel={`Password strength: ${label}`}>
      <View style={styles.bars}>
        {[1, 2, 3].map((level) => (
          <View
            key={level}
            style={[
              styles.bar,
              filled >= level && tone === "danger" && styles.barDanger,
              filled >= level && tone === "warning" && styles.barWarning,
              filled >= level && tone === "success" && styles.barSuccess,
              filled >= level && tone === "secondary" && styles.barMuted,
            ]}
          />
        ))}
      </View>
      <Text
        variant="caption"
        tone={tone === "danger" ? "danger" : "secondary"}
        style={tone === "success" ? { color: colors.success } : tone === "warning" ? { color: colors.warning } : undefined}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    marginTop: -spacing.sm,
  },
  bars: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  barDanger: {
    backgroundColor: colors.danger,
  },
  barWarning: {
    backgroundColor: colors.warning,
  },
  barSuccess: {
    backgroundColor: colors.success,
  },
  barMuted: {
    backgroundColor: colors.border,
  },
})
