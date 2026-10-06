import { Text } from "@/components/ui"
import { colors, radius, spacing, theme, typography } from "@/theme"
import { StyleSheet, TextInput, View } from "react-native"
import { useAreaMeasureDraft } from "./area-measure-draft"
import type { AreaMeasurePairProps } from "./area-measure-pair.types"

/** iOS and other platforms. Android uses two Compose outlined fields. */
export function AreaMeasurePair({ sqFt, sqMeter, editable = true, onCommit }: AreaMeasurePairProps) {
  const draft = useAreaMeasureDraft({ sqFt, sqMeter, editable, onCommit })
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <MeasureInput
          label="Sq feet"
          value={draft.sqFtText}
          editable={editable}
          onChangeText={(text) => draft.apply("sqFt", text)}
          onBlur={() => draft.blur("sqFt")}
        />
        <MeasureInput
          label="Sq meter"
          value={draft.sqMeterText}
          editable={editable}
          onChangeText={(text) => draft.apply("sqMeter", text)}
          onBlur={() => draft.blur("sqMeter")}
        />
      </View>
      {draft.error ? (
        <Text variant="caption" tone="danger">
          {draft.error}
        </Text>
      ) : null}
    </View>
  )
}

function MeasureInput({
  label,
  value,
  editable,
  onChangeText,
  onBlur,
}: {
  label: string
  value: string
  editable: boolean
  onChangeText: (text: string) => void
  onBlur: () => void
}) {
  return (
    <View style={styles.field}>
      <TextInput
        accessibilityLabel={label}
        value={value}
        editable={editable}
        keyboardType="decimal-pad"
        placeholder={label}
        placeholderTextColor={colors.textSecondary}
        onChangeText={onChangeText}
        onBlur={onBlur}
        style={[styles.input, editable ? null : styles.inputDisabled]}
      />
      <Text variant="caption" tone="secondary" style={styles.caption}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: "row", gap: spacing.md },
  field: { flex: 1, gap: spacing.xs },
  input: {
    minHeight: theme.controlHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  inputDisabled: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textSecondary,
  },
  caption: { textAlign: "center" },
})
