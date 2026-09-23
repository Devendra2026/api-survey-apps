import { colors, typography } from "@/theme";
import { Text as RNText, type TextProps, type TextStyle } from "react-native";

type Variant = "title" | "heading" | "body" | "bodyStrong" | "caption" | "label";
type Tone = "default" | "secondary" | "inverse" | "danger" | "primary";

type Props = TextProps & {
  variant?: Variant;
  tone?: Tone;
};

const toneColor: Record<Tone, string> = {
  default: colors.text,
  secondary: colors.textSecondary,
  inverse: colors.textInverse,
  danger: colors.danger,
  primary: colors.primary,
};

export function Text({
  variant = "body",
  tone = "default",
  style,
  ...rest
}: Props) {
  const base = typography[variant] as TextStyle;
  return (
    <RNText
      {...rest}
      style={[{ color: toneColor[tone] }, base, style]}
    />
  );
}
