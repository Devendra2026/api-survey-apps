import { colors, spacing, typography } from "@/theme";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  caption: string;
  /** Optional screen title under the brand (e.g. Sign in). */
  title?: string;
};

export function AuthBrandHeader({ caption, title }: Props) {
  return (
    <View style={styles.wrap}>
      <Image
        source={require("../../../../assets/logo.png")}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="SDV EduTech"
      />
      <Text style={styles.brand}>SDV EduTech</Text>
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
  logo: {
    width: 180,
    height: 64,
  },
  brand: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.xs,
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
