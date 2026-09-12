
# MINHAS AI Build and Deployment Contracts

## Security model

Generated project code is never executed inside the MINHAS AI API process. The API stores project files in the database, creates restore points before edits and AI fixes, and sends build/deploy requests only to configured external services. A project must pass an isolated build before deployment can be requested.

## Isolated build service

Configure `MINHAS_BUILD_SERVICE_URL` and `MINHAS_BUILD_SERVICE_TOKEN` as server-side secrets. The adapter sends `POST {MINHAS_BUILD_SERVICE_URL}/v1/builds` with a JSON body containing `projectId`, `projectName`, `framework`, and a list of `{ path, language, content }` files. The service should return `{ id, status, logs?, previewUrl? }`. Status polling uses `GET {MINHAS_BUILD_SERVICE_URL}/v1/builds/{id}` and expects `{ status, logs?, error?, previewUrl? }`.

The worker should build inside an isolated container or sandbox with no access to the MINHAS AI database credentials. It should enforce CPU, memory, wall-clock, output-size, dependency, and network policies. The preview URL must be scoped to the generated project and should expire or be revocable.

## Deployment service

Configure `MINHAS_DEPLOY_SERVICE_URL` and `MINHAS_DEPLOY_SERVICE_TOKEN` as server-side secrets. The adapter sends `POST {MINHAS_DEPLOY_SERVICE_URL}/v1/deployments` with `projectId`, `projectName`, `framework`, `provider`, and the project files. It expects `{ id, status, targetUrl? }`. Status polling uses `GET {MINHAS_DEPLOY_SERVICE_URL}/v1/deployments/{id}` and expects `{ status, error?, targetUrl? }`.

The adapter supports the logical provider names `managed`, `vercel`, and `netlify`; provider-specific credentials must remain inside the deployment service rather than in the mobile app or MINHAS AI API.

## ZIP export

ZIP export is performed server-side with path traversal protection, uploaded through the built-in storage service, and returned as a signed download URL. The API rejects empty workspaces and unsafe paths such as `../secrets.env`.

## AI review and auto-fix

AI review is bounded to a capped input size and returns findings without claiming that code was executed. Auto-fix creates a snapshot first, applies at most three complete-file patches to existing files, and records the review result and applied paths. It does not run shell commands or accept new files from the model.

## Required operational checks

Before enabling external providers, verify that the service authenticates every request, validates project ownership metadata, rejects path traversal, isolates execution, strips secrets, limits dependencies and network access, records logs, and supports cancellation. The mobile UI reports the actual runtime state. A capability is marked live only after provider execution and verification; missing infrastructure is blocked rather than represented as a fake success.


