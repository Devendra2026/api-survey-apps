export type FooterButton = {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  variant: "primary" | "secondary" | "ghost"
  flex: number
}
