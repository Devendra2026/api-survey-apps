import { colors } from "@/theme"
import {
  Text as ComposeText,
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
} from "@expo/ui/jetpack-compose"
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers"
import { StyleSheet, View } from "react-native"

type Props = {
  value: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}

const segmentColors = {
  activeContainerColor: colors.primary,
  activeContentColor: colors.textInverse,
  activeBorderColor: colors.primary,
  inactiveContainerColor: colors.surface,
  inactiveContentColor: colors.text,
  inactiveBorderColor: colors.border,
} as const

/**
 * Android slum control. Material 3 single-choice segmented buttons inside `Host`.
 */
export function SlumChoice({ value, disabled, onChange }: Props) {
  const enabled = !disabled
  return (
    <View style={styles.hostWrap}>
      <Host
        matchContents={{ vertical: true }}
        colorScheme="light"
        seedColor={colors.primary}
        ignoreSafeAreaKeyboardInsets
        style={styles.host}
      >
        <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
          <SegmentedButton selected={!value} enabled={enabled} onClick={() => onChange(false)} colors={segmentColors}>
            <SegmentedButton.Label>
              <ComposeText>Not in slum area</ComposeText>
            </SegmentedButton.Label>
          </SegmentedButton>
          <SegmentedButton selected={value} enabled={enabled} onClick={() => onChange(true)} colors={segmentColors}>
            <SegmentedButton.Label>
              <ComposeText>Slum area</ComposeText>
            </SegmentedButton.Label>
          </SegmentedButton>
        </SingleChoiceSegmentedButtonRow>
      </Host>
    </View>
  )
}

const styles = StyleSheet.create({
  hostWrap: { width: "100%" },
  host: { width: "100%", minHeight: 48 },
})
