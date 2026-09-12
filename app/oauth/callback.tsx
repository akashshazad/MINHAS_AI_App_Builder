
import { ThemedView } from "@/components/themed-view";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { parseOAuthCallback } from "@/lib/auth/oauth-callback";
import { getRedirectUri } from "@/constants/oauth";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    sessionToken?: string;
    user?: string;
  }>();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      console.log("[OAuth] Callback handler triggered");
      try {
        // Check for sessionToken in params first (web OAuth callback from server redirect)
        if (params.sessionToken) {
          console.log("[OAuth] Session token found in params (web callback)");
          await Auth.setSessionToken(params.sessionToken);
          if (Platform.OS !== "web" && !(await Api.validateSession())) {
            await Auth.removeSessionToken();
            throw new Error("The received session could not be validated.");
          }

          // Decode and store user info if available
          if (params.user) {
            try {
              // Use atob for base64 decoding (works in both web and React Native)
              const userJson =
                typeof atob !== "undefined"
                  ? atob(params.user)
                  : Buffer.from(params.user, "base64").toString("utf-8");
              const userData = JSON.parse(userJson);
              const userInfo: Auth.User = {
                id: userData.id,
                openId: userData.openId,
                name: userData.name,
                email: userData.email,
                loginMethod: userData.loginMethod,
                lastSignedIn: new Date(userData.lastSignedIn || Date.now()),
              };
              await Auth.setUserInfo(userInfo);
                } catch (err) {
              console.error("[OAuth] Failed to parse user data:", err);
            }
          }

          setStatus("success");
          router.replace("/(tabs)");
          return;
        }

        const initialUrl = await Linking.getInitialURL();
        const callback = parseOAuthCallback(initialUrl ?? "", {
          code: params.code,
          state: params.state,
          error: params.error,
          sessionToken: params.sessionToken,
        });
        const error = callback.error;
        if (error) {
          setStatus("error");
          setErrorMessage(error || "OAuth error occurred");
          return;
        }

        const code = callback.code;
        const state = callback.state;
        const sessionToken = callback.sessionToken;

        // If we have sessionToken directly from URL, use it
        if (sessionToken) {
          await Auth.setSessionToken(sessionToken);
          if (Platform.OS !== "web" && !(await Api.validateSession())) {
            await Auth.removeSessionToken();
            throw new Error("The received session could not be validated.");
          }
          // User info is already in the OAuth callback response
          // No need to fetch from API
          setStatus("success");
          router.replace("/(tabs)");
          return;
        }

        // Otherwise, exchange code for session token
        if (!code || !state) {
          console.error("[OAuth] Missing code or state parameter", {
            hasCode: !!code,
            hasState: !!state,
          });
          setStatus("error");
          setErrorMessage("Missing code or state parameter");
          return;
        }

        // Exchange code for session token
        const verifier = Platform.OS === "web" ? null : await Auth.consumeOAuthTransaction(state);
        if (Platform.OS !== "web" && !verifier) {
          throw new Error("OAuth state is invalid, expired, or already used.");
        }
        const result = await Api.exchangeOAuthCode(code, state, verifier ?? undefined, Platform.OS === "web" ? undefined : getRedirectUri());
        console.log("[OAuth] Exchange result:", {
          hasSessionToken: !!result.sessionToken,
          hasUser: !!result.user,
        });

        if (result.sessionToken) {
          // Store session token
          await Auth.setSessionToken(result.sessionToken);

          const validatedUser = await Api.validateSession();
          if (!validatedUser) {
            await Auth.removeSessionToken();
            throw new Error("The received session could not be validated.");
          }

          // Store user info if available
          if (validatedUser) {
            const userInfo: Auth.User = {
              id: validatedUser.id,
              openId: validatedUser.openId,
              name: validatedUser.name,
              email: validatedUser.email,
              loginMethod: validatedUser.loginMethod,
              lastSignedIn: new Date(validatedUser.lastSignedIn),
            };
            await Auth.setUserInfo(userInfo);
            } else {
            console.log("[OAuth] No user data in result");
          }

          setStatus("success");
          router.replace("/(tabs)");
        } else {
          console.error("[OAuth] No session token in result:", result);
          setStatus("error");
          setErrorMessage("No session token received");
        }
      } catch (error) {
        console.error("[OAuth] Callback error:", error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to complete authentication",
        );
      }
    };

    handleCallback();
  }, [params.code, params.state, params.error, params.sessionToken, params.user, router]);

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <ThemedView className="flex-1 items-center justify-center gap-4 p-5">
        {status === "processing" && (
          <>
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-base leading-6 text-center text-foreground">
              Completing authentication...
            </Text>
          </>
        )}
        {status === "success" && (
          <>
            <Text className="text-base leading-6 text-center text-foreground">
              Authentication successful!
            </Text>
            <Text className="text-base leading-6 text-center text-foreground">
              Redirecting...
            </Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text className="mb-2 text-xl font-bold leading-7 text-error">
              Authentication failed
            </Text>
            <Text className="text-base leading-6 text-center text-foreground">
              {errorMessage}
            </Text>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

