import { Button, Text, TextField } from "@/components/ui"
import { colors, radius, spacing, touchTarget } from "@/theme"
import { useMemo, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useCatalogOptions } from "../hooks/use-catalog"
import { optionLabel } from "../lib/labels"

export type SelectOption = {
  value: string
  label: string
}

type SelectProps = {
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
  /**
   * `inline` lists options under the field. Use it inside another modal so Android
   * does not have to present a second modal.
   */
  presentation?: "modal" | "inline"
}

/**
 * One select for survey master data. Options are passed in (catalog or Prisma enum).
 * A React Native modal sheet is used because the previous `@expo/ui` BottomSheet
 * did not present options on the field-survey screens.
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
  searchable = true,
  presentation = "modal",
}: SelectProps) {
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = options.find((option) => option.value === value)
  const display = selected?.label ?? (value ? optionLabel(value) : placeholder)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (option) => option.label.toLowerCase().includes(q) || option.value.toLowerCase().includes(q),
    )
  }, [options, query])

  const close = () => {
    setOpen(false)
    setQuery("")
  }

  const optionsPanel = (
    <>
      {searchable && presentation === "modal" ? (
        <TextField
          label="Search"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Search options"
        />
      ) : null}
      {loading ? (
        <Text variant="body" tone="secondary">
          Loading options…
        </Text>
      ) : error ? (
        <View style={styles.errorRow}>
          <Text variant="body" tone="danger" style={styles.triggerText}>
            {error}
          </Text>
          {onRetry ? <Button title="Retry" variant="secondary" onPress={onRetry} /> : null}
        </View>
      ) : filtered.length === 0 ? (
        <Text variant="body" tone="secondary">
          {options.length === 0 ? "No options available." : "No matching options."}
        </Text>
      ) : (
        filtered.map((item) => {
          const isSelected = item.value === value
          return (
            <Pressable
              key={item.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                onChange(item.value)
                close()
              }}
              style={[styles.option, isSelected && styles.optionSelected]}
            >
              <Text variant="bodyStrong" tone={isSelected ? "inverse" : "default"} style={styles.triggerText}>
                {item.label}
              </Text>
              {isSelected ? (
                <Text variant="caption" tone="inverse">
                  Selected
                </Text>
              ) : null}
            </Pressable>
          )
        })
      )}
      {!required && value ? (
        <Button
          title="Clear selection"
          variant="secondary"
          onPress={() => {
            onChange(null)
            close()
          }}
        />
      ) : null}
      {presentation === "modal" ? <Button title="Close" variant="ghost" onPress={close} /> : null}
    </>
  )

  return (
    <View style={styles.wrap}>
      <Text variant="label">
        {label}
        {required ? <Text tone="danger"> *</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
        accessibilityState={{ disabled: Boolean(disabled || loading), expanded: open }}
        disabled={disabled || loading}
        onPress={() => setOpen(true)}
        style={[styles.trigger, (disabled || loading) && styles.disabled]}
      >
        <Text variant="body" tone={value ? "default" : "secondary"} style={styles.triggerText}>
          {loading ? "Loading options…" : display}
        </Text>
        <Text variant="label" tone="primary">
          ▼
        </Text>
      </Pressable>
      {error ? (
        <View style={styles.errorRow}>
          <Text variant="caption" tone="danger" style={styles.triggerText}>
            {error}
          </Text>
          {onRetry ? <Button title="Retry" variant="secondary" onPress={onRetry} /> : null}
        </View>
      ) : null}

      {presentation === "inline" ? (
        open ? <View style={styles.inlineList}>{optionsPanel}</View> : null
      ) : (
        <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
          <View style={styles.backdrop}>
            <Pressable accessibilityLabel="Close options" style={styles.dismiss} onPress={close} />
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
              <View style={styles.handle} />
              <Text variant="heading">{label}</Text>
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
                {optionsPanel}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

export function EnumSelect<T extends string>({
  options,
  value,
  onChange,
  ...rest
}: Omit<SelectProps, "options" | "value" | "onChange"> & {
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
}: Omit<SelectProps, "options" | "loading" | "error" | "onRetry" | "value" | "onChange"> & {
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

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  inlineList: { gap: spacing.sm, maxHeight: 280 },
  trigger: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  triggerText: { flex: 1 },
  disabled: { opacity: 0.55 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  dismiss: { flex: 1 },
  sheet: {
    maxHeight: "85%",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  list: { maxHeight: 360 },
  option: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
})
