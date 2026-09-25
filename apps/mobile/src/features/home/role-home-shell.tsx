import { Button, Screen, Text, cardStyle } from "@/components/ui";
import { getApiBaseUrl } from "@/lib/env";
import { colors, radius, spacing } from "@/theme";
import {
  primaryRoleName,
  roleDisplayName,
  type AuthenticatedProfile,
} from "@/types/user";
import { StyleSheet, View } from "react-native";

export type RoleHomeCopy = {
  caption: string;
  title: string;
  placeholder: string;
};

type RoleHomeShellProps = {
  profile: AuthenticatedProfile;
  copy: RoleHomeCopy;
  onSignOut: () => void;
};

export function RoleHomeShell({ profile, copy, onSignOut }: RoleHomeShellProps) {
  const roleName = primaryRoleName(profile);

  return (
    <Screen scroll>
      <View style={styles.topBar} pointerEvents="none" />
      <View style={styles.header}>
        <Text variant="caption" tone="secondary">
          {copy.caption}
        </Text>
        <Text variant="title">{profile.fullName}</Text>
        <Text variant="body" tone="secondary">
          {profile.email}
        </Text>
      </View>

      <View style={[cardStyle, styles.card]}>
        <View style={styles.roleBadge}>
          <Text variant="label" tone="inverse">
            {roleName ? roleDisplayName(roleName) : "Assigned"}
          </Text>
        </View>
        <Text variant="label" tone="secondary" style={styles.metaLabel}>
          Role
        </Text>
        <Text variant="heading">
          {roleName ? roleDisplayName(roleName) : "Assigned"}
        </Text>
        <Text variant="caption" tone="secondary" style={styles.meta}>
          {copy.placeholder}
        </Text>
      </View>

      <View style={[cardStyle, styles.card]}>
        <Text variant="label" tone="secondary">
          {copy.title}
        </Text>
        <Text variant="body" tone="secondary" style={styles.panelBody}>
          Tools for this role will appear here in a later release. Permissions
          continue to be enforced by the API.
        </Text>
      </View>

      {__DEV__ ? (
        <View style={[cardStyle, styles.card]}>
          <Text variant="label" tone="secondary">
            API
          </Text>
          <Text variant="caption" tone="secondary">
            {getApiBaseUrl()}
          </Text>
        </View>
      ) : null}

      <Button
        title="Sign out"
        variant="secondary"
        onPress={onSignOut}
        style={styles.signOut}
      />
    </Screen>
  );
}

export const ADMIN_HOME_COPY: RoleHomeCopy = {
  caption: "Admin dashboard",
  title: "Administration",
  placeholder:
    "User onboarding and configuration tools will appear here. Use the web admin for full control today.",
};

export const SURVEY_HOME_COPY: RoleHomeCopy = {
  caption: "Survey dashboard",
  title: "Field surveys",
  placeholder:
    "Field survey capture tools will appear here. Your assigned wards and permissions are already active.",
};

const styles = StyleSheet.create({
  topBar: {
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    marginBottom: spacing.md,
    opacity: 0.85,
  },
  header: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  card: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  metaLabel: {
    marginTop: spacing.xs,
  },
  meta: {
    marginTop: spacing.sm,
  },
  panelBody: {
    marginTop: spacing.xs,
  },
  signOut: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
