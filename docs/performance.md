# Controlled performance measurements

Measured on 8 November 2026. The revised helper avoided callbacks from unrelated page updates. CPU ranges overlapped the baseline without the helper. These results do not establish a battery-runtime saving.

## Method

The test ran on Apple M5 Pro (darwin, arm64), connected to AC power. It used Chromium 158.0.8127.18 through Playwright 1.65.0. This is an isolated Chromium test on the Mac, not a measurement of the user’s running Vivaldi session.

Each configuration ran three 15-second samples in alternating forward/reverse order. Each sample used a new temporary profile and a 1.5-second warm-up. A local canvas supplied 640 × 360 video at 30 frames per second. The page made 20 unrelated text-node replacements per animation frame, approximately 1,200 DOM updates per second. All configurations used the same expanded-player geometry. No account, private stream or external media source was used.

The previous configuration used the content script from commit `f1b7c3d`, the preceding 2.0.0 build. The revised configuration observed direct changes to the player’s ancestors, without extending observation to their subtrees. \[3\] A temporary test-only counter recorded observer callbacks and state messages; it is absent from the release.

Browser CPU is the change in process CPU time, divided by elapsed time. 100% represents one fully used CPU core. Page task/script time comes from Chromium performance counters. Measurements include runtime and rendering variation. \[1\], \[2\]

## Results

| Configuration | Median browser CPU | CPU range | Median page task time | Median script time | Observer callbacks | State messages |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Without helper | 17.39% | 17.37–21.17% | 29.81 ms/s | 3.38 ms/s | 0 | 0 |
| Previous helper | 15.47% | 14.63–17.96% | 29.22 ms/s | 4.27 ms/s | 2701 | 0 |
| Revised helper | 15.62% | 14.53–20.52% | 27.89 ms/s | 3.23 ms/s | 0 | 0 |

Callback and message counts are totals across the three samples, approximately 45 seconds per configuration. The revised helper received zero observer callbacks during 54,020 unrelated DOM updates. It sent no state messages during that measurement interval. Entry and exit still send their required layout messages.

## Limits

Three short samples cannot separate small CPU differences from run-to-run variation. Separate browser launches, warm-up, concurrent work and the graphics workload affect the result. The generated stream is not a real HLS/DRM/network decoder workload. Content scripts share the renderer with the page, so the process totals do not attribute every CPU cycle to the helper.

The Mac was charging. Battery discharge, watts, wake-ups, codec-specific power, long-session memory growth and battery runtime were not measured. The absence of polling and the removal of these callbacks reduce unnecessary work; they do not establish zero energy cost.

## Reproduce

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run performance
```

Set `VFS_PERF_BASELINE` to an earlier content-script file to include that configuration. `VFS_PERF_SECONDS` controls sample length (5–60 seconds). `VFS_PERF_OUTPUT` selects the results file; the default is `dist/performance.json`. The test deletes its temporary profiles. Source checks reject production polling timers, animation loops and broad subtree observers.

## References

1. Chrome DevTools Protocol, [“SystemInfo.getProcessInfo”](https://chromedevtools.github.io/devtools-protocol/tot/SystemInfo/#method-getProcessInfo).
2. Chrome DevTools Protocol, [“Performance.getMetrics”](https://chromedevtools.github.io/devtools-protocol/tot/Performance/#method-getMetrics).
3. MDN, [“MutationObserver: observe()”](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe).
