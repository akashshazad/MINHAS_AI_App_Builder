
import * as Linking from "expo-linking";
import * as ReactNative from "react-native";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// Extract scheme from bundle ID (last segment timestamp, prefixed with "manus")
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const bundleId = "com.app.minhasaiappbuilder";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;
export const isManusOAuthConfigured = Boolean(OAUTH_PORTAL_URL && APP_ID);

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000.
 * URL pattern: https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    // Published WebDev apps serve the client and API from one public origin.
    // Do not keep calling a stale preview API after publication.
    if (hostname.endsWith(".manus.space") && API_BASE_URL && !API_BASE_URL.includes(".manus.space")) {
      return window.location.origin;
    }
    // Pattern: 8081-sandboxid.region.domain -> 3000-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname && (!API_BASE_URL || API_BASE_URL.includes(".manus.computer"))) {
      return `${protocol}//${apiHostname}`;
    }
  }

  if (API_BASE_URL) return API_BASE_URL.replace(/\/$/, "");

  // Fallback to empty (will use relative URL)
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";
export const OAUTH_STATE_KEY = "manus-oauth-state";
export const OAUTH_VERIFIER_KEY = "manus-oauth-code-verifier";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

/**
 * Get the redirect URI for OAuth callback.
 * - Web: uses API server callback endpoint
 * - Native: uses deep link scheme
 */
export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    return `${getApiBaseUrl()}/api/oauth/callback`;
  } else {
    return Linking.createURL("/oauth/callback", {
      scheme: env.deepLinkScheme,
    });
  }
};

function toBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createPkceTransaction() {
  const random = await Crypto.getRandomBytesAsync(32);
  const state = toBase64Url(random);
  const verifier = toBase64Url(await Crypto.getRandomBytesAsync(32));
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  const challenge = digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  if (ReactNative.Platform.OS !== "web") {
    await SecureStore.setItemAsync(OAUTH_STATE_KEY, state);
    await SecureStore.setItemAsync(OAUTH_VERIFIER_KEY, verifier);
  }
  return { state, challenge };
}

export const getLoginUrl = async () => {
  const redirectUri = getRedirectUri();
  const { state, challenge } = await createPkceTransaction();

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Start OAuth login flow.
 *
 * On native platforms (iOS/Android), open the system browser directly so
 * the OAuth callback returns via deep link to the app.
 *
 * On web, this simply redirects to the login URL.
 *
 * @returns Always null, the callback is handled via deep link.
 */
export async function startOAuthLogin(): Promise<string | null> {
  if (!isManusOAuthConfigured) {
    throw new Error("Login is not configured: OAuth portal or app ID is missing.");
  }
  const loginUrl = await getLoginUrl();

  if (ReactNative.Platform.OS === "web") {
    // On web, just redirect
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] Failed to open login URL:", error);
    throw new Error("Unable to open the secure login page. Check that a browser is installed and try again.");
  }

  // The OAuth callback will reopen the app via deep link.
  return null;
}
