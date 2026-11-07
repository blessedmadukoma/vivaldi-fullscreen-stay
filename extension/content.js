(() => {
  "use strict";
  if (location.origin !== "https://www.youtube.com" || window.top !== window) return;
  const ROOT = "data-vfs-active";
  const PLAYER = "data-vfs-player";
  const swallowed = new Set();
  let saved = null;

  function editing(target) {
    return target instanceof Element && Boolean(target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
    ));
  }

  function signal(expanded) {
    const state = saved;
    chrome.runtime.sendMessage({ type: "vfs:state", expanded }).then(result => {
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

  function enter() {
    const player = document.querySelector("#movie_player");
    if (!(player instanceof HTMLElement) || !(player.querySelector("video") instanceof HTMLVideoElement) || document.fullscreenElement) return false;
    if (typeof player.showPopover !== "function" || player.matches(":popover-open")) return false;
    const button = player.querySelector(".ytp-fullscreen-button");
    const observer = new MutationObserver(() => { if (!player.isConnected) exit(); });
    saved = {
      player, button, observer, popover: player.getAttribute("popover"),
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
    signal(true);
    return true;
  }

  function toggle() {
    if (saved) { exit(); return true; }
    return enter();
  }

  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  window.addEventListener("keydown", event => {
    if (!event.isTrusted) return;
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
    if (key === "t" && saved && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !editing(event.target)) {
      // Let YouTube receive the original trusted event after restoring its layout.
      if (!event.repeat) exit();
      return;
    }
    if (key !== "f" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || editing(event.target)) return;
    if (event.repeat) {
      if (swallowed.has(key)) consume(event);
      return;
    }
    if (toggle()) {
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
    if (event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (saved && event.target instanceof Element && event.target.closest("#movie_player .ytp-size-button")) {
      exit();
      return;
    }
    if (!(event.target instanceof Element) || !event.target.closest("#movie_player .ytp-fullscreen-button")) return;
    if (toggle()) consume(event);
  }, true);

  window.addEventListener("dblclick", event => {
    if (!event.isTrusted) return;
    if (event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof Element) || !event.target.matches("#movie_player video, #movie_player .html5-video-container")) return;
    if (toggle()) consume(event);
  }, true);

  window.addEventListener("blur", () => swallowed.clear());
  window.addEventListener("pagehide", () => exit());
  window.addEventListener("yt-navigate-start", () => exit(), true);
  // Reset stale state without sending page content or account data.
  signal(false);
})();
