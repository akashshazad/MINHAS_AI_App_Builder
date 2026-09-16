# MINHAS AI App Builder — Deep Audit Matrix

| Area | Status | Evidence / root cause |
|---|---|---|
| Existing Expo/Router architecture | LIVE | Existing mobile app, tabs, project workspace, server/tRPC architecture preserved. |
| Core MINHAS session | LIVE | Backend-issued anonymous session; live readiness reports database/auth ready. |
| Manus OAuth/PKCE | BLOCKED BY CONFIGURATION | Optional PKCE flow is retained and rejects incomplete exchanges; provider App ID/registered redirect configuration is intentionally absent. |
| Project creation persistence | LIVE | Baseline and custom migrations applied; project and initial event now insert atomically; rollback-only live INSERT verification passed. |
| Migration handling | LIVE | Baseline Drizzle migrations plus locked custom migrations applied; optional native-build tables are skipped safely; project tables verified live. |
| Prompt size/preservation | LIVE WITH SAFE BOUNDARY | Removed artificial 12,000-character caps; projects.idea and aiRuns.prompt are MEDIUMTEXT; 1 MB transparent API safety boundary; prompt and attachment context are chunked without byte loss; draft is persisted locally. |
| Attachments | LIVE IN APP CODE / PROVIDER-DEPENDENT | Camera, gallery, files, validation, base64 upload, signed storage URLs, and AI text/image context are wired. Storage provider configuration must exist for live uploads. |
| Voice input | LIVE IN APP CODE / PROVIDER-DEPENDENT | Real expo-audio recording, permission handling, upload, and built-in STT procedure are wired. STT/storage credentials remain environment-dependent. |
| Prompt retry/resume/cancel | PARTIAL | Prompt is preserved on failure, retry is available, and duplicate submission is idempotent. Full server-side cancellation/resume of a live LLM request still depends on provider cancellation support. |
| Structured AI output | LIVE | Versioned schemas, strict structured responses, Zod validation, bounded repair/retry, chunked context, and prior live Urdu plan-to-files verification. |
| Code review / restore / version control | PARTIAL | Existing routes and restore points remain; broad transactional verification of every autonomous stage is not complete. |
| Build / preview / deployment | PARTIAL / CONFIGURATION-DEPENDENT | Permanent clean-container root cause fixed: `react-native-css-interop@0.2.1` is now a direct locked dependency for the existing JSX runtime import. A fresh frozen install and production web/server build pass. Android release CI, secure signing, native service/worker images, artifact hashing, and upload steps are prepared. Real Android artifact and public deployment remain blocked by external SDK/signing/publishing infrastructure. |
| GitHub | PARTIAL / BLOCKED BY CONFIGURATION | Provider and version-control routes exist; live repository OAuth/push/pull requires configured GitHub credentials/provider. |
| Offline recovery | PARTIAL | Prompt draft is persisted locally and failures preserve input; full background upload/build resume remains provider-dependent. |
| Performance | PARTIAL | FlatList, bounded attachment sizes, prompt chunking, and server-side validation exist; large-file/device profiling remains to be run on physical hardware. |
| Security | IMPROVED / NO NEW CRITICAL FINDING | OAuth remains optional and PKCE-validated; uploads are type/size/name constrained and stored under the authenticated user path; generated code remains isolated from the API process. |
| Regression coverage | VERIFIED FOR LOCAL AUTOMATED GATES | Fresh frozen install, typecheck, lint, 39 unit tests, production web/server build, 5/5 Playwright E2E under controlled execution, preflight, production preflight, security audit, runtime safety, feature structure, native worker/queue/artifact/signing/Docker/execution self-tests, and v4.8 release self-test pass. Deployed E2E, physical-device visual regression, and real APK/AAB remain not testable here. |

## Acceptance boundary

The app is **not globally production-ready for every platform/provider**. The permanent code-level deployment blocker is fixed and verified by a fresh frozen install/build. Final certification is blocked only by external requirements: run `.github/workflows/ci.yml`'s manual/tag `android-release` job with `MINHAS_RELEASE_KEYSTORE_BASE64`, `MINHAS_RELEASE_KEYSTORE_PASSWORD`, `MINHAS_RELEASE_KEY_ALIAS`, and `MINHAS_RELEASE_KEY_PASSWORD`; provide a real WebDev/hosting publish mechanism and independently verify root/API/deployed E2E; configure and exercise GitHub, Manus OAuth registration, storage, STT, isolated build, preview, and deployment provider credentials. No unavailable integration is represented as successful.
