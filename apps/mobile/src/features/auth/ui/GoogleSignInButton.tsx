import { Button } from "@/components/ui"

type Props = {
  loading?: boolean
  disabled?: boolean
  onPress: () => void
  label?: string
}

export function GoogleSignInButton({
  loading = false,
  disabled = false,
  onPress,
  label = "Continue with Google",
}: Props) {
  return (
    <Button
      title={loading ? "Connecting to Google…" : label}
      variant="secondary"
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={label}
    />
  )
}
