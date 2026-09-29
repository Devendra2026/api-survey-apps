import { Text } from "@/components/ui"
import { colors, spacing } from "@/theme"
import { Host, Switch } from "@expo/ui"
import { StyleSheet, View } from "react-native"

/**
 * Yes/No control backed by universal `@expo/ui` Switch inside Host.
 * Host bridges to Jetpack Compose on Android and SwiftUI on iOS.
 * Off = No (or unset before first toggle); On = Yes.
 */
export function NativeYesNoField({
  label,
  value,
  onChange,
  disabled,
  required,
}: {
  label: string
  value: boolean | null
  onChange: (next: boolean | null) => void
  disabled?: boolean
  required?: boolean
}) {
  const checked = value === true
  return (
    <View style={styles.wrap}>
      <Text variant="label">
        {label}
        {required ? <Text tone="danger"> *</Text> : null}
      </Text>
      <Host matchContents style={styles.host} seedColor={colors.primary}>
        <Switch
          label={checked ? "Yes" : value === false ? "No" : "Not set — toggle for Yes"}
          value={checked}
          disabled={disabled}
          onValueChange={(next) => {
            if (disabled) return
            onChange(next)
          }}
        />
      </Host>
      <Text variant="caption" tone="secondary">
        {value === true ? "Yes selected" : value === false ? "No selected" : "Not set"}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  host: { minHeight: 44, justifyContent: "center" },
})
