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
5. MDN, [“Event: composedPath() method”](https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath).
6. MDN, [“ShadowRoot: activeElement property”](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/activeElement).
7. MDN, [“ShadowRoot: adoptedStyleSheets property”](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets).

Verification at this revision: 24 local unit/policy/packaging tests, five Chromium browser tests, CodeQL with zero open alerts, zero npm advisories, and clean staged/history secret scans. A negative control with a generated, non-functional credential was rejected by Gitleaks. The only exception is the exact public extension identity key in `extension/manifest.json`. Release builds require clean committed source and an exact file allow-list.

## Scoped X update — 8 November 2026

Version 1.2.0 adds only `https://x.com/*` to the existing YouTube match. Installing it therefore needs approval for the new site access. No all-sites match, new browser API permission, iframe access, external messaging, storage or network code is added. Known X private routes cannot activate the indicator. A valid same-origin private route can always clear it, so SPA navigation cannot leave a stale fullscreen badge.

The X adapter uses the selected or hovered visible player wrapper, which contains both the video component and its controls. Input fields, synthetic events, lookalike domains and off-screen players are rejected. The worker still accepts only a fixed message type and a boolean. An invalidated extension runtime rolls the layout back without throwing. Local validation: 29 unit/policy/packaging tests and seven isolated Chromium browser tests pass. A public X video was also checked live in Vivaldi 8.3.4191.30: playback stayed expanded, and F and Esc retained native Mac fullscreen. These checks do not prove that every X layout or streaming provider is supported.

## General streaming update — 8 November 2026

Version 2.0.0 materially widens site access to HTTP(S) pages and matching frames. This allows the code to run on signed-in pages across websites. It is not equivalent to the earlier narrow permissions and requires approval before installation. No browser API permission, network code, storage, native messaging, remote dependency or main-world injection is added.

Only a trusted key, click or double-click can initiate expansion. The worker validates its own extension ID, active document, non-negative frame/tab IDs, matching sender origin, HTTP(S) scheme and a fixed three-field message. The activation ID is generated randomly; it is not an account token or page value. The worker sends only this state to content scripts in the same tab, using `tabs.sendMessage`. It does not query tab URLs or frame URLs. Ancestors use browser focus state to expand the visible iframe; other frame branches stay unchanged. A worker clear restores each frame without sending another clear. \[1\]

Local validation passes 31 unit/policy/packaging tests and 11 Chromium browser tests. They cover nested cross-origin players, unrelated frames, forged page messages, synthetic input, malformed activation IDs, non-web origins, navigation, typing, HTTP and HTTPS videos, and YouTube theatre transitions. A failed badge write sends a clear to restore ancestor frames. Live validation in Vivaldi 8.3.4191.30 covered an embedded Kwik/Plyr stream, more than 50 seconds of expanded playback, and Esc, F and player-button exits. Native Mac fullscreen was retained. Temporary local diagnostics were removed by reloading the extension and stream tab; they are not in the source or release. No private stream URL or browser-session data is included here. All-site access increases the consequences of a compromised future release. The source policy and scanners are change gates, not a proof of security or universal player compatibility.

## Open shadow roots — 8 November 2026

The updated 2.0.0 release addresses an embedded Video.js player inside BC.Game's open shadow root. The earlier code inspected the retargeted event and top-level focus element, so it missed a control or iframe inside that root. The update uses the browser's composed event path and follows focus through open roots. These APIs expose the event path and focused element inside an open root; a closed root's internal event path remains hidden. \[5\], \[6\] The helper recognises a text-labelled fullscreen button beside a single iframe. Descendant scripts accept extension-owned active state so Esc or F can clear parent-started expansion. An unrelated frame's pagehide does not clear the tab's active view.

The shadow stylesheet is a fixed CSS literal. It has no imports, resource URLs or interpolation. Source policy tests enforce those restrictions. The helper adopts this stylesheet only within the selected shadow root, preserves other adopted stylesheets and removes its own on exit. \[7\] There are no new permissions, message fields, network or storage capabilities. The existing all-site access remains a material capability and retains the limits described above.

Local validation passes 34 unit/policy/packaging tests and 14 Chromium browser tests. New cases cover nested shadow frames, text-labelled iframe controls, child Esc/F exits, stylesheet cleanup, input retargeting, synthetic controls and no additional page requests. The user confirmed that both Esc and F exits on the live match player retain native Mac fullscreen. No account information, private match URL or streaming token is included in this record.

## Project rename and performance review — 8 November 2026

The project is now Vivaldi Fullscreen Stay. The repository, package name, extension title, companion CSS and release archive use that name. The extension identity key, ID, version 2.0.0, permissions and message schema are unchanged.

The active observer now watches the player's ancestor chain with `childList` only. It checks disconnection or a closed popover and can refresh the watched chain after a DOM move. Same-document navigation clears the view through an event handler. The code adds no polling or background timer. Policy checks reject timers, animation loops, computed object keys and broad subtree observers in production code.

Validation passes 35 unit/policy/packaging tests and 16 Chromium browser tests. Added behaviour checks cover removal of a player ancestor and same-document navigation to a private X route. Secret and dependency scans are clear. The [performance report](performance.md) records controlled CPU measurements: the revised helper had zero observer callbacks during 54,020 unrelated DOM updates and sent no state messages during the measured steady playback. CPU ranges overlapped the baseline. Battery discharge and battery runtime were not measured because the Mac was connected to power.
