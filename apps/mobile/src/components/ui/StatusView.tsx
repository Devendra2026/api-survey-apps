import { colors, radius, spacing } from "@/theme";
import { Image } from "expo-image";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button } from "./Button";
import { Text } from "./Text";

type Variant = "loading" | "error" | "pending" | "disabled" | "empty";

type Props = {
  variant: Variant;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function StatusView({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <View style={styles.wrap}>
      {variant === "loading" ? (
        <View style={styles.brand}>
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="SDV EduTech"
          />
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <View
          style={[
            styles.badge,
            variant === "pending" && styles.badgePending,
            variant === "disabled" && styles.badgeDanger,
            variant === "error" && styles.badgeDanger,
            variant === "empty" && styles.badgeMuted,
          ]}
        >
          <Text variant="heading" tone={variant === "disabled" || variant === "error" ? "danger" : "primary"}>
            {variant === "pending" ? "…" : variant === "disabled" ? "!" : "i"}
          </Text>
        </View>
      )}
      <Text variant="heading" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" tone="secondary" style={styles.description}>
          {description}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {actionLabel && onAction ? (
          <Button title={actionLabel} onPress={onAction} />
        ) : null}
        {secondaryLabel && onSecondary ? (
          <Button title={secondaryLabel} variant="secondary" onPress={onSecondary} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  brand: {
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  logo: {
    width: 220,
    height: 78,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  badgePending: {
    backgroundColor: colors.warningMuted,
  },
  badgeDanger: {
    backgroundColor: colors.dangerMuted,
  },
  badgeMuted: {
    backgroundColor: colors.surfaceMuted,
  },
  title: {
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    maxWidth: 320,
  },
  actions: {
    width: "100%",
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
