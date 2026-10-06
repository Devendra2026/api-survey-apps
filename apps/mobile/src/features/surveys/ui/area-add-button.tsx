import { Text } from "@/components/ui"
import { colors } from "@/theme"
import { Pressable, StyleSheet } from "react-native"
import type { AreaAddButtonProps } from "./area-add-button.types"

/** iOS add control. Android uses a Compose button. */
export function AreaAddButton({ label, disabled = false, onPress }: AreaAddButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled ? styles.disabled : null]}
    >
      <Text variant="bodyStrong" style={disabled ? styles.disabledLabel : styles.label}>
        +
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  disabled: { backgroundColor: colors.surfaceMuted },
  label: { color: colors.textInverse },
  disabledLabel: { color: colors.textSecondary },
})
