# Security policy

## Supported release

Use **1.1.0 or later**, including the matching companion CSS. Earlier versions used a page-title marker to control Vivaldi's interface and accepted synthetic input. A page could copy that marker to cover browser controls. This was an interface-spoofing risk; this audit found no account-token theft or laptop-access path.

Do not mix the old CSS with the new extension. Remove the old `youtube-fullscreen.css` before installing its replacement. Version 1.1.0 has a stable extension ID, so an unpacked 1.0.2 installation must be disabled or removed and replaced once.

## Trust boundaries

- The content script is restricted to the top-level `https://www.youtube.com/` origin and runs in Chrome's isolated world.
- Keyboard, click and double-click actions require a browser-trusted event. Page JavaScript cannot activate this extension by dispatching an event.
- The worker accepts only a fixed message type and a boolean. It checks the browser-provided extension ID, frame, document lifecycle, tab ID and exact origin. It can change only this extension's own per-tab badge.
- The browser appearance rule requires that badge and an active YouTube webview. A page title or page-created DOM element cannot set the browser-owned badge.
- The extension has no cookie, history, storage, debugger, native-messaging, file, download or management permission. It neither sends network requests nor loads remote code. There are no runtime dependencies.

The event-driven worker has no polling or keep-alive timer. It wakes for state changes and navigation. This audit did not measure battery consumption.

## What this does not guarantee

An extension with YouTube site access can read and change that site's DOM. The reviewed code uses it for the player and controls; a malicious future update could misuse the same access. The extension CSP does not block every possible content-script network mechanism. Permission restrictions, policy checks, code review and the release source must be considered together. \[1\], \[2\]

No source audit or scanner can prove that a browser, operating system, publisher account or future release is free of vulnerabilities. This is a scoped code audit, not a certification against a named compliance standard. Keep Vivaldi and macOS updated. No Web Store review has been performed.

## Checks

- Pre-commit: production-code and manifest policy checks, unit/attack tests and staged secret scanning.
- CI: those checks, full Git-history secret scanning, dependency advisories, Chromium extension/browser tests, CodeQL security queries and release packaging checks.
- Actions are pinned to commit hashes. Development dependencies are pinned in the lockfile with integrity digests. Gitleaks downloads are pinned and checked against recorded SHA-256 digests.
- Dependabot proposes dependency and action updates. Updates still require checks and review.

The policy scanner is a conservative change detector. It rejects network, storage, dynamic-code and unapproved browser capabilities in production JavaScript. It is not a general JavaScript sandbox or a substitute for review.

## Report an issue

Use GitHub's **Report a vulnerability** feature when available. Do not put credentials, browser profiles, private tab URLs or session files in a public issue. Include the extension and Vivaldi versions, a minimal reproduction and the expected result.

## References

1. Chrome for Developers, [“Content scripts”](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
2. Chrome for Developers, [“Stay secure”](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure).
3. Chrome for Developers, [“Action API”](https://developer.chrome.com/docs/extensions/reference/api/action).
