
import { afterEach, describe, expect, it } from "vitest";
import { getAllowedOAuthRedirectUris } from "./sdk";

describe("exact OAuth redirect allowlist", () => {
  const originalList = process.env.OAUTH_ALLOWED_REDIRECT_URIS;
  const originalNative = process.env.OAUTH_NATIVE_REDIRECT_URI;

  afterEach(() => {
    if (originalList === undefined) delete process.env.OAUTH_ALLOWED_REDIRECT_URIS;
    else process.env.OAUTH_ALLOWED_REDIRECT_URIS = originalList;
    if (originalNative === undefined) delete process.env.OAUTH_NATIVE_REDIRECT_URI;
    else process.env.OAUTH_NATIVE_REDIRECT_URI = originalNative;
  });

  it("keeps exact entries and rejects wildcard entries", () => {
    process.env.OAUTH_ALLOWED_REDIRECT_URIS = "https://app.example/api/oauth/callback,https://app.example/*";
    process.env.OAUTH_NATIVE_REDIRECT_URI = "manusminhasaiappbuilder://oauth/callback";
    expect(getAllowedOAuthRedirectUris()).toEqual([
      "https://app.example/api/oauth/callback",
      "manusminhasaiappbuilder://oauth/callback",
    ]);
  });

  it("returns no allowlist when production callback configuration is missing", () => {
    delete process.env.OAUTH_ALLOWED_REDIRECT_URIS;
    delete process.env.OAUTH_NATIVE_REDIRECT_URI;
    expect(getAllowedOAuthRedirectUris()).toEqual([]);
  });
});


