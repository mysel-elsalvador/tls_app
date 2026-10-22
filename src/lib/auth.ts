// Cognito sign-in (SRP) through Amplify. Tokens live in localStorage and
// Amplify refreshes them with the refresh token (30 days).
import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";

// Inlined at build time from .env.production.local (scripts/deploy.sh) or .env.local.
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
  userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID ?? "",
  userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID ?? "",
};

let configured = false;

/** Call before any aws-amplify/auth function. */
export function setupAuth() {
  if (configured) return;
  if (!config.userPoolId || !config.userPoolClientId) {
    throw new Error("NEXT_PUBLIC_USER_POOL_ID / NEXT_PUBLIC_USER_POOL_CLIENT_ID are not set (see README)");
  }
  Amplify.configure({
    Auth: { Cognito: { userPoolId: config.userPoolId, userPoolClientId: config.userPoolClientId, loginWith: { email: true } } },
  });
  configured = true;
}

/** Access token for the API, refreshed if needed; null when signed out. */
export async function accessToken(): Promise<string | null> {
  setupAuth();
  const { tokens } = await fetchAuthSession();
  return tokens?.accessToken?.toString() ?? null;
}
