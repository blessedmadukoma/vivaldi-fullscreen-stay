(() => {
  "use strict";
  const youtube = location.origin === "https://www.youtube.com";
  const x = location.origin === "https://x.com";
  if (location.protocol !== "https:" && location.protocol !== "http:") return;
  const ROOT = "data-vfs-active";
  const PLAYER = "data-vfs-player";
  const swallowed = new Set();
  let saved = null;
  let hoveredPlayer = null;
  const containers = '.plyr, .video-js, .jwplayer, .mejs-container, .flowplayer, [data-testid="videoPlayer"], [data-testid="videoComponent"]';

  function privateXPage() {
    return x && /^\/(?:i\/(?:chat|calls|flow)|messages|settings|compose|account|login|logout|oauth)(?:\/|$)/.test(location.pathname);
  }

  function xPlayer(target) {
    if (!(target instanceof Element)) return null;
    const candidate = target.closest('[data-testid="videoPlayer"]') ?? target.closest('[data-testid="videoComponent"]');
    return candidate instanceof HTMLElement && candidate.querySelector("video") instanceof HTMLVideoElement ? candidate : null;
  }

  function playerFor(target, scan = false) {
    if (youtube) return document.querySelector("#movie_player");
    if (privateXPage()) return null;
    const player = (x ? xPlayer(target) : genericPlayer(target, scan)) ?? hoveredPlayer;
    if (!player?.isConnected) return null;
    const bounds = player.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.right > 0 && bounds.top < window.innerHeight && bounds.left < window.innerWidth ? player : null;
  }

  function genericPlayer(target, scan = false) {
    if (!(target instanceof Element)) return null;
    const known = target.closest(containers);
    if (known?.querySelector("video") instanceof HTMLVideoElement) return known;
    if (target instanceof HTMLVideoElement) return target;
    if (!scan) return null;
    // Select the nearest small container with one video, not a whole feed.
    let parent = target;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      if (parent.querySelectorAll("video").length === 1) return parent;
      parent = parent.parentElement;
    }
    return null;
  }

  function fullscreenButton(target) {
    if (!(target instanceof Element)) return null;
    if (youtube) return target.closest("#movie_player .ytp-fullscreen-button");
    const button = target.closest('button, [role="button"]');
    if (!button || !(x ? xPlayer(button) : genericPlayer(button, true))) return null;
    if (!x && button.matches('.plyr__control[data-plyr="fullscreen"], .vjs-fullscreen-control, .jw-icon-fullscreen, .mejs-fullscreen-button button')) return button;
    const label = button.getAttribute("aria-label") ?? button.getAttribute("title") ?? "";
    return /^(?:(?:enter|exit|toggle)(?: video)?\s+)?full\s*screen(?: mode)?(?:\s*\(f\))?$/i.test(label) ? button : null;
  }

  function editing(target) {
    return target instanceof Element && Boolean(target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
    ));
  }

  function signal(expanded) {
    const state = saved;
    let request;
    try {
      request = chrome.runtime.sendMessage({ type: "vfs:state", expanded, activation: expanded ? state.activation : "" });
    } catch {
      if (expanded && saved === state) exit(false);
      return;
    }
    request.then(result => {
      if (expanded && saved === state && result?.ok !== true) exit(false);
    }).catch(() => { if (expanded && saved === state) exit(false); });
  }

  function exit(notify = true) {
    if (!saved) return;
    const old = saved;
    saved = null;
    old.observer.disconnect();
    if (old.player.matches(":popover-open")) old.player.hidePopover();
    if (old.popover === null) old.player.removeAttribute("popover");
    else old.player.setAttribute("popover", old.popover);
    document.documentElement.removeAttribute(ROOT);
    old.player.removeAttribute(PLAYER);
    if (old.button?.isConnected) {
      if (old.ariaLabel === null) old.button.removeAttribute("aria-label");
      else old.button.setAttribute("aria-label", old.ariaLabel);
      if (old.title === null) old.button.removeAttribute("title");
      else old.button.setAttribute("title", old.title);
      if (old.tooltip === null) old.button.removeAttribute("data-title-no-tooltip");
      else old.button.setAttribute("data-title-no-tooltip", old.tooltip);
    }
    window.scrollTo(old.scrollX, old.scrollY);
    if (notify) signal(false);
  }

  function enter(player, control, activation = null) {
    if (!(player instanceof HTMLElement) || document.fullscreenElement) return false;
    if (activation === null && !(player instanceof HTMLVideoElement) && !(player.querySelector("video") instanceof HTMLVideoElement)) return false;
    if (activation !== null && !(player instanceof HTMLIFrameElement)) return false;
    if (typeof player.showPopover !== "function" || player.matches(":popover-open")) return false;
    const button = control ?? (youtube ? player.querySelector(".ytp-fullscreen-button") : null);
    const observer = new MutationObserver(() => { if (!player.isConnected || privateXPage()) exit(); });
    saved = {
      player, button, observer, activation: activation ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join(""), popover: player.getAttribute("popover"),
      scrollX: window.scrollX, scrollY: window.scrollY,
      ariaLabel: button?.getAttribute("aria-label") ?? null,
      title: button?.getAttribute("title") ?? null,
      tooltip: button?.getAttribute("data-title-no-tooltip") ?? null
    };
    player.setAttribute("data-vfs-player", "");
    document.documentElement.setAttribute("data-vfs-active", "");
    player.setAttribute("popover", "manual");
    try {
      player.showPopover();
    } catch {
      exit(false);
      return false;
    }
    if (button) {
      button.setAttribute("aria-label", "Exit video fullscreen (f)");
      button.setAttribute("title", "Exit video fullscreen (f)");
      button.setAttribute("data-title-no-tooltip", "Exit video fullscreen");
    }
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (activation === null) signal(true);
    return true;
  }

  function toggle(player, control) {
    if (saved) { exit(); return true; }
    return enter(player, control);
  }

  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  window.addEventListener("keydown", event => {
    if (!event.isTrusted) return;
    if (privateXPage()) { exit(); return; }
    const key = event.key.toLowerCase();
    if (event.repeat && swallowed.has(key)) {
      consume(event);
      return;
    }
    if (key === "escape" && saved) {
      swallowed.add(key);
      consume(event);
      if (!event.repeat) exit();
      return;
    }
    if (youtube && key === "t" && saved && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !editing(event.target)) {
      // Let YouTube receive the original trusted event after restoring its layout.
      if (!event.repeat) exit();
      return;
    }
    if (key !== "f" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || editing(event.target)) return;
    if (event.repeat) {
      if (swallowed.has(key)) consume(event);
      return;
    }
    if (toggle(playerFor(event.target))) {
      swallowed.add(key);
      consume(event);
    }
  }, true);

  window.addEventListener("keyup", event => {
    if (!event.isTrusted) return;
    const key = event.key.toLowerCase();
    if (swallowed.delete(key)) consume(event);
  }, true);

  window.addEventListener("click", event => {
    if (!event.isTrusted) return;
    if (privateXPage()) { exit(); return; }
    if (event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (youtube && saved && event.target instanceof Element && event.target.closest("#movie_player .ytp-size-button")) {
      exit();
      return;
    }
    const button = fullscreenButton(event.target);
    if (button && toggle(playerFor(button, true), button)) consume(event);
  }, true);

  window.addEventListener("dblclick", event => {
    if (!event.isTrusted) return;
    if (privateXPage()) { exit(); return; }
    if (event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof Element)) return;
    if (youtube && !event.target.matches("#movie_player video, #movie_player .html5-video-container")) return;
    if (!youtube && event.target.closest('button, [role="button"], [role="slider"], input, textarea, a')) return;
    if (toggle(playerFor(event.target))) consume(event);
  }, true);

  window.addEventListener("blur", () => swallowed.clear());
  window.addEventListener("pagehide", () => exit());
  window.addEventListener("yt-navigate-start", () => exit(), true);
  if (!youtube) {
    window.addEventListener("pointerover", event => {
      if (!event.isTrusted) return;
      hoveredPlayer = privateXPage() ? null : (x ? xPlayer(event.target) : genericPlayer(event.target));
    }, true);
    window.addEventListener("popstate", () => exit());
  }
  // Only the extension worker can relay expansion to focused ancestor frames.
  // No page postMessage bridge, frame URL or page content is used.
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id || sender.tab || !message || typeof message !== "object" || Array.isArray(message) || Object.keys(message).length !== 3) return;
    if (message.type !== "vfs:relay" || typeof message.expanded !== "boolean" || typeof message.activation !== "string") return;
    if (!message.expanded) { if (message.activation === "") exit(false); return; }
    if (!/^[a-f0-9]{32}$/.test(message.activation) || saved?.activation === message.activation || privateXPage()) return;
    const frame = document.activeElement;
    if (!document.hasFocus() || !(frame instanceof HTMLIFrameElement)) return;
    const bounds = frame.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0 || bounds.bottom <= 0 || bounds.right <= 0 || bounds.top >= window.innerHeight || bounds.left >= window.innerWidth) return;
    exit(false);
    enter(frame, null, message.activation);
  });
})();
