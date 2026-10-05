import { Text } from "@/components/ui"
import { colors, radius, spacing } from "@/theme"
import { Pressable, StyleSheet, View } from "react-native"

type Props = {
  value: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}

const OPTIONS = [
  { value: false, label: "Not in slum area" },
  { value: true, label: "Slum area" },
] as const

/** iOS and other platforms. Android uses a Compose segmented button. */
export function SlumChoice({ value, disabled, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = value === option.value
        return (
          <Pressable
            key={option.label}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.selected, disabled && styles.disabled]}
          >
            <Text variant="label" tone={selected ? "inverse" : "default"}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  option: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  disabled: { opacity: 0.6 },
})
