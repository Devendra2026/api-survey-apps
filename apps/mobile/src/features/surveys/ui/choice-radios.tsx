import { Text } from "@/components/ui"
import { colors, spacing, touchTarget } from "@/theme"
import { Pressable, StyleSheet, View } from "react-native"

import type { ChoiceOption } from "./choice-radios.types"

export type { ChoiceOption } from "./choice-radios.types"

type Props = {
  label: string
  options: readonly ChoiceOption[]
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
}

/**
 * Yes/No style choices. Android uses Jetpack Compose `RadioButton` rows.
 */
export function ChoiceRadios({ label, options, value, onChange, disabled, required }: Props) {
  return (
    <View style={styles.wrap}>
      <Text variant="label">
        {label}
        {required ? <Text tone="danger"> *</Text> : null}
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: Boolean(disabled) }}
              accessibilityLabel={option.label}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={styles.choice}
            >
              <View style={[styles.ring, selected && styles.ringSelected]}>
                {selected ? <View style={styles.dot} /> : null}
              </View>
              <Text variant="body">{option.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  choice: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  ringSelected: { borderColor: colors.primary },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
})
