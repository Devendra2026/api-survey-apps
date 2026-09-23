import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Screen, Text, TextField, cardStyle } from "@/components/ui";
import { getClerkErrorMessage } from "@/features/auth/clerk-errors";
import { spacing } from "@/theme";

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSignUp() {
    if (!isLoaded || !signUp) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

      await signUp.create({
        emailAddress: email.trim(),
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err) {
      setError(getClerkErrorMessage(err, "Sign up failed"));
    } finally {
      setLoading(false);
    }
  }

  async function onVerify() {
    if (!isLoaded || !signUp) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace("/");
        return;
      }

      setError("Verification is incomplete. Please try again or contact support.");
    } catch (err) {
      setError(getClerkErrorMessage(err, "Verification failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll keyboard>
      <View style={styles.header}>
        <Text variant="title">
          {pendingVerification ? "Verify email" : "Create account"}
        </Text>
        <Text variant="body" tone="secondary">
          {pendingVerification
            ? "Enter the code we sent to your email. An admin must assign your role before you can work in the field."
            : "Sign up to request access. After email verification, wait for an administrator to assign your role."}
        </Text>
      </View>

      <View style={[cardStyle, styles.form]}>
        {pendingVerification ? (
          <TextField
            label="Verification code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            placeholder="123456"
            editable={!loading}
          />
        ) : (
          <>
            <TextField
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              placeholder="Your name"
              editable={!loading}
            />
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
              textContentType="newPassword"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              editable={!loading}
            />
          </>
        )}

        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}

        <Button
          title={pendingVerification ? "Verify and continue" : "Create account"}
          loading={loading}
          disabled={
            !isLoaded ||
            (pendingVerification
              ? !code.trim()
              : !email.trim() || !password || !fullName.trim())
          }
          onPress={() => {
            void (pendingVerification ? onVerify() : onSignUp());
          }}
        />
      </View>

      <View style={styles.footer}>
        <Text variant="body" tone="secondary">
          Already have an account?{" "}
        </Text>
        <Link href="/(auth)/sign-in">
          <Text variant="bodyStrong" tone="primary">
            Sign in
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
