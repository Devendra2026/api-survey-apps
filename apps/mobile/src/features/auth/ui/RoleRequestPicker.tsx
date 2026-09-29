import { Text } from "@/components/ui"
import { colors, radius, spacing } from "@/theme"
import type { RequestableRole } from "@/types/user"
import { Pressable, StyleSheet, View } from "react-native"

const OPTIONS: {
  value: RequestableRole
  title: string
  description: string
}[] = [
    {
      value: "SURVEYOR",
      title: "Surveyor",
      description: "Create and submit property surveys in the field.",
    },
    {
      value: "FIELD_SUPERVISOR",
      title: "Supervisor",
      description: "Review and monitor surveys according to your permissions.",
    },
  ]

type Props = {
  value: RequestableRole | null
  onChange: (role: RequestableRole) => void
  disabled?: boolean
  error?: string | null
}

export function RoleRequestPicker({ value, onChange, disabled = false, error }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Requested role">
      <Text variant="label" tone="secondary">
        Requested role *
      </Text>
      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const selected = value === option.value
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`${option.title}. ${option.description}`}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[styles.option, selected && styles.optionSelected, disabled && styles.disabled]}
            >
              <Text variant="bodyStrong" tone={selected ? "primary" : "default"}>
                {option.title}
              </Text>
              <Text variant="caption" tone="secondary">
                {option.description}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 72,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  disabled: {
    opacity: 0.55,
  },
})
