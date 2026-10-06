import { colors } from "@/theme"
import { Button, Host, Text } from "@expo/ui/jetpack-compose"
import { size } from "@expo/ui/jetpack-compose/modifiers"
import { Pressable, StyleSheet } from "react-native"
import type { AreaAddButtonProps } from "./area-add-button.types"

const filledColors = {
  containerColor: colors.primary,
  contentColor: colors.textInverse,
  disabledContainerColor: "#E2E8F0",
  disabledContentColor: "#94A3B8",
} as const

/**
 * Android add control. The press is handled by React Native so a Compose host
 * higher on the Area screen cannot swallow the tap. The Material button is visual.
 */
export function AreaAddButton({ label, disabled = false, onPress }: AreaAddButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.hit, disabled ? styles.hitDisabled : null]}
    >
      <Host
        pointerEvents="none"
        matchContents
        colorScheme="light"
        seedColor={colors.primary}
        style={styles.host}
      >
        <Button enabled={!disabled} onClick={onPress} colors={filledColors} modifiers={[size(40, 40)]}>
          <Text color={disabled ? "#94A3B8" : colors.textInverse}>+</Text>
        </Button>
      </Host>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    zIndex: 2,
    elevation: 4,
  },
  hitDisabled: { backgroundColor: colors.surfaceMuted, elevation: 0 },
  host: { width: 40, height: 40 },
})
