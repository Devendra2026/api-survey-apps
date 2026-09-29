import { Text } from "@/components/ui"
import { spacing } from "@/theme"
import type { ReactNode } from "react"
import { StyleSheet, View } from "react-native"

type Props = {
  children: ReactNode
}

export function AuthFooter({ children }: Props) {
  return <View style={styles.wrap}>{children}</View>
}

type LinkRowProps = {
  prompt: string
  action: ReactNode
}

export function AuthFooterLinkRow({ prompt, action }: LinkRowProps) {
  return (
    <View style={styles.row}>
      <Text variant="body" tone="secondary">
        {prompt}{" "}
      </Text>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
})
