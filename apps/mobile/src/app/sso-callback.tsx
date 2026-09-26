import { Redirect } from "expo-router";

/**
 * Landing route for Clerk Google SSO (`mobile://sso-callback`).
 * Session activation is handled by `useSSO` while the auth browser is open;
 * this screen exists so cold opens of the deep link have a valid route.
 */
export default function SsoCallbackScreen() {
  return <Redirect href="/" />;
}
