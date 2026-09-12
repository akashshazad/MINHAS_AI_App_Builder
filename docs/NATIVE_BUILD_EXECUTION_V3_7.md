
# MINHAS AI App Builder 10X v3.7.0 — Native Build Execution

v3.7 adds a real Docker worker execution adapter around the v3.6 native worker contract. The build service can launch an isolated worker container with a read-only root filesystem, dropped Linux capabilities, no-new-privileges, PID/CPU/memory limits, explicit network policy, and read-only request/secret mounts.

The worker reads a validated request file, optionally reads short-lived signing material from a mounted secret file, runs the existing native build runner, writes a bounded result file, and is destroyed after the job. Signing material is never passed as Docker command-line arguments.

This package is an execution implementation and contract foundation. It is **not** a claim that an Android APK/AAB was successfully built in this sandbox. Live certification requires a provisioned Docker host, Android SDK/JDK image build, dependency availability, signing profile, and a real Android project.


