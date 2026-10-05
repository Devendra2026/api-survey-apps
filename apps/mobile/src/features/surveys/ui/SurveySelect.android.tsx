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
import { useCatalogOptions } from "../hooks/use-catalog"
import { optionLabel } from "../lib/labels"
import { outlinedFieldColors } from "./compose-field-colors"
import type { SelectOption } from "./survey-select.types"

const FIELD_MIN_HEIGHT = 56

type Props = {
  label: string
  value: string | null
  onChange: (next: string | null) => void
  options: readonly SelectOption[]
  required?: boolean
  disabled?: boolean
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  placeholder?: string
  searchable?: boolean
  presentation?: "modal" | "inline"
}

/**
 * Android survey dropdown. Jetpack Compose `ExposedDropdownMenuBox` anchored
 * to an outlined field. Used for catalog codes and Prisma enums.
 */
export function SurveySelect({
  label,
  value,
  onChange,
  options,
  required,
  disabled,
  loading,
  error,
  onRetry,
  placeholder = "Select…",
}: Props) {
  const selected = options.find((option) => option.value === value)
  const display = selected?.label ?? ""
  const labelState = useNativeState(display)
  const [expanded, setExpanded] = useState(false)
  const canOpen = !disabled && !loading && options.length > 0
  const menuOpen = expanded && canOpen
  useEffect(() => {
    labelState.set(display)
  }, [display, labelState])
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
        <ExposedDropdownMenuBox
          expanded={menuOpen}
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
            isError={Boolean(error)}
            modifiers={[menuAnchor("primaryNotEditable", canOpen), fillMaxWidth()]}
            colors={outlinedFieldColors}
          >
            <OutlinedTextField.Placeholder>
              <ComposeText color={colors.textSecondary}>{loading ? "Loading options…" : placeholder}</ComposeText>
            </OutlinedTextField.Placeholder>
            <OutlinedTextField.TrailingIcon>
              <ComposeText color={colors.primary}>{menuOpen ? "▲" : "▼"}</ComposeText>
            </OutlinedTextField.TrailingIcon>
          </OutlinedTextField>
          <ExposedDropdownMenu expanded={menuOpen} onDismissRequest={() => setExpanded(false)} containerColor={colors.surface}>
            {!required && value ? (
              <DropdownMenuItem
                onClick={() => {
                  labelState.set("")
                  onChange(null)
                  setExpanded(false)
                }}
              >
                <DropdownMenuItem.Text>
                  <ComposeText color={colors.textSecondary}>Clear selection</ComposeText>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            ) : null}
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
      {error ? (
        <Text variant="caption" tone="danger" onPress={onRetry}>
          {error}
          {onRetry ? " · Retry" : ""}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  host: { width: "100%", minHeight: FIELD_MIN_HEIGHT },
})

export function EnumSelect<T extends string>({
  options,
  value,
  onChange,
  ...rest
}: Omit<Props, "options" | "value" | "onChange"> & {
  options: readonly T[]
  value: T | null
  onChange: (next: T | null) => void
}) {
  return (
    <SurveySelect
      {...rest}
      options={options.map((option) => ({ value: option, label: optionLabel(option) }))}
      value={value}
      onChange={(next) => {
        if (next === null) {
          onChange(null)
          return
        }
        const match = options.find((option) => option === next)
        if (match) onChange(match)
      }}
    />
  )
}

/** Loads one reference catalog and stores the entry code on the survey. */
export function CatalogSelect<T extends string>({
  category,
  allowed,
  value,
  onChange,
  ...rest
}: Omit<Props, "options" | "loading" | "error" | "onRetry" | "value" | "onChange"> & {
  category: string
  allowed: readonly T[]
  value: T | null
  onChange: (next: T | null) => void
}) {
  const catalog = useCatalogOptions(category)
  const options = catalog.options.filter((option): option is { value: T; label: string } =>
    allowed.some((code) => code === option.value),
  )
  return (
    <SurveySelect
      {...rest}
      options={options}
      value={value}
      loading={catalog.loading}
      error={catalog.error}
      onRetry={catalog.retry}
      onChange={(next) => {
        if (next === null) {
          onChange(null)
          return
        }
        const match = allowed.find((code) => code === next)
        if (match) onChange(match)
      }}
    />
  )
}
