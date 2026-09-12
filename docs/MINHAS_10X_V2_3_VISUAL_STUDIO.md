
# MINHAS AI Builder 10X v2.3 — Visual AI Studio

## Purpose
Adds a code-linked Visual AI Studio workflow on top of the v2.2 controlled Software Factory.

## Implemented
- Visual Studio project route.
- Approved-plan page/component target selection.
- Code-linked file mapping for the selected target.
- Natural-language visual change requests.
- Reuse of the safe AI preview/apply pipeline.
- Reviewable proposed-file list with lightweight line-change preview.
- Explicit Reject / Apply controls.
- Restore point remains enforced by the existing apply workflow.
- Verified preview is opened only when the project already has a verified live preview URL.

## Truthfulness
The Studio does not pretend that the plan map is a rendered app canvas. A real live preview is only labeled verified when the existing preview health gate has established it.

## Next expansion
The next stage can add a true remote preview bridge with component selection telemetry, visual overlays, Git/GitHub version control, branch/diff management, and device-farm inspection while preserving the no-fake-success contract.


