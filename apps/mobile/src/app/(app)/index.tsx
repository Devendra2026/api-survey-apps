import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Button, Screen, Text, cardStyle } from "@/components/ui";
import { useAppSession } from "@/features/auth/AppSessionProvider";
import { getApiBaseUrl } from "@/lib/env";
import { spacing } from "@/theme";
import { primaryRoleName, roleDisplayName } from "@/types/user";

export default function HomeScreen() {
  const { state, signOut } = useAppSession();

  if (state.status === "pending") {
    return <Redirect href="/(app)/pending" />;
  }
  if (state.status === "disabled") {
    return <Redirect href="/(app)/disabled" />;
  }
  if (state.status !== "ready") {
    return <Redirect href="/" />;
  }

  const { profile } = state;
  const roleName = primaryRoleName(profile);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="caption" tone="secondary">
          Signed in
        </Text>
        <Text variant="title">{profile.fullName}</Text>
        <Text variant="body" tone="secondary">
          {profile.email}
        </Text>
      </View>

      <View style={[cardStyle, styles.card]}>
        <Text variant="label" tone="secondary">
          Role
        </Text>
        <Text variant="heading">
          {roleName ? roleDisplayName(roleName) : "Assigned"}
        </Text>
        <Text variant="caption" tone="secondary" style={styles.meta}>
          Permissions are enforced by the API. Field survey tools will appear here in a later release.
        </Text>
      </View>

      <View style={[cardStyle, styles.card]}>
        <Text variant="label" tone="secondary">
          API
        </Text>
        <Text variant="caption" tone="secondary">
          {getApiBaseUrl()}
        </Text>
      </View>

      <Button
        title="Sign out"
        variant="secondary"
        onPress={() => {
          void signOut();
        }}
        style={styles.signOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  card: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  meta: {
    marginTop: spacing.sm,
  },
  signOut: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
