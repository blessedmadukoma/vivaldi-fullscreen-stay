# Changelog

## 1.2.0 — 8 November 2026

- Add a scoped X.com (formerly Twitter) player handler.
- Require approval for the added X.com site access. No all-sites permission is requested.
- Keep private X routes inactive and clear state after navigation.
- Retain the browser-owned badge and trusted-input checks.

## 1.1.0 — 7 November 2026

Security update. Replace both the extension and companion CSS.

- Replace page-title signalling with an extension-owned per-tab action badge and an active YouTube webview check.
- Reject synthetic input and validate origin, frame, document lifecycle and message schema.
- Remove page-title mutations and add a stable public extension ID.
- Add pre-commit checks, secret scanning, dependency advisories, CodeQL, browser attack tests and allow-listed release packaging.
- Keep the runtime free of third-party dependencies. The new event-driven worker updates only its own badge and has no polling timer.

## 1.0.2 — 7 November 2026

First public source release.

- Expand the existing YouTube player without calling the native Fullscreen API.
- Keep Vivaldi's native macOS fullscreen state when leaving video view.
- Cover the browser controls with a companion CSS rule that retains the tab bar's layout.
- Leave YouTube-managed player classes unchanged.
- Pass theatre actions to YouTube after restoring the normal player layout.
- Limit content-script access to `https://www.youtube.com/*`.
