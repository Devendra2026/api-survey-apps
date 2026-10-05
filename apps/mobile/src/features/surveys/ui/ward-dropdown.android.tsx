import { Text } from "@/components/ui"
import { colors, spacing } from "@/theme"
import {
  Text as ComposeText,
  DropdownMenuItem,
  ExposedDropdownMenu,
  ExposedDropdownMenuBox,
  Host,
  OutlinedTextField,
  useNativeState,
} from "@expo/ui/jetpack-compose"
import { fillMaxWidth, menuAnchor } from "@expo/ui/jetpack-compose/modifiers"
import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"
import type { WardDropdownProps } from "./ward-dropdown.types"

const FIELD_MIN_HEIGHT = 56

/**
 * Android ward field. Jetpack Compose `ExposedDropdownMenuBox` draws the
 * outlined menu anchored to a read-only text field.
 */
export function WardDropdown({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Select ward",
}: WardDropdownProps) {
  const selected = options.find((option) => option.value === value)
  const display = selected?.label ?? ""
  const labelState = useNativeState(display)
  const [expanded, setExpanded] = useState(false)
  const canOpen = !disabled && options.length > 0
  if (!canOpen && expanded) setExpanded(false)
  useEffect(() => {
    labelState.set(display)
  }, [display, labelState])
  return (
    <View style={styles.wrap}>
      <Text variant="label">
        Ward
        <Text tone="danger"> *</Text>
      </Text>
      <Host
        matchContents={{ vertical: true }}
        colorScheme="light"
        seedColor={colors.primary}
        ignoreSafeAreaKeyboardInsets
        style={styles.host}
      >
        <ExposedDropdownMenuBox
          expanded={expanded}
          onExpandedChange={(next) => {
            if (!canOpen) return
            setExpanded(next)
          }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField
            value={labelState}
            readOnly
            singleLine
            enabled={canOpen}
            modifiers={[menuAnchor("primaryNotEditable", canOpen), fillMaxWidth()]}
            colors={{
              focusedTextColor: colors.text,
              unfocusedTextColor: colors.text,
              focusedContainerColor: colors.surface,
              unfocusedContainerColor: colors.surface,
              focusedIndicatorColor: colors.primary,
              unfocusedIndicatorColor: colors.border,
              focusedTrailingIconColor: colors.primary,
              unfocusedTrailingIconColor: colors.primary,
              focusedPlaceholderColor: colors.textSecondary,
              unfocusedPlaceholderColor: colors.textSecondary,
            }}
          >
            <OutlinedTextField.Placeholder>
              <ComposeText color={colors.textSecondary}>{placeholder}</ComposeText>
            </OutlinedTextField.Placeholder>
            <OutlinedTextField.TrailingIcon>
              <ComposeText color={colors.primary}>{expanded ? "▲" : "▼"}</ComposeText>
            </OutlinedTextField.TrailingIcon>
          </OutlinedTextField>
          <ExposedDropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)} containerColor={colors.surface}>
            {options.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => {
                  labelState.set(option.label)
                  onChange(option.value)
                  setExpanded(false)
                }}
              >
                <DropdownMenuItem.Text>
                  <ComposeText color={option.value === value ? colors.primary : colors.text}>{option.label}</ComposeText>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            ))}
          </ExposedDropdownMenu>
        </ExposedDropdownMenuBox>
      </Host>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  host: { width: "100%", minHeight: FIELD_MIN_HEIGHT },
})
