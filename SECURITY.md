# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest `main` / latest npm `opencode-rtl-fix` | ✅ |
| older releases | ⚠️ update to the latest first |

Security fixes are released as new versions. If you are on an older
version, upgrade and check whether the issue still reproduces before
reporting.

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Report privately via email:

- **khanzadeh.1377@gmail.com**

Please include:

1. A description of the vulnerability and its impact.
2. Steps to reproduce (configuration, opencode version, OS).
3. The plugin version / commit you tested.

You will receive an acknowledgment within a reasonable time, and we will
coordinate a fix and release before any public disclosure.

## Scope Notes

- The `patch/` desktop scripts intentionally modify the locally installed
  opencode Desktop `app.asar` (with backup + `--unpatch` revert). They must
  be run explicitly by the user with admin rights; they never run
  automatically and never exfiltrate data.
- The server plugin only transforms chat text locally and sets
  `OPENCODE_RTL*` environment variables. It makes no network requests.
