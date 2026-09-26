import { colors, radius, spacing, theme, typography } from "@/theme";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Text } from "./Text";

type Props = Omit<TextInputProps, "secureTextEntry"> & {
  label: string;
  error?: string;
};

/**
 * Password field with show/hide toggle. Touch target for the toggle is ≥ 44px.
 */
export function PasswordInput({
  label,
  error,
  style,
  editable = true,
  ...rest
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text variant="label" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.row, error ? styles.rowError : null]}>
        <TextInput
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          secureTextEntry={!visible}
          accessibilityLabel={label}
          {...rest}
          style={[styles.input, style]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
          disabled={!editable}
          hitSlop={4}
          onPress={() => setVisible((value) => !value)}
          style={styles.toggle}
        >
          <Text variant="label" tone="primary">
            {visible ? "Hide" : "Show"}
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: theme.controlHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingLeft: spacing.lg,
  },
  rowError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    minHeight: theme.controlHeight,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  toggle: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
});
