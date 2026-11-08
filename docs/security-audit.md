# Security audit — 7 November 2026

Scope: the extension, companion Vivaldi CSS, public repository, development checks and release package. The baseline was commit `04fa187`, version 1.0.2. This was an internal source and behaviour review, not an independent certification.

## Findings

| Finding | Impact | Resolution in 1.1.0 |
| --- | --- | --- |
| Browser controls were covered when an active page title contained a public marker. | Another site or crafted YouTube title could trigger the appearance rule. This could aid interface spoofing. | Removed all title signalling. The CSS now checks this extension's browser-owned action badge and the active YouTube webview. |
| Input handlers accepted untrusted synthetic events. | Page scripts could trigger the expanded player without a genuine key or click. | Input handlers require `event.isTrusted`. Origin and top-frame guards also run before listeners are installed. |
| No automated change gates or dependency/security workflow existed. | Future code or release changes could add capabilities or include secrets without detection. | Added manifest/AST/CSS policy checks, attack tests, secret scanning, dependency checks, CodeQL, pinned tools and allow-listed packaging. |

## Data and capability review

The reviewed production code has no request-sending API, remote script, dynamic-code evaluation, cookie or token access, storage access, native-messaging bridge, command execution or filesystem API. No credentials or private browser data were found in the public Git history by the secret scan. These observations apply to the reviewed code and scan coverage; they do not prove the absence of every possible vulnerability.

The content script reads the player, its video and control labels. The worker receives only `{type: "vfs:state", expanded: boolean}`. Chrome supplies sender metadata for origin validation; the worker does not send or persist that URL. It writes only this extension's per-tab action badge. Navigation clears the badge. Pending writes are serialised so a delayed activation does not overwrite a later clear.

The content script shares the page's DOM but has isolated JavaScript globals. The page cannot set `isTrusted` to true or call the worker through an external messaging interface. The manifest exposes no external messaging or web-accessible resource interface. Chrome still treats content scripts as a lower-trust boundary, so the worker validates every message. \[1\], \[2\]

## Verification and limits

Local checks cover forged titles, synthetic events, wrong origins, iframe senders, inactive documents, malformed messages, extra data fields, stale navigation state, typing, theatre transitions and a rejected badge update. Chromium browser tests use isolated temporary profiles and local route fixtures; no personal browser profile or account is used. They also check that ordinary expansion generates no additional page requests.

The CSS tests model Vivaldi's protected interface structure. The hardened helper was also checked live in Vivaldi 8.3.4191.30: the protected badge covered the browser controls, and F, Esc and theatre transitions retained native Mac fullscreen. The model tests are not a substitute for retesting Vivaldi after a browser UI update. YouTube itself makes network requests, and other installed extensions are outside this audit. Unpacked installations require the user to install updates manually.

## References

1. Chrome for Developers, [“Content scripts”](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
2. Chrome for Developers, [“Stay secure”](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure).
3. Playwright, [“Chrome extensions”](https://playwright.dev/docs/chrome-extensions).
4. GitHub, [“Workflow configuration options for code scanning”](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options).

Verification at this revision: 24 local unit/policy/packaging tests, five Chromium browser tests, CodeQL with zero open alerts, zero npm advisories, and clean staged/history secret scans. A negative control with a generated, non-functional credential was rejected by Gitleaks. The only exception is the exact public extension identity key in `extension/manifest.json`. Release builds require clean committed source and an exact file allow-list.

## Scoped X update — 8 November 2026

Version 1.2.0 adds only `https://x.com/*` to the existing YouTube match. Installing it therefore needs approval for the new site access. No all-sites match, new browser API permission, iframe access, external messaging, storage or network code is added. Known X private routes cannot activate the indicator. A valid same-origin private route can always clear it, so SPA navigation cannot leave a stale fullscreen badge.

The X adapter uses the selected or hovered visible player wrapper, which contains both the video component and its controls. Input fields, synthetic events, lookalike domains and off-screen players are rejected. The worker still accepts only a fixed message type and a boolean. An invalidated extension runtime rolls the layout back without throwing. Local validation: 29 unit/policy/packaging tests and seven isolated Chromium browser tests pass. A public X video was also checked live in Vivaldi 8.3.4191.30: playback stayed expanded, and F and Esc retained native Mac fullscreen. These checks do not prove that every X layout or streaming provider is supported.

## General streaming update — 8 November 2026

Version 2.0.0 materially widens site access to HTTP(S) pages and matching frames. This allows the code to run on signed-in pages across websites. It is not equivalent to the earlier narrow permissions and requires approval before installation. No browser API permission, network code, storage, native messaging, remote dependency or main-world injection is added.

Only a trusted key, click or double-click can initiate expansion. The worker validates its own extension ID, active document, non-negative frame/tab IDs, matching sender origin, HTTP(S) scheme and a fixed three-field message. The activation ID is generated randomly; it is not an account token or page value. The worker sends only this state to content scripts in the same tab, using `tabs.sendMessage`. It does not query tab URLs or frame URLs. Ancestors use browser focus state to expand the visible iframe; other frame branches stay unchanged. A worker clear restores each frame without sending another clear. \[1\]

Local validation passes 31 unit/policy/packaging tests and 11 Chromium browser tests. They cover nested cross-origin players, unrelated frames, forged page messages, synthetic input, malformed activation IDs, non-web origins, navigation, typing, HTTP and HTTPS videos, and YouTube theatre transitions. A failed badge write sends a clear to restore ancestor frames. Live validation on the existing embedded streaming player is pending. All-site access increases the consequences of a compromised future release. The source policy and scanners are change gates, not a proof of security or universal player compatibility.
