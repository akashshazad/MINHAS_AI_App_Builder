import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = { autoFetch?: boolean };

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const applyApiUser = useCallback(async (apiUser: any) => {
    if (!apiUser) throw new Error("MINHAS backend returned no user");
    const userInfo: Auth.User = {
      id: apiUser.id,
      openId: apiUser.openId,
      name: apiUser.name,
      email: apiUser.email,
      loginMethod: apiUser.loginMethod,
      lastSignedIn: new Date(apiUser.lastSignedIn),
    };
    await Auth.setUserInfo(userInfo);
    setUser(userInfo);
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();
        if (apiUser) await applyApiUser(apiUser);
        else await applyApiUser((await Api.createAnonymousSession()).user);
        return;
      }

      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        await applyApiUser((await Api.createAnonymousSession()).user);
        return;
      }

      const apiUser = await Api.validateSession();
      if (!apiUser) {
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
        await applyApiUser((await Api.createAnonymousSession()).user);
        return;
      }
      await applyApiUser(apiUser);
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error("MINHAS backend authentication failed");
      setError(nextError);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applyApiUser]);

  const logout = useCallback(async () => {
    try { await Api.logout(); } catch { /* local session cleanup remains authoritative */ }
    await Auth.removeSessionToken();
    await Auth.clearUserInfo();
    setUser(null);
    setError(null);
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (autoFetch) void fetchUser();
    else setLoading(false);
  }, [autoFetch, fetchUser]);

  return { user, loading, error, isAuthenticated, refresh: fetchUser, logout };
}
