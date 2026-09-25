import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import { resolveAppHomeHref } from "@/types/user";
import { Redirect } from "expo-router";

/** Safety net: route ready users to role home. */
export default function AppIndex() {
  const { state } = useAppSession();

  if (state.status === "pending") {
    return <Redirect href="/(app)/pending" />;
  }
  if (state.status === "disabled") {
    return <Redirect href="/(app)/disabled" />;
  }
  if (state.status === "ready") {
    return <Redirect href={resolveAppHomeHref(state.profile)} />;
  }
  return <Redirect href="/" />;
}
