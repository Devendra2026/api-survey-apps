import { colors } from "@/theme"
import { Button, Host, OutlinedButton, Row, Text } from "@expo/ui/jetpack-compose"
import { fillMaxWidth, weight } from "@expo/ui/jetpack-compose/modifiers"
import { StyleSheet } from "react-native"
import type { FooterButton } from "./footer-buttons.types"

const filledColors = {
  containerColor: colors.primary,
  contentColor: colors.textInverse,
  disabledContainerColor: "#E2E8F0",
  disabledContentColor: "#94A3B8",
} as const

const outlinedColors = {
  containerColor: colors.surface,
  contentColor: colors.primary,
  disabledContainerColor: colors.surface,
  disabledContentColor: "#94A3B8",
} as const

/**
 * Android footer. Filled and outlined Material 3 buttons in one `Host` row.
 */
export function FooterButtons({ buttons }: { buttons: readonly FooterButton[] }) {
  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme="light"
      seedColor={colors.primary}
      ignoreSafeAreaKeyboardInsets
      style={styles.host}
    >
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
        {buttons.map((button) => (
          <FooterControl key={button.title} button={button} />
        ))}
      </Row>
    </Host>
  )
}

function FooterControl({ button }: { button: FooterButton }) {
  const enabled = !button.disabled && !button.loading
  const label = button.loading ? "Saving…" : button.title
  const primary = button.variant === "primary"
  const content = (
    <Text color={enabled ? (primary ? colors.textInverse : colors.primary) : "#94A3B8"}>{label}</Text>
  )
  if (primary) {
    return (
      <Button enabled={enabled} onClick={button.onPress} colors={filledColors} modifiers={[weight(button.flex)]}>
        {content}
      </Button>
    )
  }
  return (
    <OutlinedButton
      enabled={enabled}
      onClick={button.onPress}
      colors={outlinedColors}
      modifiers={[weight(button.flex)]}
    >
      {content}
    </OutlinedButton>
  )
}

const styles = StyleSheet.create({
  host: { width: "100%", minHeight: 48 },
})
