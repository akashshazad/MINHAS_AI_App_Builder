import fs from "node:fs";

const gradlePath = "android/app/build.gradle";
const required = [
  "ANDROID_KEYSTORE_PATH",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required for a release build`);
}
if (!fs.existsSync(gradlePath)) {
  throw new Error(`${gradlePath} is missing; run expo prebuild before configuring signing`);
}

const source = fs.readFileSync(gradlePath, "utf8");
const marker = "// MINHAS_RELEASE_SIGNING_CONFIGURED";
if (source.includes(marker)) {
  console.log("ANDROID RELEASE SIGNING ALREADY CONFIGURED");
  process.exit(0);
}
const signingBlock = `
    release {
        storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
        storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
        keyAlias System.getenv("ANDROID_KEY_ALIAS")
        keyPassword System.getenv("ANDROID_KEY_PASSWORD")
    }
`;
if (
  !source.includes("signingConfigs {") ||
  !source.includes("signingConfig signingConfigs.debug")
) {
  throw new Error("Unexpected Expo Gradle signing structure; refusing to patch silently");
}
const withReleaseConfig = source.replace(
  /    signingConfigs \{\n        debug \{[\s\S]*?\n        \}\n    \}/,
  (match) => `${match}${signingBlock}`,
);
if (withReleaseConfig === source) throw new Error("Could not add release signing config");
const withReleaseBuild = withReleaseConfig.replace(
  /        release \{\n            \/\/ Caution![\s\S]*?            signingConfig signingConfigs\.debug\n/,
  (match) =>
    match.replace(
      "signingConfig signingConfigs.debug",
      `signingConfig signingConfigs.release\n            ${marker}`,
    ),
);
if (withReleaseBuild === withReleaseConfig)
  throw new Error("Could not switch release build to release signing");
fs.writeFileSync(gradlePath, withReleaseBuild);
console.log("ANDROID RELEASE SIGNING CONFIGURED");
