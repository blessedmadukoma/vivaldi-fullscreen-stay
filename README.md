# Fullscreen Stay

Keep Vivaldi in macOS fullscreen when you leave an HTML video player, including embedded streams.

This workaround expands the existing player inside the browser window. A companion Vivaldi appearance rule lets it cover the browser controls. It avoids the native video fullscreen transition that can also take Vivaldi out of macOS fullscreen.

**Install both parts.** The extension alone fills the tab and leaves Vivaldi's bars visible. This is a source release for manual installation. It is not a Chrome Web Store listing or a Vivaldi vendor patch.

## Install

1. Download the ZIP from [Releases](https://github.com/blessedmadukoma/youtube-fullscreen-stay/releases/latest). Extract it to a permanent folder. Keep that folder after installation.
2. Disable or remove any older YouTube Fullscreen Stay installation. Open `vivaldi://extensions/`, enable **Developer mode**, select **Load unpacked**, and choose the extracted `extension` folder.
3. Keep **Fullscreen Stay** visible in Vivaldi’s extensions toolbar. In **Settings → Address Bar**, choose **Toggle Only Hidden Extensions** instead of **Toggle All Extensions**. If needed, right-click this helper and select **Show Button**. Other extension buttons can use **Hide Button**. The protected badge needs this helper to remain visible; otherwise the video can fill the tab while browser bars remain visible.
4. Open `vivaldi://experiments/` and enable **Allow CSS modifications** if needed to expose the appearance setting.
5. Open **Settings → Appearance → Custom UI Modifications**. Select the extracted `vivaldi-ui` folder. If you already use a custom CSS folder, copy `youtube-fullscreen.css` into that folder instead.
6. Restart Vivaldi. Refresh video tabs that were already open.

These changes affect the current Vivaldi profile. They do not edit Vivaldi's application files.

## Use

Put Vivaldi in macOS fullscreen first, using **Control + Command + F** or the green window button. Open a video on an HTTP or HTTPS page.

- On YouTube, **F** expands the video. On other sites, focus or hover the video and press **F**, or double-click its video area. **F** or **Esc** restores the page while keeping the browser in macOS fullscreen.
- Recognised fullscreen buttons also toggle the expanded view. The shared handler recognises common Plyr, Video.js, JW Player and MediaElement controls, plus labelled fullscreen buttons beside a video. Use F or double-click if a site's button is not recognised.
- For embedded streams, the helper expands the video and its focused parent frames. It does not reload or move the video element.
- On YouTube, **T** or the theatre button leaves the expanded view and passes the original action to YouTube.
- Entering fullscreen from theatre view and leaving with F or Esc preserves YouTube's existing theatre state.

If the browser is windowed, the video fills that window. The extension does not put the window into macOS fullscreen.

## Privacy and access

Version 2.0.0 runs on HTTP and HTTPS pages and their matching frames. This is broader access than the YouTube/X-only release: the browser can allow it to read and change pages across all websites, including signed-in pages. Review this permission before installing. The code uses DOM access for player layout, control labels and the focused iframe. It does not read or transmit messages, form contents, cookies or account tokens. Known X chat, calls, account, settings and compose routes remain inactive; these guards do not reduce the granted permission.

The extension sends no network requests, analytics or remote code and stores no data. Its event-driven worker validates state messages, relays layout state within the same tab and updates its own toolbar badge. Messages contain a boolean and a random activation ID; they contain no page content or requested URL. There is no polling or keep-alive timer. Streaming sites continue to make their normal requests. See [SECURITY.md](SECURITY.md) for the threat model and limits.

## Limits and verification

Version **1.0.2** was checked on **Vivaldi 8.3.4191.30, macOS 26.7.2, Apple silicon**. The user confirmed stable fullscreen playback and both transitions: **F → T** and **theatre → F → Esc**. The YouTube queue was retained.

YouTube, X and Vivaldi layout changes can require an update. X support was checked live in Vivaldi 8.3.4191.30. The general handler passes isolated tests for ordinary players and nested cross-origin frames. Live streaming validation is pending before release. This does not establish support for every player. Browser-internal pages, local files, opaque/sandboxed frames, closed shadow DOM and unrecognised controls can remain unsupported. No DRM or site security control is bypassed.

The appearance rule requires this extension's protected badge and an active HTTP(S) webview. A page title cannot activate it. It depends on Vivaldi's interface selectors and keeps the tab bar in layout to avoid a repeated show/hide cycle.

For development, clone this repository; the installation ZIP contains the runtime files and documentation. Unit tests use mock pages, and browser tests run the extension in isolated Chromium profiles. The hardened helper was also tested live in Vivaldi 8.3.4191.30: F, Esc and theatre transitions retained native Mac fullscreen. Run the checks with:

```sh
npm ci --ignore-scripts
npm run check
npm test
npx playwright install chromium
npm run test:browser
npm run secrets
npm audit --audit-level=moderate
```

For local pre-commit checks, run `git config core.hooksPath .githooks`. The repository also provides `.pre-commit-config.yaml` for users of the pre-commit framework. These checks inspect the staged diff for secrets and the full working tree for code policy and tests. CI checks committed content independently.

Read the [security audit](docs/security-audit.md) before relying on the extension. Version 1.0.2 is superseded because its title-based appearance rule could be spoofed.

## Remove

1. Remove **Fullscreen Stay** from `vivaldi://extensions/`.
2. Delete `youtube-fullscreen.css` from your custom CSS folder. Keep any unrelated CSS files.
3. Restart Vivaldi and refresh video tabs.

## Related Vivaldi issue

Reported to Vivaldi as **VB-133154** on **7 November 2026**, with reproduction steps and this workaround attached. The report describes a possible regression; Vivaldi has not confirmed its cause.

The original fault resembles **VB-76734**, which Vivaldi listed as fixed in March 2021. A user report from February 2021 describes the same loss of the browser's fullscreen Space. This does not establish that the current fault has the same cause. \[1\], \[2\]

## References

1. Vivaldi, [“Tab, menu and Speed Dial fixes — Vivaldi Browser snapshot 2218.3”](https://vivaldi.com/blog/desktop/tab-menu-and-speed-dial-fixes-vivaldi-browser-snapshot-2218-3/), 5 March 2021. Includes VB-76734.
2. r/vivaldibrowser, [“Moving out of fullscreen YouTube puts Vivaldi into a window”](https://www.reddit.com/r/vivaldibrowser/comments/luiibp/), 28 February 2021.

## Licence

MIT. See [LICENSE](LICENSE).
