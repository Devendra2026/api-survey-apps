import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Screen, Text, TextField, cardStyle } from "@/components/ui";
import { getClerkErrorMessage } from "@/features/auth/clerk-errors";
import { spacing } from "@/theme";

export default function SignInScreen() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!isLoaded || !signIn) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace("/");
        return;
      }

      setError("Additional verification is required. Please complete sign-in on the web, or contact support.");
    } catch (err) {
      setError(getClerkErrorMessage(err, "Sign in failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll keyboard>
      <View style={styles.header}>
        <Text variant="title">Welcome back</Text>
        <Text variant="body" tone="secondary">
          Sign in with your municipal survey account.
        </Text>
      </View>

      <View style={[cardStyle, styles.form]}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          placeholder="you@example.com"
          editable={!loading}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          placeholder="••••••••"
          editable={!loading}
        />
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
        <Button
          title="Sign in"
          loading={loading}
          disabled={!email.trim() || !password || !isLoaded}
          onPress={() => {
            void onSubmit();
          }}
        />
      </View>

      <View style={styles.footer}>
        <Text variant="body" tone="secondary">
          Need an account?{" "}
        </Text>
        <Link href="/(auth)/sign-up">
          <Text variant="bodyStrong" tone="primary">
            Sign up
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
    marginTop: spacing.xxl,
  },
  form: {
    gap: spacing.lg,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
