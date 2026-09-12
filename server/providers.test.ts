
import { afterEach, describe, expect, it } from "vitest";
import { buildProviderStatus, deployProviderStatus, normalizeBuildStatus, normalizeDeploymentStatus } from "./providers";

const originalBuildUrl = process.env.MINHAS_BUILD_SERVICE_URL;
const originalBuildToken = process.env.MINHAS_BUILD_SERVICE_TOKEN;
const originalDeployUrl = process.env.MINHAS_DEPLOY_SERVICE_URL;
const originalDeployToken = process.env.MINHAS_DEPLOY_SERVICE_TOKEN;

afterEach(() => {
  process.env.MINHAS_BUILD_SERVICE_URL = originalBuildUrl;
  process.env.MINHAS_BUILD_SERVICE_TOKEN = originalBuildToken;
  process.env.MINHAS_DEPLOY_SERVICE_URL = originalDeployUrl;
  process.env.MINHAS_DEPLOY_SERVICE_TOKEN = originalDeployToken;
});

describe("provider configuration", () => {
  it("does not claim isolated builds are available without both settings", () => {
    delete process.env.MINHAS_BUILD_SERVICE_URL;
    delete process.env.MINHAS_BUILD_SERVICE_TOKEN;
    expect(buildProviderStatus()).toMatchObject({ configured: false, provider: "isolated-build-service" });
  });

  it("does not claim deployment is available without both settings", () => {
    delete process.env.MINHAS_DEPLOY_SERVICE_URL;
    delete process.env.MINHAS_DEPLOY_SERVICE_TOKEN;
    expect(deployProviderStatus()).toMatchObject({ configured: false, provider: "deployment-service" });
  });

  it("normalizes provider success states to canonical application states", () => {
    expect(normalizeBuildStatus("success")).toBe("passed");
    expect(normalizeBuildStatus("failure")).toBe("failed");
    expect(normalizeDeploymentStatus("deployed")).toBe("live");
    expect(normalizeDeploymentStatus("error")).toBe("failed");
  });
});


