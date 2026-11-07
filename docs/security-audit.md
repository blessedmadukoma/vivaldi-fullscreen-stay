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

The CSS tests model Vivaldi's protected interface structure. They are not a substitute for a live Vivaldi test after a browser UI update. YouTube itself makes network requests, and other installed extensions are outside this audit. Unpacked installations require the user to install updates manually.

## References

1. Chrome for Developers, [“Content scripts”](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
2. Chrome for Developers, [“Stay secure”](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure).
3. Playwright, [“Chrome extensions”](https://playwright.dev/docs/chrome-extensions).
4. GitHub, [“Workflow configuration options for code scanning”](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options).
