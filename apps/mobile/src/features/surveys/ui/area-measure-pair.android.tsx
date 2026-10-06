import { Text } from "@/components/ui"
import { colors, spacing } from "@/theme"
import { Text as ComposeText, Host, OutlinedTextField, Row, useNativeState } from "@expo/ui/jetpack-compose"
import { fillMaxWidth, weight } from "@expo/ui/jetpack-compose/modifiers"
import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import { useAreaMeasureDraft } from "./area-measure-draft"
import type { AreaMeasurePairProps } from "./area-measure-pair.types"
import { outlinedFieldColors } from "./compose-field-colors"

/**
 * Android area pair. Two Jetpack Compose `OutlinedTextField`s in one `Host`
 * row so square feet and square meters convert as the surveyor types.
 */
export function AreaMeasurePair({ sqFt, sqMeter, editable = true, onCommit }: AreaMeasurePairProps) {
  const draft = useAreaMeasureDraft({ sqFt, sqMeter, editable, onCommit })
  return (
    <View style={styles.wrap}>
      <Host
        matchContents={{ vertical: true }}
        colorScheme="light"
        seedColor={colors.primary}
        ignoreSafeAreaKeyboardInsets
        pointerEvents={editable ? "auto" : "none"}
        style={styles.host}
      >
        <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
          <MeasureField
            label="Sq feet"
            value={draft.sqFtText}
            editable={editable}
            onChangeText={(text) => draft.apply("sqFt", text)}
            onBlur={() => draft.blur("sqFt")}
          />
          <MeasureField
            label="Sq meter"
            value={draft.sqMeterText}
            editable={editable}
            onChangeText={(text) => draft.apply("sqMeter", text)}
            onBlur={() => draft.blur("sqMeter")}
          />
        </Row>
      </Host>
      <View style={styles.captions}>
        <Text variant="caption" tone="secondary" style={styles.caption}>
          Sq feet
        </Text>
        <Text variant="caption" tone="secondary" style={styles.caption}>
          Sq meter
        </Text>
      </View>
      {draft.error ? (
        <Text variant="caption" tone="danger">
          {draft.error}
        </Text>
      ) : null}
    </View>
  )
}

function MeasureField({
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
  const textState = useNativeState(value)
  useEffect(() => {
    textState.set(value)
  }, [textState, value])
  return (
    <OutlinedTextField
      value={textState}
      enabled={editable}
      readOnly={!editable}
      singleLine
      keyboardOptions={{ keyboardType: "decimal", capitalization: "none", autoCorrectEnabled: false }}
      onValueChange={onChangeText}
      onFocusChanged={(focused) => {
        if (!focused) onBlur()
      }}
      colors={outlinedFieldColors}
      modifiers={[weight(1)]}
    >
      <OutlinedTextField.Placeholder>
        <ComposeText color={colors.textSecondary}>{label}</ComposeText>
      </OutlinedTextField.Placeholder>
    </OutlinedTextField>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  host: { width: "100%", height: 56, overflow: "hidden" },
  captions: { flexDirection: "row", gap: spacing.md },
  caption: { flex: 1, textAlign: "center" },
})
