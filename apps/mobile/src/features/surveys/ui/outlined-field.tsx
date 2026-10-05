import { Text, TextField } from "@/components/ui"
import { spacing } from "@/theme"
import { StyleSheet, View } from "react-native"
import type { OutlinedFieldProps } from "./outlined-field.types"

/** iOS and other platforms. Android uses the Compose outlined field. */
export function OutlinedField({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  error,
  editable = true,
  keyboard = "default",
  maxLength,
  required,
}: OutlinedFieldProps) {
  return (
    <View style={styles.wrap}>
      <TextField
        label={required ? `${label} *` : label}
        value={value}
        placeholder={placeholder}
        editable={editable}
        keyboardType={keyboard}
        maxLength={maxLength}
        error={error}
        onChangeText={onChangeText}
      />
      {!error && helper ? (
        <Text variant="caption" tone="secondary">
          {helper}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, flex: 1 },
})
