# Windows Release Reliability Design

## Goal

Restore the Windows release pipeline after the v0.9.9 NSIS download failure and publish a clean v0.9.10 release with an installer, updater signature, and `latest.json`.

## Root cause

The v0.9.9 application compiled successfully, but Tauri received HTTP 503 while downloading NSIS 3.11. The workflow had no build retry, so packaging stopped before any release assets were uploaded. The workflow also used Node 20-based action majors and passed a stale Tauri action input.

## Design

- Upgrade `actions/checkout` and `actions/setup-node` to their current Node 24-based major versions.
- Upgrade `tauri-apps/tauri-action` to v1.
- Preserve Tauri's default asset names instead of applying a custom rename pattern, because README and updater links already rely on those names.
- Set `retryAttempts: 3` so transient build or upload failures are retried.
- Bump all synchronized application versions and public download links to v0.9.10.
- Keep updater signing and optional Authenticode secrets unchanged.

## Verification

Unit tests validate the workflow contract and synchronized versions. Local verification runs the complete web checks and Rust compilation. The tagged GitHub Actions run is only successful when the v0.9.10 release exposes the NSIS installer, `.sig`, and `latest.json`.

## Authenticode boundary

The workflow already supports a PFX certificate through GitHub secrets. Obtaining a trusted certificate remains an external identity, payment, and certificate-authority approval process; no private key or certificate is stored in the repository.
