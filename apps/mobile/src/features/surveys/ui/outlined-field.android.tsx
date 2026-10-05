import { Text } from "@/components/ui"
import { colors, spacing } from "@/theme"
import { Text as ComposeText, Host, OutlinedTextField, useNativeState } from "@expo/ui/jetpack-compose"
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers"
import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import { outlinedFieldColors } from "./compose-field-colors"
import type { OutlinedFieldProps } from "./outlined-field.types"

const FIELD_MIN_HEIGHT = 56

/**
 * Android property field. Jetpack Compose `OutlinedTextField` inside `Host`,
 * tinted with the municipal navy seed color.
 */
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
  const textState = useNativeState(value)
  useEffect(() => {
    textState.set(value)
  }, [textState, value])
  const support = error ?? helper
  return (
    <View style={styles.wrap}>
      <Text variant="label">
        {label}
        {required ? <Text tone="danger"> *</Text> : null}
      </Text>
      <Host
        matchContents={{ vertical: true }}
        colorScheme="light"
        seedColor={colors.primary}
        ignoreSafeAreaKeyboardInsets
        style={styles.host}
      >
        <OutlinedTextField
          value={textState}
          enabled={editable}
          readOnly={!onChangeText}
          singleLine
          isError={Boolean(error)}
          maxLength={maxLength}
          keyboardOptions={{
            keyboardType: keyboard === "number-pad" ? "number" : "text",
            capitalization: "none",
            autoCorrectEnabled: false,
          }}
          onValueChange={(next) => {
            if (!onChangeText) return
            onChangeText(next)
          }}
          colors={outlinedFieldColors}
          modifiers={[fillMaxWidth()]}
        >
          {placeholder ? (
            <OutlinedTextField.Placeholder>
              <ComposeText color={colors.textSecondary}>{placeholder}</ComposeText>
            </OutlinedTextField.Placeholder>
          ) : null}
          {support ? (
            <OutlinedTextField.SupportingText>
              <ComposeText color={error ? colors.danger : colors.textSecondary}>{support}</ComposeText>
            </OutlinedTextField.SupportingText>
          ) : null}
        </OutlinedTextField>
      </Host>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, flex: 1 },
  host: { width: "100%", minHeight: FIELD_MIN_HEIGHT },
})
