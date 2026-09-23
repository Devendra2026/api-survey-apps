import { colors, radius, spacing } from "@/theme";
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
      <View
        style={[
          styles.badge,
          variant === "pending" && styles.badgePending,
          variant === "disabled" && styles.badgeDanger,
          variant === "error" && styles.badgeDanger,
          variant === "empty" && styles.badgeMuted,
        ]}
      >
        {variant === "loading" ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <Text variant="heading" tone={variant === "disabled" || variant === "error" ? "danger" : "primary"}>
            {variant === "pending" ? "…" : variant === "disabled" ? "!" : "i"}
          </Text>
        )}
      </View>
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
