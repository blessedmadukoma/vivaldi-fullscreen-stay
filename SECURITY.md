# Security policy

## Supported release

Use **1.1.0 or later**, including the matching companion CSS. Earlier versions used a page-title marker to control Vivaldi's interface and accepted synthetic input. A page could copy that marker to cover browser controls. This was an interface-spoofing risk; this audit found no account-token theft or laptop-access path.

Do not mix the old CSS with the new extension. Remove the old `youtube-fullscreen.css` before installing `vivaldi-fullscreen.css`. The project is now Vivaldi Fullscreen Stay. Its extension ID is unchanged. Version 1.1.0 introduced this stable ID, so an unpacked 1.0.2 installation must be disabled or removed and replaced once.

## Trust boundaries

- Version 2.0.0 content scripts run in HTTP(S) pages and matching frames, in Chrome's isolated world. Internal browser pages and local files are excluded. Versions 1.1.0 and 1.2.0 had narrower site access.
- Keyboard, click and double-click actions require a browser-trusted event. Page JavaScript cannot activate this extension by dispatching an event.
- The worker accepts only a fixed message type, boolean and random activation ID. It checks the browser-provided extension ID, frame, document lifecycle, tab ID, HTTP(S) scheme and matching sender origin. It relays layout state only within that sender's tab and changes its own per-tab badge.
- Content scripts accept relays only from their own extension worker. A relay can expand only a visible iframe in a document's focused frame chain. There is no page `postMessage` bridge, main-world script or override of the native Fullscreen API. \[4\]
- Open shadow roots use the original trusted event path and nested focus state. A fixed local stylesheet supplies player geometry inside the shadow root and is removed on exit. The policy check rejects dynamic CSS literals and external CSS resources. A child can send a clear for parent-started expansion; unrelated frame navigation does not send that clear.
- The browser appearance rule requires that badge and an active HTTP(S) webview. A page title or page-created DOM element cannot set the browser-owned badge.
- The extension has no cookie, history, storage, debugger, native-messaging, file, download or management permission. It neither sends network requests nor loads remote code. There are no runtime dependencies.

The event-driven worker has no polling or keep-alive timer. It wakes for state changes and navigation. This audit did not measure battery consumption.

Active layout cleanup observes direct changes to the player's ancestors, rather than mutations across the whole page. Same-document navigation clears layout through the Navigation API. Source policy rejects production timers, animation loops and `subtree: true` observers. The [performance report](docs/performance.md) records controlled CPU measurements and their limits.

## What this does not guarantee

All-site DOM access is a material increase over the YouTube/X-only release. It includes the ability to read or modify signed-in website pages. Installing 2.0.0 therefore requires approval for this wider access. The reviewed code uses it only for player layout, control labels and the focused iframe; a malicious future update could misuse the same access. X private routes cannot activate the badge and can always clear it after navigation. The extension CSP does not block every possible content-script network mechanism. Permission restrictions, policy checks, code review and the release source must be considered together. \[1\], \[2\]

No source audit or scanner can prove that a browser, operating system, publisher account or future release is free of vulnerabilities. This is a scoped code audit, not a certification against a named compliance standard. Keep Vivaldi and macOS updated. No Web Store review has been performed.

## Checks

- Pre-commit: production-code and manifest policy checks, unit/attack tests and staged secret scanning.
- CI: those checks, full Git-history secret scanning, dependency advisories, Chromium extension/browser tests, CodeQL security queries and release packaging checks.
- Actions are pinned to commit hashes. Development dependencies are pinned in the lockfile with integrity digests. Gitleaks downloads are pinned and checked against recorded SHA-256 digests.
- Dependabot alerts and security updates remain enabled. Routine version-update PRs are disabled. Updates still require checks and review.

The policy scanner is a conservative change detector. It rejects network, storage, dynamic-code and unapproved browser capabilities in production JavaScript. It is not a general JavaScript sandbox or a substitute for review.

## Report an issue

Use GitHub's **Report a vulnerability** feature when available. Do not put credentials, browser profiles, private tab URLs or session files in a public issue. Include the extension and Vivaldi versions, a minimal reproduction and the expected result.

## References

1. Chrome for Developers, [“Content scripts”](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
2. Chrome for Developers, [“Stay secure”](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure).
3. Chrome for Developers, [“Action API”](https://developer.chrome.com/docs/extensions/reference/api/action).
4. Chrome for Developers, [“Message passing”](https://developer.chrome.com/docs/extensions/develop/concepts/messaging).
