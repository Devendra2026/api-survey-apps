import { Text } from "@/components/ui"
import { colors, spacing } from "@/theme"
import { Text as ComposeText, Host, RadioButton, Row } from "@expo/ui/jetpack-compose"
import { clickable, padding, selectableGroup } from "@expo/ui/jetpack-compose/modifiers"
import { StyleSheet, View } from "react-native"
import type { ChoiceOption } from "./choice-radios.types"

type Props = {
  label: string
  options: readonly ChoiceOption[]
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
}

const radioColors = {
  selectedColor: colors.primary,
  unselectedColor: colors.textSecondary,
  disabledSelectedColor: colors.border,
  disabledUnselectedColor: colors.border,
} as const

/**
 * Android choice row. Jetpack Compose `RadioButton` inside `Host`.
 */
export function ChoiceRadios({ label, options, value, onChange, disabled, required }: Props) {
  const enabled = !disabled
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
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 16 }} modifiers={[selectableGroup()]}>
          {options.map((option) => {
            const selected = value === option.value
            const choose = () => {
              if (!enabled) return
              onChange(option.value)
            }
            return (
              <Row
                key={option.value}
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 4 }}
                modifiers={[clickable(choose, { indication: false }), padding(0, 8, 8, 8)]}
              >
                <RadioButton selected={selected} enabled={enabled} onClick={choose} colors={radioColors} />
                <ComposeText color={colors.text}>{option.label}</ComposeText>
              </Row>
            )
          })}
        </Row>
      </Host>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  host: { width: "100%", minHeight: 48 },
})
