# Possible regression of VB-76734 in Vivaldi 8.3

Submitted to Vivaldi as **VB-133154** on **7 November 2026**. Vivaldi accepted the report; this does not mean that it has confirmed the regression or its cause.

Leaving a fullscreen YouTube video also takes the Vivaldi window out of native macOS fullscreen.

## Steps to reproduce

1. Use Vivaldi 8.3.4191.30 on macOS. Disable YouTube Fullscreen Stay and remove its companion appearance rule before testing the browser fault.
2. Put the Vivaldi window into native macOS fullscreen using the green window button or Control + Command + F. The browser should already occupy its own fullscreen Space.
3. Open a YouTube video, for example `https://www.youtube.com/watch?v=q3U-KYNzCGM`.
4. Give the player keyboard focus and press F to enter video fullscreen.
5. Press F again to leave video fullscreen.
6. Repeat steps 2–4, then use Esc to leave video fullscreen.

Expected: only the video leaves fullscreen. Vivaldi stays in the same macOS fullscreen Space with its normal browser controls restored.

Actual: the Vivaldi window also leaves macOS fullscreen and returns to a window on the desktop. Both F and Esc produce the problem.

## Evidence and limits

The fault was observed before the custom workaround was installed. Turning off fullscreen auto-hide did not resolve it. Enabling Use Native Window and restarting did not resolve it. Those settings were restored.

The original fault has not been retested in a clean profile, and there is no controlled comparison with 8.2. This is a possible recurrence or regression, rather than a confirmed common cause with the earlier issue.

Vivaldi's March 2021 changelog lists VB-76734 as fixed. A February 2021 user report describes the same behaviour. \[1\], \[2\]

The workaround in this repository avoids the native video fullscreen transition. It is not evidence that Vivaldi's underlying fault is fixed.

## Scope update — 8 November 2026

The reporter also observes the same browser-fullscreen exit on X.com (formerly Twitter) and while streaming. These are user-reported observations, not an independent confirmation that all players share one cause. The installed 1.1.0 workaround applies only to YouTube, so it cannot prevent the original browser fault on those other sites.

An additional public X example is `https://x.com/SpaceX/status/2118870818021097862`. To test, put Vivaldi into native Mac fullscreen first, use the player’s fullscreen button, then leave video fullscreen with Esc or that button. The expected result is that Vivaldi stays in its Mac fullscreen Space. Record whether the whole browser leaves it.

The 1.2.0 workaround was checked on that public video in Vivaldi 8.3.4191.30. The fullscreen button and double-click expanded the player. Playback stayed expanded, and F and Esc restored the page while retaining native Mac fullscreen. This tests the workaround, not the browser fault with the workaround disabled. No private account pages or streaming-session links are included in this report. This repository update has not been sent as a follow-up to ticket VB-133154.

## References

1. Vivaldi, [“Tab, menu and Speed Dial fixes — Vivaldi Browser snapshot 2218.3”](https://vivaldi.com/blog/desktop/tab-menu-and-speed-dial-fixes-vivaldi-browser-snapshot-2218-3/), 5 March 2021.
2. r/vivaldibrowser, [“Moving out of fullscreen YouTube puts Vivaldi into a window”](https://www.reddit.com/r/vivaldibrowser/comments/luiibp/), 28 February 2021.
