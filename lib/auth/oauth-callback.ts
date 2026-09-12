
export type OAuthCallbackParams = {
  code?: string | null;
  state?: string | null;
  error?: string | null;
  sessionToken?: string | null;
};

const MAX_PARAMETER_LENGTH = 4096;
const SAFE_VALUE = /^[A-Za-z0-9._~%+\-=/]+$/;

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PARAMETER_LENGTH) return null;
  return SAFE_VALUE.test(trimmed) ? trimmed : null;
}

export function parseOAuthCallback(input: string, routeParams: OAuthCallbackParams = {}): OAuthCallbackParams {
  let parsed: URL | null = null;
  try {
    parsed = new URL(input, "http://localhost");
  } catch {
    return {
      code: clean(routeParams.code),
      state: clean(routeParams.state),
      error: clean(routeParams.error),
      sessionToken: clean(routeParams.sessionToken),
    };
  }
  return {
    code: clean(routeParams.code ?? parsed.searchParams.get("code")),
    state: clean(routeParams.state ?? parsed.searchParams.get("state")),
    error: clean(routeParams.error ?? parsed.searchParams.get("error")),
    sessionToken: clean(routeParams.sessionToken ?? parsed.searchParams.get("sessionToken")),
  };
}


