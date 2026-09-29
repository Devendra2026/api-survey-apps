import { BrandLogo } from "@/features/auth/ui/BrandLogo";
import { colors, spacing, typography } from "@/theme";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  caption: string;
  /** Optional screen title under the brand (e.g. Sign in). */
  title?: string;
};

export function AuthBrandHeader({ caption, title }: Props) {
  return (
    <View style={styles.wrap}>
      <BrandLogo />
     
      <Text style={styles.product}>Property Survey</Text>
      <Text style={styles.subtitle}>Nagar Panchayat · GIS field operations</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  brand: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  product: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.md,
  },
  caption: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: spacing.md,
    maxWidth: 320,
  },
});
