import { Button } from "@/components/ui"
import { StyleSheet, View } from "react-native"
import type { FooterButton } from "./footer-buttons.types"

export type { FooterButton } from "./footer-buttons.types"

/** iOS and fallback footer. Android uses Material 3 buttons. */
export function FooterButtons({ buttons }: { buttons: readonly FooterButton[] }) {
  return (
    <View style={styles.row}>
      {buttons.map((button) => (
        <Button
          key={button.title}
          title={button.loading ? "Saving…" : button.title}
          variant={button.variant}
          loading={button.loading}
          disabled={button.disabled}
          onPress={button.onPress}
          style={{ flex: button.flex }}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
})
