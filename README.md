# YouTube Fullscreen Stay

Keep Vivaldi in macOS fullscreen when you leave a fullscreen YouTube video.

This workaround expands the existing YouTube player inside the browser window. A companion Vivaldi appearance rule lets it cover the browser controls. It avoids the native video fullscreen transition that can also take Vivaldi out of macOS fullscreen.

**Install both parts.** The extension alone fills the tab and leaves Vivaldi's bars visible. This is a source release for manual installation. It is not a Chrome Web Store listing or a Vivaldi vendor patch.

## Install

1. Download the ZIP from [Releases](https://github.com/blessedmadukoma/youtube-fullscreen-stay/releases/latest). Extract it to a permanent folder. Keep that folder after installation.
2. Open `vivaldi://extensions/`. Enable **Developer mode**, select **Load unpacked**, and choose the extracted `extension` folder.
3. Open `vivaldi://experiments/` and enable **Allow CSS modifications** if needed to expose the appearance setting.
4. Open **Settings → Appearance → Custom UI Modifications**. Select the extracted `vivaldi-ui` folder. If you already use a custom CSS folder, copy `youtube-fullscreen.css` into that folder instead.
5. Restart Vivaldi. Refresh YouTube tabs that were already open.

These changes affect the current Vivaldi profile. They do not edit Vivaldi's application files.

## Use

Put Vivaldi in macOS fullscreen first, using **Control + Command + F** or the green window button. Open a video on `https://www.youtube.com/`.

- **F** expands the video. **F** or **Esc** returns to the page while keeping the browser in macOS fullscreen.
- The player's fullscreen button and a double-click on the video also toggle the expanded view.
- **T** or the theatre button leaves the expanded view and passes the original action to YouTube.
- Entering fullscreen from theatre view and leaving with F or Esc preserves YouTube's existing theatre state.

If the browser is windowed, the video fills that window. The extension does not put the window into macOS fullscreen.

## Privacy and access

The content script runs only on `https://www.youtube.com/*`. The browser's site-access notice applies: it can read and change YouTube pages. The code uses this access for the player layout, temporary page-title prefix and keyboard controls.

The extension has no background worker, network requests, analytics, remote code, data storage or polling timers. YouTube itself continues to make its normal network requests.

## Limits and verification

Version **1.0.2** was checked on **Vivaldi 8.3.4191.30, macOS 26.7.2, Apple silicon**. The user confirmed stable fullscreen playback and both transitions: **F → T** and **theatre → F → Esc**. The YouTube queue was retained.

YouTube or Vivaldi layout changes can require an update. Embedded players, Shorts, other video sites and other browser versions have not been verified. The appearance rule depends on Vivaldi's interface selectors and a temporary title prefix. It keeps the tab bar in layout, because removing it caused a repeated show/hide cycle in the first local version.

The local checks use a mock page to check key handling and restoration. They do not replace testing in a real browser:

```sh
node tests/interaction.cjs
```

## Remove

1. Remove **YouTube Fullscreen Stay** from `vivaldi://extensions/`.
2. Delete `youtube-fullscreen.css` from your custom CSS folder. Keep any unrelated CSS files.
3. Restart Vivaldi and refresh YouTube.

## Related Vivaldi issue

The original fault resembles **VB-76734**, which Vivaldi listed as fixed in March 2021. A user report from February 2021 describes the same loss of the browser's fullscreen Space. This does not establish that the current fault has the same cause. \[1\], \[2\]

## References

1. Vivaldi, [“Tab, menu and Speed Dial fixes — Vivaldi Browser snapshot 2218.3”](https://vivaldi.com/blog/desktop/tab-menu-and-speed-dial-fixes-vivaldi-browser-snapshot-2218-3/), 5 March 2021. Includes VB-76734.
2. r/vivaldibrowser, [“Moving out of fullscreen YouTube puts Vivaldi into a window”](https://www.reddit.com/r/vivaldibrowser/comments/luiibp/), 28 February 2021.

## Licence

MIT. See [LICENSE](LICENSE).
