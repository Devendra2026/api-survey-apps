import { colors, radius, spacing } from "@/theme";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { AuthBrandHeader } from "./AuthBrandHeader";

type Props = {
  caption: string;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Enterprise auth layout: navy wash, brand hero, elevated form panel.
 */
export function AuthScreenShell({ caption, title, children, footer }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.heroWash} pointerEvents="none" />
      <View style={styles.accentBar} pointerEvents="none" />
      <AuthBrandHeader caption={caption} title={title} />
      <View style={styles.panel}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
  },
  heroWash: {
    position: "absolute",
    top: -spacing.xxl,
    left: -spacing.xl,
    right: -spacing.xl,
    height: 220,
    backgroundColor: colors.surfaceMuted,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    opacity: 0.9,
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    opacity: 0.85,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  footer: {
    marginTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
});
