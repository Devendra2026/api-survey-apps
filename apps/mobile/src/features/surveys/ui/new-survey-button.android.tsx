import { colors } from "@/theme"
import { Button, Host, Text } from "@expo/ui/jetpack-compose"
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers"
import { StyleSheet } from "react-native"
import type { NewSurveyButtonProps } from "./new-survey-button.types"

const filledColors = {
  containerColor: colors.primary,
  contentColor: colors.textInverse,
  disabledContainerColor: "#E2E8F0",
  disabledContentColor: "#94A3B8",
} as const

/** Android progress-home action. Material 3 filled button inside `Host`. */
export function NewSurveyButton({ onPress }: NewSurveyButtonProps) {
  return (
    <Host matchContents={{ vertical: true }} colorScheme="light" seedColor={colors.primary} style={styles.host}>
      <Button onClick={onPress} colors={filledColors} modifiers={[fillMaxWidth()]}>
        <Text color={colors.textInverse}>+ New survey</Text>
      </Button>
    </Host>
  )
}

const styles = StyleSheet.create({
  host: { width: "100%", minHeight: 48 },
})
